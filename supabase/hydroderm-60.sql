-- Υδροδερμοαπόξεση is €60. Online bookings had saved the old €55 catalog price.
update public.catalog_services
set price_cents = 6000, updated_at = now()
where id = 'hydroderm';

update public.appointments
set price_cents = 6000, updated_at = now()
where price_cents = 5500
  and regexp_replace(lower(service), '[^a-zα-ωάέήίόύώϊϋΐΰ]', '', 'g')
      like '%υδροδερμοαποξεση%';
