-- Prompt manager storage for transcript pipeline prompts.
-- Run this in Supabase SQL editor once.

create table if not exists public.pipeline_prompts (
  key text primary key,
  title text,
  step text,
  sort_order integer,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.pipeline_prompts enable row level security;

-- Service role can always read/write (used by server middleware).
-- This policy enables optional signed-in dashboard use too.
create policy if not exists "pipeline_prompts_select_authenticated"
on public.pipeline_prompts
for select
to authenticated
using (true);

create policy if not exists "pipeline_prompts_update_authenticated"
on public.pipeline_prompts
for all
to authenticated
using (true)
with check (true);
