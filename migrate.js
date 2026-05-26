/**
 * migrate.js — Full Excel-to-Supabase Migration
 * 
 * Data structure in Excel:
 *   Each INQUIRY occupies the first row (with Customer, Inquiry Date, etc.)
 *   followed by sub-rows for each LINE ITEM (only item name, qty, price etc.)
 * 
 * Migration strategy:
 *   1. Parse Excel sheets, grouping rows into (inquiry + items)
 *   2. Upsert customers from Customer Contact sheet
 *   3. Insert inquiries (one per inquiry group)
 *   4. Insert inquiry_items (one per line item)
 */

const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Supabase_url;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.Supabase_Key;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase configuration missing! Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================================
// Helpers
// =============================================================

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().substring(0, 10);
  if (typeof val === 'number') {
    // Excel serial date: base is Dec 30, 1899
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (d.getFullYear() < 1900 || d.getFullYear() > 2100) return null;
    return d.toISOString().substring(0, 10);
  }
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) return new Date(parsed).toISOString().substring(0, 10);
  return null;
}

function cleanStr(val) {
  if (!val) return null;
  return String(val).trim().replace(/\s+/g, ' ') || null;
}

function toInt(val) {
  if (!val) return null;
  const n = parseInt(String(val).replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
}

function toNum(val) {
  if (!val) return null;
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

// Map Excel Tipe Proses → our category
function mapCategory(tipeProses, process_, itemName) {
  const t = String(tipeProses || '').toLowerCase();
  const p = String(process_ || '').toLowerCase();
  const i = String(itemName || '').toLowerCase();

  if (t.includes('investment') || t.includes('invest') || t.includes('wax') || p.includes('invest')) return 'investment';
  if (t.includes('sand') || t.includes('casting') || p.includes('sand')) return 'sand casting';
  if (t.includes('fabrication') || t.includes('fab') || p.includes('fabrication') || p.includes('fab')) return 'fabrication';
  if (t.includes('forg') || p.includes('forg')) return 'forging';

  // Fallback: guess from item name
  if (i.includes('jig') || i.includes('fixture') || i.includes('klem') || i.includes('bracket') || i.includes('plate')) return 'fabrication';
  if (i.includes('disc') || i.includes('casing') || i.includes('pump') || i.includes('flange') || i.includes('ring') || i.includes('body')) return 'sand casting';
  if (i.includes('invest') || i.includes('wax')) return 'investment';
  if (i.includes('forg')) return 'forging';

  return 'others';
}

// Normalize status from Excel to our allowed values
function mapStatus(rawStatus, sheetDefault) {
  if (!rawStatus) return sheetDefault;
  const s = String(rawStatus).toLowerCase().trim();
  if (s.includes('cancel') || s.includes('batal')) return 'Canceled';
  if (s.includes('po') || s.includes('order') || s.includes('won') || s === 'new po') return 'PO Won';
  if (s.includes('submit') || s.includes('sent') || s.includes('quotation sent')) return 'Submitted';
  if (s.includes('follow')) return 'Follow Up';
  if (s.includes('pending')) return 'Pending Quotation';
  if (s.includes('estimation')) return 'Pending Quotation';
  return sheetDefault;
}

// Internal PIC team
const TEAM = ['AFIF NI', 'PUTRI', 'ERVAN', 'NOVY', 'RANU', 'AFIF'];
function extractInternalPic(rawPic) {
  if (!rawPic) return 'AFIF NI';
  const upper = String(rawPic).toUpperCase();
  const found = TEAM.find(m => upper.includes(m));
  if (found) return found === 'AFIF' ? 'AFIF NI' : found;
  return 'AFIF NI';
}

// =============================================================
// Parse Excel sheet into [{inquiry, items}] groups
// =============================================================
function parseSheetIntoGroups(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.warn(`  ⚠️  Sheet "${sheetName}" not found, skipping.`);
    return [];
  }

  // Read raw rows
  const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Find header row (first row with >= 4 non-null values)
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < allRows.length; i++) {
    const nonNull = allRows[i].filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (nonNull.length >= 4) {
      headers = allRows[i].map(h => (h ? String(h).trim() : null));
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    console.warn(`  ⚠️  Could not find header row in "${sheetName}".`);
    return [];
  }

  // Helper to get a value by column header name (case-insensitive)
  function col(row, ...names) {
    for (const name of names) {
      for (let i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toLowerCase() === name.toLowerCase()) {
          if (row[i] !== null && row[i] !== undefined && String(row[i]).trim() !== '') {
            return row[i];
          }
        }
      }
    }
    return null;
  }

  const groups = [];
  let currentGroup = null;

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    const customer = cleanStr(col(row, 'Customer'));
    const itemName = cleanStr(col(row, 'Item Name'));

    // A new inquiry group starts when Customer cell is non-empty
    if (customer) {
      // Save previous group
      if (currentGroup) groups.push(currentGroup);

      const inquiryDate = parseExcelDate(col(row, 'Inquiry Date'));
      const quotationDate = parseExcelDate(col(row, 'Quotation Date'));
      const followUpDate = parseExcelDate(col(row, 'Follow Up'));

      currentGroup = {
        customer,
        inquiry: {
          inquiry_date: inquiryDate || new Date().toISOString().substring(0, 10),
          quotation_date: quotationDate,
          follow_up_date: followUpDate,
          quotation_number: cleanStr(col(row, 'Quotation #', 'Quotation No')),
          lead_time_days: toInt(col(row, 'Lead Time (Working Days)')),
          status: cleanStr(col(row, 'Status')),
          po_number: cleanStr(col(row, 'No. Po', 'No. PO')),
          order_review: cleanStr(col(row, 'Order Review')),
          currency: cleanStr(col(row, 'Currency')),
          remark: cleanStr(col(row, 'Remark', 'UPDATE', 'NOTE')),
        },
        items: []
      };

      // Also collect the item from this same row (if any)
      if (itemName) {
        currentGroup.items.push({
          item_name: itemName,
          material: cleanStr(col(row, 'Material')),
          process: cleanStr(col(row, 'Process')),
          tipe_proses: cleanStr(col(row, 'Tipe Proses')),
          qty: toInt(col(row, 'Qty')),
          cast_price: toNum(col(row, 'Cast Price')),
          mach_price: toNum(col(row, 'Mach Price')),
          surface_treatment: toNum(col(row, 'Surface Treatment')),
          packing_cost: toNum(col(row, 'Packing Cost')),
          cfr: toNum(col(row, 'CFR')),
          total_price_per_qty: toNum(col(row, 'Total Price / QTY')),
          total_price: toNum(col(row, 'Total Price')),
          tooling_cost: toNum(col(row, 'Tooling cost & M/C fixture')),
        });
      }

    } else if (currentGroup && itemName) {
      // Sub-row: additional item under current inquiry
      currentGroup.items.push({
        item_name: itemName,
        material: cleanStr(col(row, 'Material')),
        process: cleanStr(col(row, 'Process')),
        tipe_proses: cleanStr(col(row, 'Tipe Proses')),
        qty: toInt(col(row, 'Qty')),
        cast_price: toNum(col(row, 'Cast Price')),
        mach_price: toNum(col(row, 'Mach Price')),
        surface_treatment: toNum(col(row, 'Surface Treatment')),
        packing_cost: toNum(col(row, 'Packing Cost')),
        cfr: toNum(col(row, 'CFR')),
        total_price_per_qty: toNum(col(row, 'Total Price / QTY')),
        total_price: toNum(col(row, 'Total Price')),
        tooling_cost: toNum(col(row, 'Tooling cost & M/C fixture')),
      });
    }
    // else: blank row or unrecognized, skip
  }

  // Push last group
  if (currentGroup) groups.push(currentGroup);

  return groups;
}

