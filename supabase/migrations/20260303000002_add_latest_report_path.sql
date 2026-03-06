-- Migration to add latest_report_path to applicants table
-- Date: 2026-03-03

-- 1. Add latest_report_path column to applicants table
ALTER TABLE public.applicants 
ADD COLUMN IF NOT EXISTS latest_report_path TEXT;

-- 2. Update existing applicants table to have the column (if not already present via ALTER)
-- This is already handled by ADD COLUMN IF NOT EXISTS.
