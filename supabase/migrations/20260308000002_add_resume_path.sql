-- Migration to add resume_path to applicants table
-- Date: 2026-03-08

-- Add resume_path column to applicants
alter table public.applicants 
    add column if not exists resume_path text;
