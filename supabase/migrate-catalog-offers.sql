-- Mark package / multi-session rows as offers (safe to re-run).
-- Does not change prices. Only flips is_offer where the name/id looks like a package.

update public.catalog_services
set is_offer = true,
    updated_at = now()
where is_offer = false
  and (
    id like '%-pack'
    or name ilike '%πακέτο%'
    or name ilike '%συνεδρί%'
  );
