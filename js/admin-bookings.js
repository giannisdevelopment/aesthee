import {
  requireSession,
  signIn,
  signOut,
  listAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  findOrCreateClientFromBooking,
  listCatalogServices,
  listClients,
  getClient,
  showToast,
  formatDate,
  formatTime,
  APPOINTMENT_STATUS_LABELS,
} from "./admin-api.js";
import {
  DEFAULT_BOOKING_CATEGORIES,
  applyCatalogFromRows,
  getServiceById,
  buildStartSlots,
  filterAvailableStarts,
  pickCabinForSlot,
  isCabinFreeForSlot,
  getCabinPool,
  getCabinPoolForServiceName,
  clampCabinToPool,
  CABIN_SHORT,
  CABIN_IDS,
  CABIN_LABELS,
  BOOKING_DAY_START,
  BOOKING_DAY_END,
  timeLabelToMinutes,
  minutesToTimeLabel,
} from "./booking-services.js";
import { fetchBookedSlots } from "./booking-api.js";
import { notifyAppointmentEmail } from "./appointment-email.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const rowsBody = document.getElementById("appointmentsBody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");
const calendarPanel = document.getElementById("calendarPanel");
const listPanel = document.getElementById("listPanel");
const viewCalBtn = document.getElementById("viewCalBtn");
const viewListBtn = document.getElementById("viewListBtn");
const calDayStrip = document.getElementById("calDayStrip");
const calMonthLabel = document.getElementById("calMonthLabel");
const calCabinHeads = document.getElementById("calCabinHeads");
const calTimes = document.getElementById("calTimes");
const calCols = document.getElementById("calCols");
const calPrev = document.getElementById("calPrev");
const calNext = document.getElementById("calNext");
const calToday = document.getElementById("calToday");
const calFab = document.getElementById("calFab");

const openBookingBtn = document.getElementById("openBookingBtn");
const cancelBookingBtn = document.getElementById("cancelBookingBtn");
const bookingPanel = document.getElementById("bookingPanel");
const bookingForm = document.getElementById("bookingForm");
const bkClient = document.getElementById("bkClient");
const bkStatus = document.getElementById("bkStatus");
const bkName = document.getElementById("bkName");
const bkPhone = document.getElementById("bkPhone");
const bkEmail = document.getElementById("bkEmail");
const bkServiceSearch = document.getElementById("bkServiceSearch");
const bkServiceId = document.getElementById("bkServiceId");
const bkServiceSuggest = document.getElementById("bkServiceSuggest");
const bkDate = document.getElementById("bkDate");
const bkTime = document.getElementById("bkTime");
const bkDuration = document.getElementById("bkDuration");
const bkPrice = document.getElementById("bkPrice");
const bkCabin = document.getElementById("bkCabin");
const bkNotes = document.getElementById("bkNotes");
const bkLinkClient = document.getElementById("bkLinkClient");
const bkSubmitBtn = document.getElementById("bkSubmitBtn");

/** @type {Array<{ id: string, name: string, categoryLabel: string, durationMin: number, priceCents: number, priceFrom: boolean, categoryId: string }>} */
let catalogCache = [];

/** @type {Array<{ id: string, full_name: string, phone: string | null, email: string | null }>} */
let clientsCache = [];

/** @type {string} */
let selectedServiceId = "";

let suggestActiveIndex = -1;

/** @type {"calendar" | "list"} */
let activeView = "calendar";

/** Calendar selected day as YYYY-MM-DD */
let calendarDay = "";

/** @type {object[]} */
let appointmentsCache = [];

/** @type {string | null} */
let editingAppointmentId = null;

/** Snapshot while editing — for email diffs */
let editingSnapshot = null;

const PX_PER_MIN = 1.35;
const DOW_LABELS = ["Κ", "Δ", "Τ", "Τ", "Π", "Π", "Σ"];
const MONTH_LABELS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];

