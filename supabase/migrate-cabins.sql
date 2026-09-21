-- Cabin-aware booking: run in Supabase SQL editor on production.
-- Cabins: 1–2 face+laser, 3 brows/lashes/wax, 4 Vacutherm, 5 body+massage

alter table public.appointments
  add column if not exists cabin_id smallint;

alter table public.appointments
  drop constraint if exists appointments_cabin_range;
alter table public.appointments
  add constraint appointments_cabin_range
  check (cabin_id is null or (cabin_id >= 1 and cabin_id <= 5));

create index if not exists appointments_cabin_date_idx
  on public.appointments (appointment_date, cabin_id, appointment_time);

drop index if exists appointments_active_slot_uidx;

create or replace function public.booking_cabin_pool(p_service text)
returns smallint[]
language plpgsql
immutable
as $$
declare
  s text := lower(trim(coalesce(p_service, '')));
begin
  if s like '%vacutherm%' then
    return array[4]::smallint[];
  end if;

  if s like '%μασάζ%'
     or s like '%endosphere%'
     or s like '%cavitation%'
     or s like '%vacuum bbl%'
     or s like '%vacum bbl%'
     or s like '%πρεσσο%'
     or s like '%κρυολιπ%'
     or s like '%μαδερο%'
     or (s like '%rf%' and s like '%σώμα%')
  then
    return array[5]::smallint[];
  end if;

  if s like '%brow%'
     or s like '%lash%'
     or s like '%φρύδ%'
     or s like '%βλεφαρίδ%'
     or s like '%κερί%'
     or s like '%σχηματισμός%'
     or s like '%extension%'
  then
    return array[3]::smallint[];
  end if;

  return array[1, 2]::smallint[];
end;
$$;

drop function if exists public.get_booked_slots(date);
create or replace function public.get_booked_slots(p_date date)
returns table (
  appointment_time time,
  service text,
  duration_minutes int,
  cabin_id smallint
)
language sql
security definer
set search_path = public
as $$
  select
    a.appointment_time,
    a.service,
    coalesce(a.duration_minutes, 60) as duration_minutes,
    a.cabin_id
  from public.appointments a
  where a.appointment_date = p_date
    and a.status in ('pending', 'confirmed')
  order by a.appointment_time;
$$;

drop function if exists public.create_booking(text, date, time, text, text, text);
drop function if exists public.create_booking(text, date, time, text, text, text, int, int);
drop function if exists public.create_booking(text, date, time, text, text, text, int, int, int);

create or replace function public.create_booking(
  p_service text,
  p_date date,
  p_time time,
  p_name text,
  p_phone text,
  p_email text default null,
  p_duration_minutes int default 60,
  p_price_cents int default null,
  p_cabin_id int default null
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
  pool smallint[];
  chosen smallint;
  candidate smallint;
  cabin_free boolean;
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

  dow := extract(dow from p_date)::int;
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
  if new_end > 21 * 60 then
    raise exception 'INVALID_TIME';
  end if;

  pool := public.booking_cabin_pool(p_service);
  chosen := null;

  if p_cabin_id is not null then
    if not (p_cabin_id = any (pool)) then
      raise exception 'SLOT_TAKEN';
    end if;
    cabin_free := true;
    for busy in
      select appointment_time, coalesce(duration_minutes, 60) as duration_minutes
      from public.appointments
      where appointment_date = p_date
        and status in ('pending', 'confirmed')
        and cabin_id = p_cabin_id
    loop
      busy_start := extract(hour from busy.appointment_time)::int * 60
        + extract(minute from busy.appointment_time)::int;
      busy_end := busy_start + busy.duration_minutes;
      if new_start < busy_end and new_end > busy_start then
        cabin_free := false;
        exit;
      end if;
    end loop;
    if cabin_free then
      chosen := p_cabin_id::smallint;
    end if;
  end if;

  if chosen is null then
    foreach candidate in array pool
    loop
      cabin_free := true;
      for busy in
        select
          appointment_time,
          coalesce(duration_minutes, 60) as duration_minutes,
          service
        from public.appointments
        where appointment_date = p_date
          and status in ('pending', 'confirmed')
          and (
            cabin_id = candidate
            or (
              cabin_id is null
              and candidate = (public.booking_cabin_pool(service))[1]
            )
          )
      loop
        busy_start := extract(hour from busy.appointment_time)::int * 60
          + extract(minute from busy.appointment_time)::int;
        busy_end := busy_start + busy.duration_minutes;
        if new_start < busy_end and new_end > busy_start then
          cabin_free := false;
          exit;
        end if;
      end loop;
      if cabin_free then
        chosen := candidate;
        exit;
      end if;
    end loop;
  end if;

  if chosen is null then
    raise exception 'SLOT_TAKEN';
  end if;

  insert into public.appointments (
    service,
    appointment_date,
    appointment_time,
    duration_minutes,
    price_cents,
    cabin_id,
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
    chosen,
    trim(p_name),
    trim(p_phone),
    nullif(trim(coalesce(p_email, '')), ''),
    'pending'
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.booking_cabin_pool(text) to anon, authenticated;
grant execute on function public.get_booked_slots(date) to anon, authenticated;
grant execute on function public.create_booking(text, date, time, text, text, text, int, int, int) to anon, authenticated;

-- Optional: backfill cabin_id on existing rows
update public.appointments a
set cabin_id = (public.booking_cabin_pool(a.service))[1]
where a.cabin_id is null;
