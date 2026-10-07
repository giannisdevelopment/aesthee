import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

try {
  const url = new URL(location.href);
  if ([...url.searchParams.keys()].some((key) => /pass|email|token/i.test(key))) {
    url.search = "";
    history.replaceState({}, "", `${url.pathname}${url.hash}`);
  }
} catch {
  /* ignore */
}

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

function isRealDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Day / month / year. Never follows the browser’s month-first locale. */
export function formatDate(value) {
  if (!value) return "—";
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** @returns {string} YYYY-MM-DD, or "" when the text is not a real day/month/year. */
export function parseDayFirstDate(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isRealDate(year, month, day)) return "";
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const greek = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!greek) return "";
  const day = Number(greek[1]);
  const month = Number(greek[2]);
  const year = Number(greek[3]);
  if (!isRealDate(year, month, day)) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function setDayFirstDate(input, iso) {
  if (!input) return;
  const parsed = parseDayFirstDate(String(iso || "").slice(0, 10));
  input.value = parsed ? formatDate(parsed) : "";
}

export function readDayFirstDate(input) {
  if (!input) return "";
  const parsed = parseDayFirstDate(input.value);
  if (parsed) input.value = formatDate(parsed);
  return parsed;
}

const DMY_MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
const DMY_DOWS = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];

/** @type {HTMLElement | null} */
let dmyPicker = null;
/** @type {HTMLInputElement | null} */
let dmyPickerInput = null;
let dmyViewYear = 0;
let dmyViewMonth = 1;

function isoParts(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function ensureDmyPicker() {
  if (dmyPicker) return dmyPicker;
  const el = document.createElement("div");
  el.className = "dmy-picker";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Επιλογή ημερομηνίας");
  el.innerHTML = `
    <div class="dmy-picker-head">
      <button type="button" class="dmy-picker-nav" data-nav="-1" aria-label="Προηγούμενος μήνας">‹</button>
      <strong data-label></strong>
      <button type="button" class="dmy-picker-nav" data-nav="1" aria-label="Επόμενος μήνας">›</button>
    </div>
    <div class="dmy-picker-dows">${DMY_DOWS.map((label) => `<span>${label}</span>`).join("")}</div>
    <div class="dmy-picker-grid" data-grid></div>
  `;
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.getAttribute("data-nav")) || 0;
      const next = new Date(dmyViewYear, dmyViewMonth - 1 + step, 1);
      dmyViewYear = next.getFullYear();
      dmyViewMonth = next.getMonth() + 1;
      renderDmyPicker();
    });
  });
  document.body.appendChild(el);
  dmyPicker = el;
  return el;
}

function renderDmyPicker() {
  const el = ensureDmyPicker();
  const label = el.querySelector("[data-label]");
  const grid = el.querySelector("[data-grid]");
  if (!label || !grid) return;
  label.textContent = `${DMY_MONTHS[dmyViewMonth - 1]} ${dmyViewYear}`;

  const selected = isoParts(parseDayFirstDate(dmyPickerInput?.value || ""));
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const firstDow = new Date(dmyViewYear, dmyViewMonth - 1, 1).getDay();
  const lead = (firstDow + 6) % 7;
  const start = new Date(dmyViewYear, dmyViewMonth - 1, 1 - lead);

  grid.innerHTML = "";
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dmy-picker-day";
    btn.textContent = String(date.getDate());
    btn.dataset.iso = iso;
    if (date.getMonth() + 1 !== dmyViewMonth) btn.classList.add("is-out");
    if (iso === todayIso) btn.classList.add("is-today");
    if (selected && iso === `${selected.year}-${String(selected.month).padStart(2, "0")}-${String(selected.day).padStart(2, "0")}`) {
      btn.classList.add("is-selected");
    }
    btn.addEventListener("click", () => {
      if (!dmyPickerInput) return;
      setDayFirstDate(dmyPickerInput, iso);
      dmyPickerInput.dispatchEvent(new Event("input", { bubbles: true }));
      dmyPickerInput.dispatchEvent(new Event("change", { bubbles: true }));
      closeDmyPicker();
    });
    grid.appendChild(btn);
  }
}

function placeDmyPicker() {
  if (!dmyPicker || !dmyPickerInput) return;
  const rect = dmyPickerInput.getBoundingClientRect();
  const width = 300;
  const height = dmyPicker.offsetHeight || 320;
  let left = rect.left;
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
  if (left < 8) left = 8;
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
  dmyPicker.style.left = `${left}px`;
  dmyPicker.style.top = `${top}px`;
}

function openDmyPicker(input) {
  const el = ensureDmyPicker();
  dmyPickerInput = input;
  const parsed = isoParts(parseDayFirstDate(input.value));
  const base = parsed || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  dmyViewYear = base.year;
  dmyViewMonth = base.month;
  el.hidden = false;
  renderDmyPicker();
  placeDmyPicker();
}

function closeDmyPicker() {
  if (dmyPicker) dmyPicker.hidden = true;
  dmyPickerInput = null;
}

function bindDayFirstPicker(input) {
  if (!(input instanceof HTMLInputElement) || input.dataset.dmyPicker) return;
  input.dataset.dmyPicker = "1";
  input.addEventListener("focus", () => openDmyPicker(input));
  input.addEventListener("click", () => openDmyPicker(input));
  input.addEventListener("input", () => {
    if (dmyPickerInput === input && dmyPicker && !dmyPicker.hidden) renderDmyPicker();
  });
}