function configMissing() {
  const cfg = window.AESTHEE_SUPABASE;
  return !cfg?.url || !cfg?.anonKey || String(cfg.url).includes("YOUR_PROJECT_REF");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusBadge(status) {
  const label = APPOINTMENT_STATUS_LABELS[status] || status;
  return `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
}

function filters() {
  if (activeView === "calendar" && calendarDay) {
    return {
      status: statusFilter?.value || "",
      fromDate: calendarDay,
      toDate: calendarDay,
      query: searchInput?.value || "",
    };
  }
  return {
    status: statusFilter?.value || "",
    fromDate: fromDate?.value || "",
    toDate: toDate?.value || "",
    query: searchInput?.value || "",
  };
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function setCalendarDay(key) {
  calendarDay = key;
  if (fromDate) fromDate.value = key;
  if (toDate) toDate.value = key;
  renderDayStrip();
  renderAppointments();
}

function setActiveView(view, { refresh = true } = {}) {
  activeView = view;
  viewCalBtn?.classList.toggle("is-active", view === "calendar");
  viewListBtn?.classList.toggle("is-active", view === "list");
  if (calendarPanel) calendarPanel.hidden = view !== "calendar";
  if (listPanel) listPanel.hidden = view !== "list";
  if (view === "list") {
    if (fromDate) fromDate.classList.remove("hidden");
    if (toDate) toDate.classList.remove("hidden");
  } else {
    if (fromDate) fromDate.classList.add("hidden");
    if (toDate) toDate.classList.add("hidden");
  }
  if (refresh) renderAppointments();
}

function renderDayStrip() {
  if (!calDayStrip || !calendarDay) return;
  const selected = parseDateKey(calendarDay);
  calMonthLabel.textContent = `${MONTH_LABELS[selected.getMonth()]} ${selected.getFullYear()}`;

  const start = new Date(selected);
  start.setDate(selected.getDate() - selected.getDay() + 1); // Monday start
  if (selected.getDay() === 0) start.setDate(selected.getDate() - 6);

  const todayKey = toDateKey(new Date());
  const parts = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = toDateKey(day);
    const dow = DOW_LABELS[day.getDay()];
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isSelected = key === calendarDay;
    parts.push(`
      <button
        type="button"
        class="cal-day${isSelected ? " is-selected" : ""}${isWeekend ? " is-weekend" : ""}${key === todayKey ? " is-today" : ""}"
        data-day="${key}"
        role="tab"
        aria-selected="${isSelected ? "true" : "false"}"
      >
        <span class="dow">${dow}</span>
        <span class="dom">${day.getDate()}</span>
      </button>
    `);
  }
  calDayStrip.innerHTML = parts.join("");
  calDayStrip.querySelectorAll("[data-day]").forEach((btn) => {
    btn.addEventListener("click", () => setCalendarDay(btn.dataset.day));
  });
}

function resolveCabinId(row) {
  const direct = Number(row.cabin_id);
  if (direct >= 1 && direct <= 5) return direct;
  return getCabinPoolForServiceName(row.service)?.[0] || 1;
}

function buildCalendarChrome() {
  if (!calCabinHeads || !calTimes || !calCols) return;

  calCabinHeads.innerHTML = CABIN_IDS.map((id) => {
    const meta = CABIN_SHORT[id];
    return `
      <div class="cal-cabin-head" title="${escapeHtml(meta.role)}">
        <span class="code">${escapeHtml(meta.code)}</span>
        <span class="role">${escapeHtml(meta.role)}</span>
      </div>
    `;
  }).join("");

  const labels = [];
  for (let mins = BOOKING_DAY_START; mins < BOOKING_DAY_END; mins += 60) {
    const top = (mins - BOOKING_DAY_START) * PX_PER_MIN;
    labels.push(`<div class="cal-time-label" style="top:${top}px">${minutesToTimeLabel(mins)}</div>`);
  }
  calTimes.innerHTML = labels.join("");
  calTimes.style.height = `${(BOOKING_DAY_END - BOOKING_DAY_START) * PX_PER_MIN}px`;

  calCols.innerHTML = CABIN_IDS.map((id) => `
    <div
      class="cal-col"
      data-cabin="${id}"
      style="height:${(BOOKING_DAY_END - BOOKING_DAY_START) * PX_PER_MIN}px"
    ></div>
  `).join("");

  calCols.querySelectorAll(".cal-col").forEach((col) => {
    col.addEventListener("click", (event) => {
      if (event.target.closest(".cal-block")) return;
      const rect = col.getBoundingClientRect();
      const y = event.clientY - rect.top;
      let mins = BOOKING_DAY_START + Math.round(y / PX_PER_MIN);
      mins = Math.round(mins / 10) * 10;
      mins = Math.max(BOOKING_DAY_START, Math.min(BOOKING_DAY_END - 10, mins));
      openBookingPanel({
        date: calendarDay,
        time: minutesToTimeLabel(mins),
        cabinId: Number(col.dataset.cabin),
      });
    });
  });
}

function renderCalendar(data) {
  if (!calCols) return;
  if (!calCols.querySelector(".cal-col")) buildCalendarChrome();

  calCols.querySelectorAll(".cal-block").forEach((el) => el.remove());
  closeCalDetail();

  const visible = (data || []).filter((row) => row.status !== "cancelled");

  for (const row of visible) {
    const cabinId = resolveCabinId(row);
    const col = calCols.querySelector(`.cal-col[data-cabin="${cabinId}"]`);
    if (!col) continue;

    const start = timeLabelToMinutes(formatTime(row.appointment_time));
    if (start == null) continue;
    const duration = Number(row.duration_minutes) || 60;
    const top = (start - BOOKING_DAY_START) * PX_PER_MIN;
    const height = Math.max(duration * PX_PER_MIN, 34);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `cal-block is-${row.status || "pending"}`;
    btn.style.top = `${Math.max(0, top)}px`;
    btn.style.height = `${height}px`;
    btn.dataset.id = row.id;
    btn.innerHTML = `
      <span class="t">${escapeHtml(formatTime(row.appointment_time))}</span>
      <span class="n">${escapeHtml(row.guest_name)}</span>
      <span class="s">${escapeHtml(row.service)}</span>
      <span class="d">${escapeHtml(formatDurationMin(duration))}${row.price_cents != null ? ` · ${escapeHtml(formatPriceCents(row.price_cents))}` : ""}</span>
    `;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openCalDetail(row);
    });
    col.appendChild(btn);
  }
}

function closeCalDetail() {
  document.getElementById("calDetail")?.remove();
}

function openCalDetail(row) {
  closeCalDetail();
  const el = document.createElement("div");
  el.id = "calDetail";
  el.className = "cal-detail";
  el.innerHTML = `
    <h3>${escapeHtml(row.guest_name)}</h3>
    <p>${escapeHtml(formatTime(row.appointment_time))} · ${escapeHtml(formatDurationMin(row.duration_minutes || 60))}</p>
    <p>${escapeHtml(row.service)}</p>
    <p>${escapeHtml(formatPriceCents(row.price_cents))} · Καμπίνα ${escapeHtml(String(resolveCabinId(row)))}</p>
    <p>${statusBadge(row.status)} · <a href="tel:${escapeHtml(row.guest_phone)}">${escapeHtml(row.guest_phone)}</a></p>
    <div class="cal-detail-actions">
      <button class="btn btn-gold btn-sm" type="button" id="calDetailEdit">Επεξεργασία</button>
      <select class="status-select" id="calDetailStatus" aria-label="Κατάσταση">
        ${Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) =>
          `<option value="${value}" ${row.status === value ? "selected" : ""}>${label}</option>`
        ).join("")}
      </select>
      ${row.client_id
        ? `<a class="btn btn-ghost btn-sm" href="/admin/client?id=${escapeHtml(row.client_id)}">Πελάτης</a>`
        : `<button class="btn btn-ghost btn-sm" type="button" id="calDetailToClient">→ Πελάτης</button>`}
      <button class="btn btn-danger btn-sm" type="button" id="calDetailDelete">Διαγραφή</button>
      <button class="btn btn-ghost btn-sm" type="button" id="calDetailClose">Κλείσιμο</button>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector("#calDetailClose")?.addEventListener("click", closeCalDetail);
  el.querySelector("#calDetailEdit")?.addEventListener("click", () => {
    closeCalDetail();
    openBookingPanel({ edit: row });
  });
  el.querySelector("#calDetailStatus")?.addEventListener("change", async (event) => {
    const nextStatus = event.target.value;
    const { error } = await updateAppointment(row.id, { status: nextStatus });
    if (error) {
      showToast(error.message || "Αποτυχία ενημέρωσης", true);
      return;
    }
    showToast("Η κατάσταση ενημερώθηκε.");
    const updated = { ...row, status: nextStatus };
    if (nextStatus === "confirmed" && row.status !== "confirmed") {
      notifyAppointmentEmail({ type: "confirmed", appointment: updated }).catch(() => {});
    } else if (nextStatus === "cancelled" && row.status !== "cancelled") {
      notifyAppointmentEmail({ type: "cancelled", appointment: updated }).catch(() => {});
    }
    closeCalDetail();
    await renderAppointments();
  });
  el.querySelector("#calDetailDelete")?.addEventListener("click", async () => {
    if (!confirm("Οριστική διαγραφή αυτού του ραντεβού;")) return;
    const { error } = await deleteAppointment(row.id);
    if (error) {
      showToast(error.message || "Αποτυχία διαγραφής", true);
      return;
    }
    showToast("Διαγράφηκε.");
    closeCalDetail();
    await renderAppointments();
  });
  el.querySelector("#calDetailToClient")?.addEventListener("click", async () => {
    try {
      const clientId = await findOrCreateClientFromBooking(row);
      await updateAppointment(row.id, {
        client_id: clientId,
        status: row.status === "pending" ? "confirmed" : row.status,
      });
      location.href = `/admin/client?id=${clientId}`;
    } catch (err) {
      showToast(err.message || "Αποτυχία δημιουργίας πελάτη", true);
    }
  });
}