// =============================================================
// MAIN MIGRATION
// =============================================================
async function run() {
  try {
    console.log('📂 Reading Excel file...');
    const workbook = xlsx.readFile('./doc/inquiry list.xlsx');
    console.log('✅ Excel loaded. Sheets:', workbook.SheetNames.join(', '));

    // ----------------------------------------------------------
    // STEP 1: Migrate Customers from Customer Contact sheet
    // ----------------------------------------------------------
    console.log('\n=== Step 1: Migrating Customer Contacts ===');
    const contactSheet = workbook.Sheets['Customer Contact'];
    if (!contactSheet) throw new Error('Sheet "Customer Contact" not found!');

    const contactRows = xlsx.utils.sheet_to_json(contactSheet, { defval: null });
    console.log(`  Found ${contactRows.length} rows in Customer Contact.`);

    const customerMap = new Map(); // companyName (uppercase) → UUID

    for (const row of contactRows) {
      const companyName = cleanStr(row['Company']);
      if (!companyName) continue;

      const rawPic = cleanStr(row['PIC']);
      const internalPic = extractInternalPic(rawPic);
      // If PIC looks like a customer contact person (has phone, or is very long), store separately
      const hasPhone = rawPic && /[\d+()]{4,}/.test(rawPic);
      const isLong = rawPic && rawPic.length > 15;
      const clientContact = (hasPhone || isLong) ? rawPic : null;

      const payload = {
        company_name: companyName,
        sector_business: cleanStr(row['Sector Bussiness']),
        regional: cleanStr(row['Regional']),
        address: cleanStr(row['Company Address']),
        email_address: cleanStr(row['Email Address']),
        client_contact_person: clientContact,
        pic_name: internalPic,
        last_contact_date: row['Last Contact'] ? new Date(parseExcelDate(row['Last Contact'])).toISOString() : null,
        next_contact_date: row['Next Contact'] ? new Date(parseExcelDate(row['Next Contact'])).toISOString() : null,
        status_email: cleanStr(row['Status Email']) || 'Active',
      };

      const { data, error } = await supabase
        .from('customers')
        .upsert([payload], { onConflict: 'company_name' })
        .select('id');

      if (error) {
        console.error(`  ❌ Customer "${companyName}": ${error.message}`);
      } else if (data && data[0]) {
        customerMap.set(companyName.toUpperCase(), data[0].id);
        console.log(`  ✅ Customer: "${companyName}" → ${data[0].id}`);
      }
    }
    console.log(`\n  Customers migrated: ${customerMap.size}`);

    // ----------------------------------------------------------
    // STEP 2: Migrate Inquiries from the 4 main sheets
    // ----------------------------------------------------------
    const SHEETS = [
      { name: 'New Quotation',   defaultStatus: 'Submitted'         },
      { name: 'TVB quotation',   defaultStatus: 'Submitted'         },
      { name: 'New Order (PO)',  defaultStatus: 'PO Won'            },
      { name: 'Canceled Inquiry',defaultStatus: 'Canceled'          },
    ];

    let totalInquiries = 0;
    let totalItems = 0;
    let skipped = 0;

    for (const sheetConfig of SHEETS) {
      console.log(`\n=== Step 2: Migrating Sheet: "${sheetConfig.name}" ===`);
      const groups = parseSheetIntoGroups(workbook, sheetConfig.name);
      console.log(`  Found ${groups.length} inquiry groups.`);

      for (const group of groups) {
        // Resolve customer ID, auto-register if not found
        let customerId = customerMap.get(group.customer.toUpperCase());

        if (!customerId) {
          console.log(`  ⚡ Auto-registering new customer: "${group.customer}"`);
          const { data, error } = await supabase
            .from('customers')
            .upsert([{ company_name: group.customer }], { onConflict: 'company_name' })
            .select('id');

          if (error) {
            console.error(`  ❌ Could not register customer "${group.customer}": ${error.message}`);
            skipped++;
            continue;
          }
          if (data && data[0]) {
            customerId = data[0].id;
            customerMap.set(group.customer.toUpperCase(), customerId);
          }
        }

        if (!customerId) { skipped++; continue; }

        // Determine category from items (use most common/first Tipe Proses)
        const firstItem = group.items[0];
        const category = firstItem
          ? mapCategory(firstItem.tipe_proses, firstItem.process, firstItem.item_name)
          : 'others';

        // Map status
        const status = mapStatus(group.inquiry.status, sheetConfig.defaultStatus);

        // Build inquiry payload
        const inquiryPayload = {
          customer_id: customerId,
          category,
          inquiry_date: group.inquiry.inquiry_date,
          quotation_date: group.inquiry.quotation_date,
          follow_up_date: group.inquiry.follow_up_date,
          quotation_number: group.inquiry.quotation_number ? String(group.inquiry.quotation_number).trim() : null,
          lead_time_days: group.inquiry.lead_time_days,
          status,
          po_number: group.inquiry.po_number,
          order_review: group.inquiry.order_review,
          currency: group.inquiry.currency || 'USD',
          remark: group.inquiry.remark,
          last_activity_at: new Date().toISOString(),
        };

        const { data: inquiryData, error: inquiryErr } = await supabase
          .from('inquiries')
          .insert([inquiryPayload])
          .select('id');

        if (inquiryErr) {
          console.error(`  ❌ Inquiry for "${group.customer}": ${inquiryErr.message}`);
          skipped++;
          continue;
        }

        const inquiryId = inquiryData[0].id;
        totalInquiries++;

        // Insert line items
        if (group.items.length > 0) {
          const itemsPayload = group.items.map(item => ({
            inquiry_id: inquiryId,
            item_name: item.item_name,
            material: item.material,
            process: item.process,
            tipe_proses: item.tipe_proses,
            qty: item.qty,
            cast_price: item.cast_price,
            mach_price: item.mach_price,
            surface_treatment: item.surface_treatment,
            packing_cost: item.packing_cost,
            cfr: item.cfr,
            total_price_per_qty: item.total_price_per_qty,
            total_price: item.total_price,
            tooling_cost: item.tooling_cost,
          }));

          const { error: itemsErr } = await supabase
            .from('inquiry_items')
            .insert(itemsPayload);

          if (itemsErr) {
            console.error(`  ⚠️  Items for inquiry ${inquiryId}: ${itemsErr.message}`);
          } else {
            totalItems += group.items.length;
          }
        }

        const shortItems = group.items.map(i => i.item_name.substring(0, 25)).join(', ');
        console.log(`  ✅ [${sheetConfig.name}] "${group.customer}" → ${group.items.length} items: ${shortItems}`);
      }
    }

    // ----------------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------------
    console.log('\n');
    console.log('========================================');
    console.log('🎉  MIGRATION COMPLETE!');
    console.log('========================================');
    console.log(`  Customers  : ${customerMap.size}`);
    console.log(`  Inquiries  : ${totalInquiries}`);
    console.log(`  Line Items : ${totalItems}`);
    console.log(`  Skipped    : ${skipped}`);
    console.log('========================================');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration Fatal Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
