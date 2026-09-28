-- Update diode laser package offers (names + Full Body 10 sessions price).
update public.catalog_services
set
  name = case id
    when 'lw-full-10' then 'Laser Full Body — 10 συνεδρίες + δώρο Full Face'
    when 'lw-full-6' then 'Laser Full Body — 6 συνεδρίες + δώρο Full Face'
    when 'lw-bikini-under-6' then 'Laser Full Bikini + Μασχάλες — 6 συνεδρίες'
    when 'lw-bikini-under-10' then 'Laser Full Bikini + Μασχάλες — 10 συνεδρίες'
    else name
  end,
  price_cents = case id
    when 'lw-full-10' then 110000
    else price_cents
  end,
  is_offer = true
where id in ('lw-full-10', 'lw-full-6', 'lw-bikini-under-6', 'lw-bikini-under-10');
