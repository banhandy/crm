const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Supabase_url;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.Supabase_Key;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase configuration missing! Check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to convert Excel date serial number or strings to ISO format
function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') {
    // Excel base date: Dec 30, 1899 due to leap year bug in Lotus 1-2-3
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString();
  }
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}

async function run() {
  try {
    console.log("Reading Excel file...");
    const workbook = xlsx.readFile('./doc/inquiry list.xlsx');
    
    // ==========================================
    // 1. MIGRATE CUSTOMER CONTACTS
    // ==========================================
    console.log("\n--- Migrating Customer Contacts ---");
    const contactsSheet = workbook.Sheets['Customer Contact'];
    if (!contactsSheet) {
      throw new Error("Could not find 'Customer Contact' sheet in the Excel file!");
    }
    
    const contactsData = xlsx.utils.sheet_to_json(contactsSheet);
    console.log(`Found ${contactsData.length} records in 'Customer Contact'.`);
    
    const customerMap = new Map(); // Maps company name to customer ID
    
    for (const row of contactsData) {
      const companyName = row['Company'] ? String(row['Company']).trim() : null;
      if (!companyName) continue;
      
      const lastContact = parseExcelDate(row['Last Contact']);
      const nextContact = parseExcelDate(row['Next Contact']);
      
      const payload = {
        company_name: companyName,
        sector_business: row['Sector Bussiness'] ? String(row['Sector Bussiness']).trim() : null,
        regional: row['Regional'] ? String(row['Regional']).trim() : null,
        address: row['Company Address'] ? String(row['Company Address']).trim() : null,
        email_address: row['Email Address'] ? String(row['Email Address']).trim() : null,
        pic_name: row['PIC'] ? String(row['PIC']).trim().toUpperCase() : 'AFIF NI',
        last_contact_date: lastContact,
        next_contact_date: nextContact,
        status_email: row['Status Email'] ? String(row['Status Email']).trim() : 'Active'
      };
      
      console.log(`Saving Customer: "${companyName}"...`);
      const { data, error } = await supabase
        .from('customers')
        .upsert([payload], { onConflict: 'company_name' })
        .select();
        
      if (error) {
        console.error(`Error saving customer ${companyName}:`, error.message);
      } else if (data && data[0]) {
        customerMap.set(companyName.toUpperCase(), data[0].id);
      }
    }
    
    console.log(`Completed Customer migration. Cached ${customerMap.size} customer IDs.`);
    
    // ==========================================
    // 2. MIGRATE INQUIRIES FROM MULTIPLE SHEETS
    // ==========================================
    const sheetsToMigrate = [
      { name: 'New Quotation', category: 'standard', defaultStatus: 'Pending Quotation' },
      { name: 'TVB quotation', category: 'tvb', defaultStatus: 'Quotation Sent' },
      { name: 'New Order (PO)', category: 'standard', defaultStatus: 'PO Won' },
      { name: 'Canceled Inquiry', category: 'standard', defaultStatus: 'Canceled' }
    ];
    
    let totalInquiriesCreated = 0;
    
    for (const config of sheetsToMigrate) {
      console.log(`\n--- Migrating Sheet: "${config.name}" ---`);
      const sheet = workbook.Sheets[config.name];
      if (!sheet) {
        console.warn(`Sheet "${config.name}" not found in Excel. Skipping.`);
        continue;
      }
      
      const rows = xlsx.utils.sheet_to_json(sheet);
      console.log(`Found ${rows.length} records in "${config.name}".`);
      
      for (const row of rows) {
        const companyName = row['Customer'] ? String(row['Customer']).trim() : null;
        if (!companyName) continue;
        
        // Find product / item name checking various Excel column mappings
        let itemName = row['Item Name'] || row['Product Name'] || row['NAMA PRODUK'] || row['PRODUCT NAME'] || row['Product'] || row['TASK'] || null;
        if (!itemName) continue; // Skip if no item details
        itemName = String(itemName).trim();
        
        // Resolve Customer ID
        let customerId = customerMap.get(companyName.toUpperCase());
        if (!customerId) {
          // If customer is not in Customer Contacts, register them automatically
          console.log(`Customer "${companyName}" not found in Contacts directory. Auto-registering...`);
          const { data, error } = await supabase
            .from('customers')
            .insert([{ company_name: companyName, pic_name: 'AFIF NI' }])
            .select();
          
          if (error) {
            console.error(`Auto-registration failed for customer "${companyName}":`, error.message);
            continue; // Skip inquiry if customer registration fails
          }
          if (data && data[0]) {
            customerId = data[0].id;
            customerMap.set(companyName.toUpperCase(), customerId);
          }
        }
        
        const inquiryDate = parseExcelDate(row['Inquiry Date']) || new Date().toISOString();
        const quotationDate = parseExcelDate(row['Quotation Date']);
        const leadTimeDays = row['Lead Time (Working Days)'] ? parseInt(row['Lead Time (Working Days)']) : null;
        const quotationNumber = row['Quotation #'] || row['Quotation No'] || null;
        const poNumber = row['No. Po'] || row['No. PO'] || null;
        const orderReview = row['Order Review'] || null;
        const remark = row['Remark'] || row['UPDATE'] || row['NOTE'] || '';
        
        // Final Status mapping: if the sheet has a specific Status column, use it; otherwise use the config's default
        const status = row['Status'] || config.defaultStatus;
        
        const payload = {
          customer_id: customerId,
          category: config.category,
          inquiry_date: inquiryDate.substring(0, 10), // Date format YYYY-MM-DD
          quotation_date: quotationDate ? quotationDate.substring(0, 10) : null,
          quotation_number: quotationNumber ? String(quotationNumber).trim() : null,
          lead_time_days: leadTimeDays,
          item_name: itemName,
          po_number: poNumber ? String(poNumber).trim() : null,
          order_review: orderReview ? String(orderReview).trim() : null,
          remark: remark ? String(remark).trim() : null,
          status: status,
          last_activity_at: new Date().toISOString()
        };
        
        console.log(`Saving Inquiry: "${companyName}" - "${itemName.substring(0, 30)}..."`);
        const { error } = await supabase
          .from('inquiries')
          .insert([payload]);
          
        if (error) {
          console.error(`Error inserting inquiry for "${companyName}":`, error.message);
        } else {
          totalInquiriesCreated++;
        }
      }
    }
    
    console.log(`\n🎉 SUCCESS! Excel Data Migration Complete!`);
    console.log(`Successfully migrated ${customerMap.size} Customers and ${totalInquiriesCreated} Inquiries.`);
    process.exit(0);
  } catch (err) {
    console.error("Migration Fatal Error:", err.message);
    process.exit(1);
  }
}

run();