function resetBookingForm(prefs = {}) {
  bookingForm.reset();
  editingAppointmentId = null;
  editingSnapshot = null;
  selectedServiceId = "";
  bkServiceId.value = "";
  bkServiceSearch.value = "";
  bkStatus.value = "confirmed";
  bkLinkClient.checked = true;
  hideServiceSuggest();
  bkDate.value = prefs.date || calendarDay || toDateKey(new Date());
  bkDuration.value = "60";
  syncCabinSelectForService(null, prefs.cabinId || null);
  bkTime.innerHTML = prefs.time
    ? `<option value="${escapeHtml(prefs.time)}" selected>${escapeHtml(prefs.time)}</option>`
    : `<option value="">Επιλέξτε ημερομηνία &amp; υπηρεσία…</option>`;
  const title = document.querySelector("#bookingPanel .panel-title");
  if (title) title.textContent = "Νέο ραντεβού";
  if (bkSubmitBtn) bkSubmitBtn.textContent = "Αποθήκευση ραντεβού";
}

function fillFormFromAppointment(row) {
  editingAppointmentId = row.id;
  editingSnapshot = { ...row };
  selectedServiceId = "";
  bkServiceId.value = "";
  bkServiceSearch.value = row.service || "";
  const match = catalogCache.find(
    (item) => normalizeSearch(item.name) === normalizeSearch(row.service || "")
  );
  if (match) {
    selectedServiceId = match.id;
    bkServiceId.value = match.id;
  }
  bkName.value = row.guest_name || "";
  bkPhone.value = row.guest_phone || "";
  bkEmail.value = row.guest_email || "";
  bkDate.value = row.appointment_date || calendarDay;
  bkDuration.value = String(row.duration_minutes || 60);
  bkPrice.value = row.price_cents != null ? eurosFromCents(row.price_cents) : "";
  bkCabin.value = row.cabin_id ? String(row.cabin_id) : "";
  bkStatus.value = row.status || "confirmed";
  bkNotes.value = row.notes || "";
  bkClient.value = row.client_id || "";
  bkLinkClient.checked = Boolean(row.client_id);
  const serviceObj = selectedCatalogService() || {
    id: selectedServiceId || "custom",
    name: row.service,
    categoryId: "",
    durationMin: row.duration_minutes || 60,
  };
  syncCabinSelectForService(serviceObj, row.cabin_id);
  const time = formatTime(row.appointment_time);
  bkTime.innerHTML = `<option value="${escapeHtml(time)}" selected>${escapeHtml(time)}</option>`;
  const title = document.querySelector("#bookingPanel .panel-title");
  if (title) title.textContent = "Επεξεργασία ραντεβού";
  if (bkSubmitBtn) bkSubmitBtn.textContent = "Αποθήκευση αλλαγών";
}

