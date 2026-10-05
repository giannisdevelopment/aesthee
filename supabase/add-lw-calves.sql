-- Add solo Laser Γυναίκες — Γάμπες (was only combined with μασχάλες).
insert into public.catalog_services (
  id, category_id, category_label, name, duration_minutes, price_cents,
  price_from, is_offer, sort_order, is_active
) values (
  'lw-calves', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες',
  'Laser Γυναίκες — Γάμπες', 20, 5000, false, false, 535, true
)
on conflict (id) do update
set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  is_active = true,
  updated_at = now();

-- Ensure μασχάλες alone stays active
update public.catalog_services
set is_active = true, updated_at = now()
where id = 'lw-underarms';

select id, name, price_cents, duration_minutes, is_active
from public.catalog_services
where id in ('lw-calves', 'lw-underarms', 'lw-calves-underarms')
order by sort_order;
