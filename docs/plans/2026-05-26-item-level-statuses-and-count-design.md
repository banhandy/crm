# Item-Level Statuses and Count Design

## Overview
This document outlines the design for introducing item-level statuses and replacing the tall card-pile rendering in the Inquiries Pipeline with a clean item count badge, with detailed status aggregation logic.

## Proposed Design Details

### 1. Database Schema
We add a `status` column to the `inquiry_items` table and populate it with the parent inquiry's status to ensure backward compatibility.

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

-- Populate existing rows
UPDATE public.inquiry_items item
SET status = inq.status
FROM public.inquiries inq
WHERE item.inquiry_id = inq.id AND (item.status IS NULL OR item.status = 'Pending Quotation');
```

### 2. Grid Table Updates
- Change the `Items & Details` (Pipeline) and `Items` (Stale) headers to `Items`.
- Render a compact, non-stretching glassmorphic pill showing the count of items: `📦 N Items`.

### 3. Dynamic Status Resolution
In the grid row, we display a status resolved at runtime:
- All items `PO Won` -> `PO Won` (Green)
- Some items `PO Won`, some `Canceled`/other -> `PO Won (X/Y)` (Violet-to-Emerald gradient)
- All items `Canceled` -> `Canceled` (Red)
- Fallback -> Highest precedence active status: `Follow Up` > `Submitted` > `Pending Quotation`

### 4. Edit Drawer Status Dropdown
Add a status selector inside the item cards in the wide Edit Drawer, and sync this field back to Supabase.
