# Inquiry Handling CRM Implementation Plan

> **For Antigravity:** REQUIRED SUB-SKILL: Load executing-plans to implement this plan task-by-task.

**Goal**: Build a modern, highly functional single-page Inquiry Handling CRM with real-time dashboards, automated follow-up status tracking, customer directory views, and interactive side-drawers using Next.js and Supabase.

**Architecture**: Decoupled serverless architecture. Next.js App Router (React) on the frontend handles page states, client routes, and real-time state sync. Supabase provides PostgreSQL storage, email authentication, and WebSockets-based Realtime subscriptions.

**Tech Stack**: Next.js, React, Supabase JS SDK, Lucide Icons, Custom Vanilla CSS (HSL-tailored Glassmorphic Design).

---

## Task 1: Supabase Database Initialization

**Files**:
- Create: `database.sql`

**Step 1: Write SQL Schema Script**
Create `database.sql` in the project root with tables, relations, indexes, and default mock data.

```sql
-- Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
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

-- Inquiries Table
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL DEFAULT 'standard',
    inquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quotation_date DATE,
    quotation_number TEXT,
    lead_time_days INTEGER,
    item_name TEXT NOT NULL,
    po_number TEXT,
    order_review TEXT,
    remark TEXT,
    status TEXT NOT NULL DEFAULT 'Pending Quotation',
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;

-- Seed Sample Data
INSERT INTO public.customers (company_name, sector_business, regional, address, email_address, pic_name, status_email)
VALUES 
('BOSCH AUTO SVC SOLUTION INC', 'Automotive', 'North America', '123 Bosch Rd', 'contact@bosch.com', 'Afif', 'Active'),
('DISC MANUFACTURER CORP', 'Manufacturing', 'Asia', '456 Mold Area', 'info@disc.com', 'Putri', 'Active');

INSERT INTO public.inquiries (customer_id, category, item_name, status, remark)
VALUES 
((SELECT id FROM public.customers WHERE company_name = 'BOSCH AUTO SVC SOLUTION INC'), 'standard', 'ARM 307039', 'Pending Quotation', 'Awaiting drawing assembly approvals'),
((SELECT id FROM public.customers WHERE company_name = 'DISC MANUFACTURER CORP'), 'standard', 'DISC F86 ALL SIZE', 'Follow Up', 'Check casting results for sample runs');
```

**Step 2: Commit**
```bash
git add database.sql
git commit -m "db: add database initialization sql schema"
```

---

## Task 2: Project Scaffolding and Dependency Installation

**Files**:
- Create: `package.json`
- Create: `next.config.js`
- Create: `.env.local`

**Step 1: Write package.json**
Create a clean `package.json` with Next.js and Supabase dependencies.

```json
{
  "name": "crm-inquiry-handler",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.4",
    "lucide-react": "^0.395.0",
    "next": "^14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

**Step 2: Write next.config.js**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    Supabase_url: process.env.Supabase_url,
    Supabase_Key: process.env.Supabase_Key,
  }
};
module.exports = nextConfig;
```

**Step 3: Write .env.local**
Configure credentials for local development.
```env
NEXT_PUBLIC_SUPABASE_URL=https://glzofointffdrqysclar.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xtnQ8X9WePsQx1zSDu6tAQ_MveqKRGz
Supabase_url=https://glzofointffdrqysclar.supabase.co
Supabase_Key=sb_publishable_xtnQ8X9WePsQx1zSDu6tAQ_MveqKRGz
```

**Step 4: Install Dependencies**
Run: `npm install`
Expected: Installs all packages with zero audit vulnerabilities.

**Step 5: Commit**
```bash
git add package.json next.config.js .env.local
git commit -m "chore: scaffold base next.js files and install dependencies"
```

---

## Task 3: Design System and Styling Setup

**Files**:
- Create: `app/globals.css`

**Step 1: Implement custom CSS variables, themes, and styles**
Write global stylesheets containing visual animations, HSL colors (neon accents), glassmorphic classes, and responsive grids.

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

:root {
  --font-family: 'Outfit', sans-serif;
  --bg-app: #0d0f12;
  --bg-sidebar: rgba(20, 24, 30, 0.85);
  --bg-card: rgba(28, 34, 43, 0.6);
  --text-main: #f3f4f6;
  --text-muted: #9ca3af;
  --border-color: rgba(255, 255, 255, 0.08);
  
  --color-won: #10b981;
  --color-pending: #3b82f6;
  --color-follow: #f59e0b;
  --color-stale: #ef4444;
  --color-accent: #8b5cf6;
}

[data-theme="light"] {
  --bg-app: #f9fafb;
  --bg-sidebar: #ffffff;
  --bg-card: #f3f4f6;
  --text-main: #111827;
  --text-muted: #6b7280;
  --border-color: rgba(0, 0, 0, 0.08);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: var(--font-family);
}

body {
  background-color: var(--bg-app);
  color: var(--text-main);
  overflow-x: hidden;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* Glassmorphism panel class */
.glass-panel {
  background: var(--bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}
```

**Step 2: Commit**
```bash
git add app/globals.css
git commit -m "style: establish premium glassmorphic styling and variables"
```

---

## Task 4: Supabase Connection Client Setup

**Files**:
- Create: `lib/supabaseClient.js`

**Step 1: Write supabase client wrapper**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.Supabase_url;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.Supabase_Key;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

**Step 2: Commit**
```bash
git add lib/supabaseClient.js
git commit -m "feat: initialize supabase connection client wrapper"
```

---

## Task 5: CRM Core Layout and UI Shell

**Files**:
- Create: `app/layout.js`
- Create: `app/page.js`

**Step 1: Write app/layout.js**
Set up the standard layout shell with appropriate SEO tags.
```javascript
import './globals.css';

export const metadata = {
  title: 'CRM - Inquiry Handling System',
  description: 'A premium dashboard to manage corporate inquiries, quotation records, and client follow-ups.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**Step 2: Write app/page.js**
Write the main dashboard containing sidebar navigations, tab selections, realtime hook subscriptions, search filters, side-drawer edits, and responsive layouts.

**Step 3: Commit**
```bash
git add app/layout.js app/page.js
git commit -m "feat: implement main dashboard layouts and realtime database views"
```

---

## Task 6: Testing & Vercel Verification

**Step 1: Test build compilation**
Run: `npm run build`
Expected: Next.js compiles the app successfully.

**Step 2: Push & Deploy**
Verify that changes are pushed to GitHub repository to automatically update Vercel deployment.
