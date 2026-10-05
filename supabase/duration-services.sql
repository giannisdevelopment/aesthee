-- Duration-only catalog rows (10′, 20′, 1ώρα…) for staff booking.
insert into public.catalog_services (
  id, category_id, category_label, name, duration_minutes, price_cents,
  price_from, is_offer, sort_order, is_active
) values
  ('dur-10', 'duration', 'Διάρκεια', '10 λεπτά', 10, 0, false, false, 1, true),
  ('dur-15', 'duration', 'Διάρκεια', '15 λεπτά', 15, 0, false, false, 2, true),
  ('dur-20', 'duration', 'Διάρκεια', '20 λεπτά', 20, 0, false, false, 3, true),
  ('dur-30', 'duration', 'Διάρκεια', '30 λεπτά', 30, 0, false, false, 4, true),
  ('dur-45', 'duration', 'Διάρκεια', '45 λεπτά', 45, 0, false, false, 5, true),
  ('dur-60', 'duration', 'Διάρκεια', '1 ώρα', 60, 0, false, false, 6, true),
  ('dur-90', 'duration', 'Διάρκεια', '1 ώρα 30′', 90, 0, false, false, 7, true),
  ('dur-120', 'duration', 'Διάρκεια', '2 ώρες', 120, 0, false, false, 8, true)
on conflict (id) do update
set
  is_active = true,
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  updated_at = now();