function openBookingPanel(prefs = {}) {
  if (prefs.edit) {
    resetBookingForm();
    fillFormFromAppointment(prefs.edit);
    bookingPanel.hidden = false;
    bookingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    refreshTimeOptions().then(() => {
      const time = formatTime(prefs.edit.appointment_time);
      const exists = [...bkTime.options].some((o) => o.value === time);
      if (!exists && time) {
        const opt = document.createElement("option");
        opt.value = time;
        opt.textContent = time;
        bkTime.appendChild(opt);
      }
      bkTime.value = time;
    }).catch(() => {});
    return;
  }

  resetBookingForm(prefs);
  bookingPanel.hidden = false;
  bookingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  if (prefs.time && bkDate.value) {
    refreshTimeOptions().then(() => {
      if (prefs.time) {
        const exists = [...bkTime.options].some((o) => o.value === prefs.time);
        if (!exists) {
          const opt = document.createElement("option");
          opt.value = prefs.time;
          opt.textContent = prefs.time;
          bkTime.appendChild(opt);
        }
        bkTime.value = prefs.time;
      }
    }).catch(() => {});
  }
}

function closeBookingPanel() {
  bookingPanel.hidden = true;
  resetBookingForm();
}

function formatPriceCents(cents) {
  if (cents == null || Number.isNaN(Number(cents))) return "—";
  const amount = Number(cents) / 100;
  const text = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(".", ",");
  return `€ ${text}`;
}

function formatDurationMin(minutes) {
  const value = Number(minutes);
  if (!value || value < 1) return "";
  if (value < 60) return `${value}′`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (!rest) return `${hours}ώ`;
  return `${hours}ώ ${rest}′`;
}

function eurosFromCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2).replace(/\.00$/, "");
}

function centsFromEuros(raw) {
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function catalogFromDefaults() {
  return DEFAULT_BOOKING_CATEGORIES.flatMap((cat) =>
    cat.services.map((s) => ({
      id: s.id,
      name: s.name,
      categoryLabel: cat.label,
      categoryId: cat.id,
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      priceFrom: Boolean(s.priceFrom),
    }))
  );
}

function catalogFromRows(rows) {
  return (rows || [])
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      id: String(row.id),
      name: String(row.name || ""),
      categoryLabel: String(row.category_label || row.category_id || "Άλλο"),
      categoryId: String(row.category_id || ""),
      durationMin: Number(row.duration_minutes) || 60,
      priceCents: Number(row.price_cents) || 0,
      priceFrom: Boolean(row.price_from),
    }))
    .filter((row) => row.name);
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatServiceMeta(row) {
  const euros = eurosFromCents(row.priceCents);
  const from = row.priceFrom ? "από " : "";
  const price = euros ? `${from}€${euros}` : "";
  const duration = `${row.durationMin || 60}′`;
  return [row.categoryLabel, price, duration].filter(Boolean).join(" · ");
}

function filterCatalog(query) {
  const q = normalizeSearch(query);
  if (!q) return [];
  return catalogCache
    .filter((row) => {
      const hay = normalizeSearch(`${row.name} ${row.categoryLabel}`);
      return hay.includes(q);
    })
    .slice(0, 25);
}

function hideServiceSuggest() {
  bkServiceSuggest.classList.add("hidden");
  bkServiceSuggest.innerHTML = "";
  suggestActiveIndex = -1;
}

function showServiceSuggest(rows, query = "") {
  const q = String(query || "").trim();
  if (!q) {
    hideServiceSuggest();
    return;
  }

  if (!rows.length) {
    bkServiceSuggest.innerHTML = `<div class="suggest-empty">Δεν βρέθηκε στον κατάλογο — θα αποθηκευτεί ως χειροκίνητη υπηρεσία.</div>`;
    bkServiceSuggest.classList.remove("hidden");
    suggestActiveIndex = -1;
    return;
  }

  bkServiceSuggest.innerHTML = rows.map((row, index) => `
    <button
      type="button"
      class="suggest-item${index === 0 ? " is-active" : ""}"
      role="option"
      data-service-id="${escapeHtml(row.id)}"
      data-index="${index}"
    >
      <strong>${escapeHtml(row.name)}</strong>
      <span>${escapeHtml(formatServiceMeta(row))}</span>
    </button>
  `).join("");
  bkServiceSuggest.classList.remove("hidden");
  suggestActiveIndex = 0;

  bkServiceSuggest.querySelectorAll("[data-service-id]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      pickService(btn.dataset.serviceId);
    });
  });
}

