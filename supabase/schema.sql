-- Aesthée — Supabase schema (CRM + booking)
-- Run in: Supabase Dashboard → SQL Editor (full replace / re-run is safe)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Clients (staff CRM)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Visits / payments (staff CRM)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Appointments (public booking + staff management)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.appointment_status as enum (
    'pending',
    'confirmed',
    'cancelled',
    'completed',
    'no_show'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes int not null default 60,
  price_cents int,
  guest_name text not null,
  guest_phone text not null,
  guest_email text,
  status public.appointment_status not null default 'pending',
  notes text,
  client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_name_len check (char_length(trim(guest_name)) >= 2),
  constraint appointments_phone_len check (char_length(trim(guest_phone)) >= 8),
  constraint appointments_duration_pos check (duration_minutes >= 5 and duration_minutes <= 240)
);

alter table public.appointments
  add column if not exists duration_minutes int not null default 60;
alter table public.appointments
  add column if not exists price_cents int;

create index if not exists appointments_date_idx
  on public.appointments (appointment_date, appointment_time);

create index if not exists appointments_status_idx
  on public.appointments (status);

create index if not exists appointments_created_idx
  on public.appointments (created_at desc);

-- One active booking per slot
create unique index if not exists appointments_active_slot_uidx
  on public.appointments (appointment_date, appointment_time)
  where status in ('pending', 'confirmed');

