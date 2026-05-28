# Dashboard KPIs and Datagrid Sorting Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Implement interactive column-based sorting on the inquiries pipeline table headers and a modern top-row KPI metric grid on the Dashboard analytics page.

**Architecture:** We will maintain client-side sorting states in `app/page.js`, utilize numeric base-currency conversions for sorting value columns, and compute responsive dashboard analytics metrics dynamically. Layout borders and micro-interactions will be added inside `app/globals.css`.

**Tech Stack:** Next.js 14, React 18, Supabase JS client, Vanilla CSS, Lucide icons.

---

### Task 1: Add Sorting React States & Helpers

**Files:**
* Modify: [page.js](file:///d:/kerjaan/antigravity/workspace/crm/app/page.js)

**Step 1: Write Sort Helper Function**
Add the sorting hooks and helper function at the top of the main React component:
```javascript
const [sortField, setSortField] = useState('inquiry_date');
const [sortDirection, setSortDirection] = useState('desc');

const getInquiryTotalNumeric = (inq) => {
  const items = inq.inquiry_items || [];
  const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0);
  const toolingTotal = items.reduce((sum, item) => sum + (parseFloat(item.tooling_cost) || 0), 0);
  const grandTotal = itemsTotal + toolingTotal;
  const rate = inq.currency === 'EUR' ? 1.08 : inq.currency === 'IDR' ? 1 / 16200 : 1.0;
  return grandTotal * rate;
};

const handleSort = (field) => {
  if (sortField === field) {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
    setSortField(field);
    setSortDirection('asc');
  }
};
```

**Step 2: Apply Sorting to filteredInquiries**
Apply `.sort()` onto `filteredInquiries` after it is filtered:
```javascript
const sortedFilteredInquiries = [...filteredInquiries].sort((a, b) => {
  let valA, valB;
  if (sortField === 'inquiry_date') {
    valA = new Date(a.inquiry_date || 0).getTime();
    valB = new Date(b.inquiry_date || 0).getTime();
  } else if (sortField === 'customer') {
    valA = (a.customers?.company_name || '').toLowerCase();
    valB = (b.customers?.company_name || '').toLowerCase();
  } else if (sortField === 'quotation_number') {
    valA = (a.quotation_number || '').toLowerCase();
    valB = (b.quotation_number || '').toLowerCase();
  } else if (sortField === 'pic') {
    valA = (a.customers?.pic_name || '').toLowerCase();
    valB = (b.customers?.pic_name || '').toLowerCase();
  } else if (sortField === 'status') {
    valA = (a.status || '').toLowerCase();
    valB = (b.status || '').toLowerCase();
  } else if (sortField === 'value') {
    valA = getInquiryTotalNumeric(a);
    valB = getInquiryTotalNumeric(b);
  } else {
    return 0;
  }
  if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
  if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
  return 0;
});
```

---

### Task 2: Make Table Headers Clickable with Dynamic Sort Icons

**Files:**
* Modify: [page.js](file:///d:/kerjaan/antigravity/workspace/crm/app/page.js)

**Step 1: Update Table Layout**
Change `filteredInquiries.map(...)` to `sortedFilteredInquiries.map(...)`.

**Step 2: Add Sort Handlers to Headers**
Add pointer classes, click handlers, and dynamic icons (▲/▼/⇅) for:
- Inquiry Date
- Customer
- Quot. #
- Value
- PIC
- Status

---

### Task 3: Calculate Metrics and Render KPI Metrics Row

**Files:**
* Modify: [page.js](file:///d:/kerjaan/antigravity/workspace/crm/app/page.js)

**Step 1: Calculate Pipeline and Active Stats**
Add calculations inside page.js:
```javascript
const activePipelineValue = inquiries
  .filter(i => i.status !== 'PO Won' && i.status !== 'Canceled')
  .reduce((sum, i) => sum + getInquiryTotalNumeric(i), 0);
```

**Step 2: Add `.kpi-grid` Markup**
Place the `.kpi-grid` element at the top of the `{activeTab === 'dashboard'}` tab rendering code block.

---

### Task 4: CSS Styles for KPI Cards & Sort Headers

**Files:**
* Modify: [globals.css](file:///d:/kerjaan/antigravity/workspace/crm/app/globals.css)

**Step 1: Add Classes**
Add responsive styling rules for `.kpi-grid`, `.kpi-card`, and `.sortable-header`.

---

### Task 5: Build Verification

**Step 1: Compile Application**
Run: `npm run build`
Expected: Successful, error-free Next.js compilation.
