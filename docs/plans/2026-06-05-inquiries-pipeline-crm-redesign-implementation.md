# Inquiries Pipeline CRM Redesign Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal:** Refactor the "Inquiries Pipeline" CRM application layout to use Tailwind CSS, shadcn/ui primitives, and next-themes, transforming the visual style to a premium minimalist SaaS design while keeping all database/logic integration intact.

**Architecture:** Initialize Tailwind and next-themes, create custom shadcn/ui primitives (Table, Badge, Card, Button, Input, Select, DropdownMenu), and refactor `app/page.js` to replace custom CSS styles with Tailwind utility classes and shadcn UI component primitives.

**Tech Stack:** Next.js 14, Tailwind CSS, shadcn/ui, next-themes, Supabase JS client.

---

### Task 1: Environment Backup & Dependency Installation

**Files:**
- Modify: `package.json`
- Create: `app/page.backup.js` (copy of `app/page.js`)

**Step 1: Backup `app/page.js`**
Run: `cp app/page.js app/page.backup.js` (or PowerShell copy command)
Expected: `app/page.backup.js` is created as a perfect backup.

**Step 2: Install dependencies**
Run: `npm install tailwindcss postcss autoprefixer tailwind-merge clsx next-themes`
Expected: Dependencies are added to `package.json` and installed in `node_modules`.

**Step 3: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: backup page and install tailwind/themes dependencies"
```

---

### Task 2: Tailwind and PostCSS Configuration

**Files:**
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Modify: `app/globals.css`

**Step 1: Initialize Tailwind configuration files**
Create `postcss.config.js` and `tailwind.config.js` containing base mappings for standard shadcn variables and colors matching the slate/navy dark mode theme (`#131e2c` for app, `#0f1a27` for sidebar, etc.).

**Step 2: Modify `app/globals.css`**
Add `@tailwind base; @tailwind components; @tailwind utilities;` and convert variable definitions to map standard tailwind/shadcn naming conventions.

**Step 3: Commit**
```bash
git add tailwind.config.js postcss.config.js app/globals.css
git commit -m "feat: configure tailwind, postcss and global CSS layers"
```

---

### Task 3: Theme Provider Setup

**Files:**
- Create: `components/theme-provider.jsx`
- Modify: `app/layout.js`

**Step 1: Create `theme-provider.jsx`**
Create a wrapper using `next-themes` that exports a standard `ThemeProvider` component using `"use client"`.

**Step 2: Wrap RootLayout in `app/layout.js`**
Modify `app/layout.js` to import and wrap the child tree with `ThemeProvider` enabling the `class` attribute for dark mode.

**Step 3: Commit**
```bash
git add components/theme-provider.jsx app/layout.js
git commit -m "feat: setup next-themes ThemeProvider"
```

---

### Task 4: Scaffolding Component Primitives

**Files:**
- Create: `components/ui/table.jsx`
- Create: `components/ui/badge.jsx`
- Create: `components/ui/select.jsx`
- Create: `components/ui/input.jsx`
- Create: `components/ui/button.jsx`
- Create: `components/ui/card.jsx`
- Create: `components/ui/dropdown-menu.jsx`

**Step 1: Create primitives**
Write clean, minimalist component primitives using `tailwind-merge` and `clsx` matching the shadcn spec.
For example, `components/ui/badge.jsx` should support default outline/muted variants.

**Step 2: Commit**
```bash
git add components/ui/
git commit -m "feat: scaffold shadcn UI component primitives"
```

---

### Task 5: Refactoring layout shell and sidebar

**Files:**
- Modify: `app/page.js`

**Step 1: Replace old custom CSS classes in Sidebar & Layout**
Replace `.app-container`, `.sidebar`, `.logo-section` styling with Tailwind utility classes:
- Sidebar: sticky sidebar with border-r, slate-navy bg, and nav items with active states highlighted by left-border markers.
- Theme switcher pinned to the bottom.

**Step 2: Verify and Commit**
Verify that the sidebar layout works.
```bash
git add app/page.js
git commit -m "refactor: apply tailwind layout shell and sidebar redesign"
```

---

### Task 6: Refactoring KPI metrics grid

**Files:**
- Modify: `app/page.js`

**Step 1: Replace old .kpi-card & .kpi-row CSS styles**
Configure a responsive grid for the 5 KPI cards. Customize left borders matching the design hierarchy:
- Total Inquiries -> Blue border
- Inquiries Without Quote -> Blue border
- Active Follow-Up -> Yellow border
- Stale Follow-Up (3D+) -> Red border with a pulse dot
- Won Conversion -> Green border

**Step 2: Verify and Commit**
```bash
git add app/page.js
git commit -m "refactor: implement new KPI metrics grid layout"
```

---

### Task 7: Refactoring table, filters and status badges

**Files:**
- Modify: `app/page.js`

**Step 1: Refactor Filters and Search**
Use shadcn Select and Input components for filter rows.

**Step 2: Refactor Table and Status Badges**
Render custom data table with `INQUIRY DATE`, `CUSTOMER`, `ITEMS`, `TYPE`, `QUOT. #`, `LEAD TIME`, `VALUE`, `PIC`, `STATUS`. Map status badges to muted, clean outline-style styles.

**Step 3: Verify and Commit**
Ensure the layout is fully responsive and interactive, keeping all sorting/filtering states intact.
```bash
git add app/page.js
git commit -m "refactor: apply table, search filters, and outline badges"
```

---

### Task 8: Refactoring Modals & Side Drawer

**Files:**
- Modify: `app/page.js`

**Step 1: Refactor drawers and forms**
Replace the custom glassmorphism modal/drawer classes with clean flat surfaces and subtle border styles using Tailwind.

**Step 2: Verify and Commit**
Ensure all state interactions work correctly.
```bash
git add app/page.js
git commit -m "refactor: convert side drawer and creation modals to Tailwind CSS"
```
