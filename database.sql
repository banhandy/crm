-- ----------------------------------------------------
-- Supabase Schema for CRM Inquiry Handling System
-- Date: 2026-05-26
-- ----------------------------------------------------

-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS public.inquiries CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- Create Customers Table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT UNIQUE NOT NULL,
    sector_business TEXT,
    regional TEXT,
    address TEXT,
    email_address TEXT,
    pic_name TEXT,
    last_contact_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    next_contact_date TIMESTAMP WITH TIME ZONE,
    status_email TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Inquiries Table
CREATE TABLE public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL DEFAULT 'standard', -- 'standard' or 'tvb'
    inquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quotation_date DATE,
    quotation_number TEXT,
    lead_time_days INTEGER,
    item_name TEXT NOT NULL,
    po_number TEXT,
    order_review TEXT,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'Pending Quotation', -- 'Draft', 'Pending Quotation', 'Quotation Sent', 'Follow Up', 'PO Won', 'Canceled'
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_inquiries_customer_id ON public.inquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_last_activity ON public.inquiries(last_activity_at);

-- Enable Realtime subscriptions for updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;

-- Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Allow public read & write access for local simplicity (customizable in production)
CREATE POLICY "Allow public read customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete customers" ON public.customers FOR DELETE USING (true);

CREATE POLICY "Allow public read inquiries" ON public.inquiries FOR SELECT USING (true);
CREATE POLICY "Allow public insert inquiries" ON public.inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update inquiries" ON public.inquiries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete inquiries" ON public.inquiries FOR DELETE USING (true);

-- ----------------------------------------------------
-- Seed Mock Data
-- ----------------------------------------------------

INSERT INTO public.customers (company_name, sector_business, regional, address, email_address, pic_name, last_contact_date, next_contact_date, status_email)
VALUES 
('BOSCH AUTO SVC SOLUTION INC', 'Automotive', 'North America', '123 Bosch Rd', 'contact@bosch.com', 'AFIF NI', timezone('utc'::text, now() - INTERVAL '2 days'), timezone('utc'::text, now() + INTERVAL '10 days'), 'Active'),
('DISC MANUFACTURER CORP', 'Manufacturing', 'Asia', '456 Mold Area', 'info@disc.com', 'PUTRI', timezone('utc'::text, now() - INTERVAL '4 days'), timezone('utc'::text, now() + INTERVAL '5 days'), 'Active'),
('TVB MOTORS LTD', 'Electric Vehicles', 'Europe', '789 EV Avenue', 'support@tvbmotors.com', 'NOVY', timezone('utc'::text, now()), timezone('utc'::text, now() + INTERVAL '7 days'), 'Active'),
('JIGS & FIXTURES GLOBAL', 'Tooling', 'Asia', 'Jig Street 5B', 'ops@jfg.com', 'ERVAN', timezone('utc'::text, now() - INTERVAL '5 days'), timezone('utc'::text, now() + INTERVAL '3 days'), 'Active');

INSERT INTO public.inquiries (customer_id, category, inquiry_date, quotation_number, item_name, status, remark, last_activity_at)
VALUES 
(
    (SELECT id FROM public.customers WHERE company_name = 'BOSCH AUTO SVC SOLUTION INC'), 
    'standard', 
    CURRENT_DATE - 5, 
    NULL, -- Missing quotation number for pending tracking
    'ARM 307039', 
    'Pending Quotation', 
    'Waiting for quality plan document confirmation',
    timezone('utc'::text, now() - INTERVAL '2 days')
),
(
    (SELECT id FROM public.customers WHERE company_name = 'DISC MANUFACTURER CORP'), 
    'standard', 
    CURRENT_DATE - 10, 
    'Q-2026-0044', 
    'DISC F86 ALL SIZE', 
    'Follow Up', 
    'Check flatness casting sizes: 40, 50, 80, 100',
    timezone('utc'::text, now() - INTERVAL '4 days') -- Stale inquiry (no update in last 3 days)
),
(
    (SELECT id FROM public.customers WHERE company_name = 'TVB MOTORS LTD'), 
    'tvb', 
    CURRENT_DATE - 2, 
    'Q-2026-0099', 
    'TVB quotation 100 sets', 
    'Quotation Sent', 
    'Sent quotations via email, waiting for customer feedback',
    timezone('utc'::text, now())
),
(
    (SELECT id FROM public.customers WHERE company_name = 'JIGS & FIXTURES GLOBAL'), 
    'standard', 
    CURRENT_DATE - 15, 
    'Q-2026-0012', 
    'JIG FLATNESS DISC F86 DN 65', 
    'PO Won', 
    'PO received: PO-889922, review complete',
    timezone('utc'::text, now() - INTERVAL '5 days')
);
