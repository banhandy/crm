# Responsive Design and Padding Layout Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Transform the CRM web application into a fully responsive interface with adaptive grid stacking, mobile-friendly forms/drawers, a slide-over mobile sidebar menu, and responsive page padding.

**Architecture:** Add a media queries system at the bottom of the main stylesheet to adapt columns, paddings, and menus dynamically based on viewport width. Implement a toggleable mobile sidebar state in React with a blur overlay and a top-bar hamburger toggle.

**Tech Stack:** Next.js (React), Vanilla CSS (Flexbox, Grid, Media Queries, transitions).

---

## Proposed Changes

### CRM Stylesheet

#### [MODIFY] [globals.css](file:///d:/kerjaan/antigravity%20workspace/crm/app/globals.css)
- **App Containers & Padding**: Reduce general padding to `16px` and gap to `20px` inside `.content-body` and `.top-bar` on screens under `768px`.
- **Dashboard Grid (`.dashboard-grid`)**: Stack left and right columns vertically (set `grid-template-columns: 1fr`) on screen widths under `1024px`.
- **Product Engineering Gantt Track (`.fai-gantt-row-container`)**: Transition the 3-column Gantt row layout into a stacked 1-column responsive layout under `1024px` to prevent horizontal text overflow and allow the horizontal track to stretch cleanly.
- **Mobile Sidebar Slide-over**: Style a slide-in responsive drawer for the navigation sidebar with a frosted glass backdrop filter overlay (`.sidebar-backdrop`) and z-index priority.
- **Drawers & Modals**: Optimize wide drawers (like the edit drawer) to span `100vw` with minimized padding on viewports under `768px`.
- **Search & Controls**: Stack filter controls vertically (`.pipeline-controls` & `.filter-group`) on viewport widths under `576px` so inputs span full width and remain legible.

### CRM Page Logic and Layout

#### [MODIFY] [page.js](file:///d:/kerjaan/antigravity%20workspace/crm/app/page.js)
- **Mobile Sidebar State**: Add a `mobileSidebarOpen` React state.
- **Hamburger Toggle**: Add a responsive `.mobile-hamburger-btn` button inside `.top-bar` displaying the Lucide `Menu` icon to slide in the sidebar on smaller screens.
- **Auto-Close on Click**: Update nav link selectors to set `mobileSidebarOpen` to `false` when a tab is selected.
- **Side Panel Backdrop**: Render the `.sidebar-backdrop` element when `mobileSidebarOpen` is active.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify zero compilation errors or syntax warnings.

### Manual Verification
- Resize the browser or use DevTools Responsive Device Mode:
  - Verify that the layout shifts smoothly on tablet screen size (`1024px`) with the dashboard columns stacking and FAI cards converting to a beautiful vertical stack with horizontal timeline track stretching.
  - Verify that under mobile screen size (`768px`), the sidebar slides off-screen, and can be slide-in with the hamburger menu button and closed with the backdrop click or nav click.
  - Verify that the Edit Drawer scales to full-width and search inputs align neatly on mobile (`576px`).
