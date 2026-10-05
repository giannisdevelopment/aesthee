-- Χαλαρωτικό μασάζ €25 (not €40) + add Morpheus to catalog.
-- Also drop leftover unique indexes that blocked several visits
-- for the same client on the same day.

update public.catalog_services
set price_cents = 2500, updated_at = now()
where id = 'massage-relaxing';

update public.appointments
set price_cents = 2500, updated_at = now()
where price_cents = 4000
  and regexp_replace(lower(service), '[^a-zα-ωάέήίόύώϊϋΐΰ]', '', 'g')
      like '%χαλαρωτικομασαζ%';

insert into public.catalog_services (
  id, category_id, category_label, name, duration_minutes, price_cents,
  price_from, is_offer, sort_order, is_active
) values (
  'morpheus', 'body', 'Θεραπείες σώματος', 'Morpheus', 60, 15000,
  false, false, 995, true
)
on conflict (id) do update
set
  category_id = excluded.category_id,
  category_label = excluded.category_label,
  name = excluded.name,
  is_active = true,
  updated_at = now();

drop index if exists public.appointments_active_slot_uidx;
drop index if exists public.appointments_client_day_uidx;
drop index if exists public.appointments_phone_day_uidx;
drop index if exists public.appointments_guest_day_uidx;
drop index if exists public.appointments_client_date_uidx;
drop index if exists public.appointments_guest_phone_date_uidx;

select id, name, price_cents, is_active
from public.catalog_services
where id in ('massage-relaxing', 'morpheus');
