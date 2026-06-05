# CRM Mobile Responsive Layout Redesign Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Refactor the CRM portal to swap navigation models, tables, and grid structures on mobile viewports (< 768px) to provide a premium mobile app-like interface.

**Architecture:** Use responsive Tailwind utilities (`md:`, `hidden`, `flex`) to toggle between desktop sidebar/tables and mobile bottom navigation/cards. Set modals and side drawers to occupy full width on mobile viewports.

**Tech Stack:** Next.js 14, Tailwind CSS, lucide-react.

---

### Task 1: Mobile Navigation Header & Shell

**Files:**
* Modify: [app/page.js](file:///d:/kerjaan/antigravity%20workspace/crm/app/page.js)

**Step 1: Implement mobile navigation shell**
* Hide the desktop sidebar on mobile by applying `hidden md:flex` to the `<aside>` element.
* Pinned a mobile bottom navigation bar (`Dashboard`, `Pipeline`, `Contact`) using fixed positioning (`fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-border z-40 flex items-center justify-around md:hidden`).
* Bind tab selection state to active bottom bar icons.
* Apply `pb-16` bottom padding on the main scrollable section of the mobile content wrapper to clear the bottom navigation bar.

**Step 2: Verify build**
* Run: `npm run build`
* Expected: Build completes successfully with no warnings.

**Step 3: Commit**
* Run:
  ```bash
  git add app/page.js
  git commit -m "feat: add mobile bottom navigation bar and responsive shell"
  ```

---

### Task 2: Mobile Card Layout for Inquiries Tab & FAB

**Files:**
* Modify: [app/page.js](file:///d:/kerjaan/antigravity%20workspace/crm/app/page.js)

**Step 1: Replace inquiries pipeline table on mobile**
* Wrap the inquiries `<table>` container with `hidden md:block` to hide it on small viewports.
* Implement a card list layout (`flex flex-col gap-4 md:hidden`) displaying Inquiry Date, Status Badge, Customer Name (bold text-base), and Item Count (📦 X Items).
* Add a floating action button (FAB) for "New Inquiry" (`fixed bottom-20 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-40 md:hidden`). Clicking this button toggles `setIsAddInquiryOpen(true)`.

**Step 2: Verify build**
* Run: `npm run build`
* Expected: Build completes successfully with no warnings.

**Step 3: Commit**
* Run:
  ```bash
  git add app/page.js
  git commit -m "feat: implement mobile inquiries pipeline cards and FAB"
  ```

---

### Task 3: Mobile Layout for Dashboard and Customer Contact

**Files:**
* Modify: [app/page.js](file:///d:/kerjaan/antigravity%20workspace/crm/app/page.js)

**Step 1: Adapt Dashboard & Customer tabs for mobile viewports**
* Convert the top KPI banner grid to stack vertically: change the section class to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`.
* Stack columns of the dashboard layout: change class to `grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6`.
* Swapped the dashboard "Stale Inquiries" table for a simplified list of cards on mobile viewports.
* Convert the Customer Directory grid to stack on mobile: change card layout class to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`. Add customer addition FAB.

**Step 2: Verify build**
* Run: `npm run build`
* Expected: Build completes successfully with no warnings.

**Step 3: Commit**
* Run:
  ```bash
  git add app/page.js
  git commit -m "feat: optimize dashboard KPIs, customer directory layout and charts for mobile view"
  ```

---

### Task 4: Mobile Viewport Drawer Sizing & Stacking Forms

**Files:**
* Modify: [app/page.js](file:///d:/kerjaan/antigravity%20workspace/crm/app/page.js)

**Step 1: Restyle drawer and modals for mobile viewports**
* Change the drawer width class in the drawer div element to expand full width on mobile: `w-full sm:w-[600px] md:w-[66vw]`.
* Make drawer padding responsive: change class to `p-4 md:p-8`.
* Update modal widths to `w-[92vw] sm:w-[500px]` to center them on mobile viewports.
* Convert drawer form grids to stack vertically:
  * `drawer-grid-2` -> `grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3`
  * `drawer-grid-3` -> `grid grid-cols-1 sm:grid-cols-3 gap-3`
  * `drawer-grid-5` -> `grid grid-cols-2 sm:grid-cols-5 gap-2`

**Step 2: Verify build**
* Run: `npm run build`
* Expected: Build completes successfully with no warnings.

**Step 3: Commit**
* Run:
  ```bash
  git add app/page.js
  git commit -m "feat: make drawer, modals, and input forms fully responsive"
  ```
