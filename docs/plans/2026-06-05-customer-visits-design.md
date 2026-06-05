# CRM Customer Visits and Meeting Minutes Design

**Date:** 2026-06-05  
**Status:** Approved  

This document details the design for adding customer visit scheduling, meeting minutes reports, and file attachment uploads to the CRM application.

---

## 1. Requirements

* **Schedules**: Track upcoming customer visits.
* **Meeting Minutes**: Record summaries and details of visits.
* **Visit Direction**: Support both "Our Visit to Customer" and "Customer Visit to Us".
* **Attachments**: Support uploading various file types (PDF, DOCX, XLSX, images) as meeting minutes attachments.
* **Integrations**: Link visits primarily to a Customer (required) and optionally to a specific Inquiry (deal). Display history logs in both Customer and Inquiry detail drawers.

---

## 2. Database Schema

A new table `customer_visits` will be created in Supabase:

```sql
create table public.customer_visits (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete cascade not null,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  title text not null,
  visit_type text not null check (visit_type in ('Our Visit to Customer', 'Customer Visit to Us')),
  scheduled_at timestamptz not null,
  pic_name text not null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Canceled')),
  minutes_summary text,
  minutes_file_path text,
  minutes_file_name text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable real-time replication
alter table public.customer_visits replica identity full;
```

---

## 3. Storage Architecture

Attachments will be stored inside the existing `'drawings'` Supabase storage bucket, using a path prefix `minutes/` to isolate them:
* **Storage Path**: `minutes/${visit_id}_${original_filename}`
* **Allowed MIME Types**: PDF, Word (DOC/DOCX), Excel (XLS/XLSX), Images (PNG/JPG/JPEG).

---

## 4. UI Architecture

### A. Navigation Tab
* A new navigation tab **Visits** (represented by a calendar/users icon) will be added to both the desktop sidebar and the mobile bottom navigation bar.
* Displays scheduled/completed visits with filters for Date, Status, and Search.

### B. Modals
* **Schedule Visit Modal**: Allows selecting Customer, optional active Inquiry, Title, Direction/Type, Date & Time, and PIC.
* **Complete/Log Visit Modal**: Form to input `minutes_summary`, upload file attachments, and mark status as `Completed`.

### C. Details Drawer Integration
* In the Customer details drawer, render a list of related visits.
* In the Inquiry details drawer, render a list of related visits.
* Provide quick download links for files.
