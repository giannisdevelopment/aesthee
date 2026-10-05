import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

function readConfig() {
  const cfg = window.AESTHEE_SUPABASE || {};
  const url = cfg.url || "";
  // Docs: browser uses publishable (or legacy anon) key — never the secret/service_role key.
  const anonKey = cfg.anonKey || cfg.publishableKey || cfg.key || "";
  return { url, anonKey };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = readConfig();
  return Boolean(url && anonKey && !url.includes("YOUR_PROJECT_REF") && !anonKey.includes("YOUR_"));
}

let _client = null;

/** Lazily create the browser client (publishable/anon key only). */
export function getSupabase() {
  if (_client) return _client;
  const { url, anonKey } = readConfig();
  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or anon/publishable key in js/supabase-config.js");
  }
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      flowType: "pkce",
    },
  });
  return _client;
}

/** @deprecated use getSupabase() — kept for existing imports */
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabase();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export function formatMoney(value) {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

export function formatDate(value) {
  if (!value) return "—";
  const date = typeof value === "string" && value.length === 10
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("el-GR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function showToast(message, isError = false) {
  const el = document.getElementById("adminToast");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("is-error", isError);
  el.classList.add("is-visible");
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => el.classList.remove("is-visible"), 5200);
}

export function mapAuthError(error) {
  const code = error?.code || "";
  const msg = String(error?.message || "");
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return "Λάθος email ή κωδικός.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) {
    return "Το email δεν έχει επιβεβαιωθεί. Στο user → Confirm user, ή απενεργοποιήστε Confirm email στα Auth settings.";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return "Αποτυχία σύνδεσης με το Supabase. Ελέγξτε δίκτυο / ad-block.";
  }
  return msg || "Αποτυχία σύνδεσης";
}

export async function requireSession() {
  const { data: { session } } = await getSupabase().auth.getSession();
  return session;
}

export async function signIn(email, password) {
  return getSupabase().auth.signInWithPassword({
    email: String(email || "").trim(),
    password: String(password || ""),
  });
}

export async function signOut() {
  return getSupabase().auth.signOut();
}

export async function listClients(query = "") {
  let request = getSupabase()
    .from("clients")
    .select("id, full_name, phone, email, updated_at, visits(count)")
    .order("full_name", { ascending: true });

  const q = query.trim();
  if (q) {
    request = request.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  return request;
}

export async function getClient(id) {
  return getSupabase()
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
}

export async function saveClient(payload, id = null) {
  if (id) {
    return getSupabase().from("clients").update(payload).eq("id", id).select().single();
  }
  return getSupabase().from("clients").insert(payload).select().single();
}

export async function deleteClient(id) {
  return getSupabase().from("clients").delete().eq("id", id);
}

export async function listVisits(clientId) {
  return getSupabase()
    .from("visits")
    .select("*")
    .eq("client_id", clientId)
    .order("payment_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
}

/**
 * Paginate a Supabase query until exhausted (PostgREST default max is 1000 rows).
 * @param {() => any} buildQuery factory returning a filtered query without .range()
 * @param {number} [pageSize]
 */
async function fetchAllRows(buildQuery, pageSize = 1000) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return { data: rows, error: null };
}

/**
 * Paid visits in a date range (inclusive). Used by till / ταμείο.
 * @param {{ fromDate: string, toDate: string }} range ISO dates YYYY-MM-DD
 */
export async function listVisitsInRange({ fromDate, toDate }) {
  return fetchAllRows(() =>
    getSupabase()
      .from("visits")
      .select("id, client_id, treatment, payment_amount, payment_date, notes, created_at, clients(full_name, phone)")
      .not("payment_amount", "is", null)
      .gt("payment_amount", 0)
      .gte("payment_date", fromDate)
      .lte("payment_date", toDate)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
  );
}

/**
 * Completed appointments in a date range (paginated — no 1000-row cap).
 */
export async function listCompletedAppointmentsInRange({ fromDate, toDate }) {
  return fetchAllRows(() =>
    getSupabase()
      .from("appointments")
      .select("id, service, appointment_date, appointment_time, price_cents, guest_name, guest_phone, status")
      .eq("status", "completed")
      .gte("appointment_date", fromDate)
      .lte("appointment_date", toDate)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false })
  );
}