function initDayFirstPickers() {
  document.querySelectorAll('input[placeholder="ηη/μμ/εεεε"], input.date-dmy').forEach((input) => {
    bindDayFirstPicker(input);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!dmyPicker || dmyPicker.hidden) return;
    const target = event.target;
    if (target instanceof Node && (dmyPicker.contains(target) || target === dmyPickerInput)) return;
    closeDmyPicker();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDmyPicker();
  });
  window.addEventListener("resize", () => {
    if (dmyPicker && !dmyPicker.hidden) placeDmyPicker();
  });
  window.addEventListener("scroll", () => {
    if (dmyPicker && !dmyPicker.hidden) placeDmyPicker();
  }, true);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDayFirstPickers);
} else {
  initDayFirstPickers();
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

export function applyAuthShell(signedIn) {
  document.documentElement.classList.toggle("auth-in", Boolean(signedIn));
  document.documentElement.classList.toggle("auth-out", !signedIn);
}

export async function requireSession() {
  const { data: { session } } = await getSupabase().auth.getSession();
  applyAuthShell(Boolean(session));
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

function stripNameMarks(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ");
}

/** Greek spelling and the Latin card (Εύα / EVA) fold to the same letters. */
export function greekNameToLatin(value) {
  let text = stripNameMarks(value);
  const pairs = [
    ["ου", "ou"],
    ["ευ", "ev"],
    ["αυ", "av"],
    ["ηυ", "iv"],
    ["αι", "e"],
    ["ει", "i"],
    ["οι", "i"],
    ["υι", "i"],
    ["θ", "th"],
    ["χ", "ch"],
    ["ψ", "ps"],
    ["ξ", "x"],
    ["μπ", "b"],
    ["ντ", "nt"],
    ["α", "a"],
    ["β", "v"],
    ["γ", "g"],
    ["δ", "d"],
    ["ε", "e"],
    ["ζ", "z"],
    ["η", "i"],
    ["ι", "i"],
    ["κ", "k"],
    ["λ", "l"],
    ["μ", "m"],
    ["ν", "n"],
    ["ο", "o"],
    ["π", "p"],
    ["ρ", "r"],
    ["σ", "s"],
    ["τ", "t"],
    ["υ", "i"],
    ["φ", "f"],
    ["ω", "o"],
  ];
  for (const [from, to] of pairs) text = text.replaceAll(from, to);
  return text.replace(/\s+/g, " ").trim();
}

/** Latin spelling folded back so a Greek card is found from EVA. */
export function latinNameToGreek(value) {
  let text = stripNameMarks(value);
  const pairs = [
    ["ou", "ου"],
    ["ev", "ευ"],
    ["ef", "ευ"],
    ["av", "αυ"],
    ["af", "αυ"],
    ["th", "θ"],
    ["ch", "χ"],
    ["ps", "ψ"],
    ["ts", "τσ"],
    ["a", "α"],
    ["b", "β"],
    ["c", "κ"],
    ["d", "δ"],
    ["e", "ε"],
    ["f", "φ"],
    ["g", "γ"],
    ["h", "χ"],
    ["i", "ι"],
    ["j", "ζ"],
    ["k", "κ"],
    ["l", "λ"],
    ["m", "μ"],
    ["n", "ν"],
    ["o", "ο"],
    ["p", "π"],
    ["q", "κ"],
    ["r", "ρ"],
    ["s", "σ"],
    ["t", "τ"],
    ["u", "υ"],
    ["v", "β"],
    ["w", "ω"],
    ["x", "ξ"],
    ["y", "υ"],
    ["z", "ζ"],
  ];
  for (const [from, to] of pairs) text = text.replaceAll(from, to);
  return text.replace(/\s+/g, " ").trim();
}

function clientQueryVariants(query) {
  const typed = String(query || "").trim().replace(/,/g, " ");
  if (!typed) return [];
  const variants = new Set([typed]);
  const latin = greekNameToLatin(typed);
  const greek = latinNameToGreek(typed);
  if (latin) variants.add(latin);
  if (greek) variants.add(greek);
  return [...variants];
}

export async function listClients(query = "", options = {}) {
  const lite = Boolean(options.lite);
  const limit = Number(options.limit) || 0;
  const select = lite
    ? "id, full_name, phone, email, updated_at"
    : "id, full_name, phone, email, updated_at, visits(count)";
  let request = getSupabase()
    .from("clients")
    .select(select)
    .order("full_name", { ascending: true });

  const variants = clientQueryVariants(query);
  if (variants.length) {
    const filters = variants.flatMap((term) => [
      `full_name.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
      `email.ilike.%${term}%`,
    ]);
    request = request.or(filters.join(","));
  }
  if (limit > 0) request = request.limit(limit);

  return request;
}

/** All clients, paged — no nested visits count (used by booking typeahead). */
export async function listAllClientsLite() {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; from < 30000; from += pageSize) {
    const { data, error } = await getSupabase()
      .from("clients")
      .select("id, full_name, phone, email")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { data: all, error: all.length ? null : error };
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: all, error: null };
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

export async function listAppointmentsForClient({ clientId = "", phone = "" } = {}) {
  let request = getSupabase()
    .from("appointments")
    .select("id, service, appointment_date, appointment_time, duration_minutes, price_cents, cabin_id, guest_name, guest_phone, status, notes, client_id")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false });

  const parts = [];
  if (clientId) parts.push(`client_id.eq.${clientId}`);
  const phoneDigits = String(phone || "").replace(/\D/g, "");
  if (phoneDigits.length >= 8) {
    parts.push(`guest_phone.ilike.%${phoneDigits.slice(-10)}%`);
  }
  if (!parts.length) return { data: [], error: null };
  request = request.or(parts.join(","));
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
