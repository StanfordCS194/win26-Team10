-- Track per-participant read state for conversations
-- Date: 2026-03-09

alter table if exists public.conversations
  add column if not exists recruiter_last_read_at timestamptz,
  add column if not exists student_last_read_at timestamptz;

create index if not exists conversations_recruiter_last_read_at_idx
  on public.conversations (recruiter_last_read_at);

create index if not exists conversations_student_last_read_at_idx
  on public.conversations (student_last_read_at);

