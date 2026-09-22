-- Remove Ραδιοσυχνότητες from the public catalog (booking + admin).
UPDATE catalog_services
SET is_active = false, updated_at = now()
WHERE id = 'radio';
