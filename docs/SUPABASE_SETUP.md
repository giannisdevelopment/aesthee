# Supabase setup — Aesthée booking + admin

## 1. Create project
1. Open [supabase.com](https://supabase.com) → New project
2. Copy **Project URL** and **anon public** key  
   (Project Settings → API)

## 2. Run schema
1. SQL Editor → New query
2. Paste and run all of `supabase/schema.sql`
3. Confirm tables: `clients`, `visits`, `appointments`, `contact_messages`
4. Confirm RPCs: `get_booked_times`, `get_booked_slots`, `create_booking`, `submit_contact`

> **Re-run note:** If you already applied an older schema, re-run the full `schema.sql`. It adds `duration_minutes` / `price_cents` on appointments, replaces `create_booking` (duration-aware overlap checks), and adds `get_booked_slots`.

## 3. Create staff login
1. Authentication → Providers → **Email** enabled
2. Authentication → Providers → Email → turn **Confirm email OFF** (or Confirm the user manually)
3. Authentication → Users → **Add user**
4. Email + password (e.g. `info@aesthee.gr`)
5. In the user row, ensure status is **Confirmed** (⋯ → Confirm user if needed)
6. Authentication → URL Configuration → Site URL = `https://aesthee.vercel.app`
7. Add Redirect URL: `https://aesthee.vercel.app/**`

Do **not** put the service_role / secret key in the browser. Admin uses the **anon / publishable** key + staff Auth login.

If login says “Invalid login credentials”, the API key is fine — reset the user password in Authentication → Users.

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
| `/booking.html` | Priced service catalog; slots sized by duration; overlap-aware availability via `get_booked_slots` + `create_booking` |
| `/contact.html` | Saves messages via `submit_contact` |
| `/admin/` | Staff login → clients CRM |
| `/admin/bookings.html` | Manage appointments, status, link to client |
| `/admin/messages.html` | Contact inbox |

Public booking never exposes other guests’ names/phones (RPC only returns busy times).
