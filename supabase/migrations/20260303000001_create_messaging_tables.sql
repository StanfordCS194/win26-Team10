-- Messaging tables: conversations between recruiters and students
-- Date: 2026-03-03

-- 1. conversations: one thread per recruiter–student pair
create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    recruiter_id uuid not null references auth.users(id) on delete cascade,
    student_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (recruiter_id, student_id)
);

create index if not exists conversations_recruiter_id_idx on public.conversations (recruiter_id);
create index if not exists conversations_student_id_idx on public.conversations (student_id);

alter table public.conversations enable row level security;

-- Participants can read their own conversations
create policy "Participants can read conversation"
    on public.conversations
    for select
    using (
        auth.uid() = recruiter_id or auth.uid() = student_id
    );

-- Only recruiters can create a conversation
create policy "Recruiters can create conversation"
    on public.conversations
    for insert
    with check (auth.uid() = recruiter_id);

-- Participants can update (e.g. updated_at)
create policy "Participants can update conversation"
    on public.conversations
    for update
    using (
        auth.uid() = recruiter_id or auth.uid() = student_id
    );

-- Trigger to auto-update updated_at on conversations
drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
    before update on public.conversations
    for each row execute procedure public.update_updated_at();

-- 2. messages: messages within a conversation
create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_id uuid not null references auth.users(id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);
create index if not exists messages_created_at_idx on public.messages (created_at);

alter table public.messages enable row level security;

-- Participants of the conversation can read messages
create policy "Participants can read messages"
    on public.messages
    for select
    using (
        exists (
            select 1 from public.conversations c
            where c.id = conversation_id
            and (c.recruiter_id = auth.uid() or c.student_id = auth.uid())
        )
    );

-- Participants can insert messages (and must be the sender)
create policy "Participants can send message"
    on public.messages
    for insert
    with check (
        auth.uid() = sender_id
        and exists (
            select 1 from public.conversations c
            where c.id = conversation_id
            and (c.recruiter_id = auth.uid() or c.student_id = auth.uid())
        )
    );
