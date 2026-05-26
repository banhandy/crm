const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Guess the right status based on inquiry data
function guessStatus(inq) {
  if (inq.po_number) return 'PO Won';
  if (inq.quotation_number) return 'Submitted';
  return 'Pending Quotation';
}

async function cleanup() {
  console.log('=== Checking for data issues ===\n');

  // -----------------------------------------------
  // 1. Empty item names
  // -----------------------------------------------
  const { data: emptyItems, error: emptyErr } = await supabase
    .from('inquiry_items')
    .select('id, item_name, inquiry_id')
    .or('item_name.is.null,item_name.eq.,item_name.eq. ');

  if (emptyErr) { console.error('Query error:', emptyErr); return; }
  console.log(`[1] Items with empty/null item_name: ${emptyItems.length}`);
  emptyItems.forEach(d => console.log(`    id=${d.id} | name="${d.item_name}"`));

  if (emptyItems.length > 0) {
    const ids = emptyItems.map(e => e.id);
    const { error: delErr } = await supabase
      .from('inquiry_items')
      .delete()
      .in('id', ids);
    if (delErr) console.error('  ❌ Delete error:', delErr.message);
    else console.log(`  ✅ Deleted ${ids.length} empty item(s).`);
  }

  // -----------------------------------------------
  // 2. Inquiries with null/empty status
  // -----------------------------------------------
  const { data: noStatus, error: statusErr } = await supabase
    .from('inquiries')
    .select('id, status, quotation_number, po_number')
    .or('status.is.null,status.eq.');

  if (statusErr) { console.error('Status query error:', statusErr); return; }
  console.log(`\n[2] Inquiries with missing status: ${noStatus.length}`);
  noStatus.forEach(i => console.log(`    id=${i.id} | qno=${i.quotation_number} | po=${i.po_number}`));

  let statusFixed = 0;
  for (const inq of noStatus) {
    const newStatus = guessStatus(inq);
    const { error: fixErr } = await supabase
      .from('inquiries')
      .update({ status: newStatus })
      .eq('id', inq.id);
    if (fixErr) console.error(`  ❌ Fix status for ${inq.id}: ${fixErr.message}`);
    else { console.log(`  ✅ Set status="${newStatus}" for ${inq.id}`); statusFixed++; }
  }

  // -----------------------------------------------
  // 3. Inquiries with unrecognised/garbage status
  // -----------------------------------------------
  const VALID_STATUSES = ['Pending Quotation', 'Submitted', 'Follow Up', 'PO Won', 'Canceled'];
  const { data: allInq } = await supabase
    .from('inquiries')
    .select('id, status, quotation_number, po_number');

  const badStatus = allInq.filter(i => i.status && !VALID_STATUSES.includes(i.status));
  console.log(`\n[3] Inquiries with unrecognised status: ${badStatus.length}`);
  badStatus.forEach(i => console.log(`    id=${i.id} | status="${i.status}"`));

  let badFixed = 0;
  for (const inq of badStatus) {
    const newStatus = guessStatus(inq);
    const { error: fixErr } = await supabase
      .from('inquiries')
      .update({ status: newStatus })
      .eq('id', inq.id);
    if (fixErr) console.error(`  ❌ Fix bad status for ${inq.id}: ${fixErr.message}`);
    else { console.log(`  ✅ "${inq.status}" → "${newStatus}" for ${inq.id}`); badFixed++; }
  }

  // -----------------------------------------------
  // Summary
  // -----------------------------------------------
  const { count: finalItems } = await supabase.from('inquiry_items').select('*', { count: 'exact', head: true });
  const { count: finalInquiries } = await supabase.from('inquiries').select('*', { count: 'exact', head: true });

  console.log('\n========================================');
  console.log('✅ Cleanup Complete!');
  console.log('========================================');
  console.log(`  Empty items deleted  : ${emptyItems.length}`);
  console.log(`  Missing statuses fixed: ${statusFixed}`);
  console.log(`  Bad statuses fixed   : ${badFixed}`);
  console.log(`  Final inquiries      : ${finalInquiries}`);
  console.log(`  Final items          : ${finalItems}`);
  console.log('========================================');
}

cleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
