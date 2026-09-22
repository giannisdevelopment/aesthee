import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

function getConfig() {
  return window.AESTHEE_SUPABASE || null;
}

export function isSupabaseConfigured() {
  const cfg = getConfig();
  return Boolean(cfg?.url && cfg?.anonKey && !String(cfg.url).includes("YOUR_PROJECT_REF"));
}

let client = null;

export function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  const cfg = getConfig();
  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

function mapBookingError(message = "") {
  const msg = String(message);
  if (msg.includes("SLOT_TAKEN")) return "Η ώρα δεν είναι διαθέσιμη. Επιλέξτε άλλη.";
  if (msg.includes("WEEKEND_CLOSED")) return "Δεν δεχόμαστε ραντεβού Σάββατο και Κυριακή.";
  if (msg.includes("PAST_DATE")) return "Η ημερομηνία έχει περάσει.";
  if (msg.includes("INVALID_TIME")) return "Μη έγκυρη ώρα για τη διάρκεια της υπηρεσίας.";
  if (msg.includes("INVALID_DURATION")) return "Μη έγκυρη διάρκεια υπηρεσίας.";
  if (msg.includes("INVALID_PHONE")) return "Ελέγξτε το τηλέφωνο.";
  if (msg.includes("INVALID_NAME")) return "Συμπληρώστε το ονοματεπώνυμο.";
  if (msg.includes("INVALID_SERVICE")) return "Επιλέξτε υπηρεσία.";
  return msg || "Αποτυχία κράτησης. Δοκιμάστε ξανά.";
}

function mapContactError(message = "") {
  const msg = String(message);
  if (msg.includes("INVALID_EMAIL")) return "Ελέγξτε το email.";
  if (msg.includes("INVALID_NAME")) return "Συμπληρώστε το όνομα.";
  if (msg.includes("INVALID_MESSAGE")) return "Γράψτε λίγο πιο αναλυτικά το μήνυμα.";
  return msg || "Αποτυχία αποστολής. Δοκιμάστε ξανά.";
}

function normalizeTime(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, 5);
  return String(value).slice(0, 5);
}

/** @returns {Promise<{ time: string, service: string, durationMin: number, cabinId: number | null }[]>} */
export async function fetchBookedSlots(dateKey) {
  const sb = getSupabase();
  if (!sb || !dateKey) return [];

  const { data, error } = await sb.rpc("get_booked_slots", { p_date: dateKey });
  if (!error) {
    return (data || []).map((row) => ({
      time: normalizeTime(row.appointment_time ?? row.appointmentTime),
      service: row.service || "",
      durationMin: Number(row.duration_minutes ?? row.durationMinutes) || 60,
      cabinId: row.cabin_id != null ? Number(row.cabin_id) : (row.cabinId != null ? Number(row.cabinId) : null),
    }));
  }

  // Fallback for DBs that still only expose get_booked_times
  console.warn("get_booked_slots unavailable, falling back to get_booked_times", error);
  const legacy = await fetchBookedTimes(dateKey);
  return legacy.map((time) => ({ time, service: "", durationMin: 60, cabinId: null }));
}

/** @returns {Promise<string[]>} times like "10:00" */
export async function fetchBookedTimes(dateKey) {
  const sb = getSupabase();
  if (!sb || !dateKey) return [];

  const { data, error } = await sb.rpc("get_booked_times", { p_date: dateKey });
  if (error) {
    console.error("get_booked_times", error);
    throw new Error(error.message || "Αποτυχία φόρτωσης διαθεσιμότητας");
  }

  return (data || []).map(normalizeTime);
}

/** @returns {Promise<object[]|null>} active catalog rows, or null if unavailable */
export async function fetchServiceCatalog() {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("catalog_services")
    .select("id, category_id, category_label, name, duration_minutes, price_cents, price_from, is_offer, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("catalog_services", error);
    return null;
  }
  return data || [];
}

export async function createBooking({
  service,
  date,
  time,
  name,
  phone,
  email = null,
  durationMinutes = 60,
  priceCents = null,
  cabinId = null,
}) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error("Το σύστημα κρατήσεων δεν είναι ρυθμισμένο ακόμα.");
  }

  const { data, error } = await sb.rpc("create_booking", {
    p_service: service,
    p_date: date,
    p_time: time.length === 5 ? `${time}:00` : time,
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_duration_minutes: durationMinutes,
    p_price_cents: priceCents,
    p_cabin_id: cabinId,
  });

  if (error) {
    const raw = error.message || "";
    if (/duplicate|unique/i.test(raw)) {
      throw new Error(mapBookingError("SLOT_TAKEN"));
    }
    throw new Error(mapBookingError(raw));
  }

  return data;
}

export async function submitContact({ name, email, message }) {
  const sb = getSupabase();
  if (!sb) {
    throw new Error("Η φόρμα δεν είναι ρυθμισμένη ακόμα.");
  }

  const { data, error } = await sb.rpc("submit_contact", {
    p_name: name,
    p_email: email,
    p_message: message,
  });

  if (error) {
    throw new Error(mapContactError(error.message));
  }

  return data;
}
