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
  if (msg.includes("INVALID_TIME")) return "Μη έγκυρη ώρα.";
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

/** @returns {Promise<string[]>} times like "10:00" */
export async function fetchBookedTimes(dateKey) {
  const sb = getSupabase();
  if (!sb || !dateKey) return [];

  const { data, error } = await sb.rpc("get_booked_times", { p_date: dateKey });
  if (error) {
    console.error("get_booked_times", error);
    throw new Error(error.message || "Αποτυχία φόρτωσης διαθεσιμότητας");
  }

  return (data || []).map((value) => {
    if (typeof value === "string") return value.slice(0, 5);
    return String(value).slice(0, 5);
  });
}

export async function createBooking({ service, date, time, name, phone, email = null }) {
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
