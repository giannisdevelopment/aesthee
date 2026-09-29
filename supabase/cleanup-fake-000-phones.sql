-- Aesthée — clear fake 000… phones from Treatwell bookings import
-- (and remove a few leftover vague contacts that slipped past the earlier cleanup)
--
-- Run in Supabase → SQL Editor, one section at a time.

-- =============================================================================
-- 1) PREVIEW
-- =============================================================================
select id, full_name, phone, left(coalesce(notes, ''), 60) as notes
from public.clients
where coalesce(phone, '') like '000%'
order by full_name;

select count(*) as clients_with_fake_000_phones
from public.clients
where coalesce(phone, '') like '000%';

-- leftover vague names still in CRM (delete these too)
select id, full_name, phone
from public.clients
where translate(lower(trim(full_name)),
  'άέήίόύώϊΰΐϋ',
  'αεηιουωιυιυ'
) ~ '(μαριος\s+ευγενειασ|tomolari|φιλη κουρμετ)'
order by full_name;

-- =============================================================================
-- 2) FIX — uncomment and run after preview looks right
-- =============================================================================
/*
begin;

update public.clients
set phone = null,
    updated_at = now()
where coalesce(phone, '') like '000%';

update public.appointments
set guest_phone = '00000000',
    updated_at = now()
where guest_phone like '000%'
  and guest_phone <> '00000000';

delete from public.appointments a
using public.clients c
where c.id = a.client_id
  and translate(lower(trim(c.full_name)),
    'άέήίόύώϊΰΐϋ',
    'αεηιουωιυιυ'
  ) ~ '(μαριος\s+ευγενειασ|tomolari|φιλη κουρμετ)';

delete from public.appointments
where translate(lower(trim(guest_name)),
  'άέήίόύώϊΰΐϋ',
  'αεηιουωιυιυ'
) ~ '(μαριος\s+ευγενειασ|tomolari|φιλη κουρμετ)';

delete from public.clients
where translate(lower(trim(full_name)),
  'άέήίόύώϊΰΐϋ',
  'αεηιουωιυιυ'
) ~ '(μαριος\s+ευγενειασ|tomolari|φιλη κουρμετ)';

commit;
*/

-- =============================================================================
-- 3) VERIFY — expect 0 / 0
-- =============================================================================
select count(*) as clients_still_with_000
from public.clients
where coalesce(phone, '') like '000%';

select count(*) as leftover_vague
from public.clients
where translate(lower(trim(full_name)),
  'άέήίόύώϊΰΐϋ',
  'αεηιουωιυιυ'
) ~ '(μαριος\s+ευγενειασ|tomolari|φιλη κουρμετ)';

-- =============================================================================
-- 4) If leftover_vague = 1 — show who, then uncomment delete
-- =============================================================================
select id, full_name, phone, notes
from public.clients
where full_name ilike '%tomolari%'
   or full_name ilike '%ευγενείας%'
   or full_name ilike '%ευγενειας%'
   or full_name ilike '%φιλη κουρμετ%'
   or full_name ilike '%φίλη κουρμετ%';

/*
begin;

delete from public.appointments a
using public.clients c
where c.id = a.client_id
  and (
    c.full_name ilike '%tomolari%'
    or c.full_name ilike '%ευγενείας%'
    or c.full_name ilike '%ευγενειας%'
    or c.full_name ilike '%φιλη κουρμετ%'
    or c.full_name ilike '%φίλη κουρμετ%'
  );

delete from public.appointments
where guest_name ilike '%tomolari%'
   or guest_name ilike '%ευγενείας%'
   or guest_name ilike '%ευγενειας%'
   or guest_name ilike '%φιλη κουρμετ%'
   or guest_name ilike '%φίλη κουρμετ%';

delete from public.clients
where full_name ilike '%tomolari%'
   or full_name ilike '%ευγενείας%'
   or full_name ilike '%ευγενειας%'
   or full_name ilike '%φιλη κουρμετ%'
   or full_name ilike '%φίλη κουρμετ%';

commit;
*/
