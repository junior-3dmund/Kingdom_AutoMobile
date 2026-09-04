create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vehicle text,
  vehicle_id text,
  name text,
  contact text,
  message text,
  status text default 'new',
  reply text,
  history jsonb default '[]'::jsonb
);

alter table public.inquiries enable row level security;

create policy if not exists "Public can insert inquiries"
  on public.inquiries
  for insert
  with check (true);

create policy if not exists "Authenticated users can read inquiries"
  on public.inquiries
  for select
  using (auth.role() = 'authenticated');
