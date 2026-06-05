# Design Doc: CRM Mobile Responsive Layout Redesign

This design document outlines the visual and architectural plans to make the CRM handling portal fully responsive on mobile devices, matching the layout mockups and implementing a mobile bottom navigation shell.

## 1. Objectives & Target User Experience
* **Desktop View Integrity**: Retain the exact existing layout for screen resolutions >= 768px (MD viewport).
* **Mobile App Feel**: Swap the navigation paradigm on viewports < 768px to a pinned bottom navigation bar.
* **Scroll-Free Layout**: Replace wide tables with a tailored mobile card grid for easy reading on mobile viewports.
* **Full-Screen Forms**: Adapt drawers and creation modals to occupy full viewport width on mobile.

---

## 2. Layout Shell & Navigation

### Desktop/Tablet Layout (>= 768px)
* Sticky left sidebar navigation remains active.
* Pinned top header bar with title and actions remains unchanged.

### Mobile Layout (< 768px)
* **Sidebar**: Hidden entirely (`hidden md:flex` on sidebar container).
* **Bottom Navigation Bar**: Fixed at the bottom of the viewport:
  ```html
  <nav className="fixed bottom-0 left-0 right-0 h-16 bg-sidebar border-t border-border z-40 flex items-center justify-around md:hidden">
    <!-- Dashboard Tab Link -->
    <!-- Pipeline Tab Link -->
    <!-- Contact Tab Link -->
  </nav>
  ```
* **Top Header**: Simplified. Hamburger button hidden, showing only the tab title.
* **Bottom Navigation Paddings**: Add bottom padding `pb-16` to the main viewport container on mobile to prevent content from being obscured by the fixed bottom navigation bar.

---

## 3. Component Adaptations

### A. Inquiries Pipeline Tab
* **Desktop**: Displays the standard `Table` layout.
* **Mobile**: Hide the table (`hidden md:block`) and render a list of cards (`flex flex-col gap-4 md:hidden`):
  * **Card Wrapper**: `bg-card border border-border p-4 rounded-xl flex flex-col gap-3 hover:bg-card-hover/40 transition-all`
  * **Header**: Layout displays Inquiry Date (`text-xs text-muted`) on the left, and Status Badge (`Badge` primitive) on the right.
  * **Title**: Company name in bold white font (`text-base font-bold text-foreground`).
  * **Footer**: Item count with a package icon (`📦 X Items` in `text-xs text-muted`).
  * **Floating Action Button (FAB)**: Pin a floating action button for adding inquiries in the bottom right corner, positioned just above the bottom navigation bar (`fixed bottom-20 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center z-40 md:hidden`).

### B. Dashboard Analytics Tab
* **KPI Metric Cards**: Adjust the grid layout to stack vertically on mobile: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`.
* **Dashboard Columns**: Main grid stacks columns: `grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6`.
* **Stale Inquiries Table**: Swapped for simplified list cards on mobile.

### C. Customer Directory Tab
* **Directory Grid**: Swapped from 3 columns to 1 column: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5`.
* **Actions**: Render FAB for customer addition on mobile.

### D. Side Drawer & Modals
* **Drawer**: Adjusts from `66vw` to `w-full` on mobile screens.
* **Form Grid Columns**: Stacks grid elements on mobile screens:
  * `drawer-grid-2` -> `grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3`
  * `drawer-grid-3` -> `grid grid-cols-1 sm:grid-cols-3 gap-3`
  * `drawer-grid-5` -> `grid grid-cols-2 sm:grid-cols-5 gap-2`
* **Modals**: Width scales to `w-[92vw]` on mobile viewports.

---

## 4. Verification Plan
1. **Visual Match**: Verify mobile layout matches the mockup screenshot (cards, search, filter icon, bottom nav, FAB).
2. **Tab Switching**: Verify bottom navigation switches tabs correctly on mobile viewports.
3. **Form Filling**: Verify drawers open full-width on mobile and form items stack correctly.
4. **Desktop Layout Integrity**: Verify desktop view remains unaffected.
