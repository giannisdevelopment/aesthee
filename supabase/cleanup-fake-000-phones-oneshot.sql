-- ONE-SHOT: clear fake 000 phones + remove leftover vague names
-- Paste into Supabase SQL Editor and Run once.

begin;

-- 1) Wipe fake phones on clients
update public.clients
set phone = null,
    updated_at = now()
where phone like '000%';

-- 2) Mark fake phones on appointments (schema requires non-null ≥8 chars)
update public.appointments
set guest_phone = '00000000',
    updated_at = now()
where guest_phone like '000%'
  and guest_phone <> '00000000';

-- 3) Delete leftover vague contacts
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

-- Should be 0 / 0
select
  (select count(*) from public.clients where phone like '000%') as clients_000_left,
  (select count(*) from public.clients
    where full_name ilike '%tomolari%'
       or full_name ilike '%ευγενείας%'
       or full_name ilike '%ευγενειας%') as vague_left;