export async function saveVisit(payload, id = null) {
  if (id) {
    return getSupabase().from("visits").update(payload).eq("id", id).select().single();
  }
  return getSupabase().from("visits").insert(payload).select().single();
}

export async function deleteVisit(id) {
  return getSupabase().from("visits").delete().eq("id", id);
}

export async function listAppointments({ status = "", fromDate = "", toDate = "", query = "" } = {}) {
  let request = getSupabase()
    .from("appointments")
    .select("id, service, appointment_date, appointment_time, duration_minutes, price_cents, cabin_id, guest_name, guest_phone, guest_email, status, notes, client_id, created_at")
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (status) request = request.eq("status", status);
  if (fromDate) request = request.gte("appointment_date", fromDate);
  if (toDate) request = request.lte("appointment_date", toDate);

  const q = String(query || "").trim();
  if (q) {
    const safe = q.replace(/[%_,()\\]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      request = request.or(`guest_name.ilike.%${safe}%,guest_phone.ilike.%${safe}%,guest_email.ilike.%${safe}%,service.ilike.%${safe}%`);
    }
  }

  return request;
}

export async function createAppointment(payload) {
  return getSupabase()
    .from("appointments")
    .insert(payload)
    .select()
    .single();
}

export async function updateAppointment(id, payload) {
  return getSupabase().from("appointments").update(payload).eq("id", id).select().single();
}

export async function deleteAppointment(id) {
  return getSupabase().from("appointments").delete().eq("id", id);
}

export async function listContactMessages() {
  return getSupabase()
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function markContactRead(id, isRead = true) {
  return getSupabase().from("contact_messages").update({ is_read: isRead }).eq("id", id);
}

export async function deleteContactMessage(id) {
  return getSupabase().from("contact_messages").delete().eq("id", id);
}

export async function findOrCreateClientFromBooking(appointment) {
  const phone = appointment.guest_phone?.trim();
  if (phone) {
    const { data: existing } = await getSupabase()
      .from("clients")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;
  }

  const { data, error } = await getSupabase()
    .from("clients")
    .insert({
      full_name: appointment.guest_name,
      phone: appointment.guest_phone || null,
      email: appointment.guest_email || null,
      notes: `Από online κράτηση (${appointment.service})`,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function listCatalogServices({ categoryId = "", query = "", includeInactive = true } = {}) {
  let request = getSupabase()
    .from("catalog_services")
    .select("*")
    .order("category_label", { ascending: true })
    .order("sort_order", { ascending: true });

  if (categoryId) request = request.eq("category_id", categoryId);
  if (!includeInactive) request = request.eq("is_active", true);

  const q = query.trim();
  if (q) {
    request = request.or(`name.ilike.%${q}%,category_label.ilike.%${q}%`);
  }

  return request;
}

export async function updateCatalogService(id, payload) {
  return getSupabase()
    .from("catalog_services")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
}

export async function createCatalogService(payload) {
  return getSupabase()
    .from("catalog_services")
    .insert(payload)
    .select()
    .single();
}

export async function deleteCatalogService(id) {
  return getSupabase().from("catalog_services").delete().eq("id", id);
}

export function formatTime(value) {
  if (!value) return "—";
  return String(value).slice(0, 5);
}

export const APPOINTMENT_STATUS_LABELS = {
  pending: "Σε αναμονή",
  confirmed: "Επιβεβαιωμένο",
  cancelled: "Ακυρωμένο",
  completed: "Ολοκληρωμένο",
  no_show: "Δεν εμφανίστηκε",
};
