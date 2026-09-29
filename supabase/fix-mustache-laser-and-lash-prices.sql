-- 1) All lash placements → €50
-- 2) Μουστάκι / πηγούνι (laser face) → cabin 1 or 2 (not Κ3)
-- 3) Re-insert known Treatwell rows if missing (fingerprint)

begin;

-- Catalog live prices (site + admin booking)
update public.catalog_services
set price_cents = 5000
where id in ('lash-ext-classic', 'lash-ext-volume', 'lash-ext-mix')
   or (
     lower(name) like '%τοποθέτηση%'
     and (
       lower(name) like '%βλεφαρίδ%'
       or lower(name) like '%lash%'
       or lower(name) like '%extension%'
     )
   );

-- Μουστάκι / πηγούνι without brows/lashes → Laser Κ1/Κ2
update public.appointments
set cabin_id = case when coalesce(cabin_id, 0) = 2 then 2 else 1 end,
    updated_at = now()
where cabin_id is distinct from 1
  and cabin_id is distinct from 2
  and (
    translate(lower(service), 'άέήίόύώϊΰΐϋ', 'αεηιουωιυιυ')
      ~ 'μουστακ|πηγουν'
    or translate(lower(coalesce(notes, '')), 'άέήίόύώϊΰΐϋ', 'αεηιουωιυιυ')
      ~ 'μουστακ|πηγουν'
  )
  and translate(lower(service || ' ' || coalesce(notes, '')), 'άέήίόύώϊΰΐϋ', 'αεηιουωιυιυ')
    !~ 'φρυδ|βλεφαριδ|brow|lash';

-- Ensure Treatwell rows exist (no-op if fingerprint already in notes)
insert into public.appointments (
  service, appointment_date, appointment_time, duration_minutes, price_cents,
  guest_name, guest_phone, guest_email, status, notes, cabin_id, client_id
)
select v.service, v.appointment_date::date, v.appointment_time::time, v.duration_minutes, v.price_cents,
       v.guest_name, v.guest_phone, v.guest_email, v.status::public.appointment_status, v.notes, v.cabin_id,
       c.id
from (
  values
    ('ΜΟΥΣΤΑΚΙ+ΠΗΓΟΥΝΙ', '2026-09-29', '13:20', 60, 2000, 'ΚΑΤΙΑ ΛΕΣΣΗ', '6981722561', 'katialessi@icloud.com', 'completed',
     'Treatwell import · twa:2026-09-29|13:20|κατια λεσση|μουστακιπηγουνι|completed|20.0', 2,
     'twa:2026-09-29|13:20|κατια λεσση|μουστακιπηγουνι|completed|20.0'),
    ('ΜΟΥΣΤΑΚΙ+ΠΗΓΟΥΝΙ', '2026-09-29', '18:00', 60, NULL, 'ΦΩΤΕΙΝΗ ΕΥΣΤΑΘΙΟΥ', '6934696215', 'fwteinhefstathiou@gmail.com', 'confirmed',
     'Treatwell import · twa:2026-09-29|18:00|φωτεινη ευσταθιου|μουστακιπηγουνι|confirmed|0', 1,
     'twa:2026-09-29|18:00|φωτεινη ευσταθιου|μουστακιπηγουνι|confirmed|0'),
    ('Ριζική αποτρίχωση με Βελόνα', '2026-10-02', '16:00', 60, NULL, 'ΧΑΙΡΕΤΑΚΗ ΕΛΕΝΗ', '6974701363', NULL, 'confirmed',
     'Treatwell import · twa:2026-10-02|16:00|χαιρετακη ελενη|ριζική αποτρίχωση με βελόνα|confirmed|0', 2,
     'twa:2026-10-02|16:00|χαιρετακη ελενη|ριζική αποτρίχωση με βελόνα|confirmed|0')
) as v(service, appointment_date, appointment_time, duration_minutes, price_cents, guest_name, guest_phone, guest_email, status, notes, cabin_id, fingerprint)
left join public.clients c
  on c.phone is not null
 and regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(v.guest_phone, '\D', '', 'g')
where not exists (
  select 1 from public.appointments a where a.notes like '%' || v.fingerprint || '%'
);

commit;

-- Verify
select id, name, price_cents from public.catalog_services
where id like 'lash-ext%'
order by id;

select appointment_date, appointment_time, cabin_id, guest_name, service
from public.appointments
where guest_name ilike any (array['%ΛΕΣΣΗ%', '%ΕΥΣΤΑΘΙΟΥ%', '%ΧΑΙΡΕΤΑΚΗ%'])
  and appointment_date >= current_date - 1
order by appointment_date, appointment_time;
