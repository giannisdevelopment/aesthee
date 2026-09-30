-- Habitol gcal times are 3h early (07:30 instead of 10:30).
-- Add +3 hours once. Safe to re-run (marker gcal-plus3).

begin;

update public.appointments
set
  appointment_date = (
    (appointment_date + appointment_time + interval '3 hours')::date
  ),
  appointment_time = (
    (appointment_date + appointment_time + interval '3 hours')::time
  ),
  notes = notes || ' · gcal-plus3',
  updated_at = now()
where notes like '%gcal:%'
  and notes not like '%gcal-plus3%';

commit;

-- Today should look like real open hours (≈10:00+)
select appointment_time, cabin_id, guest_name, left(service, 40) as service
from public.appointments
where notes like '%gcal:%'
  and appointment_date = current_date
  and status <> 'cancelled'
order by appointment_time, cabin_id;
