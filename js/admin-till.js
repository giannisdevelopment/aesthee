import {
  requireSession,
  signIn,
  signOut,
  listVisitsInRange,
  listCompletedAppointmentsInRange,
  showToast,
  formatMoney,
  formatDate,
  mapAuthError,
  isSupabaseConfigured,
} from "./admin-api.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");
const tillBody = document.getElementById("tillBody");
const tillDate = document.getElementById("tillDate");
const tillMonth = document.getElementById("tillMonth");
const tillYear = document.getElementById("tillYear");
const tillToday = document.getElementById("tillToday");
const tillPeriodLabel = document.getElementById("tillPeriodLabel");
const periodBtns = document.querySelectorAll("[data-period]");

/** @type {"day" | "month" | "year"} */
let period = "day";

function pad(n) {
  return String(n).padStart(2, "0");
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayIso() {
  return isoDate(new Date());
}

function monthValue(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  if (!isSupabaseConfigured()) configBanner?.classList.remove("hidden");
}

function eurosFromCents(cents) {
  if (cents == null || cents === "") return 0;
  const n = Number(cents);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function moneyKey(amount) {
  return Number(amount || 0).toFixed(2);
}

function rangeForPeriod() {
  if (period === "day") {
    const day = tillDate.value || todayIso();
    return { fromDate: day, toDate: day, label: formatDate(day) };
  }
  if (period === "month") {
    const raw = tillMonth.value || monthValue();
    const [y, m] = raw.split("-").map(Number);
    const fromDate = `${y}-${pad(m)}-01`;
    const last = new Date(y, m, 0).getDate();
    const toDate = `${y}-${pad(m)}-${pad(last)}`;
    const label = new Intl.DateTimeFormat("el-GR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
    return { fromDate, toDate, label };
  }
  const y = Number(tillYear.value) || new Date().getFullYear();
  return {
    fromDate: `${y}-01-01`,
    toDate: `${y}-12-31`,
    label: String(y),
  };
}

function syncPeriodInputs() {
  tillDate.classList.toggle("hidden", period !== "day");
  tillMonth.classList.toggle("hidden", period !== "month");
  tillYear.classList.toggle("hidden", period !== "year");
  periodBtns.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.period === period);
  });
}

function setToday() {
  const now = new Date();
  tillDate.value = isoDate(now);
  tillMonth.value = monthValue(now);
  tillYear.value = String(now.getFullYear());
}

/**
 * Prefer CRM visit payments. Completed bookings fill gaps (walk-ins booked in calendar
 * but not yet logged as a client visit) using name + date + amount.
 */
function mergeRows(visits, bookings) {
  const visitRows = (visits || []).map((row) => ({
    id: `v-${row.id}`,
    date: row.payment_date,
    name: row.clients?.full_name || "—",
    service: row.treatment,
    source: "Επίσκεψη",
    amount: Number(row.payment_amount) || 0,
    href: row.client_id ? `/admin/client?id=${row.client_id}` : "",
  }));

  const covered = new Set(
    visitRows.map((row) => `${row.date}|${normalizeName(row.name)}|${moneyKey(row.amount)}`),
  );

  const bookingRows = [];
  for (const row of bookings || []) {
    const amount = eurosFromCents(row.price_cents);
    if (amount <= 0) continue;
    const key = `${row.appointment_date}|${normalizeName(row.guest_name)}|${moneyKey(amount)}`;
    if (covered.has(key)) continue;
    bookingRows.push({
      id: `a-${row.id}`,
      date: row.appointment_date,
      name: row.guest_name,
      service: row.service,
      source: "Ραντεβού",
      amount,
      href: "",
    });
  }

  return [...visitRows, ...bookingRows].sort((a, b) => {
    if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
    return String(b.name).localeCompare(String(a.name), "el");
  });
}

async function renderTill() {
  const { fromDate, toDate, label } = rangeForPeriod();
  tillPeriodLabel.textContent = label;
  tillBody.innerHTML = `<tr><td colspan="5" class="empty">Φόρτωση…</td></tr>`;

  const [visitsRes, bookingsRes] = await Promise.all([
    listVisitsInRange({ fromDate, toDate }),
    listCompletedAppointmentsInRange({ fromDate, toDate }),
  ]);

  if (visitsRes.error) {
    tillBody.innerHTML = `<tr><td colspan="5" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
    showToast(visitsRes.error.message || "Αποτυχία φόρτωσης επισκέψεων", true);
    return;
  }
  if (bookingsRes.error) {
    tillBody.innerHTML = `<tr><td colspan="5" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
    showToast(bookingsRes.error.message || "Αποτυχία φόρτωσης ραντεβού", true);
    return;
  }

  const rows = mergeRows(visitsRes.data, bookingsRes.data);
  const visitTotal = rows.filter((r) => r.source === "Επίσκεψη").reduce((sum, r) => sum + r.amount, 0);
  const bookingTotal = rows.filter((r) => r.source === "Ραντεβού").reduce((sum, r) => sum + r.amount, 0);
  const visitCount = rows.filter((r) => r.source === "Επίσκεψη").length;
  const bookingCount = rows.filter((r) => r.source === "Ραντεβού").length;
  const total = visitTotal + bookingTotal;

  document.getElementById("statTotal").textContent = formatMoney(total).replace("—", "€ 0");
  document.getElementById("statCount").textContent = `${rows.length} εγγραφές`;
  document.getElementById("statVisits").textContent = formatMoney(visitTotal).replace("—", "€ 0");
  document.getElementById("statVisitsCount").textContent = `${visitCount} πληρωμές`;
  document.getElementById("statBookings").textContent = formatMoney(bookingTotal).replace("—", "€ 0");
  document.getElementById("statBookingsCount").textContent = `${bookingCount} ραντεβού`;

  if (!rows.length) {
    tillBody.innerHTML = `<tr><td colspan="5" class="empty">Καμία είσπραξη σε αυτή την περίοδο.</td></tr>`;
    return;
  }

  tillBody.innerHTML = rows.map((row) => {
    const nameCell = row.href
      ? `<a class="client-link" href="${escapeHtml(row.href)}">${escapeHtml(row.name)}</a>`
      : escapeHtml(row.name);
    return `
      <tr>
        <td>${escapeHtml(formatDate(row.date))}</td>
        <td>${nameCell}</td>
        <td>${escapeHtml(row.service || "—")}</td>
        <td>${escapeHtml(row.source)}</td>
        <td class="till-amount">${escapeHtml(formatMoney(row.amount))}</td>
      </tr>
    `;
  }).join("");
}

function bind() {
  periodBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      period = /** @type {"day" | "month" | "year"} */ (btn.dataset.period);
      syncPeriodInputs();
      await renderTill();
    });
  });
  tillDate?.addEventListener("change", () => renderTill());
  tillMonth?.addEventListener("change", () => renderTill());
  tillYear?.addEventListener("change", () => renderTill());
  tillToday?.addEventListener("click", async () => {
    setToday();
    await renderTill();
  });
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = loginForm.email.value;
  const password = loginForm.password.value;
  const { error } = await signIn(email, password);
  if (error) {
    showToast(mapAuthError(error), true);
    return;
  }
  showApp();
  await renderTill();
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  showLogin();
});

setToday();
syncPeriodInputs();
bind();

if (!isSupabaseConfigured()) {
  showLogin();
} else {
  requireSession().then(async (session) => {
    if (!session) {
      showLogin();
      return;
    }
    showApp();
    await renderTill();
  });
}