-- ---------------------------------------------------------------------------
-- Contact messages (public form)
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_idx
  on public.contact_messages (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
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

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Public RPCs (anon-safe; no PII leaked in slot checks)
-- ---------------------------------------------------------------------------
drop function if exists public.create_booking(text, date, time, text, text, text);
drop function if exists public.create_booking(text, date, time, text, text, text, int, int);
create or replace function public.get_booked_times(p_date date)
returns setof time
language sql
security definer
set search_path = public
as $$
  select appointment_time
  from public.appointments
  where appointment_date = p_date
    and status in ('pending', 'confirmed')
  order by appointment_time;
$$;

create or replace function public.get_booked_slots(p_date date)
returns table (
  appointment_time time,
  service text,
  duration_minutes int
)
language sql
security definer
set search_path = public
as $$
  select
    a.appointment_time,
    a.service,
    coalesce(a.duration_minutes, 60) as duration_minutes
  from public.appointments a
  where a.appointment_date = p_date
    and a.status in ('pending', 'confirmed')
  order by a.appointment_time;
$$;

create or replace function public.create_booking(
  p_service text,
  p_date date,
  p_time time,
  p_name text,
  p_phone text,
  p_email text default null,
  p_duration_minutes int default 60,
  p_price_cents int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  dow int;
  hh int;
  mm int;
  duration int;
  new_start int;
  new_end int;
  busy record;
  busy_start int;
  busy_end int;
begin
  if p_service is null or char_length(trim(p_service)) < 2 then
    raise exception 'INVALID_SERVICE';
  end if;
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'INVALID_NAME';
  end if;
  if p_phone is null or char_length(trim(p_phone)) < 8 then
    raise exception 'INVALID_PHONE';
  end if;
  if p_date is null or p_time is null then
    raise exception 'INVALID_SLOT';
  end if;
  if p_date < current_date then
    raise exception 'PAST_DATE';
  end if;

  dow := extract(dow from p_date)::int; -- 0=Sun … 6=Sat
  if dow = 0 or dow = 6 then
    raise exception 'WEEKEND_CLOSED';
  end if;

  duration := coalesce(p_duration_minutes, 60);
  if duration < 5 or duration > 240 then
    raise exception 'INVALID_DURATION';
  end if;

  hh := extract(hour from p_time)::int;
  mm := extract(minute from p_time)::int;
  if hh < 10 or hh > 20 then
    raise exception 'INVALID_TIME';
  end if;
  if mm not in (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55) then
    raise exception 'INVALID_TIME';
  end if;

  new_start := hh * 60 + mm;
  new_end := new_start + duration;
  -- Shop closes 21:00
  if new_end > 21 * 60 then
    raise exception 'INVALID_TIME';
  end if;

  for busy in
    select appointment_time, coalesce(duration_minutes, 60) as duration_minutes
    from public.appointments
    where appointment_date = p_date
      and status in ('pending', 'confirmed')
  loop
    busy_start := extract(hour from busy.appointment_time)::int * 60
      + extract(minute from busy.appointment_time)::int;
    busy_end := busy_start + busy.duration_minutes;
    if new_start < busy_end and new_end > busy_start then
      raise exception 'SLOT_TAKEN';
    end if;
  end loop;

  insert into public.appointments (
    service,
    appointment_date,
    appointment_time,
    duration_minutes,
    price_cents,
    guest_name,
    guest_phone,
    guest_email,
    status
  )
  values (
    trim(p_service),
    p_date,
    p_time,
    duration,
    p_price_cents,
    trim(p_name),
    trim(p_phone),
    nullif(trim(coalesce(p_email, '')), ''),
    'pending'
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.submit_contact(
  p_name text,
  p_email text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'INVALID_NAME';
  end if;
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'INVALID_EMAIL';
  end if;
  if p_message is null or char_length(trim(p_message)) < 5 then
    raise exception 'INVALID_MESSAGE';
  end if;

  insert into public.contact_messages (full_name, email, message)
  values (trim(p_name), trim(p_email), trim(p_message))
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.get_booked_times(date) to anon, authenticated;
grant execute on function public.get_booked_slots(date) to anon, authenticated;
grant execute on function public.create_booking(text, date, time, text, text, text, int, int) to anon, authenticated;
grant execute on function public.submit_contact(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.visits enable row level security;
alter table public.appointments enable row level security;
alter table public.contact_messages enable row level security;

-- Clients (staff only)
drop policy if exists "Staff can select clients" on public.clients;
drop policy if exists "Staff can insert clients" on public.clients;
drop policy if exists "Staff can update clients" on public.clients;
drop policy if exists "Staff can delete clients" on public.clients;

create policy "Staff can select clients"
  on public.clients for select to authenticated using (true);
create policy "Staff can insert clients"
  on public.clients for insert to authenticated with check (true);
create policy "Staff can update clients"
  on public.clients for update to authenticated using (true) with check (true);
create policy "Staff can delete clients"
  on public.clients for delete to authenticated using (true);

-- Visits (staff only)
drop policy if exists "Staff can select visits" on public.visits;
drop policy if exists "Staff can insert visits" on public.visits;
drop policy if exists "Staff can update visits" on public.visits;
drop policy if exists "Staff can delete visits" on public.visits;

create policy "Staff can select visits"
  on public.visits for select to authenticated using (true);
create policy "Staff can insert visits"
  on public.visits for insert to authenticated with check (true);
create policy "Staff can update visits"
  on public.visits for update to authenticated using (true) with check (true);
create policy "Staff can delete visits"
  on public.visits for delete to authenticated using (true);

-- Appointments (staff CRUD; public create/read via RPCs only)
drop policy if exists "Staff can select appointments" on public.appointments;
drop policy if exists "Staff can insert appointments" on public.appointments;
drop policy if exists "Staff can update appointments" on public.appointments;
drop policy if exists "Staff can delete appointments" on public.appointments;

create policy "Staff can select appointments"
  on public.appointments for select to authenticated using (true);
create policy "Staff can insert appointments"
  on public.appointments for insert to authenticated with check (true);
create policy "Staff can update appointments"
  on public.appointments for update to authenticated using (true) with check (true);
create policy "Staff can delete appointments"
  on public.appointments for delete to authenticated using (true);

-- Contact messages (staff only; public submit via RPC)
drop policy if exists "Staff can select contact_messages" on public.contact_messages;
drop policy if exists "Staff can update contact_messages" on public.contact_messages;
drop policy if exists "Staff can delete contact_messages" on public.contact_messages;

create policy "Staff can select contact_messages"
  on public.contact_messages for select to authenticated using (true);
create policy "Staff can update contact_messages"
  on public.contact_messages for update to authenticated using (true) with check (true);
create policy "Staff can delete contact_messages"
  on public.contact_messages for delete to authenticated using (true);