function pickService(id) {
  const row = catalogCache.find((item) => item.id === id);
  if (!row) return;
  selectedServiceId = row.id;
  bkServiceId.value = row.id;
  bkServiceSearch.value = row.name;
  bkDuration.value = String(row.durationMin || 60);
  bkPrice.value = eurosFromCents(row.priceCents);
  hideServiceSuggest();
  syncCabinSelectForService({
    id: row.id,
    categoryId: row.categoryId,
    durationMin: row.durationMin,
    name: row.name,
  });
  refreshTimeOptions().catch(() => {});
}

/** Limit cabin dropdown to the pool allowed for this service; auto-fix wrong picks. */
function syncCabinSelectForService(service, preferredCabinId = null) {
  if (!bkCabin) return;
  const pool = service ? getCabinPool(service) : CABIN_IDS.slice();
  const current = preferredCabinId != null
    ? Number(preferredCabinId)
    : (bkCabin.value ? Number(bkCabin.value) : null);

  bkCabin.innerHTML = [
    `<option value="">Αυτόματα</option>`,
    ...pool.map((id) => {
      const meta = CABIN_SHORT[id] || { code: `Κ${id}`, role: "" };
      return `<option value="${id}">${escapeHtml(meta.code)} — ${escapeHtml(meta.role)}</option>`;
    }),
  ].join("");

  if (current != null && pool.includes(current)) {
    bkCabin.value = String(current);
    return;
  }

  if (current != null && !pool.includes(current)) {
    bkCabin.value = pool.length === 1 ? String(pool[0]) : "";
    const labels = pool.map((id) => CABIN_SHORT[id]?.code || `Κ${id}`).join(" / ");
    showToast(`Η θεραπεία μπαίνει μόνο σε ${labels}. Διορθώθηκε αυτόματα.`);
    return;
  }

  bkCabin.value = pool.length === 1 ? String(pool[0]) : "";
}

function clearPickedServiceKeepText() {
  selectedServiceId = "";
  bkServiceId.value = "";
}

function selectedCatalogService() {
  if (!selectedServiceId) return null;
  return catalogCache.find((row) => row.id === selectedServiceId) || getServiceById(selectedServiceId) || null;
}

function selectedServicePayload() {
  const fromCatalog = selectedCatalogService();
  if (fromCatalog) {
    return {
      id: fromCatalog.id,
      name: fromCatalog.name,
      durationMin: Number(bkDuration.value) || fromCatalog.durationMin || 60,
      categoryId: fromCatalog.categoryId,
    };
  }
  const name = bkServiceSearch.value.trim();
  return {
    id: "custom",
    name,
    durationMin: Number(bkDuration.value) || 60,
    categoryId: "",
  };
}

function renderClientOptions() {
  const parts = [`<option value="">— Χωρίς σύνδεση / νέος —</option>`];
  for (const client of clientsCache) {
    const phone = client.phone ? ` · ${client.phone}` : "";
    parts.push(
      `<option value="${escapeHtml(client.id)}">${escapeHtml(client.full_name)}${escapeHtml(phone)}</option>`
    );
  }
  bkClient.innerHTML = parts.join("");
}

async function refreshTimeOptions() {
  const date = bkDate.value;
  const service = selectedServicePayload();
  const duration = Number(bkDuration.value) || service.durationMin || 60;

  if (!date || !service.name) {
    bkTime.innerHTML = `<option value="">Επιλέξτε ημερομηνία &amp; υπηρεσία…</option>`;
    return;
  }

  const prev = bkTime.value;
  bkTime.innerHTML = `<option value="">Φόρτωση ωρών…</option>`;

  try {
    let booked = await fetchBookedSlots(date);
    if (editingAppointmentId && editingSnapshot) {
      const selfTime = formatTime(editingSnapshot.appointment_time);
      const selfCabin = Number(editingSnapshot.cabin_id) || null;
      const selfDate = String(editingSnapshot.appointment_date || "").slice(0, 10);
      if (selfDate === date) {
        booked = booked.filter((row) => {
          if (formatTime(row.time) !== selfTime) return true;
          if (selfCabin == null) return false;
          return Number(row.cabinId) !== selfCabin;
        });
      }
    }
    const candidates = buildStartSlots(duration);
    const available = filterAvailableStarts(candidates, booked, {
      id: service.id,
      categoryId: service.categoryId,
      durationMin: duration,
    });

    if (!available.length) {
      bkTime.innerHTML = `<option value="">Καμία διαθέσιμη ώρα</option>`;
      return;
    }

    bkTime.innerHTML = [
      `<option value="">Επιλέξτε ώρα…</option>`,
      ...available.map((t) => `<option value="${t}" ${t === prev ? "selected" : ""}>${t}</option>`),
    ].join("");
  } catch (error) {
    console.warn(error);
    const candidates = buildStartSlots(duration);
    bkTime.innerHTML = [
      `<option value="">Επιλέξτε ώρα…</option>`,
      ...candidates.map((t) => `<option value="${t}">${t}</option>`),
    ].join("");
  }
}

