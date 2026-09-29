-- Split combined massage into three bookable types (same duration/price).
-- Deactivate legacy combined row; insert/update the three types + keep cupping/neck.

update public.catalog_services
set is_active = false
where id = 'massage';

insert into public.catalog_services (
  id, category_id, category_label, name,
  duration_minutes, price_cents, price_from, is_offer, sort_order, is_active
) values
  ('massage-relaxing', 'massage', 'Μασάζ', 'Χαλαρωτικό μασάζ', 55, 4000, false, false, 1010, true),
  ('massage-myorelax', 'massage', 'Μασάζ', 'Μυοχαλαρωτικό μασάζ', 55, 4000, false, false, 1015, true),
  ('massage-sports', 'massage', 'Μασάζ', 'Αθλητικό μασάζ', 55, 4000, false, false, 1020, true)
on conflict (id) do update set
  category_id = excluded.category_id,
  category_label = excluded.category_label,
  name = excluded.name,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  price_from = excluded.price_from,
  is_offer = excluded.is_offer,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

update public.catalog_services
set
  category_id = 'massage',
  category_label = 'Μασάζ',
  sort_order = case id
    when 'massage-cupping' then 1030
    when 'massage-neck-back' then 1040
    else sort_order
  end,
  is_active = true
where id in ('massage-cupping', 'massage-neck-back');
