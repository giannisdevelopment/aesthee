-- Aesthée CRM schema for Supabase
-- Run in: Supabase Dashboard → SQL Editor

create extension if not exists "pgcrypto";

-- Clients
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  medical_history text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_full_name_idx on public.clients (full_name);
create index if not exists clients_phone_idx on public.clients (phone);

-- Visits / payments
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  treatment text not null,
  payment_amount numeric(10, 2),
  payment_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists visits_client_id_idx on public.visits (client_id);
create index if not exists visits_payment_date_idx on public.visits (payment_date desc);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row
  execute function public.set_updated_at();

-- RLS: only authenticated staff
alter table public.clients enable row level security;
alter table public.visits enable row level security;

drop policy if exists "Staff can select clients" on public.clients;
drop policy if exists "Staff can insert clients" on public.clients;
drop policy if exists "Staff can update clients" on public.clients;
drop policy if exists "Staff can delete clients" on public.clients;

create policy "Staff can select clients"
  on public.clients for select
  to authenticated
  using (true);

create policy "Staff can insert clients"
  on public.clients for insert
  to authenticated
  with check (true);

create policy "Staff can update clients"
  on public.clients for update
  to authenticated
  using (true)
  with check (true);

create policy "Staff can delete clients"
  on public.clients for delete
  to authenticated
  using (true);

drop policy if exists "Staff can select visits" on public.visits;
drop policy if exists "Staff can insert visits" on public.visits;
drop policy if exists "Staff can update visits" on public.visits;
drop policy if exists "Staff can delete visits" on public.visits;

create policy "Staff can select visits"
  on public.visits for select
  to authenticated
  using (true);

create policy "Staff can insert visits"
  on public.visits for insert
  to authenticated
  with check (true);

create policy "Staff can update visits"
  on public.visits for update
  to authenticated
  using (true)
  with check (true);

create policy "Staff can delete visits"
  on public.visits for delete
  to authenticated
  using (true);
