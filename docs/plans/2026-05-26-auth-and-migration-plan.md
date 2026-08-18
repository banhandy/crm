# Authentication & Excel Data Migration Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal**: Implement a secure email/password login portal for admin-managed accounts and automate the migration of inquiries and customer contacts from `doc/inquiry list.xlsx` into Supabase.

**Architecture**: Integrate Supabase Auth on the client side of the Next.js single-page dashboard. Build a standalone Node.js migration script using `xlsx` to parse sheets, format data, and bulk-load into the database via the `@supabase/supabase-js` client wrapper.

**Tech Stack**: Supabase Auth, Next.js, Node.js, `xlsx` parser library.

---

## Task 1: Install Migration Dependencies & Write Migration Script

**Files**:
- Create: `migrate.js`
- Modify: `package.json`

**Step 1: Install xlsx library**
Run: `npm install xlsx`
Expected: Installs `xlsx` package with zero failures.

**Step 2: Create migrate.js**
Write `migrate.js` in the project root to load the Excel sheet, extract company contacts, de-duplicate them, insert them into `customers`, and then parse quotations/POs/canceled items to insert them into `inquiries`.

```javascript
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Supabase_url;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.Supabase_Key;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Loading Excel workbook...");
  const workbook = xlsx.readFile('./doc/inquiry list.xlsx');
  
  // 1. MIGRATE CUSTOMERS
  console.log("Parsing Customer Contacts...");
  const contactsSheet = workbook.Sheets['Customer Contact'];
  const contactsData = xlsx.utils.sheet_to_json(contactsSheet);
  
  const customerMap = new Map();
  
  for (const row of contactsData) {
    const companyName = row['Company'] ? row['Company'].trim() : null;
    if (!companyName) continue;
    
    // Check if customer already exists or insert
    const payload = {
      company_name: companyName,
      sector_business: row['Sector Bussiness'] || null,
      regional: row['Regional'] || null,
      address: row['Company Address'] || null,
      email_address: row['Email Address'] || null,
      pic_name: row['PIC'] ? row['PIC'].trim().toUpperCase() : 'AFIF NI',
      status_email: row['Status Email'] || 'Active'
    };
    
    const { data, error } = await supabase
      .from('customers')
      .upsert([payload], { onConflict: 'company_name' })
      .select();
      
    if (error) {
      console.error(`Error saving customer ${companyName}:`, error.message);
    } else if (data && data[0]) {
      customerMap.set(companyName, data[0].id);
    }
  }
  
  console.log(`Successfully migrated ${customerMap.size} customer companies.`);
  
  // 2. MIGRATE INQUIRIES
  console.log("Parsing Inquiries Sheets...");
  const sheetsToMigrate = [
    { name: 'New Quotation', category: 'standard', defaultStatus: 'Pending Quotation' },
    { name: 'TVB quotation', category: 'tvb', defaultStatus: 'Quotation Sent' },
    { name: 'New Order (PO)', category: 'standard', defaultStatus: 'PO Won' },
    { name: 'Canceled Inquiry', category: 'standard', defaultStatus: 'Canceled' }
  ];
  
  let inquiriesCount = 0;
  
  for (const sheetConfig of sheetsToMigrate) {
    const sheet = workbook.Sheets[sheetConfig.name];
    if (!sheet) {
      console.warn(`Sheet ${sheetConfig.name} not found, skipping.`);
      continue;
    }
    
    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log(`Parsing ${rows.length} rows from sheet: ${sheetConfig.name}...`);
    
    for (const row of rows) {
      const companyName = row['Customer'] ? row['Customer'].trim() : null;
      const itemName = row['Item Name'] || row['Product'] || row['NAMA PRODUK'] || row['TASK'] || 'Unnamed Item';
      
      if (!companyName) continue;
      
      // Get mapped customer ID
      let customerId = customerMap.get(companyName);
      if (!customerId) {
        // Create customer on the fly if missing from directory
        const { data, error } = await supabase
          .from('customers')
          .insert([{ company_name: companyName, pic_name: 'AFIF NI' }])
          .select();
        if (data && data[0]) {
          customerId = data[0].id;
          customerMap.set(companyName, customerId);
        } else {
          continue; // Skip if customer cannot be resolved
        }
      }
      
      const payload = {
        customer_id: customerId,
        category: sheetConfig.category,
        item_name: itemName,
        quotation_number: row['Quotation #'] || null,
        lead_time_days: row['Lead Time (Working Days)'] ? parseInt(row['Lead Time (Working Days)']) : null,
        po_number: row['No. Po'] || row['No. PO'] || null,
        order_review: row['Order Review'] || null,
        remark: row['Remark'] || row['UPDATE'] || '',
        status: row['Status'] || sheetConfig.defaultStatus,
        last_activity_at: new Date().toISOString()
      };
      
      const { error } = await supabase.from('inquiries').insert([payload]);
      if (error) {
        console.error(`Error saving inquiry for ${companyName}:`, error.message);
      } else {
        inquiriesCount++;
      }
    }
  }
  
  console.log(`Excel Data Migration Complete! Successfully loaded ${inquiriesCount} inquiries.`);
}

run();
```

**Step 3: Run the Migration Script**
Run: `node migrate.js`
Expected: Outputs completion message and inserts all records into Supabase.

**Step 4: Commit**
```bash
git add package.json migrate.js package-lock.json
git commit -m "feat: add Excel data migration script and dependencies"
```

---

## Task 2: Implement Secure Authentication Panel & Sign-Out Page

**Files**:
- Modify: `app/page.js`

**Step 1: Update app/page.js with Supabase Auth Support**
Rewrite the top level client module:
- Set up login forms (email/password inputs) with loading states.
- Protect the main workspace: if `supabase.auth.getUser()` session is missing, render a premium visual Login Portal instead of the Dashboard.
- Provide a login verification callback matching Supabase user authentication.
- Add a "Log Out" sidebar button calling `supabase.auth.signOut()`.

**Step 2: Compile & Build Verification**
Run: `npm run build`
Expected: Next.js compiles successfully.

**Step 3: Commit**
```bash
git add app/page.js
git commit -m "feat: implement secure admin login portal and logout sessions"
```
