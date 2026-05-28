-- ====================================================
-- CRM Inquiry Handling System - Supabase Schema
-- Date: 2026-05-26
-- ====================================================
-- Run this entire script in the Supabase SQL Editor
-- to reset and recreate the database from scratch.
-- ====================================================

-- ====================================================
-- 1. DROP ALL EXISTING TABLES (clean slate)
-- ====================================================
DROP TABLE IF EXISTS public.inquiry_items CASCADE;
DROP TABLE IF EXISTS public.inquiries CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.pic_members CASCADE;

-- ====================================================
-- 2. PIC MEMBERS (Sales team reference)
-- ====================================================
CREATE TABLE public.pic_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================
-- 3. CUSTOMERS TABLE
-- ====================================================
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT UNIQUE NOT NULL,
    sector_business TEXT,
    regional TEXT,
    address TEXT,
    email_address TEXT,
    client_contact_person TEXT,         -- Customer's contact person (client-side)
    pic_name TEXT DEFAULT 'AFIF NI',    -- Internal sales PIC (AFIF NI, PUTRI, ERVAN, NOVY, RANU)
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_contact_date TIMESTAMP WITH TIME ZONE,
    status_email TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================
-- 4. INQUIRIES TABLE (one row per inquiry/quotation group)
-- ====================================================
CREATE TABLE public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,

    -- Inquiry classification
    category TEXT NOT NULL DEFAULT 'others',
    -- Allowed: 'sand casting', 'fabrication', 'investment', 'forging', 'others'

    -- Key dates
    inquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quotation_date DATE,                -- Date quotation was sent to customer
    follow_up_date DATE,                -- Next follow-up date

    -- Quotation reference
    quotation_number TEXT,              -- e.g. "25080009"
    lead_time_days INTEGER,             -- Quoted lead time in working days

    -- Status & tracking
    status TEXT NOT NULL DEFAULT 'Pending Quotation',
    -- Allowed: 'Pending Quotation', 'Submitted', 'Follow Up', 'PO Won', 'Canceled'

    -- PO details (when order is won)
    po_number TEXT,
    order_review TEXT,                  -- OR number / order review reference

    -- Currency for this inquiry
    currency TEXT DEFAULT 'USD',        -- 'USD', 'EUR', 'IDR', etc.

    -- Notes & updates
    remark TEXT,

    -- Timestamps
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================
-- 5. INQUIRY ITEMS TABLE (line items per inquiry)
-- ====================================================
CREATE TABLE public.inquiry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE CASCADE NOT NULL,

    -- Item details
    item_name TEXT NOT NULL,
    material TEXT,
    process TEXT,                       -- Manufacturing process description
    tipe_proses TEXT,                   -- Process type category (SAND CASTING, FABRICATION, etc.)
    qty INTEGER,

    -- Pricing
    cast_price NUMERIC(18, 4),
    mach_price NUMERIC(18, 4),
    surface_treatment NUMERIC(18, 4),
    packing_cost NUMERIC(18, 4),
    cfr NUMERIC(18, 4),
    total_price_per_qty NUMERIC(18, 4),
    total_price NUMERIC(18, 4),
    tooling_cost NUMERIC(18, 4),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================
-- 6. INDEXES
-- ====================================================
CREATE INDEX idx_inquiries_customer_id ON public.inquiries(customer_id);
CREATE INDEX idx_inquiries_status ON public.inquiries(status);
CREATE INDEX idx_inquiries_category ON public.inquiries(category);
CREATE INDEX idx_inquiries_inquiry_date ON public.inquiries(inquiry_date);
CREATE INDEX idx_inquiries_last_activity ON public.inquiries(last_activity_at);
CREATE INDEX idx_inquiry_items_inquiry_id ON public.inquiry_items(inquiry_id);

-- ====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ====================================================
ALTER TABLE public.pic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_items ENABLE ROW LEVEL SECURITY;

-- Allow full public access (anon key) - customise for auth later
CREATE POLICY "Allow all pic_members" ON public.pic_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inquiries" ON public.inquiries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all inquiry_items" ON public.inquiry_items FOR ALL USING (true) WITH CHECK (true);

-- ====================================================
-- 8. REALTIME SUBSCRIPTIONS
-- ====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_items;

-- ====================================================
-- 9. SEED: PIC MEMBERS (Sales Team)
-- ====================================================
INSERT INTO public.pic_members (name) VALUES
    ('AFIF NI'),
    ('PUTRI'),
    ('ERVAN'),
    ('NOVY'),
    ('RANU');

-- ====================================================
-- 10. MIGRATIONS (Updates applied to live database)
-- ====================================================
-- Run the following script in the Supabase SQL Editor
-- to add status and FAI columns to inquiry_items:
ALTER TABLE public.inquiry_items 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending Quotation',
ADD COLUMN IF NOT EXISTS fai_status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_engineer TEXT,
ADD COLUMN IF NOT EXISTS fai_dimensions TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_material_cert TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_test_report TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS fai_remarks TEXT,
ADD COLUMN IF NOT EXISTS fai_date DATE;

-- Populate status of existing items based on their parent Inquiry status
UPDATE public.inquiry_items item
SET status = inq.status
FROM public.inquiries inq
WHERE item.inquiry_id = inq.id AND (item.status IS NULL OR item.status = 'Pending Quotation');

-- ====================================================
-- 11. DRAWING UPLOADS (item_drawings table)
-- ====================================================
-- Run in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.item_drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_item_id UUID REFERENCES public.inquiry_items(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX idx_item_drawings_item_id ON public.item_drawings(inquiry_item_id);
ALTER TABLE public.item_drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all item_drawings" ON public.item_drawings FOR ALL USING (true) WITH CHECK (true);
-- Storage bucket: 'drawings' (private) — create in Supabase Dashboard
-- Storage RLS (SQL Editor): CREATE POLICY "drawings_anon_all" ON storage.objects FOR ALL TO anon USING (bucket_id = 'drawings') WITH CHECK (bucket_id = 'drawings');
-- Path convention: drawings/{inquiry_item_id}/{timestamp}_{filename}

-- ====================================================
-- Done! Run migrate.js next to import Excel data.
-- ====================================================
