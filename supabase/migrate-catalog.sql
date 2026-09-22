-- Aesthée — editable service catalog (prices + offers)
-- Run once in Supabase SQL Editor (safe to re-run: seed uses ON CONFLICT DO NOTHING)
-- Requires set_updated_at() from schema.sql

create table if not exists public.catalog_services (
  id text primary key,
  category_id text not null,
  category_label text not null,
  name text not null,
  duration_minutes int not null,
  price_cents int not null,
  price_from boolean not null default false,
  is_offer boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_services_name_len check (char_length(trim(name)) >= 2),
  constraint catalog_services_duration check (duration_minutes >= 5 and duration_minutes <= 480),
  constraint catalog_services_price check (price_cents >= 0)
);

create index if not exists catalog_services_category_idx
  on public.catalog_services (category_id, sort_order);
create index if not exists catalog_services_active_idx
  on public.catalog_services (is_active, category_id);

drop trigger if exists catalog_services_set_updated_at on public.catalog_services;
create trigger catalog_services_set_updated_at
  before update on public.catalog_services
  for each row
  execute function public.set_updated_at();

alter table public.catalog_services enable row level security;

drop policy if exists "Public can read active catalog" on public.catalog_services;
drop policy if exists "Staff can select catalog" on public.catalog_services;
drop policy if exists "Staff can insert catalog" on public.catalog_services;
drop policy if exists "Staff can update catalog" on public.catalog_services;
drop policy if exists "Staff can delete catalog" on public.catalog_services;

create policy "Public can read active catalog"
  on public.catalog_services for select to anon
  using (is_active = true);

create policy "Staff can select catalog"
  on public.catalog_services for select to authenticated using (true);
create policy "Staff can insert catalog"
  on public.catalog_services for insert to authenticated with check (true);
create policy "Staff can update catalog"
  on public.catalog_services for update to authenticated using (true) with check (true);
create policy "Staff can delete catalog"
  on public.catalog_services for delete to authenticated using (true);

