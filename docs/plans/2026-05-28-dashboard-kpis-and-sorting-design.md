# Design Document: Dashboard KPIs and Datagrid Sorting

**Date:** 2026-05-28  
**Topic:** Column-based Datagrid Sorting and Premium Dashboard KPI Metrics  
**Status:** Approved  

---

## 1. Goal Description
The objective is to implement:
1. **Interactive column sorting** on the primary inquiries datagrid header. Clickable columns will toggle between ascending, descending, and unsorted/default states, with clear visual icons.
2. **A premium top-row KPI metrics grid** on the main Dashboard view showing vital analytics: Active Pipeline Value, Pending Quotations count, Stale Inquiries count, and Win Rate (Conversion).

---

## 2. Technical Details & Architecture

### A. Datagrid Sorting
We will add two new client-side React states inside `app/page.js`:
* `sortField`: `'inquiry_date' | 'customer' | 'quotation_number' | 'value' | 'pic' | 'status'`
* `sortDirection`: `'asc' | 'desc'`

#### Sorting Functionality
A sorting wrapper will sort the `filteredInquiries` array before rendering.
* **Customer**: Sorts by `a.customers?.company_name` vs `b.customers?.company_name`.
* **Value**: Sorts numerically by parsing the currency rates and summing items inside the inquiry (a dynamic numeric conversion helper `getInquiryTotalNumeric` will be introduced).
* **Date**: Sorts by `a.inquiry_date` vs `b.inquiry_date`.
* **Standard Fields**: Default alphabetical comparison for status, PIC, quotation number.

#### Visual Indicators
Clickable headers in `<thead />` of the inquiries table will display:
* `▲` (accent-colored icon when sorting ASC)
* `▼` (accent-colored icon when sorting DESC)
* `⇅` (muted-colored icon when sortable but inactive)

---

### B. Dashboard Top-Row KPI Metrics Grid
A new CSS Grid element `.kpi-grid` containing 4 glassmorphic cards will be rendered at the top of the `{activeTab === 'dashboard'}` view.

#### 1. Active Pipeline Value
* **Definition**: Total financial value of all current active inquiries (status is not 'PO Won' or 'Canceled').
* **Calculation**: For each active inquiry, sum the value of items converted to a unified currency (USD/IDR), and display the unified value elegantly.

#### 2. Pending Quotations
* **Definition**: Active inquiries currently missing a quotation number.
* **Calculation**: Filters active inquiries where `!inq.quotation_number`.

#### 3. Stale Inquiries
* **Definition**: Active inquiries with no updates in > 3 days.
* **Calculation**: Matches the count calculated by the `isStale` helper.

#### 4. Win Rate (Conversion)
* **Definition**: Ratio of Won inquiries to total inquiries.
* **Calculation**: `(wonOrdersCount / totalInquiries) * 100` rounded to nearest integer.

---

## 3. Style Specification
Modern visual enhancements in `globals.css`:
* Glassmorphic metric cards (`.kpi-card`) with custom gradients, blur effects, and smooth hover translations.
* Pointer cursors and hover backgrounds on table header columns.
