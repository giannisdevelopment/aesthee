# Supabase setup — Aesthée booking + admin

## 1. Create project
1. Open [supabase.com](https://supabase.com) → New project
2. Copy **Project URL** and **anon public** key  
   (Project Settings → API)

## 2. Run schema
1. SQL Editor → New query
2. Paste and run all of `supabase/schema.sql`
3. Also run `supabase/migrate-catalog.sql` (seeds prices + offers; safe to re-run — never overwrites edits)
4. Optionally run `supabase/migrate-catalog-offers.sql` to flag package/session rows as offers
5. Confirm tables: `clients`, `visits`, `appointments`, `contact_messages`, `catalog_services`
6. Confirm RPCs: `get_booked_times`, `get_booked_slots`, `create_booking`, `submit_contact`

## 3. Create staff login
1. Authentication → Providers → **Email** enabled
2. Authentication → Providers → Email → turn **Confirm email OFF** (or Confirm the user manually)
3. Authentication → Users → **Add user**
4. Email + password (e.g. `info@aesthee.gr`)
5. In the user row, ensure status is **Confirmed** (⋯ → Confirm user if needed)
6. Authentication → URL Configuration → Site URL = `https://aesthee.gr`
7. Add Redirect URL: `https://aesthee.gr/**` (optional: also keep `https://aesthee.vercel.app/**` for previews)

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

## 6. Appointment emails (Resend)

Staff / online booking can email the guest on create, confirm, reschedule, or cancel.

1. Create a free [Resend](https://resend.com) account and API key
2. In Vercel → Project → Settings → Environment Variables add:
   - `RESEND_API_KEY` = your key
   - `EMAIL_FROM` = `Aesthée <info@aesthee.gr>` (domain must be verified in Resend)
   - optional `SITE_URL` = `https://aesthee.gr`
3. Redeploy

Endpoint: `POST /api/send-appointment-email`  
Emails are skipped silently when the guest has no email address.

## What is connected
| Surface | Behavior |
|---|---|
| `/booking.html` | Priced service catalog from `catalog_services` (falls back to defaults); **10′** start slots |
| `/contact.html` | Saves messages via `submit_contact` |
| `/admin/` | Staff login → clients CRM |
| `/admin/bookings` | Day calendar (5 cabins), create/edit appointments, status + email notices |
| `/admin/services.html` | Edit prices, toggle active, add package offers |
| `/admin/messages.html` | Contact inbox |

Public booking never exposes other guests’ names/phones (RPC only returns busy times).