insert into public.catalog_services (
  id, category_id, category_label, name, duration_minutes, price_cents, price_from, is_offer, sort_order, is_active
) values
  ('brow-shape', 'brows', 'Περιποίηση φρυδιών', 'Σχηματισμός φρυδιών', 15, 1000, false, false, 10, true),
  ('brow-shape-tint', 'brows', 'Περιποίηση φρυδιών', 'Σχηματισμός & βαφή', 30, 2500, false, false, 20, true),
  ('brow-lamination', 'brows', 'Περιποίηση φρυδιών', 'Brow Lamination', 30, 2500, false, false, 30, true),
  ('brow-lamination-tint', 'brows', 'Περιποίηση φρυδιών', 'Brow Lamination & Tint', 45, 3500, false, false, 40, true),
  ('lash-lift-keratin', 'lashes', 'Βλεφαρίδες', 'Lash Lift & Keratin Treatment', 45, 3500, false, false, 50, true),
  ('lash-lift-tint', 'lashes', 'Βλεφαρίδες', 'Lash Lift & Tint', 60, 3500, false, false, 60, true),
  ('lash-ext-classic', 'lashes', 'Βλεφαρίδες', 'Extensions βλεφαρίδων — τοποθέτηση one by one', 120, 5000, false, false, 70, true),
  ('lash-maint-classic', 'lashes', 'Βλεφαρίδες', 'Extension βλεφαρίδων — συντήρηση one by one', 90, 2500, false, false, 80, true),
  ('lash-ext-volume', 'lashes', 'Βλεφαρίδες', 'Extensions βλεφαρίδων — τοποθέτηση volume (3D)', 120, 6000, false, false, 90, true),
  ('lash-maint-volume', 'lashes', 'Βλεφαρίδες', 'Extension βλεφαρίδων — συντήρηση volume (3D)', 90, 3500, false, false, 100, true),
  ('lash-ext-mix', 'lashes', 'Βλεφαρίδες', 'Extensions βλεφαρίδων — τοποθέτηση mix (3D & one by one)', 120, 5500, false, false, 110, true),
  ('lash-maint-mix', 'lashes', 'Βλεφαρίδες', 'Extension βλεφαρίδων — συντήρηση mix (3D & one by one)', 90, 3000, false, false, 120, true),
  ('elec-10', 'electrolysis', 'Ριζική αποτρίχωση με βελόνα', 'Ριζική αποτρίχωση — 10′', 10, 1500, false, false, 130, true),
  ('elec-15', 'electrolysis', 'Ριζική αποτρίχωση με βελόνα', 'Ριζική αποτρίχωση — 15′', 15, 2000, false, false, 140, true),
  ('elec-20', 'electrolysis', 'Ριζική αποτρίχωση με βελόνα', 'Ριζική αποτρίχωση — 20′', 20, 2500, false, false, 150, true),
  ('hydra-cleanse', 'face', 'Θεραπείες προσώπου', 'Καθαρισμός προσώπου HydraFacial', 90, 6000, false, false, 160, true),
  ('dermapen-acne', 'face', 'Θεραπείες προσώπου', 'Θεραπεία προσώπου Dermapen για ουλές ακμής', 60, 6000, false, false, 170, true),
  ('dermapen-face-neck', 'face', 'Θεραπείες προσώπου', 'Θεραπεία Dermapen πρόσωπο & λαιμό', 90, 8000, false, false, 180, true),
  ('dermapen-full', 'face', 'Θεραπείες προσώπου', 'Θεραπεία Dermapen πρόσωπο & λαιμό & ντεκολτέ', 120, 10000, false, false, 190, true),
  ('hifu-face', 'face', 'Θεραπείες προσώπου', 'HIFU προσώπου', 60, 20000, false, false, 200, true),
  ('deep-acids', 'face', 'Θεραπείες προσώπου', 'Βαθύς καθαρισμός & οξέα φρούτων', 90, 8000, false, false, 210, true),
  ('glow-whitening', 'face', 'Θεραπείες προσώπου', 'Glow & whitening treatment', 45, 3500, false, false, 220, true),
  ('acne-oil', 'face', 'Θεραπείες προσώπου', 'Θεραπεία ακμής & λιπαρότητας', 45, 3500, false, false, 230, true),
  ('meso-dermapen', 'face', 'Θεραπείες προσώπου', 'Μεσοθεραπεία προσώπου με Dermapen', 75, 6000, false, false, 240, true),
  ('diamond-derm', 'face', 'Θεραπείες προσώπου', 'Δερμοαπόξεση με διαμάντι', 90, 6000, false, false, 250, true),
  ('hydrafacial', 'face', 'Θεραπείες προσώπου', 'HydraFacial', 90, 6000, false, false, 260, true),
  ('hydrafacial-diamond', 'face', 'Θεραπείες προσώπου', 'HydraFacial + διαμάντι', 120, 9000, false, false, 270, true),
  ('clean-14', 'face', 'Θεραπείες προσώπου', 'Καθαρισμός με 14 κεφαλές', 120, 11000, false, false, 280, true),
  ('herbal-peel', 'face', 'Θεραπείες προσώπου', 'Φυτικό peeling', 60, 12000, false, false, 290, true),
  ('chem-peel', 'face', 'Θεραπείες προσώπου', 'Χημικό peeling προσώπου', 60, 9000, false, false, 300, true),
  ('spot-removal', 'face', 'Θεραπείες προσώπου', 'Αφαίρεση πανάδας', 45, 6000, true, false, 310, true),
  ('carbon-peel', 'face', 'Θεραπείες προσώπου', 'Carbon Peel Laser', 45, 7000, false, false, 320, true),
  ('tattoo-face', 'face', 'Θεραπείες προσώπου', 'Αφαίρεση tattoo (φρύδια–χείλη–eye liner)', 45, 8000, false, false, 330, true),
  ('tattoo-body', 'face', 'Θεραπείες προσώπου', 'Αφαίρεση tattoo σώματος', 60, 8000, true, false, 340, true),
  ('micro-dose', 'face', 'Θεραπείες προσώπου', 'Micro Dose', 60, 6500, false, false, 350, true),
  ('rf-face', 'face', 'Θεραπείες προσώπου', 'RF Microneedling προσώπου', 60, 9000, false, false, 360, true),
  ('deep-cleanse', 'face', 'Θεραπείες προσώπου', 'Βαθύς καθαρισμός προσώπου', 60, 5000, false, false, 370, true),
  ('hydroderm', 'face', 'Θεραπείες προσώπου', 'Υδροδερμοαπόξεση', 60, 5500, false, false, 380, true),
  ('photo', 'face', 'Θεραπείες προσώπου', 'Φωτοθεραπεία', 30, 4000, false, false, 390, true),
  ('meso', 'face', 'Θεραπείες προσώπου', 'Μεσοθεραπεία', 45, 5500, false, false, 400, true),
  ('vit-c', 'face', 'Θεραπείες προσώπου', 'Θεραπεία βιταμίνης C', 45, 4500, false, false, 420, true),
  ('hyaluronic', 'face', 'Θεραπείες προσώπου', 'Θεραπεία υαλουρονικού οξέος (μη ενέσιμη)', 45, 5500, false, false, 430, true),
  ('whitening', 'face', 'Θεραπείες προσώπου', 'Θεραπεία λεύκανσης', 45, 5000, false, false, 440, true),
  ('plasma-pen', 'face', 'Θεραπείες προσώπου', 'Plasma Pen — αντιμετώπιση κηλίδων', 60, 15000, true, false, 445, true),
  ('exosomes', 'face', 'Θεραπείες προσώπου', 'Θεραπεία εξωσωμάτων (μη ενέσιμη)', 60, 9000, false, false, 450, true),
  ('pdrn', 'face', 'Θεραπείες προσώπου', 'Θεραπεία PDRN (μη ενέσιμη)', 60, 9000, false, false, 460, true),
  ('lw-full-body', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Full Body', 60, 14000, false, false, 470, true),
  ('lw-full-legs', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Full πόδια', 30, 10000, false, false, 480, true),
  ('lw-full-bikini', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Full bikini', 15, 5000, false, false, 490, true),
  ('lw-underarms', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Μασχάλες', 10, 3000, false, false, 500, true),
  ('lw-arms', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Χέρια', 15, 4000, false, false, 510, true),
  ('lw-nipples', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Θηλές', 5, 1000, false, false, 520, true),
  ('lw-full-face', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Full πρόσωπο', 10, 4000, false, false, 530, true),
  ('lw-calves-underarms', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Γάμπες & μασχάλες', 30, 7000, false, false, 540, true),
  ('lw-mustache-chin', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Μουστάκι + πηγούνι', 10, 2500, false, false, 550, true),
  ('lw-cheeks', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Παρείες', 10, 2000, false, false, 560, true),
  ('lw-belly-line', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Γυναίκες — Γραμμή κοιλιάς', 10, 2000, false, false, 570, true),
  ('lw-full-10', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Full Body — 10 συνεδρίες', 60, 115000, false, true, 580, true),
  ('lw-full-6', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Full Body — 6 συνεδρίες', 60, 69000, false, true, 590, true),
  ('lw-bikini-under-6', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Full Bikini + Armpits — 6 συνεδρίες', 20, 30000, false, true, 600, true),
  ('lw-bikini-under-10', 'laser-women', 'Αποτρίχωση Laser — Γυναίκες', 'Laser Full Bikini + Armpits — 10 συνεδρίες', 20, 50000, false, true, 610, true),
  ('lm-full-body', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Full Body', 120, 23000, false, false, 620, true),
  ('lm-back', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Πλάτη', 20, 7000, false, false, 630, true),
  ('lm-waist', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Μέση', 10, 4000, false, false, 640, true),
  ('lm-belly', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Κοιλιά', 15, 6000, false, false, 650, true),
  ('lm-chest', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Στήθος', 15, 6000, false, false, 660, true),
  ('lm-nape', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Αυχένας', 10, 2500, false, false, 670, true),
  ('lm-full-legs', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Full πόδια', 40, 14000, false, false, 680, true),
  ('lm-shoulders', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Ώμοι', 15, 3000, false, false, 690, true),
  ('lm-cheekbones', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Ζυγωματικά', 10, 1500, false, false, 700, true),
  ('lm-belly-chest-back-waist', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Κοιλιά + στήθος + πλάτη + μέση', 45, 17000, false, false, 710, true),
  ('lm-belly-chest', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Κοιλιά + στήθος', 30, 10000, false, false, 720, true),
  ('lm-back-waist', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Πλάτη + μέση', 30, 10000, false, false, 730, true),
  ('lm-back-waist-shoulders', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Πλάτη + μέση + ώμοι', 30, 12000, false, false, 740, true),
  ('lm-back-shoulders', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Πλάτη + ώμοι', 20, 8000, false, false, 750, true),
  ('lm-ears-nose', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Αυτιά + μύτη', 10, 2000, false, false, 760, true),
  ('lm-chest-back', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Στήθος + πλάτη', 30, 11000, false, false, 770, true),
  ('lm-back-chest-shoulders-waist', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Πλάτη + στήθος + ώμοι + μέση', 40, 16000, false, false, 780, true),
  ('lm-calves', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Γάμπες', 30, 6000, false, false, 790, true),
  ('lm-neck', 'laser-men', 'Αποτρίχωση Laser — Άντρες', 'Laser Άντρες — Λαιμός', 10, 3000, false, false, 800, true),
  ('vacutherm', 'body', 'Θεραπείες σώματος', 'Vacutherm Treadmill & Bike', 30, 3500, false, false, 810, true),
  ('vacutherm-pack', 'body', 'Θεραπείες σώματος', 'Vacutherm — πακέτο 10+2 δώρο', 30, 25000, false, true, 820, true),
  ('endospheres', 'body', 'Θεραπείες σώματος', 'ENDOSPHERES', 45, 4000, false, false, 830, true),
  ('endospheres-pack', 'body', 'Θεραπείες σώματος', 'ENDOSPHERES — πακέτο 8+2 δώρο', 45, 34900, false, true, 840, true),
  ('cavitation', 'body', 'Θεραπείες σώματος', 'Cavitation', 30, 2500, false, false, 850, true),
  ('cavitation-pack', 'body', 'Θεραπείες σώματος', 'Cavitation — πακέτο 10 συνεδριών', 30, 20000, false, true, 860, true),
  ('vacuum-bbl', 'body', 'Θεραπείες σώματος', 'Vacuum BBL', 30, 2000, false, false, 870, true),
  ('vacuum-bbl-pack', 'body', 'Θεραπείες σώματος', 'Vacuum BBL — πακέτο 10 συνεδριών', 30, 15000, false, true, 880, true),
  ('presso', 'body', 'Θεραπείες σώματος', 'Πρεσσοθεραπεία', 30, 2000, false, false, 890, true),
  ('presso-pack', 'body', 'Θεραπείες σώματος', 'Πρεσσοθεραπεία — πακέτο 10 συνεδριών', 30, 15000, false, true, 900, true),
  ('cryo', 'body', 'Θεραπείες σώματος', 'Κρυολιπόλυση 4 σημείων', 60, 16000, false, false, 910, true),
  ('cryo-pack', 'body', 'Θεραπείες σώματος', 'Κρυολιπόλυση 4 σημείων — πακέτο 3 συνεδριών', 60, 39000, false, true, 920, true),
  ('madero', 'body', 'Θεραπείες σώματος', 'Μαδεροθεραπεία', 35, 3000, false, false, 930, true),
  ('madero-pack', 'body', 'Θεραπείες σώματος', 'Μαδεροθεραπεία — πακέτο 10+2 δώρο', 35, 25000, false, true, 940, true),
  ('rf-body', 'body', 'Θεραπείες σώματος', 'RF Microneedling σώματος (έως 3 περιοχές)', 60, 18000, false, false, 950, true),
  ('rf-body-pack', 'body', 'Θεραπείες σώματος', 'RF Microneedling σώματος — πακέτο 3 συνεδριών', 60, 45000, false, true, 960, true),
  ('massage', 'body', 'Θεραπείες σώματος', 'Μασάζ χαλαρωτικό / αθλητικό / μυοχαλαρωτικό', 55, 4000, false, false, 970, true),
  ('massage-cupping', 'body', 'Θεραπείες σώματος', 'Μασάζ βεντούζες', 40, 4000, false, false, 980, true),
  ('massage-neck-back', 'body', 'Θεραπείες σώματος', 'Μασάζ αυχένα πλάτη μέση', 30, 3500, false, false, 990, true),
  ('wax', 'body', 'Θεραπείες σώματος', 'Αποτρίχωση με κερί', 30, 2500, true, false, 1000, true)
on conflict (id) do nothing;
