-- Aesthée — Treatwell junk cleanup (staff blocks + curated fake contacts)
--
-- STEPS (Supabase → SQL Editor):
--   1. Run SECTION 1 (function) once.
--   2. Run SECTION 2 (preview A + B) and skim names.
--   3. Run SECTION 3 (delete A — staff junk).
--   4. Run SECTION 4 (delete B — curated vague 000… contacts only).
--   5. Run SECTION 5 (verify counts are 0 / low).

-- =============================================================================
-- SECTION 1 — helper function (run once)
-- =============================================================================
create or replace function public._is_treatwell_staff_junk(raw_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  n text;
begin
  if raw_name is null or length(trim(raw_name)) = 0 then
    return false;
  end if;

  n := lower(trim(raw_name));
  n := translate(
    n,
    'άέήίόύώϊΰΐϋὰὲὴὶὸὺὼᾶῆῖῦῶἀἁἄἅἀἐἑἔἕἠἡἤἥἰἱἴἵὀὁὄὅὐὑὔὕὠὡὤὥ',
    'αεηιουωιυιυαεηιουωαηιυωαααααεεεεηηηηιιιιοοοουυυυωωωω'
  );

  if n ~ '(off|0ff|σοσιαλ|social|ρεπο|αρρωστ|walk-?in|υδραυλικ|αφεντικ|βλεφα|ορθοπεδικ|κομμωτηρ|βραβεια)' then
    return true;
  end if;

  if n ~ 'αλλαγη.*(φιλτρ|νερα)' or n ~ 'να ενημερωσω' then
    return true;
  end if;

  if n in ('χαρα', 'ευγενια', 'ευγενεια', 'βασια', 'βα', 'xara', 'walk-in', 'walk in', 'εγω') then
    return true;
  end if;

  if n ~ '(βασια|ευγενεια|ευγενια|χαρα|xara).{0,60}[0-9]{1,2}'
     or n ~ '[0-9]{1,2}.{0,60}(βασια|ευγενεια|ευγενια|χαρα|xara)' then
    return true;
  end if;

  if n ~ 'βασια\s*\(.*καραβη' or n ~ 'ευγενια\s+λειζερ' or n ~ 'μαριος\s+ευγενειασ' then
    return true;
  end if;

  return false;
end;
$$;

-- Curated Group B: vague placeholders only (NOT full-looking real names)
create or replace function public._is_treatwell_vague_000_junk(raw_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  n text;
begin
  if raw_name is null then
    return false;
  end if;

  n := lower(trim(raw_name));
  n := translate(
    n,
    'άέήίόύώϊΰΐϋὰὲὴὶὸὺὼᾶῆῖῦῶἀἁἄἅἀἐἑἔἕἠἡἤἥἰἱἴἵὀὁὄὅὐὑὔὕὠὡὤὥ',
    'αεηιουωιυιυαεηιουωαηιυωαααααεεεεηηηηιιιιοοοουυυυωωωω'
  );
  -- collapse spaces
  n := regexp_replace(n, '\s+', ' ', 'g');

  return n in (
    'μαμα',
    'μαμα ελευθεριασ',
    'ξαδερφος',
    'ελευθερια',
    'ευα',
    'μαιρη',
    'μαρινα',
    'μαριος',
    'μαριος ευγενειασ',
    'αλεξανδροσ αλο',
    'αλεξανανδροσ αλο',
    'αθηνα fn',
    'πισσαρη',
    'tomolari( φιλη κουρμετα)',
    'tomolari(φιλη κουρμετασ)',
    'elizabeth mama klaudias',
    'κωστησ δικηγοροσ',
    'αρλιντο',
    'γεωργινα',
    'georgina',
    'λεονα'
  );
end;
$$;

-- =============================================================================
-- SECTION 2 — PREVIEW (run this, open each result tab)
-- =============================================================================

-- A: staff junk clients
select 'A-client' as kind, full_name, phone
from public.clients
where public._is_treatwell_staff_junk(full_name)
order by full_name;

-- A: staff junk appointments (sample / full list)
select 'A-appt' as kind, guest_name, guest_phone, appointment_date, status
from public.appointments
where public._is_treatwell_staff_junk(guest_name)
order by guest_name, appointment_date desc;

-- A counts
select
  (select count(*) from public.clients where public._is_treatwell_staff_junk(full_name)) as a_clients,
  (select count(*) from public.appointments where public._is_treatwell_staff_junk(guest_name)) as a_appointments;

-- B: vague 000… contacts only (curated delete list)
select 'B-vague' as kind, full_name, phone, left(coalesce(notes, ''), 60) as notes
from public.clients
where coalesce(notes, '') ilike '%Treatwell bookings import%'
  and coalesce(phone, '') like '000%'
  and public._is_treatwell_vague_000_junk(full_name)
order by full_name;

-- B: other 000… contacts that we KEEP (real-looking names)
select 'B-keep' as kind, full_name, phone
from public.clients
where coalesce(notes, '') ilike '%Treatwell bookings import%'
  and coalesce(phone, '') like '000%'
  and not public._is_treatwell_staff_junk(full_name)
  and not public._is_treatwell_vague_000_junk(full_name)
order by full_name;

select
  (select count(*) from public.clients
    where coalesce(notes, '') ilike '%Treatwell bookings import%'
      and coalesce(phone, '') like '000%'
      and public._is_treatwell_vague_000_junk(full_name)) as b_vague_delete,
  (select count(*) from public.clients
    where coalesce(notes, '') ilike '%Treatwell bookings import%'
      and coalesce(phone, '') like '000%'
      and not public._is_treatwell_staff_junk(full_name)
      and not public._is_treatwell_vague_000_junk(full_name)) as b_keep;

-- =============================================================================
-- SECTION 3 — DELETE A (staff junk)
-- Select ONLY this block and run it after preview looks good.
-- =============================================================================
/*
begin;

delete from public.appointments
where public._is_treatwell_staff_junk(guest_name);

delete from public.clients
where public._is_treatwell_staff_junk(full_name);

commit;
*/

-- =============================================================================
-- SECTION 4 — DELETE B (curated vague 000… only)
-- Select ONLY this block and run it after Section 3.
-- =============================================================================
/*
begin;

delete from public.appointments a
using public.clients c
where coalesce(c.notes, '') ilike '%Treatwell bookings import%'
  and coalesce(c.phone, '') like '000%'
  and public._is_treatwell_vague_000_junk(c.full_name)
  and (a.client_id = c.id or (a.guest_phone = c.phone and a.guest_name = c.full_name));

delete from public.appointments
where public._is_treatwell_vague_000_junk(guest_name)
  and guest_phone like '000%';

delete from public.clients
where coalesce(notes, '') ilike '%Treatwell bookings import%'
  and coalesce(phone, '') like '000%'
  and public._is_treatwell_vague_000_junk(full_name);

commit;
*/

-- =============================================================================
-- SECTION 5 — VERIFY
-- =============================================================================
select
  (select count(*) from public.clients where public._is_treatwell_staff_junk(full_name)) as a_clients_left,
  (select count(*) from public.appointments where public._is_treatwell_staff_junk(guest_name)) as a_appts_left,
  (select count(*) from public.clients
    where coalesce(notes, '') ilike '%Treatwell bookings import%'
      and coalesce(phone, '') like '000%'
      and public._is_treatwell_vague_000_junk(full_name)) as b_vague_left,
  (select count(*) from public.clients
    where coalesce(notes, '') ilike '%Treatwell bookings import%'
      and coalesce(phone, '') like '000%'
      and not public._is_treatwell_staff_junk(full_name)
      and not public._is_treatwell_vague_000_junk(full_name)) as b_keep_still_there;