async function loadCatalogAndClients() {
  try {
    const { data, error } = await listCatalogServices({ includeInactive: false });
    if (error) throw error;
    if (data?.length) {
      applyCatalogFromRows(data);
      catalogCache = catalogFromRows(data);
    } else {
      catalogCache = catalogFromDefaults();
    }
  } catch {
    catalogCache = catalogFromDefaults();
  }

  try {
    const { data } = await listClients("");
    clientsCache = (data || []).map((row) => ({
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
    }));
  } catch {
    clientsCache = [];
  }
  renderClientOptions();
}

async function onClientPicked() {
  const id = bkClient.value;
  if (!id) return;
  const cached = clientsCache.find((c) => c.id === id);
  if (cached) {
    bkName.value = cached.full_name || "";
    bkPhone.value = cached.phone || "";
    bkEmail.value = cached.email || "";
    return;
  }
  const { data } = await getClient(id);
  if (data) {
    bkName.value = data.full_name || "";
    bkPhone.value = data.phone || "";
    bkEmail.value = data.email || "";
  }
}

async function renderAppointments() {
  rowsBody.innerHTML = `<tr><td colspan="7" class="empty">Φόρτωση…</td></tr>`;
  const { data, error } = await listAppointments(filters());
  if (error) {
    rowsBody.innerHTML = `<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
    showToast(error.message || "Αποτυχία φόρτωσης ραντεβού", true);
    renderCalendar([]);
    return;
  }

  appointmentsCache = data || [];
  renderCalendar(appointmentsCache);

  if (!data?.length) {
    rowsBody.innerHTML = `<tr><td colspan="7" class="empty">Δεν βρέθηκαν ραντεβού.</td></tr>`;
    return;
  }

  rowsBody.innerHTML = data.map((row) => `
    <tr data-id="${escapeHtml(row.id)}">
      <td>
        <strong>${escapeHtml(formatDate(row.appointment_date))}</strong><br />
        <span class="muted">${escapeHtml(formatTime(row.appointment_time))}${row.duration_minutes ? ` · ${escapeHtml(formatDurationMin(row.duration_minutes))}` : ""}</span>
      </td>
      <td>
        ${escapeHtml(row.service)}<br />
        <span class="muted">${escapeHtml(formatPriceCents(row.price_cents))}${row.cabin_id ? ` · Καμπίνα ${escapeHtml(String(row.cabin_id))}` : ""}</span>
      </td>
      <td>
        ${escapeHtml(row.guest_name)}<br />
        <a class="muted" href="tel:${escapeHtml(row.guest_phone)}">${escapeHtml(row.guest_phone)}</a>
      </td>
      <td>${statusBadge(row.status)}</td>
      <td class="muted">${escapeHtml(formatDate(row.created_at))}</td>
      <td>
        <select class="status-select" data-status-for="${escapeHtml(row.id)}" aria-label="Αλλαγή κατάστασης">
          ${Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) =>
            `<option value="${value}" ${row.status === value ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
      </td>
      <td class="row-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${escapeHtml(row.id)}">Επεξεργασία</button>
        ${row.client_id
          ? `<a class="btn btn-ghost btn-sm" href="/admin/client?id=${escapeHtml(row.client_id)}">Πελάτης</a>`
          : `<button class="btn btn-ghost btn-sm" type="button" data-to-client="${escapeHtml(row.id)}">→ Πελάτης</button>`}
        <button class="btn btn-danger btn-sm" type="button" data-delete="${escapeHtml(row.id)}">Διαγραφή</button>
      </td>
    </tr>
  `).join("");

  rowsBody.querySelectorAll("[data-status-for]").forEach((select) => {
    select.addEventListener("change", async () => {
      const id = select.dataset.statusFor;
      const row = data.find((item) => item.id === id);
      const nextStatus = select.value;
      const { error: updError } = await updateAppointment(id, { status: nextStatus });
      if (updError) {
        showToast(updError.message || "Αποτυχία ενημέρωσης", true);
        await renderAppointments();
        return;
      }
      showToast("Η κατάσταση ενημερώθηκε.");
      if (row) {
        const updated = { ...row, status: nextStatus };
        if (nextStatus === "confirmed" && row.status !== "confirmed") {
          notifyAppointmentEmail({ type: "confirmed", appointment: updated }).catch(() => {});
        } else if (nextStatus === "cancelled" && row.status !== "cancelled") {
          notifyAppointmentEmail({ type: "cancelled", appointment: updated }).catch(() => {});
        }
      }
      await renderAppointments();
    });
  });

  rowsBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = data.find((item) => item.id === btn.dataset.edit);
      if (row) openBookingPanel({ edit: row });
    });
  });

  rowsBody.querySelectorAll("[data-to-client]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const appointment = data.find((row) => row.id === btn.dataset.toClient);
      if (!appointment) return;
      try {
        btn.disabled = true;
        const clientId = await findOrCreateClientFromBooking(appointment);
        await updateAppointment(appointment.id, {
          client_id: clientId,
          status: appointment.status === "pending" ? "confirmed" : appointment.status,
        });
        showToast("Συνδέθηκε με πελάτη.");
        location.href = `/admin/client?id=${clientId}`;
      } catch (err) {
        showToast(err.message || "Αποτυχία δημιουργίας πελάτη", true);
        btn.disabled = false;
      }
    });
  });

  rowsBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Οριστική διαγραφή αυτού του ραντεβού;")) return;
      const { error: delError } = await deleteAppointment(btn.dataset.delete);
      if (delError) {
        showToast(delError.message || "Αποτυχία διαγραφής", true);
        return;
      }
      showToast("Διαγράφηκε.");
      await renderAppointments();
    });
  });
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  if (configMissing()) configBanner.classList.remove("hidden");
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (configMissing()) {
    showToast("Ρυθμίστε πρώτα το supabase-config.js", true);
    return;
  }
  const email = event.target.email.value.trim();
  const password = event.target.password.value;
  const { error } = await signIn(email, password);
  if (error) {
    showToast(error.message || "Αποτυχία σύνδεσης", true);
    return;
  }
  showApp();
  await loadCatalogAndClients();
  buildCalendarChrome();
  renderDayStrip();
  setActiveView("calendar", { refresh: false });
  await renderAppointments();
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  showLogin();
});

