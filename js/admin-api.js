import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.AESTHEE_SUPABASE;
if (!cfg?.url || !cfg?.anonKey || cfg.url.includes("YOUR_PROJECT_REF")) {
  console.error("Missing js/supabase-config.js — copy from supabase-config.example.js");
}

export const supabase = createClient(cfg?.url || "", cfg?.anonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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
  showToast._timer = window.setTimeout(() => el.classList.remove("is-visible"), 3800);
}

export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function listClients(query = "") {
  let request = supabase
    .from("clients")
    .select("id, full_name, phone, email, updated_at, visits(count)")
    .order("updated_at", { ascending: false });

  const q = query.trim();
  if (q) {
    request = request.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  return request;
}

export async function getClient(id) {
  return supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
}

export async function saveClient(payload, id = null) {
  if (id) {
    return supabase.from("clients").update(payload).eq("id", id).select().single();
  }
  return supabase.from("clients").insert(payload).select().single();
}

export async function deleteClient(id) {
  return supabase.from("clients").delete().eq("id", id);
}

export async function listVisits(clientId) {
  return supabase
    .from("visits")
    .select("*")
    .eq("client_id", clientId)
    .order("payment_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
}

export async function saveVisit(payload, id = null) {
  if (id) {
    return supabase.from("visits").update(payload).eq("id", id).select().single();
  }
  return supabase.from("visits").insert(payload).select().single();
}

export async function deleteVisit(id) {
  return supabase.from("visits").delete().eq("id", id);
}
