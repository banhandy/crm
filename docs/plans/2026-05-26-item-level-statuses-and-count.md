# Item-Level Statuses and Count Columns Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Clean up the CRM inquiry grid layout by showing a simple item count pill and implement a high-fidelity item-level status tracking system that dynamically aggregates parent statuses (supporting mixed outcomes like 9/10 won).

**Architecture:** We will run a database migration to add `status` to `inquiry_items`. In the React frontend (`app/page.js`), we will write a status resolver that computes aggregate status at runtime, update table columns to render a compact count pill, integrate status dropdowns inside item cards in the wide Edit Drawer, and update the save payload to persist all new fields.

**Tech Stack:** Next.js (React), Supabase, Vanilla CSS

---

### Task 1: Database Migration Schema
**Files:**
- Modify: `database.sql`
- Test: Execute SQL query in Supabase Editor

**Step 1: Write the schema alteration code**
Update `database.sql` to include columns for item status and FAI quality checklist:
```sql
ALTER TABLE public.inquiry_items 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending Quotation',
ADD COLUMN IF NOT EXISTS fai_status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_engineer TEXT,
ADD COLUMN IF NOT EXISTS fai_dimensions TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_material_cert TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_test_report TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_remarks TEXT,
ADD COLUMN IF NOT EXISTS fai_date DATE;

-- Populate existing rows based on parent status
UPDATE public.inquiry_items item
SET status = inq.status
FROM public.inquiries inq
WHERE item.inquiry_id = inq.id AND (item.status IS NULL OR item.status = 'Pending Quotation');
```

**Step 2: Commit database schema update**
```bash
git add database.sql
git commit -m "migration: add status and FAI columns to database.sql"
```

---

### Task 2: Dynamic Status Aggregator Helper in React
**Files:**
- Modify: `app/page.js:55-70` (Add helper function near top of file)

**Step 1: Write the aggregator code**
```javascript
// Helper to resolve aggregate status based on individual items
function getAggregateStatus(inq) {
  const items = inq.inquiry_items || [];
  if (items.length === 0) return inq.status;
  
  const total = items.length;
  const statuses = items.map(item => item.status || 'Pending Quotation');
  const wonCount = statuses.filter(s => s === 'PO Won').length;
  const canceledCount = statuses.filter(s => s === 'Canceled').length;
  
  if (wonCount === total) return 'PO Won';
  if (canceledCount === total) return 'Canceled';
  
  if (wonCount > 0) {
    return `PO Won (${wonCount}/${total})`;
  }
  
  if (statuses.includes('Follow Up')) return 'Follow Up';
  if (statuses.includes('Submitted')) return 'Submitted';
  return 'Pending Quotation';
}
```

**Step 2: Commit helper function**
```bash
git add app/page.js
git commit -m "feat: add getAggregateStatus status aggregator helper in React"
```

---

### Task 3: CSS Styling for Badges and Count Pill
**Files:**
- Modify: `app/globals.css` (Add new styles at the bottom of the file)

**Step 1: Write the Vanilla CSS classes**
```css
/* Glassmorphic Item Count Badge */
.item-count-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
}

.item-count-badge:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

/* Partially Won Premium Gradient Badge */
.badge-partial-won {
  background: linear-gradient(135deg, var(--color-accent-glow), rgba(16, 185, 129, 0.15)) !important;
  color: var(--text-main) !important;
  border: 1px solid rgba(139, 92, 246, 0.4) !important;
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.15);
  font-weight: 600;
}
```

**Step 2: Commit CSS updates**
```bash
git add app/globals.css
git commit -m "style: add CSS styling for item-count-badge and badge-partial-won"
```

---

### Task 4: Inquiries Pipeline & Stale Inquiries Table Column Updates
**Files:**
- Modify: `app/page.js` (Pipeline table lines 1015-1080, Stale table lines 839-885)

**Step 1: Modify headers and cells in pipeline table**
Change header `Items & Details` to `Items`.
Update table body row cell:
```javascript
// Before:
<td>
  {inq.inquiry_items && inq.inquiry_items.length > 0 ? (...) : ...}
</td>

// After:
<td>
  <span className="item-count-badge">
    📦 {inq.inquiry_items?.length || 0} {inq.inquiry_items?.length === 1 ? 'Item' : 'Items'}
  </span>
</td>
```