openBookingBtn?.addEventListener("click", () => openBookingPanel({ date: calendarDay }));
calFab?.addEventListener("click", () => openBookingPanel({ date: calendarDay }));
cancelBookingBtn?.addEventListener("click", () => closeBookingPanel());

viewCalBtn?.addEventListener("click", () => setActiveView("calendar"));
viewListBtn?.addEventListener("click", () => setActiveView("list"));

calPrev?.addEventListener("click", () => {
  const d = parseDateKey(calendarDay);
  d.setDate(d.getDate() - 7);
  setCalendarDay(toDateKey(d));
});

calNext?.addEventListener("click", () => {
  const d = parseDateKey(calendarDay);
  d.setDate(d.getDate() + 7);
  setCalendarDay(toDateKey(d));
});

calToday?.addEventListener("click", () => setCalendarDay(toDateKey(new Date())));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCalDetail();
});

bkClient?.addEventListener("change", () => {
  onClientPicked().catch(() => {});
});

bkServiceSearch?.addEventListener("focus", () => {
  showServiceSuggest(filterCatalog(bkServiceSearch.value), bkServiceSearch.value);
});

bkServiceSearch?.addEventListener("input", () => {
  clearPickedServiceKeepText();
  showServiceSuggest(filterCatalog(bkServiceSearch.value), bkServiceSearch.value);
});

bkServiceSearch?.addEventListener("keydown", (event) => {
  const items = [...bkServiceSuggest.querySelectorAll("[data-service-id]")];
  if (event.key === "Escape") {
    hideServiceSuggest();
    return;
  }
  if (event.key === "ArrowDown" && items.length) {
    event.preventDefault();
    suggestActiveIndex = Math.min(items.length - 1, suggestActiveIndex + 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === suggestActiveIndex));
    items[suggestActiveIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "ArrowUp" && items.length) {
    event.preventDefault();
    suggestActiveIndex = Math.max(0, suggestActiveIndex - 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === suggestActiveIndex));
    items[suggestActiveIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "Enter" && !bkServiceSuggest.classList.contains("hidden") && items.length) {
    const active = items[Math.max(0, suggestActiveIndex)] || items[0];
    if (active) {
      event.preventDefault();
      pickService(active.dataset.serviceId);
    }
  }
});

bkServiceSearch?.addEventListener("blur", () => {
  window.setTimeout(() => hideServiceSuggest(), 120);
  const typed = bkServiceSearch.value.trim();
  if (!typed) {
    clearPickedServiceKeepText();
    return;
  }
  if (selectedServiceId) return;
  const exact = catalogCache.find(
    (row) => normalizeSearch(row.name) === normalizeSearch(typed)
  );
  if (exact) pickService(exact.id);
});

bkDate?.addEventListener("change", () => {
  refreshTimeOptions().catch(() => {});
});

bkDuration?.addEventListener("change", () => {
  refreshTimeOptions().catch(() => {});
});

document.addEventListener("click", (event) => {
  const wrap = document.getElementById("bkServiceSuggestWrap");
  if (wrap && !wrap.contains(event.target)) hideServiceSuggest();
});

bookingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const service = selectedServicePayload();
  if (!service.name) {
    showToast("Επιλέξτε ή πληκτρολογήστε υπηρεσία.", true);
    bkServiceSearch.focus();
    return;
  }

  const time = bkTime.value;
  const date = bkDate.value;
  const duration = Number(bkDuration.value);
  if (!date || !time) {
    showToast("Συμπληρώστε ημερομηνία και ώρα.", true);
    return;
  }
  if (!duration || duration < 5 || duration > 240) {
    showToast("Η διάρκεια πρέπει να είναι 5–240 λεπτά.", true);
    return;
  }

  const name = bkName.value.trim();
  const phone = bkPhone.value.trim();
  if (name.length < 2 || phone.length < 8) {
    showToast("Ελέγξτε όνομα και τηλέφωνο.", true);
    return;
  }

  let cabinId = bkCabin.value ? Number(bkCabin.value) : null;
  const pool = getCabinPool(service);
  const poolLabel = pool.map((id) => CABIN_SHORT[id]?.code || `Κ${id}`).join(" / ");

  if (cabinId && !pool.includes(cabinId)) {
    showToast(`Η θεραπεία δεν μπαίνει σε Κ${cabinId}. Επιτρέπονται: ${poolLabel}.`);
    cabinId = null;
    syncCabinSelectForService(service, null);
  }

  try {
    let booked = await fetchBookedSlots(date);
    if (editingAppointmentId && editingSnapshot) {
      const selfTime = formatTime(editingSnapshot.appointment_time);
      const selfCabin = Number(editingSnapshot.cabin_id) || null;
      const selfDate = String(editingSnapshot.appointment_date || "").slice(0, 10);
      if (selfDate === date) {
        booked = booked.filter((row) => {
          if (formatTime(row.time) !== selfTime) return true;
          if (selfCabin == null) return false;
          return Number(row.cabinId) !== selfCabin;
        });
      }
    }

    const freeInPool = pickCabinForSlot(service, booked, time);
    if (!freeInPool) {
      showToast(`Καμία ελεύθερη καμπίνα (${poolLabel}) για αυτή την ώρα.`, true);
      await refreshTimeOptions();
      return;
    }

    if (cabinId && isCabinFreeForSlot(cabinId, service, booked, time)) {
      // keep preferred
    } else if (cabinId) {
      showToast(`Η επιλεγμένη καμπίνα δεν ήταν ελεύθερη — μπήκε στη ${CABIN_SHORT[freeInPool]?.code || `Κ${freeInPool}`}.`);
      cabinId = freeInPool;
    } else {
      cabinId = freeInPool;
    }

    cabinId = clampCabinToPool(service, cabinId);
    syncCabinSelectForService(service, cabinId);
  } catch (error) {
    cabinId = clampCabinToPool(service, cabinId || pool[0]);
    console.warn("cabin pick fallback", error);
  }

  const payload = {
    service: service.name,
    appointment_date: date,
    appointment_time: time.length === 5 ? `${time}:00` : time,
    duration_minutes: duration,
    price_cents: centsFromEuros(bkPrice.value),
    cabin_id: cabinId,
    guest_name: name,
    guest_phone: phone,
    guest_email: bkEmail.value.trim() || null,
    status: bkStatus.value || "confirmed",
    notes: bkNotes.value.trim() || null,
    client_id: bkClient.value || null,
  };

  bkSubmitBtn.disabled = true;
  try {
    if (editingAppointmentId) {
      const prev = editingSnapshot || {};
      const { data, error } = await updateAppointment(editingAppointmentId, payload);
      if (error) {
        showToast(error.message || "Αποτυχία αποθήκευσης", true);
        return;
      }

      const prevDate = String(prev.appointment_date || "").slice(0, 10);
      const prevTime = formatTime(prev.appointment_time);
      const nextDate = String(payload.appointment_date).slice(0, 10);
      const nextTime = formatTime(payload.appointment_time);
      const timeChanged = prevDate !== nextDate || prevTime !== nextTime;
      const statusBecameConfirmed = payload.status === "confirmed" && prev.status !== "confirmed";
      const statusBecameCancelled = payload.status === "cancelled" && prev.status !== "cancelled";

      if (timeChanged) {
        notifyAppointmentEmail({
          type: "rescheduled",
          appointment: data || payload,
          previousDate: prevDate,
          previousTime: prevTime,
        }).catch(() => {});
      } else if (statusBecameConfirmed) {
        notifyAppointmentEmail({ type: "confirmed", appointment: data || payload }).catch(() => {});
      } else if (statusBecameCancelled) {
        notifyAppointmentEmail({ type: "cancelled", appointment: data || payload }).catch(() => {});
      } else {
        notifyAppointmentEmail({ type: "updated", appointment: data || payload }).catch(() => {});
      }

      showToast("Το ραντεβού ενημερώθηκε.");
    } else {
      const { data, error } = await createAppointment(payload);
      if (error) {
        showToast(error.message || "Αποτυχία αποθήκευσης", true);
        return;
      }

      let saved = data;
      if (bkLinkClient.checked && data && !data.client_id) {
        try {
          const clientId = await findOrCreateClientFromBooking(data);
          const linked = await updateAppointment(data.id, { client_id: clientId });
          saved = linked.data || data;
        } catch (linkErr) {
          console.warn(linkErr);
        }
      }

      const mailType = payload.status === "confirmed" ? "confirmed" : "created";
      notifyAppointmentEmail({ type: mailType, appointment: saved || payload }).catch(() => {});
      showToast("Το ραντεβού καταχωρήθηκε.");
    }

    closeBookingPanel();
    await loadCatalogAndClients();
    await renderAppointments();
  } finally {
    bkSubmitBtn.disabled = false;
  }
});

let searchTimer = 0;
[searchInput, statusFilter].forEach((el) => {
  el?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => renderAppointments(), 200);
  });
  el?.addEventListener("change", () => renderAppointments());
});

[fromDate, toDate].forEach((el) => {
  el?.addEventListener("change", () => {
    if (activeView === "list") renderAppointments();
  });
});

async function boot() {
  const today = toDateKey(new Date());
  calendarDay = today;
  if (fromDate) fromDate.value = today;
  if (toDate) toDate.value = today;

  if (configMissing()) {
    showLogin();
    return;
  }
  const session = await requireSession();
  if (!session) {
    showLogin();
    return;
  }
  showApp();
  await loadCatalogAndClients();
  buildCalendarChrome();
  renderDayStrip();
  setActiveView("calendar", { refresh: false });
  await renderAppointments();
}

boot();
