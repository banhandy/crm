const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Supabase_url;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.Supabase_Key;

const supabase = createClient(supabaseUrl, supabaseKey);

const TEAM_MEMBERS = ['AFIF NI', 'PUTRI', 'ERVAN', 'NOVY', 'RANU'];

// Heuristics to classify item into a process category
function determineCategory(itemName, legacyCategory) {
  const item = String(itemName).toLowerCase();
  if (legacyCategory === 'tvb') return 'investment';
  
  if (item.includes('jig') || item.includes('fixture') || item.includes('klem') || item.includes('plate') || item.includes('bracket') || item.includes('assembly')) {
    return 'fabrication';
  }
  if (item.includes('disc') || item.includes('casing') || item.includes('pump') || item.includes('roll') || item.includes('flange') || item.includes('ring')) {
    return 'sand casting';
  }
  if (item.includes('invest') || item.includes('wax') || item.includes('lost')) {
    return 'investment';
  }
  if (item.includes('forg') || item.includes('engkol') || item.includes('picu')) {
    return 'forging';
  }
  return 'others';
}

async function run() {
  try {
    console.log("Starting PIC & Category Migration...");

    // 1. Add client_contact_person column to customers if not exists (using Supabase RPC or direct SQL isn't always easy from JS, 
    // but PostgreSQL ALTER TABLE is supported if we execute it. Wait! Since we don't have direct sql query tool in Supabase JS SDK 
    // unless we create a function, wait, we can just run ALTER TABLE through a Supabase RPC or tell the user. But wait! 
    // Supabase JS SDK doesn't support running raw SQL directly unless we use an extension.
    // Wait, let's write a PostgreSQL command that they can run in the SQL Editor, OR we can just write the migration script 
    // to populate the field after they add it, or wait—can we do it directly?
    // Let's ask them to run a quick SQL statement in the SQL Editor to add the column `client_contact_person` to `customers` table.
    // Wait, let's see if we can do this without ALTER TABLE?
    // Yes! Let's provide a quick SQL script for them to run in the SQL Editor first, then run our node migration script!
    // Wait! Let's write the node script first to do all the updates).
    
    console.log("Fetching all customers...");
    const { data: customers, error: custErr } = await supabase.from('customers').select('*');
    if (custErr) throw custErr;
    
    console.log(`Found ${customers.length} customers. Cleaning up PIC data...`);
    let custUpdated = 0;
    
    for (const cust of customers) {
      const originalPic = cust.pic_name || '';
      let cleanSalesPic = 'AFIF NI'; // Default internal PIC
      let clientContact = '';
      
      const hasPhone = /[\d+()]{4,}/.test(originalPic);
      const isLongName = originalPic.length > 15;
      
      if (hasPhone || isLongName || originalPic.toLowerCase().includes('pak') || originalPic.toLowerCase().includes('bu') || originalPic.toLowerCase().includes('customer')) {
        // This is a client contact person!
        clientContact = originalPic;
        // Try to find if there is an internal PIC hidden in the string
        const matchedTeam = TEAM_MEMBERS.find(member => originalPic.toUpperCase().includes(member));
        cleanSalesPic = matchedTeam || 'AFIF NI';
      } else {
        // This is likely an internal PIC!
        const matchedTeam = TEAM_MEMBERS.find(member => originalPic.toUpperCase().includes(member));
        cleanSalesPic = matchedTeam || 'AFIF NI';
      }
      
      console.log(`Customer: "${cust.company_name}" -> Internal Sales Owner: "${cleanSalesPic}" | Client Contact: "${clientContact}"`);
      
      // Update customer
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ 
          pic_name: cleanSalesPic,
          client_contact_person: clientContact // This column must be added to Supabase first!
        })
        .eq('id', cust.id);
        
      if (updateErr) {
        console.error(`Error updating customer ${cust.company_name}:`, updateErr.message);
      } else {
        custUpdated++;
      }
    }
    
    // 2. MIGRATE INQUIRY CATEGORIES
    console.log("\nFetching all inquiries...");
    const { data: inquiries, error: inqErr } = await supabase.from('inquiries').select('*');
    if (inqErr) throw inqErr;
    
    console.log(`Found ${inquiries.length} inquiries. Classifying manufacturing processes...`);
    let inqUpdated = 0;
    
    for (const inq of inquiries) {
      const newCategory = determineCategory(inq.item_name, inq.category);
      console.log(`Inquiry: "${inq.item_name.substring(0, 30)}..." | Category: "${inq.category}" -> "${newCategory}"`);
      
      const { error: updateInqErr } = await supabase
        .from('inquiries')
        .update({ category: newCategory })
        .eq('id', inq.id);
        
      if (updateInqErr) {
        console.error(`Error updating inquiry ${inq.id}:`, updateInqErr.message);
      } else {
        inqUpdated++;
      }
    }
    
    console.log(`\n🎉 PIC & Category Migration Complete!`);
    console.log(`Updated ${custUpdated} Customers and ${inqUpdated} Inquiries.`);
    process.exit(0);
  } catch (err) {
    console.error("Migration Fatal Error:", err.message);
    process.exit(1);
  }
}

run();
