-- Habitol merge into appointments

create or replace function public._client_name_key(raw text)
returns text
language sql
immutable
as $$
  select coalesce(
    (
      select string_agg(w, ' ' order by w)
      from unnest(
        string_to_array(
          regexp_replace(
            translate(
              lower(trim(coalesce(raw, ''))),
              'άέήίόύώϊΰΐϋὰὲὴὶὸὺὼᾶῆῖῦῶΆΈΉΊΌΎΏ',
              'αεηιουωιυιυαεηιουωαηιυωαεηιουω'
            ),
            '[^a-z0-9α-ω\s]',
            ' ',
            'g'
          ),
          ' '
        )
      ) as w
      where w <> ''
    ),
    ''
  );
$$;

-- Prefer real client phone when staging has placeholder
update public._gcal_staging s
set guest_phone = c.phone
from public.clients c
where (s.guest_phone is null or s.guest_phone like '000%')
  and c.phone is not null
  and c.phone not like '000%'
  and public._client_name_key(c.full_name) = public._client_name_key(s.guest_name);

insert into public.appointments (
  service, appointment_date, appointment_time, duration_minutes, price_cents,
  guest_name, guest_phone, guest_email, status, notes, client_id
)
select distinct on (s.appointment_date, s.appointment_time, public._client_name_key(s.guest_name), s.service)
  s.service,
  s.appointment_date,
  s.appointment_time,
  s.duration_minutes,
  s.price_cents,
  s.guest_name,
  coalesce(nullif(s.guest_phone, ''), '00000000'),
  null,
  'confirmed'::public.appointment_status,
  s.notes,
  c.id
from public._gcal_staging s
left join lateral (
  select id from public.clients c
  where (
    (c.phone is not null and c.phone not like '000%'
      and regexp_replace(c.phone, '\D', '', 'g')
        = regexp_replace(s.guest_phone, '\D', '', 'g'))
    or public._client_name_key(c.full_name) = public._client_name_key(s.guest_name)
  )
  order by
    case when c.phone is not null and c.phone not like '000%' then 0 else 1 end,
    c.updated_at desc nulls last
  limit 1
) c on true
where not exists (
  select 1 from public.appointments a
  where s.gcal_uid is not null
    and position(s.gcal_uid in coalesce(a.notes, '')) > 0
)
and not exists (
  select 1 from public.appointments a
  where a.appointment_date = s.appointment_date
    and a.appointment_time = s.appointment_time
    and public._client_name_key(a.guest_name) = public._client_name_key(s.guest_name)
)
order by s.appointment_date, s.appointment_time, public._client_name_key(s.guest_name), s.service;

select
  (select count(*) from public._gcal_staging) as staged,
  (select count(*) from public.appointments where notes ilike '%gcal:%') as appts_with_gcal_uid,
  (select count(*) from public.appointments) as total_appointments;
