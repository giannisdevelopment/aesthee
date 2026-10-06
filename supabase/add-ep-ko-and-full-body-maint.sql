-- Staff catalog: ΕΠ/ΚΟ durations (Treatwell) + Full Body γυναικείο συντήρηση.
-- Safe to re-run.
insert into public.catalog_services (
  id, category_id, category_label, name, duration_minutes, price_cents,
  price_from, is_offer, sort_order, is_active
) values
  ('ep-10', 'ep-ko', 'Επαναληπτικό', 'ΕΠ/ΚΟ 10 λεπτά', 10, 0, false, false, 9, true),
  ('ep-20', 'ep-ko', 'Επαναληπτικό', 'ΕΠ/ΚΟ 20 λεπτά', 20, 0, false, false, 10, true),
  ('ep-30', 'ep-ko', 'Επαναληπτικό', 'ΕΠ/ΚΟ 30 λεπτά', 30, 0, false, false, 11, true),
  ('ep-40', 'ep-ko', 'Επαναληπτικό', 'ΕΠ/ΚΟ 40 λεπτά', 40, 0, false, false, 12, true),
  ('ep-60', 'ep-ko', 'Επαναληπτικό', 'ΕΠ/ΚΟ 60 λεπτά', 60, 0, false, false, 13, true),
  ('ep-120', 'ep-ko', 'Επαναληπτικό', 'ΕΠ/ΚΟ 120 λεπτά', 120, 0, false, false, 14, true),
  ('lw-full-body-maint', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Full Body γυναικείο συντήρηση', 60, 14000, false, false, 481, true)
on conflict (id) do update
set
  name = excluded.name,
  category_id = excluded.category_id,
  category_label = excluded.category_label,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  is_active = true,
  updated_at = now();
