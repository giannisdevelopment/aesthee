import {
  requireSession,
  signIn,
  signOut,
  listCompletedAppointmentsInRange,
  showToast,
  formatMoney,
  formatDate,
  setDayFirstDate,
  readDayFirstDate,
  mapAuthError,
  isSupabaseConfigured,
  applyAuthShell,
} from "./admin-api.js?v=tills-2";
import {
  displayServiceName,
  splitAppointmentServices,
  resolveCabinForAppointment,
  isBlockedTimeService,
  CABIN_SHORT,
} from "./booking-services.js?v=solarium-word";

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

function eurosFromCents(cents) {
  if (cents == null || cents === "") return 0;
  const n = Number(cents);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

function moneyText(amount) {
  return formatMoney(amount).replace("—", "€ 0");
}

function countLabel(n) {
  return n === 1 ? "1 ολοκληρωμένο" : `${n} ολοκληρωμένα`;
}

/** Ταμείο 1 = Κ1–Κ2. Ταμείο 2 = Κ3–Κ6. */
function tillForCabin(cabinId) {
  const id = Number(cabinId);
  if (id === 1 || id === 2) return 1;
  if (id >= 3 && id <= 6) return 2;
  return 0;
}

function rangeForPeriod() {
  if (period === "day") {
    const day = readDayFirstDate(tillDate) || todayIso();
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
  setDayFirstDate(tillDate, isoDate(now));
  tillMonth.value = monthValue(now);
  tillYear.value = String(now.getFullYear());
}

/** Completed appointments only. Confirmed, pending, cancelled, and blocked time stay out. */
function rowsFromCompleted(bookings) {
  const rows = [];
  for (const row of bookings || []) {
    if (row.status !== "completed") continue;
    if (isBlockedTimeService(row.service)) continue;
    const amount = eurosFromCents(row.price_cents);
    if (amount <= 0) continue;
    const cabinId = resolveCabinForAppointment(row);
    const till = tillForCabin(cabinId);
    if (!till) continue;
    rows.push({
      id: row.id,
      date: row.appointment_date,
      name: row.guest_name,
      service: row.service,
      cabinId,
      cabin: CABIN_SHORT[cabinId]?.code || `Κ${cabinId}`,
      till,
      amount,
    });
  }
  rows.sort((a, b) => {
    if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
    if (a.till !== b.till) return a.till - b.till;
    return String(a.name).localeCompare(String(b.name), "el");
  });
  return rows;
}

async function renderTill() {
  const { fromDate, toDate, label } = rangeForPeriod();
  tillPeriodLabel.textContent = label;
  tillBody.innerHTML = `<tr><td colspan="6" class="empty">Φόρτωση…</td></tr>`;

  const bookingsRes = await listCompletedAppointmentsInRange({ fromDate, toDate });

  if (bookingsRes.error) {
    tillBody.innerHTML = `<tr><td colspan="6" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
    showToast(bookingsRes.error.message || "Αποτυχία φόρτωσης ραντεβού", true);
    return;
  }

  const rows = rowsFromCompleted(bookingsRes.data);
  const till1 = rows.filter((row) => row.till === 1);
  const till2 = rows.filter((row) => row.till === 2);
  const sum = (list) => list.reduce((total, row) => total + row.amount, 0);

  document.getElementById("statTill1").textContent = moneyText(sum(till1));
  document.getElementById("statTill1Meta").textContent = `Κ1 · Κ2 · ${countLabel(till1.length)}`;
  document.getElementById("statTill2").textContent = moneyText(sum(till2));
  document.getElementById("statTill2Meta").textContent = `Κ3 · Κ4 · Κ5 · Κ6 · ${countLabel(till2.length)}`;
  document.getElementById("statTotal").textContent = moneyText(sum(rows));
  document.getElementById("statCount").textContent = countLabel(rows.length);

  if (!rows.length) {
    tillBody.innerHTML = `<tr><td colspan="6" class="empty">Κανένα ολοκληρωμένο ραντεβού σε αυτή την περίοδο.</td></tr>`;
    return;
  }

  tillBody.innerHTML = rows.map((row) => `
      <tr>
        <td>${escapeHtml(formatDate(row.date))}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(splitAppointmentServices(row.service).filter(Boolean).map(displayServiceName).join(" + ") || "—")}</td>
        <td>${escapeHtml(row.cabin)}</td>
        <td>Ταμείο ${row.till}</td>
        <td class="till-amount">${escapeHtml(formatMoney(row.amount))}</td>
      </tr>
    `).join("");
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
