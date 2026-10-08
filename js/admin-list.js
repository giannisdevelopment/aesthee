import {
  requireSession,
  signIn,
  signOut,
  listClients,
  listAppointmentsForVisitCount,
  listVisitDates,
  showToast,
  mapAuthError,
  isSupabaseConfigured,
  applyAuthShell,
} from "./admin-api.js?v=visit-count";
import { isBlockedTimeService } from "./booking-services.js?v=solarium-word";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const clientsBody = document.getElementById("clientsBody");
const searchInput = document.getElementById("searchInput");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");
const submitBtn = loginForm?.querySelector('button[type="submit"]');

function setLoginError(message) {
  if (!loginError) {
    if (message) showToast(message, true);
    return;
  }
  if (!message) {
    loginError.hidden = true;
    loginError.textContent = "";
    return;
  }
  loginError.hidden = false;
  loginError.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function phoneKey(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0030")) digits = digits.slice(4);
  else if (digits.startsWith("30") && digits.length > 10) digits = digits.slice(2);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length >= 8 ? digits : "";
}

function dayKey(value) {
  return String(value || "").slice(0, 10);
}

function bumpDay(days, day, field) {
  if (!day) return;
  let cell = days.get(day);
  if (!cell) {
    cell = { appts: 0, visits: 0 };
    days.set(day, cell);
  }
  cell[field] += 1;
}

/** Appointments and logged visits on the same day count as one visit. */
function countFromDays(days) {
  let total = 0;
  for (const cell of days.values()) total += Math.max(cell.appts, cell.visits);
  return total;
}

function countClientVisits(client, index) {
  const days = new Map();
  for (const [day, count] of index.visitsByClient.get(client.id) || []) {
    for (let i = 0; i < count; i += 1) bumpDay(days, day, "visits");
  }
  for (const row of index.apptsByClient.get(client.id) || []) {
    bumpDay(days, row.day, "appts");
  }
  const phone = phoneKey(client.phone);
  if (phone) {
    for (const row of index.apptsByPhone.get(phone) || []) {
      if (row.clientId && row.clientId !== client.id) continue;
      bumpDay(days, row.day, "appts");
    }
  }
  if (!days.size) return client.visits?.[0]?.count ?? 0;
  return countFromDays(days);
}

/** @type {Promise<object> | null} */
let visitIndexPromise = null;

function loadVisitIndex() {
  if (!visitIndexPromise) {
    visitIndexPromise = (async () => {
      const today = todayKey();
      const [apptsRes, visitsRes] = await Promise.all([
        listAppointmentsForVisitCount(today),
        listVisitDates(),
      ]);
      if (apptsRes.error || visitsRes.error) {
        visitIndexPromise = null;
        return null;
      }
      const apptsByClient = new Map();
      const apptsByPhone = new Map();
      for (const row of apptsRes.data || []) {
        if (isBlockedTimeService(row.service)) continue;
        const day = dayKey(row.appointment_date);
        if (!day) continue;
        if (row.client_id) {
          const list = apptsByClient.get(row.client_id) || [];
          list.push({ day, clientId: row.client_id });
          apptsByClient.set(row.client_id, list);
          continue;
        }
        const phone = phoneKey(row.guest_phone);
        if (!phone) continue;
        const list = apptsByPhone.get(phone) || [];
        list.push({ day, clientId: "" });
        apptsByPhone.set(phone, list);
      }
      const visitsByClient = new Map();
      for (const row of visitsRes.data || []) {
        const day = dayKey(row.payment_date);
        if (!row.client_id || !day) continue;
        let byDay = visitsByClient.get(row.client_id);
        if (!byDay) {
          byDay = new Map();
          visitsByClient.set(row.client_id, byDay);
        }
        byDay.set(day, (byDay.get(day) || 0) + 1);
      }
      return { apptsByClient, apptsByPhone, visitsByClient };
    })();
  }
  return visitIndexPromise;
}

async function renderClients(query = "") {
  clientsBody.innerHTML = `<tr><td colspan="5" class="empty">Φόρτωση…</td></tr>`;
  const [{ data, error }, index] = await Promise.all([
    listClients(query),
    loadVisitIndex(),
  ]);
  if (error) {
    clientsBody.innerHTML = `<tr><td colspan="5" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
    showToast(error.message || "Αποτυχία φόρτωσης πελατών", true);
    return;
  }
  const rows = [...(data || [])].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""), "el", {
      sensitivity: "base",
      numeric: true,
    })
  );
  if (!rows.length) {
    clientsBody.innerHTML = `<tr><td colspan="5" class="empty">Δεν βρέθηκαν πελάτες.</td></tr>`;
    return;
  }

  clientsBody.innerHTML = rows.map((client) => {
    const visitCount = index
      ? countClientVisits(client, index)
      : (client.visits?.[0]?.count ?? 0);
    return `
      <tr>
        <td><a class="client-link" href="/admin/client?id=${escapeHtml(client.id)}">${escapeHtml(client.full_name)}</a></td>
        <td>${escapeHtml(client.phone || "—")}</td>
        <td>${escapeHtml(client.email || "—")}</td>
        <td>${visitCount}</td>
        <td><a class="btn btn-ghost btn-sm" href="/admin/client?id=${escapeHtml(client.id)}">Άνοιγμα</a></td>
      </tr>
    `;
  }).join("");
}

function showApp() {
  applyAuthShell(true);
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showLogin() {
  applyAuthShell(false);
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  if (!isSupabaseConfigured()) configBanner?.classList.remove("hidden");
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError("");
  if (!isSupabaseConfigured()) {
    setLoginError("Λείπει το js/supabase-config.js (URL + anon/publishable key).");
    return;
  }
  const email = event.target.email.value.trim();
  const password = event.target.password.value;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Σύνδεση…";
  }
  try {
    const { data, error } = await signIn(email, password);
    if (error) {
      const mapped = mapAuthError(error);
      setLoginError(mapped);
      showToast(mapped, true);
      return;
    }
    if (!data?.session) {
      setLoginError("Η σύνδεση δεν επέστρεψε session. Δοκιμάστε ξανά.");
      return;
    }
    showApp();
    await renderClients();
  } catch (err) {
    const mapped = mapAuthError(err);
    setLoginError(mapped);
    showToast(mapped, true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Σύνδεση";
    }
  }
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  showLogin();
});

let searchTimer = 0;
searchInput?.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    renderClients(searchInput.value);
  }, 220);
});

async function boot() {
  if (!isSupabaseConfigured()) {
    showLogin();
    return;
  }
  try {
    const session = await requireSession();
    if (!session) {
      showLogin();
      return;
    }
    showApp();
    await renderClients();
  } catch (err) {
    setLoginError(mapAuthError(err));
  }
}

boot();
