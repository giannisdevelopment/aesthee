-- Habitol / Google Calendar → Aesthée appointments
-- Source: thetanbar23@gmail.com.ics (Z = Athens wall clock)
-- Events: 7589 (skipped 725)
-- Run ORDER in Supabase SQL Editor:
--   1) 00-setup.sql
--   2) 01-chunk-01.sql … 01-chunk-10.sql
--   3) 104-resync-times-and-cabins.sql  (updates times + inserts missing + cabins)
-- Do NOT run the old −3h / winter scripts after this.

create table if not exists public._gcal_staging (
  service text not null,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes int not null,
  price_cents int,
  guest_name text not null,
  guest_phone text not null,
  status text not null,
  notes text,
  gcal_uid text
);

truncate table public._gcal_staging;

-- Next: run 01-chunk-*.sql in order, then 104-resync-times-and-cabins.sql
