# Supabase setup — Aesthée booking + admin

## 1. Create project
1. Open [supabase.com](https://supabase.com) → New project
2. Copy **Project URL** and **anon public** key  
   (Project Settings → API)

## 2. Run schema
1. SQL Editor → New query
2. Paste and run all of `supabase/schema.sql`
3. Confirm tables: `clients`, `visits`, `appointments`, `contact_messages`
4. Confirm RPCs: `get_booked_times`, `create_booking`, `submit_contact`

## 3. Create staff login
1. Authentication → Users → Add user
2. Email + password (this is the admin login)
3. Email confirm can be disabled for the first staff user in Auth settings if needed

## 4. Local config
```bash
cp js/supabase-config.example.js js/supabase-config.js
```
Fill in `url` and `anonKey`.  
`js/supabase-config.js` is gitignored.

## 5. Vercel (production)
Set environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

`npm run build` writes `js/supabase-config.js` from those env vars.

## What is connected
| Surface | Behavior |
|---|---|
| `/booking.html` | Creates appointments via `create_booking`; hides taken slots |
| `/contact.html` | Saves messages via `submit_contact` |
| `/admin/` | Staff login → clients CRM |
| `/admin/bookings.html` | Manage appointments, status, link to client |
| `/admin/messages.html` | Contact inbox |

Public booking never exposes other guests’ names/phones (RPC only returns busy times).
