-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- kv_store: generic key-value persistence for DeliveryOS server state
-- Stores: task-statuses, feedback-history, team-overrides, last-assignment,
--         and assignment-history:{date}_{mode} entries
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists kv_store (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Auto-update updated_at on upsert
create or replace function kv_store_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kv_store_touch_trigger on kv_store;
create trigger kv_store_touch_trigger
  before insert or update on kv_store
  for each row execute function kv_store_touch();

-- Enable Row Level Security
alter table kv_store enable row level security;

-- Allow all operations for anon role (server uses anon key)
drop policy if exists "Allow all for anon" on kv_store;
create policy "Allow all for anon" on kv_store
  for all to anon
  using (true)
  with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- tasks table (kept for compatibility / future use)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED')) default 'PENDING',
  type text,
  account_id uuid,
  assigned_user_id uuid,
  created_at timestamptz default now(),
  assigned_at timestamptz,
  closed_at timestamptz
);

create index if not exists idx_tasks_user      on tasks(assigned_user_id);
create index if not exists idx_tasks_status    on tasks(status);
create index if not exists idx_tasks_closed_at on tasks(closed_at);

alter table tasks enable row level security;

drop policy if exists "Allow all for anon" on tasks;
create policy "Allow all for anon" on tasks
  for all to anon
  using (true)
  with check (true);