Update status badge rendering to support computed aggregate status:
```javascript
// Before:
{inq.status === 'PO Won' && <span className="status-badge badge-won">PO Won</span>}

// After:
{(() => {
  const aggStatus = getAggregateStatus(inq);
  if (aggStatus === 'PO Won') return <span className="status-badge badge-won">PO Won</span>;
  if (aggStatus.startsWith('PO Won (')) return <span className="status-badge status-badge badge-partial-won">{aggStatus}</span>;
  if (aggStatus === 'Pending Quotation') return <span className="status-badge badge-pending">Pending Quotation</span>;
  if (aggStatus === 'Submitted') return <span className="status-badge badge-pending" style={{ color: 'var(--color-accent)', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'var(--color-accent-glow)' }}>Submitted</span>;
  if (aggStatus === 'Follow Up') return <span className="status-badge badge-follow">Follow Up</span>;
  if (aggStatus === 'Canceled') return <span className="status-badge badge-canceled">Canceled</span>;
  return null;
})()}
```

**Step 2: Modify headers and cells in stale inquiries table**
Change header `Items` to `Items` (remains same header name).
Update table body row cell to render `<span className="item-count-badge">` instead of mapping items.
Update status badge to use aggregate status.

**Step 3: Commit table changes**
```bash
git add app/page.js
git commit -m "feat: simplify items column to count badges and implement dynamic status badges"
```

---

### Task 5: Edit Drawer Dropdown and Data Syncing
**Files:**
- Modify: `app/page.js` (Item cards details section and handleUpdateInquiry)

**Step 1: Render Item Status Selector in drawer**
Inside the Edit Drawer, in the main section of the item card (near the fields like item name and quantity), add the status dropdown selector:
```javascript
<div className="form-group">
  <label className="form-label" style={{ fontSize: '11px' }}>Item Status</label>
  <select 
    className="form-select"
    style={{ padding: '8px' }}
    value={item.status || 'Pending Quotation'}
    onChange={e => {
      const updated = [...selectedInquiry.inquiry_items];
      updated[index].status = e.target.value;
      setSelectedInquiry({ ...selectedInquiry, inquiry_items: updated });
    }}
  >
    <option value="Pending Quotation">Pending Quotation</option>
    <option value="Submitted">Submitted</option>
    <option value="Follow Up">Follow Up</option>
    <option value="PO Won">PO Won</option>
    <option value="Canceled">Canceled</option>
  </select>
</div>
```
Make sure to adjust the grids in the item details to accommodate this new dropdown cleanly!

**Step 2: Update `handleUpdateInquiry` database syncing payload**
Map `status` and `fai_*` columns to the upsert payload:
```javascript
return {
  id: item.id || undefined,
  inquiry_id: selectedInquiry.id,
  item_name: item.item_name || 'Unnamed Item',
  material: item.material || null,
  process: item.process || null,
  tipe_proses: item.tipe_proses || null,
  qty: qty || null,
  cast_price: item.cast_price ? parseFloat(item.cast_price) : null,
  mach_price: item.mach_price ? parseFloat(item.mach_price) : null,
  surface_treatment: item.surface_treatment ? parseFloat(item.surface_treatment) : null,
  packing_cost: item.packing_cost ? parseFloat(item.packing_cost) : null,
  cfr: item.cfr ? parseFloat(item.cfr) : null,
  total_price_per_qty: totalPricePerQty || null,
  total_price: totalPrice || null,
  tooling_cost: item.tooling_cost ? parseFloat(item.tooling_cost) : null,
  // Sync Status and FAI checklist columns:
  status: item.status || 'Pending Quotation',
  fai_status: item.fai_status || 'Pending',
  fai_engineer: item.fai_engineer || null,
  fai_dimensions: item.fai_dimensions || 'Pending',
  fai_material_cert: item.fai_material_cert || 'Pending',
  fai_test_report: item.fai_test_report || 'Pending',
  fai_remarks: item.fai_remarks || null,
  fai_date: item.fai_date || null
};
```

**Step 3: Commit drawer dropdown and syncing updates**
```bash
git add app/page.js
git commit -m "feat: add item status select inside drawer and sync item status & FAI fields to Supabase"
```

---

### Task 6: Local Verification and Build Validation
**Files:**
- Test: Local build validation using `npm run build`

**Step 1: Run compilation build command**
Run: `npm run build`
Expected: Passes successfully with zero Next.js compilation errors.
