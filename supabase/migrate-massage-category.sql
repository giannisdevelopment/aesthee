-- Extract massage services from body into their own booking category.
update public.catalog_services
set
  category_id = 'massage',
  category_label = 'Μασάζ',
  sort_order = case id
    when 'massage' then 1010
    when 'massage-cupping' then 1020
    when 'massage-neck-back' then 1030
    else sort_order
  end
where id in ('massage', 'massage-cupping', 'massage-neck-back');
