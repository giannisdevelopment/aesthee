-- Remove duplicate ΚΑΤΙΑ ΛΕΣΣΗ ΜΟΥΣΤΑΚΙ+ΠΗΓΟΥΝΙ (same day/time — keep one in Κ2)

begin;

-- Preview duplicates (same guest + date + time + service)
select id, cabin_id, status, left(notes, 80) as notes, created_at
from public.appointments
where guest_name ilike '%ΛΕΣΣΗ%'
  and appointment_date = '2026-09-29'
  and appointment_time = '13:20:00'
  and service ilike '%ΜΟΥΣΤΑΚΙ%'
order by cabin_id, created_at;

-- Keep the Treatwell fingerprint row in Κ2; delete the extra
with dups as (
  select id,
         row_number() over (
           order by
             case when notes like '%twa:2026-09-29|13:20|κατια λεσση%' then 0 else 1 end,
             case when cabin_id = 2 then 0 else 1 end,
             created_at asc
         ) as rn
  from public.appointments
  where guest_name ilike '%ΛΕΣΣΗ%'
    and appointment_date = '2026-09-29'
    and appointment_time = '13:20:00'
    and (
      service ilike '%ΜΟΥΣΤΑΚΙ%'
      or service ilike '%ΠΗΓΟΥΝΙ%'
    )
)
delete from public.appointments a
using dups
where a.id = dups.id
  and dups.rn > 1;

-- Ensure survivor is Laser cabin
update public.appointments
set cabin_id = 2, updated_at = now()
where guest_name ilike '%ΛΕΣΣΗ%'
  and appointment_date = '2026-09-29'
  and appointment_time = '13:20:00'
  and (
    service ilike '%ΜΟΥΣΤΑΚΙ%'
    or service ilike '%ΠΗΓΟΥΝΙ%'
  );

commit;

select appointment_date, appointment_time, cabin_id, guest_name, service
from public.appointments
where guest_name ilike any (array['%ΛΕΣΣΗ%', '%ΕΥΣΤΑΘΙΟΥ%', '%ΧΑΙΡΕΤΑΚΗ%'])
  and appointment_date >= current_date - 1
order by appointment_date, appointment_time, cabin_id;
