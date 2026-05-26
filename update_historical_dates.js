const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Supabase_url;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.Supabase_Key;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase configuration missing! Check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to add N working days (excluding weekends) to a start date
function addWorkingDays(startDateStr, days) {
  if (!startDateStr || days === null || days === undefined) return null;
  const date = new Date(startDateStr);
  const daysToAdd = parseInt(days);
  if (isNaN(daysToAdd) || daysToAdd <= 0) return startDateStr;
  
  let added = 0;
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Exclude Sun (0) and Sat (6)
      added++;
    }
  }
  return date.toISOString().substring(0, 10); // Return YYYY-MM-DD
}

async function run() {
  try {
    console.log("Fetching all inquiries from Supabase...");
    const { data: inquiries, error: fetchError } = await supabase
      .from('inquiries')
      .select('id, inquiry_date, lead_time_days, quotation_date');
      
    if (fetchError) throw fetchError;
    
    console.log(`Found ${inquiries.length} inquiries in total. Scanning for updates...`);
    let updateCount = 0;
    
    for (const inq of inquiries) {
      // If it has inquiry date, lead time days, and NO quotation date currently set
      if (inq.inquiry_date && inq.lead_time_days !== null && !inq.quotation_date) {
        const calculatedQuotDate = addWorkingDays(inq.inquiry_date, inq.lead_time_days);
        
        if (calculatedQuotDate) {
          console.log(`Updating Inquiry ID ${inq.id}: Inquiry Date ${inq.inquiry_date} + Lead Time ${inq.lead_time_days} days -> Calculated Quotation Date: ${calculatedQuotDate}`);
          
          const { error: updateError } = await supabase
            .from('inquiries')
            .update({ quotation_date: calculatedQuotDate })
            .eq('id', inq.id);
            
          if (updateError) {
            console.error(`Error updating inquiry ${inq.id}:`, updateError.message);
          } else {
            updateCount++;
          }
        }
      }
    }
    
    console.log(`\n🎉 SUCCESS! Historical Database Date Updates Complete!`);
    console.log(`Successfully calculated and updated ${updateCount} inquiries.`);
    process.exit(0);
  } catch (err) {
    console.error("Update Script Fatal Error:", err.message);
    process.exit(1);
  }
}

run();
