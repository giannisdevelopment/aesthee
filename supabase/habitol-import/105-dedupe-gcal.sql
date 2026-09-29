-- Remove duplicate gcal appointments (same day + time + guest + service).
-- Keeps the earliest created row per group.

begin;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        appointment_date,
        appointment_time,
        translate(lower(trim(guest_name)), 'άέήίόύώ', 'αεηιουω'),
        translate(lower(trim(service)), 'άέήίόύώ', 'αεηιουω')
      order by
        case when notes like '%gcal-resync%' then 0 else 1 end,
        created_at asc nulls last,
        id asc
    ) as rn
  from public.appointments
  where notes like '%gcal:%'
    and status <> 'cancelled'
)
delete from public.appointments a
using ranked r
where a.id = r.id
  and r.rn > 1;

commit;

-- Today should be unique
select appointment_time, cabin_id, guest_name, left(service, 40) as service
from public.appointments
where notes like '%gcal:%'
  and appointment_date = current_date
  and status <> 'cancelled'
order by appointment_time, cabin_id;
