-- Add Plasma Pen (κηλίδες) to the public catalog.
INSERT INTO catalog_services (
  id, category_id, category_label, name,
  duration_minutes, price_cents, price_from, is_offer, sort_order, is_active
) VALUES (
  'plasma-pen', 'face', 'Θεραπείες προσώπου', 'Plasma Pen — αντιμετώπιση κηλίδων',
  60, 15000, true, false, 445, true
)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  category_label = EXCLUDED.category_label,
  name = EXCLUDED.name,
  duration_minutes = EXCLUDED.duration_minutes,
  price_cents = EXCLUDED.price_cents,
  price_from = EXCLUDED.price_from,
  is_offer = EXCLUDED.is_offer,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();
