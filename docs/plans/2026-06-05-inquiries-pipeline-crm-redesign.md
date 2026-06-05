# Design Doc: Inquiries Pipeline CRM Redesign

**Date:** 2026-06-05
**Status:** Approved

## Goal
Redesign the "Inquiries Pipeline" CRM layout into a high-fidelity, minimalist SaaS interface using Tailwind CSS and shadcn/ui primitives. The layout matches a slate/steel-navy dark mode aesthetic with flat surfaces, subtle borders, and smooth light/dark transitions.

---

## 1. Styling System & Theme Configuration

### Tailwind Integration
Tailwind CSS and PostCSS will be configured at the root. We will define a custom HSL or RGB theme structure in `tailwind.config.js` to map to existing global variables:
*   `bg-app`: Slate/Navy `#131e2c` (dark) / Slate-light `#f4f5f7` (light)
*   `bg-sidebar`: `#0f1a27` (dark) / `#f8f9fa` (light)
*   `bg-card`: `#192739` (dark) / `#ffffff` (light)
*   `border-color`: `rgba(139, 162, 188, 0.12)` (dark) / `#e5e7eb` (light)

### Theme Provider (`next-themes`)
*   Configure `next-themes` client-side wrapper to support standard class-based dark mode (`darkMode: "class"`).
*   Scaffold a `ThemeProvider` wrap in `app/layout.js`.

---

## 2. Layout & Components

### Sidebar Shell
*   Left-hand sticky sidebar with a clean brand logo header `"C CRM Core"`.
*   Active nav tabs highlighted with a left border accent (`border-l-4 border-blue-500`).
*   Theme switching block and user profile details pinned to the bottom.

### KPI Cards Ribbon
5 KPI cards with custom 4px left-border accent colors:
1.  **Total Inquiries** -> Blue border (`border-l-4 border-blue-500`)
2.  **Inquiries Without Quote** -> Blue border (`border-l-4 border-blue-500`)
3.  **Active Follow-Up** -> Yellow border (`border-l-4 border-amber-500`)
4.  **Stale Follow-Up (3D+)** -> Red border (`border-l-4 border-red-500`) with an animated red pulse dot indicator.
5.  **Won Conversion** -> Green border (`border-l-4 border-emerald-500`)

### Filters & Data Table
*   Minimalist filters using shadcn Select and Input components.
*   Data table containing headers: `INQUIRY DATE`, `CUSTOMER`, `ITEMS`, `TYPE`, `QUOT. #`, `LEAD TIME`, `VALUE`, `PIC`, `STATUS`.
*   Outline-style badges for statuses (muted, low-opacity, and thin borders) instead of bright filled blocks.

---

## 3. Preservation of Logic
All Supabase database handlers, PDF drawing uploads, client/inquiry creation forms, real-time channels, and the First Article Inspection (FAI) timeline tracker will remain fully functional and integrated within the refactored code.
