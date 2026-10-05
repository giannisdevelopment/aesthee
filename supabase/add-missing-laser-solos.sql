-- Fill common laser solos/combos that Treatwell books but catalog lacked.
insert into public.catalog_services (
  id, category_id, category_label, name, duration_minutes, price_cents,
  price_from, is_offer, sort_order, is_active
) values
  ('lw-calves', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Γάμπες', 20, 5000, false, false, 535, true),
  ('lw-bikini-line', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Γραμμή bikini', 10, 2500, false, false, 495, true),
  ('lw-bikini-underarms', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Full bikini & μασχάλες', 20, 7000, false, false, 498, true),
  ('lw-upper-lip', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Άνω χείλος', 5, 1500, false, false, 532, true),
  ('lw-chin', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Πηγούνι', 5, 1500, false, false, 533, true),
  ('lm-ears', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Αυτιά', 5, 1000, false, false, 761, true),
  ('lm-nose', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Μύτη', 5, 1000, false, false, 762, true)
on conflict (id) do update
set
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  is_active = true,
  updated_at = now();

update public.catalog_services
set is_active = true, updated_at = now()
where id in ('lw-underarms', 'lw-calves-underarms', 'lw-mustache-chin', 'lw-full-bikini');

select id, name, price_cents, duration_minutes
from public.catalog_services
where id like 'lw-%' or id in ('lm-ears', 'lm-nose', 'lm-ears-nose')
order by category_id, sort_order, id;
