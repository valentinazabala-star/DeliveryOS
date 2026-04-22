-- Run this in the Supabase SQL Editor

create table tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED')) default 'PENDING',
  type text,
  account_id uuid,
  assigned_user_id uuid,
  created_at timestamp default now(),
  assigned_at timestamp,
  closed_at timestamp
);

create index idx_tasks_user on tasks(assigned_user_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_closed_at on tasks(closed_at);

-- Enable Row Level Security (required for the publishable/anon key)
alter table tasks enable row level security;

-- Allow all operations for anon role (adjust per your auth requirements)
create policy "Allow all for anon" on tasks
  for all
  to anon
  using (true)
  with check (true);
