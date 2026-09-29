-- After loading 00-setup + 01-chunk-01 … 01-chunk-10 into _gcal_staging:
-- 1) UPDATE times/dates on existing gcal appointments (fix wrong TZ)
-- 2) INSERT any UIDs still missing
-- 3) Re-apply cabin keywords (μουστάκι/πηγούνι → Κ1/Κ2, not Κ3)
--
-- Do NOT run the old −3h script after this.

begin;

-- ── 1) Sync existing rows by gcal UID ───────────────────────────────────────
update public.appointments a
set
  service = s.service,
  appointment_date = s.appointment_date,
  appointment_time = s.appointment_time,
  duration_minutes = s.duration_minutes,
  price_cents = coalesce(s.price_cents, a.price_cents),
  guest_name = s.guest_name,
  guest_phone = case
    when a.guest_phone is null or a.guest_phone like '000%' then s.guest_phone
    else a.guest_phone
  end,
  notes = s.notes || ' · gcal-resync',
  updated_at = now()
from public._gcal_staging s
where s.gcal_uid is not null
  and position(s.gcal_uid in coalesce(a.notes, '')) > 0;

-- ── 2) Insert missing UIDs ──────────────────────────────────────────────────
insert into public.appointments (
  service, appointment_date, appointment_time, duration_minutes, price_cents,
  guest_name, guest_phone, guest_email, status, notes, client_id
)
select
  s.service,
  s.appointment_date,
  s.appointment_time,
  s.duration_minutes,
  s.price_cents,
  s.guest_name,
  coalesce(nullif(s.guest_phone, ''), '00000000'),
  null,
  'confirmed'::public.appointment_status,
  s.notes || ' · gcal-resync',
  c.id
from public._gcal_staging s
left join lateral (
  select id from public.clients c
  where (
    (c.phone is not null and c.phone not like '000%'
      and regexp_replace(c.phone, '\D', '', 'g')
        = regexp_replace(s.guest_phone, '\D', '', 'g'))
    or translate(lower(trim(c.full_name)), 'άέήίόύώ', 'αεηιουω')
         = translate(lower(trim(s.guest_name)), 'άέήίόύώ', 'αεηιουω')
  )
  order by case when c.phone is not null and c.phone not like '000%' then 0 else 1 end
  limit 1
) c on true
where s.gcal_uid is not null
  and not exists (
    select 1 from public.appointments a
    where position(s.gcal_uid in coalesce(a.notes, '')) > 0
  );

-- ── 3) Cabins ───────────────────────────────────────────────────────────────
create or replace function public._svc_key(raw text)
returns text
language sql
immutable
as $$
  select translate(
    lower(trim(coalesce(raw, ''))),
    'άέήίόύώϊΰΐϋΆΈΉΊΌΎΏ',
    'αεηιουωιυιυαεηιουω'
  );
$$;

update public.appointments
set cabin_id = null, updated_at = now()
where notes like '%gcal:%';

-- laser face: μουστάκι / πηγούνι alone
update public.appointments
set cabin_id = 1, updated_at = now()
where notes like '%gcal:%'
  and cabin_id is null
  and public._svc_key(service || ' ' || coalesce(notes, '')) ~ 'μουστακ|πηγουν'
  and public._svc_key(service || ' ' || coalesce(notes, '')) !~ 'φρυδ|βλεφαριδ|brow|lash';

update public.appointments
set cabin_id = 4, updated_at = now()
where notes like '%gcal:%'
  and cabin_id is null
  and public._svc_key(service || ' ' || coalesce(notes, '')) ~ 'vacum|vacuum|vacutherm';

update public.appointments
set cabin_id = 3, updated_at = now()
where notes like '%gcal:%'
  and cabin_id is null
  and public._svc_key(service || ' ' || coalesce(notes, ''))
    ~ 'φρυδ|βλεφαριδ|brow|lash|κερι|lamination|(τοποθετηση.*βλεφαριδ)|(συντηρηση.*(βλεφαριδ|φρυδ))|σχηματισμ';

update public.appointments
set cabin_id = 5, updated_at = now()
where notes like '%gcal:%'
  and cabin_id is null
  and public._svc_key(service || ' ' || coalesce(notes, ''))
    ~ 'μασαζ|massage|endosphere|πρεσσο|presso|κρυολιπ|μαδερο|madero|morpheus|lemon|σολ|\ysol\y|cavitation|\ybbl\y';

update public.appointments
set cabin_id = 1, updated_at = now()
where notes like '%gcal:%'
  and cabin_id is null;

commit;

select
  (select count(*) from public._gcal_staging) as staged,
  (select count(*) from public.appointments where notes like '%gcal-resync%') as resynced_notes,
  (select count(*) from public.appointments where notes like '%gcal:%') as total_gcal;

-- Today sample
select appointment_time, cabin_id, guest_name, left(service, 40) as service
from public.appointments
where notes like '%gcal:%'
  and appointment_date = current_date
order by appointment_time, cabin_id;
