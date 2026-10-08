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
  listAllClientsLite,
  getClient,
  showToast,
  formatDate,
  formatTime,
  setDayFirstDate,
  readDayFirstDate,
  APPOINTMENT_STATUS_LABELS,
  applyAuthShell,
  greekNameToLatin,
} from "./admin-api.js?v=name-fold";
import {
  DEFAULT_BOOKING_CATEGORIES,
  applyCatalogFromRows,
  getServiceById,
  findServiceByName,
  buildStartSlots,
  filterAvailableStarts,
  pickCabinForSlot,
  isCabinFreeForSlot,
  getCabinPool,
  getCabinPoolForServiceName,
  clampCabinToPool,
  resolveCabinForAppointment,
  CABIN_SHORT,
  CABIN_IDS,
  CABIN_LABELS,
  BOOKING_DAY_START,
  BOOKING_DAY_END,
  SLOT_STEP_MINUTES,
  timeLabelToMinutes,
  minutesToTimeLabel,
  filterServiceSuggestions,
  displayServiceName,
  splitAppointmentServices,
  joinAppointmentServices,
  BLOCKED_TIME_SERVICE,
  isBlockedTimeService,
} from "./booking-services.js?v=solarium-word";
import { fetchBookedSlots } from "./booking-api.js";
import { notifyAppointmentEmail } from "./appointment-email.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const rowsBody = document.getElementById("appointmentsBody");
const searchInput = document.getElementById("searchInput");
const calSearchHits = document.getElementById("calSearchHits");
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
const calMonthPop = document.getElementById("calMonthPop");
const calMonthGrid = document.getElementById("calMonthGrid");
const calYearLabel = document.getElementById("calYearLabel");
const calYearPrev = document.getElementById("calYearPrev");
const calYearNext = document.getElementById("calYearNext");
const calCabinHeads = document.getElementById("calCabinHeads");
const calTimes = document.getElementById("calTimes");
const calCols = document.getElementById("calCols");
const calGrid = document.getElementById("calGrid");
const calPrev = document.getElementById("calPrev");
const calNext = document.getElementById("calNext");
const calToday = document.getElementById("calToday");
const calWeekBtn = document.getElementById("calWeek");
const calFab = document.getElementById("calFab");

const openBookingBtn = document.getElementById("openBookingBtn");
const cancelBookingBtn = document.getElementById("cancelBookingBtn");
const bookingPanel = document.getElementById("bookingPanel");
const bookingForm = document.getElementById("bookingForm");
const bkClientSearch = document.getElementById("bkClientSearch");
const bkClientId = document.getElementById("bkClientId");
const bkClientSuggest = document.getElementById("bkClientSuggest");
const bkStatus = document.getElementById("bkStatus");
const bkName = document.getElementById("bkName");
const bkPhone = document.getElementById("bkPhone");
const bkEmail = document.getElementById("bkEmail");
const bkServiceSearch = document.getElementById("bkServiceSearch");
const bkServiceId = document.getElementById("bkServiceId");
const bkServiceSuggest = document.getElementById("bkServiceSuggest");
const bkService2Search = document.getElementById("bkService2Search");
const bkService2Suggest = document.getElementById("bkService2Suggest");
const bkDate = document.getElementById("bkDate");
const bkTime = document.getElementById("bkTime");
const bkTimeSuggest = document.getElementById("bkTimeSuggest");
const bkDuration = document.getElementById("bkDuration");
const bkPrice = document.getElementById("bkPrice");
const bkCabin = document.getElementById("bkCabin");
const bkNotes = document.getElementById("bkNotes");
const bkRepeat = document.getElementById("bkRepeat");
const bkRepeatBlock = document.getElementById("bkRepeatBlock");
const bkRepeatExtra = document.getElementById("bkRepeatExtra");
const bkRepeatDows = document.getElementById("bkRepeatDows");
const bkRepeatUntil = document.getElementById("bkRepeatUntil");
const bkLinkClient = document.getElementById("bkLinkClient");
const bkBlockTime = document.getElementById("bkBlockTime");
const bkBlockHint = document.getElementById("bkBlockHint");
const bkClientRow = document.getElementById("bkClientRow");
const bkGuestRow = document.getElementById("bkGuestRow");
const bkEmailField = document.getElementById("bkEmailField");
const bkServiceField = document.getElementById("bkServiceField");
const bkService2Field = document.getElementById("bkService2Field");
const bkPriceField = document.getElementById("bkPriceField");
const bkSubmitBtn = document.getElementById("bkSubmitBtn");

/** @type {Array<{ id: string, name: string, categoryLabel: string, durationMin: number, priceCents: number, priceFrom: boolean, categoryId: string }>} */
let catalogCache = [];

/** @type {Array<{ id: string, full_name: string, phone: string | null, email: string | null }>} */
let clientsCache = [];

/** @type {string} */
let selectedServiceId = "";

/** Duration and price already added by the second service, so a new pick replaces them. */
let extraApplied = { duration: 0, cents: 0 };

/** Hold a cabin with no client. */
let blockMode = false;

let suggest2ActiveIndex = -1;

/** @type {string} */
let selectedClientId = "";

let suggestActiveIndex = -1;
let clientSuggestActiveIndex = -1;
let timeSuggestActiveIndex = -1;

/** @type {string[]} */
let availableTimes = [];

/** @type {"calendar" | "list"} */
let activeView = "calendar";

/** Cabin columns for one day, or seven day columns for the week. */
const CAL_SPAN_KEY = "aesthee-cal-span";
/** @type {"day" | "week"} */
let calendarSpan = "day";
try {
  calendarSpan = localStorage.getItem(CAL_SPAN_KEY) === "week" ? "week" : "day";
} catch {
  calendarSpan = "day";
}

/** Calendar selected day as YYYY-MM-DD. In week view this anchors the week. */
let calendarDay = "";

/** Rebuilds the grid when the mode or the visible week changes. */
let chromeStamp = "";

let monthPickerYear = new Date().getFullYear();

/** @type {object[]} */
let appointmentsCache = [];

/** @type {object[]} */
let searchHitsCache = [];

/** @type {Set<string>} */
let searchHitIds = new Set();

/** @type {Set<string>} */
let searchHitDates = new Set();

/** @type {string} */
let pendingHighlightId = "";

let renderSeq = 0;

/** @type {string | null} */
let editingAppointmentId = null;

/** Snapshot while editing — for email diffs */
let editingSnapshot = null;

const DOW_LABELS = ["Κ", "Δ", "Τ", "Τ", "Π", "Π", "Σ"];
const REPEAT_DOWS = [
  { js: 1, label: "Δε" },
  { js: 2, label: "Τρ" },
  { js: 3, label: "Τε" },
  { js: 4, label: "Πε" },
  { js: 5, label: "Πα" },
  { js: 6, label: "Σα" },
  { js: 0, label: "Κυ" },
];
const MONTH_LABELS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];

/** @type {number | null} */
let nowLineTimer = null;

/** @type {{ x: number, y: number, cabin: string, top: number } | null} */
let emptySlotPointer = null;

/**
 * Active calendar block drag (cabin ± time).
 * @type {{
 *   row: object,
 *   el: HTMLElement,
 *   pointerId: number,
 *   startX: number,
 *   startY: number,
 *   origTop: number,
 *   origCabin: number,
 *   duration: number,
 *   moved: boolean,
 *   ghost: HTMLElement | null,
 *   targetCabin: number | null,
 *   targetMins: number | null,
 * } | null}
 */
let blockDrag = null;

function pxPerMin() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--cal-px-min")
    .trim();
  const fromGrid = calCols?.closest(".cal-grid");
  const gridRaw = fromGrid
    ? getComputedStyle(fromGrid).getPropertyValue("--cal-px-min").trim()
    : "";
  const n = Number(gridRaw || raw || 2);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

function calBoardEl() {
  return document.getElementById("calBoard");
}

function syncCalModeClass() {
  const bookingOpen = Boolean(bookingPanel && !bookingPanel.hidden);
  appView?.classList.toggle("is-cal-mode", activeView === "calendar" && !bookingOpen);
  calFab?.classList.toggle("is-hidden", activeView !== "calendar" || bookingOpen);
  if (calendarPanel && activeView === "calendar") {
    calendarPanel.hidden = bookingOpen && window.matchMedia("(max-width: 860px)").matches;
  } else if (calendarPanel && activeView !== "calendar") {
    calendarPanel.hidden = true;
  }
}

function configMissing() {
  const cfg = window.AESTHEE_SUPABASE;
  return !cfg?.url || !cfg?.anonKey || String(cfg.url).includes("YOUR_PROJECT_REF");
}

function formatServiceLines(service) {
  return splitAppointmentServices(service)
    .filter(Boolean)
    .map((part) => escapeHtml(displayServiceName(part)))
    .join("<br>");
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
  const query = searchInput?.value || "";
  const status = statusFilter?.value || "";
  if (query.trim()) {
    return { status, fromDate: "", toDate: "", query };
  }
  if (activeView === "calendar" && calendarDay) {
    const range = calendarRange();
    return { status, fromDate: range.start, toDate: range.end, query };
  }
  return {
    status,
    fromDate: readDayFirstDate(fromDate),
    toDate: readDayFirstDate(toDate),
    query,
  };
}

function appointmentDateKey(row) {
  return String(row?.appointment_date || "").slice(0, 10);
}

function pickBestSearchHit(hits) {
  if (!hits?.length) return null;
  const today = toDateKey(new Date());
  const upcoming = hits.filter((row) => appointmentDateKey(row) >= today);
  return upcoming[0] || hits[hits.length - 1];
}

function hideSearchHits() {
  if (!calSearchHits) return;
  calSearchHits.classList.add("hidden");
  calSearchHits.innerHTML = "";
}

function renderSearchHits(hits) {
  if (!calSearchHits) return;
  const q = (searchInput?.value || "").trim();
  if (!q || activeView !== "calendar") {
    hideSearchHits();
    return;
  }
  if (!hits.length) {
    calSearchHits.innerHTML = `<div class="search-hits-empty">Δεν βρέθηκαν ραντεβού.</div>`;
    calSearchHits.classList.remove("hidden");
    return;
  }
  const shown = hits.slice(0, 25);
  const extra = hits.length - shown.length;
  calSearchHits.innerHTML = `
    <div class="search-hits-meta">${hits.length} αποτέλεσμα${hits.length === 1 ? "" : "τα"}</div>
    ${shown.map((row) => `
      <button type="button" class="search-hit" data-id="${escapeHtml(row.id)}" data-day="${escapeHtml(appointmentDateKey(row))}">
        <strong>${escapeHtml(row.guest_name || "—")}</strong>
        <span>${escapeHtml(formatDate(row.appointment_date))} · ${escapeHtml(formatTime(row.appointment_time))} · ${formatServiceLines(row.service)}</span>
      </button>
    `).join("")}
    ${extra > 0 ? `<div class="search-hits-empty">και άλλα ${extra}…</div>` : ""}
  `;
  calSearchHits.classList.remove("hidden");
  calSearchHits.querySelectorAll(".search-hit").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      jumpToSearchHit(btn.dataset.id, btn.dataset.day);
    });
  });
}

function jumpToSearchHit(id, day) {
  pendingHighlightId = id || "";
  if (day && day !== calendarDay) {
    setCalendarDay(day);
    return;
  }
  highlightSearchBlock(id);
}

function highlightSearchBlock(id) {
  if (!id || !calCols) return;
  calCols.querySelectorAll(".cal-block.is-selected").forEach((el) => el.classList.remove("is-selected"));
  const safeId = (typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(id) : id;
  const btn = calCols.querySelector(`.cal-block[data-id="${safeId}"]`);
  if (!btn) return;
  btn.classList.add("is-selected");
  btn.scrollIntoView({ block: "center", behavior: "smooth" });
  const row = appointmentsCache.find((item) => item.id === id)
    || searchHitsCache.find((item) => item.id === id);
  if (row) openCalDetail(row);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysKey(key, days) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function selectedRepeatWeekdays() {
  return new Set(
    [...(bkRepeatDows?.querySelectorAll(".repeat-dow.is-on") || [])]
      .map((btn) => Number(btn.dataset.js))
  );
}

function expandRepeatDates(startKey, untilKey, weekdays) {
  const dates = [];
  if (!startKey) return dates;
  if (!weekdays.size) return [startKey];
  const start = parseDateKey(startKey);
  const until = parseDateKey(untilKey || addDaysKey(startKey, 56));
  if (until < start) return [startKey];
  for (let d = new Date(start); d <= until; d.setDate(d.getDate() + 1)) {
    if (weekdays.has(d.getDay())) dates.push(toDateKey(d));
    if (dates.length >= 40) break;
  }
  return dates.length ? dates : [startKey];
}

function syncRepeatUi() {
  const weekly = bkRepeat?.value === "weekly";
  bkRepeatExtra?.classList.toggle("hidden", !weekly);
  if (!weekly) return;
  const startIso = readDayFirstDate(bkDate);
  if (!selectedRepeatWeekdays().size && startIso) {
    const js = parseDateKey(startIso).getDay();
    bkRepeatDows?.querySelectorAll(".repeat-dow").forEach((btn) => {
      btn.classList.toggle("is-on", Number(btn.dataset.js) === js);
    });
  }
  if (bkRepeatUntil && !readDayFirstDate(bkRepeatUntil) && startIso) {
    setDayFirstDate(bkRepeatUntil, addDaysKey(startIso, 56));
  }
}

function buildRepeatDows() {
  if (!bkRepeatDows) return;
  bkRepeatDows.innerHTML = REPEAT_DOWS.map((d) => (
    `<button type="button" class="repeat-dow" data-js="${d.js}">${d.label}</button>`
  )).join("");
  bkRepeatDows.querySelectorAll(".repeat-dow").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("is-on");
    });
  });
}

function parseDateKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

const WEEK_HEADS = ["Κυ", "Δε", "Τρ", "Τε", "Πε", "Πα", "Σα"];

function weekBounds(key) {
  const selected = parseDateKey(key || toDateKey(new Date()));
  const start = new Date(selected);
  const dow = selected.getDay();
  start.setDate(selected.getDate() + (dow === 0 ? -6 : 1 - dow));
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(toDateKey(day));
  }
  return { start: days[0], end: days[6], days };
}

function calendarRange() {
  if (calendarSpan === "week" && calendarDay) return weekBounds(calendarDay);
  return { start: calendarDay, end: calendarDay, days: calendarDay ? [calendarDay] : [] };
}

function paintSpanToggle() {
  const week = calendarSpan === "week";
  calWeekBtn?.classList.toggle("is-active", week);
  calWeekBtn?.setAttribute("aria-pressed", week ? "true" : "false");
  calendarPanel?.classList.toggle("is-week", week);
  calGrid?.classList.toggle("is-week", week);
}

function setCalendarSpan(span, { refresh = true } = {}) {
  const next = span === "week" ? "week" : "day";
  if (calendarSpan === next && !refresh) {
    paintSpanToggle();
    return;
  }
  calendarSpan = next;
  try {
    localStorage.setItem(CAL_SPAN_KEY, calendarSpan);
  } catch {
    /* the toggle still works for this visit */
  }
  chromeStamp = "";
  lastFocusScrollDay = "";
  paintSpanToggle();
  ensureCalendarChrome();
  renderDayStrip();
  if (refresh) renderAppointments();
}

function setCalendarDay(key) {
  calendarDay = key;
  setDayFirstDate(fromDate, key);
  setDayFirstDate(toDate, key);
  renderDayStrip();
  if (calendarSpan === "week") ensureCalendarChrome();
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
  syncCalModeClass();
  if (refresh) renderAppointments();
}

function hideMonthPicker() {
  calMonthPop?.classList.add("hidden");
  calMonthLabel?.setAttribute("aria-expanded", "false");
}

function renderMonthPicker() {
  if (!calMonthGrid || !calYearLabel) return;
  const today = new Date();
  const selected = calendarDay ? parseDateKey(calendarDay) : today;
  calYearLabel.textContent = String(monthPickerYear);
  calMonthGrid.innerHTML = MONTH_LABELS.map((label, month) => {
    const isNow = today.getFullYear() === monthPickerYear && today.getMonth() === month;
    const isSelected = selected.getFullYear() === monthPickerYear && selected.getMonth() === month;
    return `<button type="button" class="cal-month-cell${isNow ? " is-now" : ""}${isSelected ? " is-selected" : ""}" data-month="${month}">${label.slice(0, 3)}</button>`;
  }).join("");
  calMonthGrid.querySelectorAll("[data-month]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const month = Number(btn.dataset.month);
      const today = new Date();
      let next;
      if (today.getFullYear() === monthPickerYear && today.getMonth() === month) {
        next = today;
      } else {
        next = new Date(monthPickerYear, month, 1, 12, 0, 0);
      }
      hideMonthPicker();
      setCalendarDay(toDateKey(next));
    });
  });
}

function toggleMonthPicker() {
  if (!calMonthPop) return;
  const open = calMonthPop.classList.contains("hidden");
  if (open) {
    const selected = calendarDay ? parseDateKey(calendarDay) : new Date();
    monthPickerYear = selected.getFullYear();
    renderMonthPicker();
    calMonthPop.classList.remove("hidden");
    calMonthLabel?.setAttribute("aria-expanded", "true");
  } else {
    hideMonthPicker();
  }
}

function renderDayStrip() {
  if (!calDayStrip || !calendarDay) return;
  const selected = parseDateKey(calendarDay);
  if (calendarSpan === "week") {
    const range = weekBounds(calendarDay);
    const from = parseDateKey(range.start);
    const to = parseDateKey(range.end);
    const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
    calMonthLabel.textContent = sameMonth
      ? `${from.getDate()}–${to.getDate()} ${MONTH_LABELS[from.getMonth()]} ${from.getFullYear()}`
      : `${from.getDate()} ${MONTH_LABELS[from.getMonth()].slice(0, 3)} – ${to.getDate()} ${MONTH_LABELS[to.getMonth()].slice(0, 3)} ${to.getFullYear()}`;
  } else {
    calMonthLabel.textContent = `${MONTH_LABELS[selected.getMonth()]} ${selected.getFullYear()}`;
  }
  monthPickerYear = selected.getFullYear();
  if (calMonthPop && !calMonthPop.classList.contains("hidden")) renderMonthPicker();

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
    const isHit = searchHitDates.has(key);
    parts.push(`
      <button
        type="button"
        class="cal-day${isSelected ? " is-selected" : ""}${isWeekend ? " is-weekend" : ""}${key === todayKey ? " is-today" : ""}${isHit ? " is-hit" : ""}"
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

  requestAnimationFrame(() => {
    const selectedBtn = calDayStrip.querySelector(".is-selected");
    selectedBtn?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
}

function resolveCabinId(row) {
  return resolveCabinForAppointment(row);
}

/**
 * Fill missing cabin_id only — never move a cabin staff already chose
 * (drag / edit must stick).
 */
async function healMismatchedCabins(rows) {
  const active = (rows || []).filter((row) => row.status !== "cancelled");
  let fixed = 0;

  for (const row of active) {
    const stored = Number(row.cabin_id);
    if (Number.isFinite(stored) && CABIN_IDS.includes(stored)) continue;

    const blob = [row.service, row.notes].filter(Boolean).join(" ");
    const pool = getCabinPoolForServiceName(blob);
    const next = pool[0] || 1;

    const { error } = await updateAppointment(row.id, { cabin_id: next });
    if (error) continue;
    row.cabin_id = next;
    fixed += 1;
  }

  return fixed;
}

function snapMinutes(raw) {
  const step = SLOT_STEP_MINUTES || 10;
  const clamped = Math.max(
    BOOKING_DAY_START,
    Math.min(BOOKING_DAY_END - step, Number(raw) || BOOKING_DAY_START),
  );
  return Math.round(clamped / step) * step;
}

function cabinColFromPoint(clientX, clientY) {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const node of stack) {
    const col = node?.closest?.(".cal-col");
    if (col?.dataset?.cabin) return col;
  }
  return null;
}

function clearBlockDragChrome() {
  document.querySelectorAll(".cal-col.is-drop-target").forEach((el) => {
    el.classList.remove("is-drop-target");
  });
  document.body.classList.remove("is-cal-dragging");
}

function endBlockDrag(cancelled = false) {
  const drag = blockDrag;
  blockDrag = null;
  clearBlockDragChrome();
  if (!drag) return null;

  if (drag.ghost) {
    drag.ghost.remove();
    drag.ghost = null;
  }
  drag.el.classList.remove("is-dragging");
  drag.el.style.opacity = "";
  drag.el.style.transform = "";
  drag.el.style.zIndex = "";

  try {
    drag.el.releasePointerCapture(drag.pointerId);
  } catch {
    /* already released */
  }

  return cancelled ? null : drag;
}

async function commitBlockDrag(drag) {
  if (!drag?.moved) return;

  const cabin = drag.targetCabin ?? drag.origCabin;
  const mins = drag.targetMins != null
    ? snapMinutes(drag.targetMins)
    : timeLabelToMinutes(formatTime(drag.row.appointment_time));
  if (mins == null) return;

  const timeLabel = minutesToTimeLabel(mins);
  const prevTime = formatTime(drag.row.appointment_time);
  const prevCabin = Number(drag.row.cabin_id) || drag.origCabin;
  const prevTimeRaw = drag.row.appointment_time;
  const cabinChanged = cabin !== prevCabin;
  const timeChanged = timeLabel !== prevTime;
  if (!cabinChanged && !timeChanged) {
    renderCalendar(appointmentsCache);
    return;
  }

  const payload = {
    cabin_id: cabin,
    appointment_time: `${timeLabel}:00`,
  };

  drag.row.cabin_id = cabin;
  drag.row.appointment_time = payload.appointment_time;
  renderCalendar(appointmentsCache);

  const { error } = await updateAppointment(drag.row.id, payload);
  if (error) {
    drag.row.cabin_id = prevCabin;
    drag.row.appointment_time = prevTimeRaw;
    showToast(error.message || "Αποτυχία μετακίνησης", true);
    renderCalendar(appointmentsCache);
    return;
  }

  const bits = [];
  if (cabinChanged) bits.push(`Κ${cabin}`);
  if (timeChanged) bits.push(timeLabel);
  showToast(`Μετακινήθηκε → ${bits.join(" · ")}`);
}

function onBlockPointerMove(event) {
  const drag = blockDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;

  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 10) return;
    drag.moved = true;
    drag.el.dataset.didDrag = "1";
    document.body.classList.add("is-cal-dragging");
    drag.el.classList.add("is-dragging");
    drag.el.style.opacity = "0.35";
    try {
      drag.el.setPointerCapture(drag.pointerId);
    } catch {
      /* ignore */
    }

    const ghost = drag.el.cloneNode(true);
    ghost.classList.add("cal-block-ghost");
    ghost.removeAttribute("id");
    ghost.style.position = "fixed";
    ghost.style.margin = "0";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "80";
    ghost.style.width = `${drag.el.getBoundingClientRect().width}px`;
    ghost.style.height = `${drag.el.getBoundingClientRect().height}px`;
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    closeCalDetail();
  }

  event.preventDefault();

  const rect = drag.el.getBoundingClientRect();
  if (drag.ghost) {
    drag.ghost.style.left = `${event.clientX - rect.width / 2}px`;
    drag.ghost.style.top = `${event.clientY - 24}px`;
  }

  const col = cabinColFromPoint(event.clientX, event.clientY);
  document.querySelectorAll(".cal-col.is-drop-target").forEach((el) => {
    el.classList.remove("is-drop-target");
  });
  if (col) {
    col.classList.add("is-drop-target");
    drag.targetCabin = Number(col.dataset.cabin) || drag.origCabin;
    const colRect = col.getBoundingClientRect();
    const yInCol = event.clientY - colRect.top;
    const rawMins = BOOKING_DAY_START + yInCol / pxPerMin() - drag.duration / 2;
    drag.targetMins = snapMinutes(rawMins);
    // Live preview position in original column while dragging
    drag.el.style.top = `${Math.max(0, (drag.targetMins - BOOKING_DAY_START) * pxPerMin())}px`;
  }
}

function onBlockPointerUp(event) {
  const drag = blockDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  const finished = endBlockDrag(false);
  if (finished?.moved) {
    event.preventDefault();
    event.stopPropagation();
    commitBlockDrag(finished);
  }
}

function onBlockPointerCancel(event) {
  const drag = blockDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  endBlockDrag(true);
  renderCalendar(appointmentsCache);
}

function bindBlockDrag(btn, row) {
  btn.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (blockDrag) return;
    const start = timeLabelToMinutes(formatTime(row.appointment_time));
    blockDrag = {
      row,
      el: btn,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origTop: parseFloat(btn.style.top) || 0,
      origCabin: resolveCabinId(row),
      duration: Number(row.duration_minutes) || 60,
      moved: false,
      ghost: null,
      targetCabin: null,
      targetMins: start,
    };
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pointermove", onBlockPointerMove, { passive: false });
  window.addEventListener("pointerup", onBlockPointerUp);
  window.addEventListener("pointercancel", onBlockPointerCancel);
}

function paintTimeGutter(dayHeight) {
  if (!calTimes) return;
  const ppm = pxPerMin();
  const labels = [];
  for (let mins = BOOKING_DAY_START; mins < BOOKING_DAY_END; mins += 60) {
    const top = (mins - BOOKING_DAY_START) * ppm;
    labels.push(`<div class="cal-time-label" style="top:${top}px">${minutesToTimeLabel(mins)}</div>`);
  }
  calTimes.innerHTML = labels.join("");
  calTimes.style.height = `${dayHeight}px`;
}

function bindEmptyColumn(col) {
  col.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".cal-block")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    emptySlotPointer = {
      x: event.clientX,
      y: event.clientY,
      cabin: col.dataset.cabin || "",
      day: col.dataset.day || "",
      top: col.getBoundingClientRect().top,
    };
  });
  col.addEventListener("pointermove", (event) => {
    if (!emptySlotPointer) return;
    if (
      Math.abs(event.clientX - emptySlotPointer.x) > 10
      || Math.abs(event.clientY - emptySlotPointer.y) > 10
    ) {
      emptySlotPointer = null;
    }
  });
  col.addEventListener("pointerup", (event) => {
    if (!emptySlotPointer) return;
    if (event.target.closest(".cal-block")) {
      emptySlotPointer = null;
      return;
    }
    const dx = Math.abs(event.clientX - emptySlotPointer.x);
    const dy = Math.abs(event.clientY - emptySlotPointer.y);
    const cabin = emptySlotPointer.cabin;
    const day = emptySlotPointer.day;
    const top = emptySlotPointer.top;
    emptySlotPointer = null;
    if (dx > 10 || dy > 10) return;
    if ((col.dataset.cabin || "") !== cabin) return;
    if ((col.dataset.day || "") !== day) return;

    const y = event.clientY - top;
    let mins = BOOKING_DAY_START + Math.round(y / pxPerMin());
    mins = Math.round(mins / 10) * 10;
    mins = Math.max(BOOKING_DAY_START, Math.min(BOOKING_DAY_END - 10, mins));
    const prefs = {
      date: day || calendarDay,
      time: minutesToTimeLabel(mins),
    };
    if (cabin) prefs.cabinId = Number(cabin);
    openBookingPanel(prefs);
  });
  col.addEventListener("pointercancel", () => {
    emptySlotPointer = null;
  });
}

function buildDayChrome() {
  if (!calCabinHeads || !calTimes || !calCols) return;
  const ppm = pxPerMin();
  const dayHeight = (BOOKING_DAY_END - BOOKING_DAY_START) * ppm;

  calCabinHeads.innerHTML = CABIN_IDS.map((id) => {
    const meta = CABIN_SHORT[id];
    return `
      <div class="cal-cabin-head" title="${escapeHtml(meta.role)}">
        <span class="code">${escapeHtml(meta.code)}</span>
        <span class="role">${escapeHtml(meta.role)}</span>
      </div>
    `;
  }).join("");

  paintTimeGutter(dayHeight);
  calCols.innerHTML = CABIN_IDS.map((id) => `
    <div class="cal-col" data-cabin="${id}" style="height:${dayHeight}px"></div>
  `).join("");
  calCols.querySelectorAll(".cal-col").forEach(bindEmptyColumn);
}

function buildWeekChrome() {
  if (!calCabinHeads || !calTimes || !calCols) return;
  const ppm = pxPerMin();
  const dayHeight = (BOOKING_DAY_END - BOOKING_DAY_START) * ppm;
  const todayKey = toDateKey(new Date());
  const { days } = weekBounds(calendarDay || todayKey);

  calCabinHeads.innerHTML = days.map((key) => {
    const date = parseDateKey(key);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return `
      <button type="button" class="cal-cabin-head cal-week-head${key === todayKey ? " is-today" : ""}${weekend ? " is-weekend" : ""}" data-day="${key}">
        <span class="dow">${WEEK_HEADS[date.getDay()]}</span>
        <span class="dom">${date.getDate()}</span>
      </button>
    `;
  }).join("");
  calCabinHeads.querySelectorAll("[data-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setCalendarSpan("day", { refresh: false });
      setCalendarDay(btn.dataset.day);
    });
  });

  paintTimeGutter(dayHeight);
  calCols.innerHTML = days.map((key) => `
    <div class="cal-col${key === todayKey ? " is-today" : ""}" data-day="${key}" style="height:${dayHeight}px"></div>
  `).join("");
  calCols.querySelectorAll(".cal-col").forEach(bindEmptyColumn);
}

function ensureCalendarChrome() {
  const stamp = calendarSpan === "week"
    ? `week:${weekBounds(calendarDay || toDateKey(new Date())).start}`
    : "day";
  if (chromeStamp === stamp && calCols?.querySelector(".cal-col")) return;
  chromeStamp = stamp;
  if (calendarSpan === "week") buildWeekChrome();
  else buildDayChrome();
}

function buildCalendarChrome() {
  chromeStamp = "";
  ensureCalendarChrome();
}

/** @type {string} */
let lastFocusScrollDay = "";

function scrollCalToFocus(rows = appointmentsCache, { force = false } = {}) {
  const board = calBoardEl();
  if (!board || activeView !== "calendar") return;
  if (!force && lastFocusScrollDay === calendarDay) return;
  lastFocusScrollDay = calendarDay;

  const ppm = pxPerMin();
  const todayKey = toDateKey(new Date());
  let focusMins = BOOKING_DAY_START;

  if (calendarDay === todayKey) {
    const now = new Date();
    focusMins = now.getHours() * 60 + now.getMinutes();
  } else {
    const starts = (rows || [])
      .filter((row) => row.status !== "cancelled")
      .map((row) => timeLabelToMinutes(formatTime(row.appointment_time)))
      .filter((m) => m != null)
      .sort((a, b) => a - b);
    if (starts.length) focusMins = starts[0];
  }

  focusMins = Math.max(BOOKING_DAY_START, Math.min(BOOKING_DAY_END, focusMins));
  const y = Math.max(0, (focusMins - BOOKING_DAY_START) * ppm - board.clientHeight * 0.28);
  let x = board.scrollLeft;
  if (calendarSpan === "week") {
    const todayCol = calCols?.querySelector(".cal-col.is-today");
    if (todayCol) {
      const colRect = todayCol.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      x = board.scrollLeft + (colRect.left - boardRect.left) - board.clientWidth / 2 + colRect.width / 2;
      x = Math.max(0, x);
    }
  }
  board.scrollTo({ top: y, left: x, behavior: "smooth" });
}

function renderCalendar(data) {
  if (!calCols) return;
  ensureCalendarChrome();
  const week = calendarSpan === "week";

  const ppm = pxPerMin();
  const dayHeight = (BOOKING_DAY_END - BOOKING_DAY_START) * ppm;
  if (calTimes) calTimes.style.height = `${dayHeight}px`;
  calCols.querySelectorAll(".cal-col").forEach((col) => {
    col.style.height = `${dayHeight}px`;
  });

  calCols.querySelectorAll(".cal-block").forEach((el) => el.remove());
  closeCalDetail();

  const visible = (data || []).filter((row) => row.status !== "cancelled");
  const GAP_PX = 3;
  const visibleDays = week ? new Set(weekBounds(calendarDay).days) : null;

  /** @type {Map<string, { row: object, start: number, end: number, top: number, height: number, col: number, cols: number }[]>} */
  const byColumn = new Map();

  for (const row of visible) {
    const cabinId = resolveCabinId(row);
    const dayKey = appointmentDateKey(row);
    if (week && !visibleDays.has(dayKey)) continue;
    const startLabel = formatTime(row.appointment_time);
    const start = timeLabelToMinutes(startLabel);
    if (start == null) continue;
    const duration = Math.max(5, Number(row.duration_minutes) || 60);
    const end = start + duration;
    const top = (start - BOOKING_DAY_START) * ppm;
    const columnKey = week ? dayKey : String(cabinId);
    if (!byColumn.has(columnKey)) byColumn.set(columnKey, []);
    byColumn.get(columnKey).push({
      row,
      start,
      end,
      top,
      height: duration * ppm,
      col: 0,
      cols: 1,
    });
  }

  for (const [columnKey, items] of byColumn) {
    const colEl = week
      ? calCols.querySelector(`.cal-col[data-day="${columnKey}"]`)
      : calCols.querySelector(`.cal-col[data-cabin="${columnKey}"]`);
    if (!colEl) continue;

    items.sort((a, b) => a.start - b.start || a.end - b.end);

    // Side-by-side layout only when times actually overlap
    for (let i = 0; i < items.length; i++) {
      const cur = items[i];
      /** @type {number[]} */
      const used = [];
      for (let j = 0; j < i; j++) {
        const prev = items[j];
        if (prev.start < cur.end && cur.start < prev.end) {
          used.push(prev.col);
        }
      }
      let col = 0;
      while (used.includes(col)) col += 1;
      cur.col = col;
    }
    const maxCol = items.reduce((m, it) => Math.max(m, it.col), 0);
    const cols = maxCol + 1;
    for (const it of items) it.cols = cols;

    // Cap height so non-overlapping neighbours never paint over each other
    for (let i = 0; i < items.length; i++) {
      const cur = items[i];
      let limit = Infinity;
      for (let j = i + 1; j < items.length; j++) {
        if (items[j].start >= cur.end) {
          limit = items[j].top;
          break;
        }
      }
      const natural = Math.max(14, cur.height - GAP_PX);
      const maxH = Number.isFinite(limit) ? limit - cur.top - GAP_PX : natural;
      cur.height = Math.max(14, Math.min(natural, maxH));
    }

    for (const it of items) {
      const row = it.row;
      const startLabel = formatTime(row.appointment_time);
      const duration = Math.max(5, Number(row.duration_minutes) || 60);
      const endLabel = endTimeLabel(startLabel, duration);
      const status = row.status || "pending";
      const sizeClass = it.height < 48 ? "is-xs" : it.height < 72 ? "is-sm" : it.height < 104 ? "is-md" : "is-lg";

      const btn = document.createElement("button");
      const searching = searchHitIds.size > 0;
      const isHit = searching && searchHitIds.has(row.id);
      btn.type = "button";
      const blocked = isBlockedTimeService(row.service);
      btn.className = `cal-block is-${status} ${sizeClass}${blocked ? " is-blocked" : ""}${isHit ? " is-search-hit" : searching ? " is-search-dim" : ""}`;
      btn.style.top = `${Math.max(0, it.top)}px`;
      btn.style.height = `${it.height}px`;
      if (it.cols > 1) {
        const widthPct = 100 / it.cols;
        btn.style.left = `calc(${it.col * widthPct}% + 2px)`;
        btn.style.right = "auto";
        btn.style.width = `calc(${widthPct}% - 4px)`;
      }
      btn.dataset.id = row.id;
      const note = staffNotes(row.notes);
      const cabinCode = CABIN_SHORT[resolveCabinId(row)]?.code || `Κ${resolveCabinId(row)}`;
      btn.title = `${week ? `${cabinCode} · ` : ""}${blocked ? BLOCKED_TIME_SERVICE : row.guest_name} · ${startLabel}–${endLabel}${note ? ` · ${note}` : ""}`;
      if (note) btn.classList.add("has-note");
      const cabinHtml = week
        ? `<span class="cal-block-cabin">${escapeHtml(cabinCode)}</span>`
        : "";
      btn.innerHTML = `
        <span class="cal-block-accent" aria-hidden="true"></span>
        <span class="cal-block-body">
          <span class="cal-block-time">${escapeHtml(startLabel)} – ${escapeHtml(endLabel)}</span>
          <span class="cal-block-name">${cabinHtml}${escapeHtml(blocked ? BLOCKED_TIME_SERVICE : row.guest_name)}</span>
          ${blocked ? "" : `<span class="cal-block-service">${formatServiceLines(row.service)}</span>`}
          ${note ? `<span class="cal-block-note">${escapeHtml(note)}</span>` : ""}
          <span class="cal-block-meta">
            <span class="cal-block-dur">${escapeHtml(formatDurationMin(duration))}</span>
            ${!blocked && row.price_cents != null ? `<span class="cal-block-price">${escapeHtml(formatPriceCents(row.price_cents))}</span>` : ""}
          </span>
        </span>
      `;
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (btn.dataset.didDrag === "1") {
          delete btn.dataset.didDrag;
          return;
        }
        calCols.querySelectorAll(".cal-block.is-selected").forEach((el) => el.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        openCalDetail(row);
      });
      if (!week) bindBlockDrag(btn, row);
      colEl.appendChild(btn);
    }
  }

  updateCalNowLine();
  if (pendingHighlightId) {
    const id = pendingHighlightId;
    pendingHighlightId = "";
    requestAnimationFrame(() => highlightSearchBlock(id));
  }
}

function closeCalDetail() {
  document.getElementById("calDetail")?.remove();
  document.getElementById("calSheetBackdrop")?.remove();
  document.body.style.overflow = "";
}

function openCalDetail(row) {
  closeCalDetail();

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.id = "calSheetBackdrop";
  backdrop.className = "cal-sheet-backdrop";
  backdrop.setAttribute("aria-label", "Κλείσιμο");
  backdrop.addEventListener("click", closeCalDetail);
  document.body.appendChild(backdrop);

  const apptNote = staffNotes(row.notes);
  const blocked = isBlockedTimeService(row.service);
  const el = document.createElement("div");
  el.id = "calDetail";
  el.className = "cal-detail";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.innerHTML = `
    <h3>${escapeHtml(blocked ? BLOCKED_TIME_SERVICE : row.guest_name)}</h3>
    ${blocked ? "" : `<a class="cal-detail-phone" href="tel:${escapeHtml(row.guest_phone)}">${escapeHtml(row.guest_phone)}</a>`}
    <p>${escapeHtml(formatTime(row.appointment_time))} – ${escapeHtml(endTimeLabel(row.appointment_time, row.duration_minutes || 60))} · ${escapeHtml(formatDurationMin(row.duration_minutes || 60))}</p>
    ${blocked ? "" : `<p class="cal-detail-service">${formatServiceLines(row.service)}</p>`}
    <p>${blocked ? "" : `${escapeHtml(formatPriceCents(row.price_cents))} · `}Καμπίνα ${escapeHtml(String(resolveCabinId(row)))}</p>
    <p>${statusBadge(row.status)}</p>
    ${apptNote ? `<div class="cal-detail-note"><span>Σημειώσεις</span><p>${escapeHtml(apptNote)}</p></div>` : ""}
    <div class="cal-detail-note hidden" id="calDetailClientNote"></div>
    <div class="cal-detail-actions">
      <button class="btn btn-gold btn-sm" type="button" id="calDetailEdit">Επεξεργασία</button>
      <select class="status-select" id="calDetailStatus" aria-label="Κατάσταση">
        ${Object.entries(APPOINTMENT_STATUS_LABELS).map(([value, label]) =>
          `<option value="${value}" ${row.status === value ? "selected" : ""}>${label}</option>`
        ).join("")}
      </select>
      ${blocked ? "" : row.client_id
        ? `<a class="btn btn-ghost btn-sm" href="/admin/client?id=${escapeHtml(row.client_id)}">Πελάτης</a>`
        : `<button class="btn btn-ghost btn-sm" type="button" id="calDetailToClient">→ Πελάτης</button>`}
      <button class="btn btn-danger btn-sm" type="button" id="calDetailDelete">Διαγραφή</button>
      <button class="btn btn-ghost btn-sm" type="button" id="calDetailClose">Κλείσιμο</button>
    </div>
  `;
  document.body.appendChild(el);
  if (window.matchMedia("(max-width: 860px)").matches) {
    document.body.style.overflow = "hidden";
  }

  if (row.client_id) {
    getClient(row.client_id).then(({ data }) => {
      if (!document.body.contains(el)) return;
      const clientNote = staffNotes(data?.notes);
      if (!clientNote || clientNote === apptNote) return;
      const box = el.querySelector("#calDetailClientNote");
      if (!box) return;
      box.classList.remove("hidden");
      box.innerHTML = `<span>Σημειώσεις πελάτη</span><p>${escapeHtml(clientNote)}</p>`;
    }).catch(() => {});
  }

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
  extraApplied = { duration: 0, cents: 0 };
  bkServiceId.value = "";
  bkServiceSearch.value = "";
  if (bkService2Search) bkService2Search.value = "";
  hideService2Suggest();
  selectedClientId = "";
  if (bkClientId) bkClientId.value = "";
  if (bkClientSearch) bkClientSearch.value = "";
  bkStatus.value = "confirmed";
  bkLinkClient.checked = true;
  hideServiceSuggest();
  hideClientSuggest();
  hideTimeSuggest();
  setDayFirstDate(bkDate, prefs.date || calendarDay || toDateKey(new Date()));
  bkDuration.value = "60";
  syncDurationStep();
  syncCabinSelectForService(null, prefs.cabinId || null);
  if (bkTime) bkTime.value = prefs.time || "";
  if (bkRepeat) bkRepeat.value = "";
  syncRepeatUi();
  if (bkRepeatBlock) bkRepeatBlock.hidden = false;
  setBlockMode(false);
  const title = document.querySelector("#bookingPanel .panel-title");
  if (title) title.textContent = "Νέο ραντεβού";
  if (bkSubmitBtn) bkSubmitBtn.textContent = "Αποθήκευση ραντεβού";
}

function syncBlockCabinOption(on) {
  if (!bkCabin) return;
  let opt = bkCabin.querySelector('option[value="all"]');
  if (on && !opt) {
    opt = document.createElement("option");
    opt.value = "all";
    opt.textContent = "Όλες οι καμπίνες";
    bkCabin.appendChild(opt);
  }
  if (!on && opt) {
    if (bkCabin.value === "all") bkCabin.value = "";
    opt.remove();
  }
}

function setBlockMode(on) {
  blockMode = Boolean(on);
  bkClientRow?.toggleAttribute("hidden", blockMode);
  bkGuestRow?.toggleAttribute("hidden", blockMode);
  bkEmailField?.toggleAttribute("hidden", blockMode);
  bkServiceField?.toggleAttribute("hidden", blockMode);
  bkService2Field?.toggleAttribute("hidden", blockMode);
  bkPriceField?.toggleAttribute("hidden", blockMode);
  bkLinkClient?.closest(".booking-link-client")?.toggleAttribute("hidden", blockMode);
  bkBlockHint?.classList.toggle("hidden", !blockMode);
  bkBlockTime?.classList.toggle("is-active", blockMode);
  if (bkBlockTime) bkBlockTime.textContent = blockMode ? "Ραντεβού πελάτη" : "Μπλοκαρισμένος χρόνος";
  if (bkName) bkName.required = !blockMode;
  if (bkPhone) bkPhone.required = !blockMode;
  if (bkServiceSearch) bkServiceSearch.required = !blockMode;
  syncBlockCabinOption(blockMode);
  if (!blockMode) {
    if (bkName?.value === BLOCKED_TIME_SERVICE) bkName.value = "";
    if (bkPhone?.value === "00000000") bkPhone.value = "";
    if (bkServiceSearch?.value === BLOCKED_TIME_SERVICE) {
      bkServiceSearch.value = "";
      selectedServiceId = "";
      if (bkServiceId) bkServiceId.value = "";
    }
  }
  if (blockMode) {
    selectedServiceId = "blocked-time";
    if (bkServiceId) bkServiceId.value = "blocked-time";
    if (bkServiceSearch) bkServiceSearch.value = BLOCKED_TIME_SERVICE;
    if (bkService2Search) bkService2Search.value = "";
    extraApplied = { duration: 0, cents: 0 };
    if (bkName && !bkName.value.trim()) bkName.value = BLOCKED_TIME_SERVICE;
    if (bkPhone && !bkPhone.value.trim()) bkPhone.value = "00000000";
    if (bkLinkClient) bkLinkClient.checked = false;
    selectedClientId = "";
    if (bkClientId) bkClientId.value = "";
    if (bkPrice) bkPrice.value = "";
  }
  const title = document.querySelector("#bookingPanel .panel-title");
  if (title) {
    title.textContent = editingAppointmentId
      ? (blockMode ? "Επεξεργασία μπλοκαρίσματος" : "Επεξεργασία ραντεβού")
      : (blockMode ? "Μπλοκαρισμένος χρόνος" : "Νέο ραντεβού");
  }
}

function fillFormFromAppointment(row) {
  editingAppointmentId = row.id;
  editingSnapshot = { ...row };
  selectedServiceId = "";
  bkServiceId.value = "";
  const [firstService, secondService] = splitAppointmentServices(row.service || "");
  bkServiceSearch.value = displayServiceName(firstService);
  if (bkService2Search) bkService2Search.value = displayServiceName(secondService);
  const match = catalogCache.find(
    (item) => normalizeSearch(item.name) === normalizeSearch(displayServiceName(firstService))
  );
  if (match) {
    selectedServiceId = match.id;
    bkServiceId.value = match.id;
  }
  bkName.value = row.guest_name || "";
  bkPhone.value = row.guest_phone || "";
  bkEmail.value = row.guest_email || "";
  setDayFirstDate(bkDate, row.appointment_date || calendarDay);
  bkDuration.value = String(row.duration_minutes || 60);
  bkPrice.value = row.price_cents != null ? eurosFromCents(row.price_cents) : "";
  const secondMatch = secondService
    ? catalogCache.find((item) => normalizeSearch(item.name) === normalizeSearch(displayServiceName(secondService)))
    : null;
  extraApplied = secondMatch
    ? { duration: Number(secondMatch.durationMin) || 0, cents: Number(secondMatch.priceCents) || 0 }
    : { duration: 0, cents: 0 };
  bkCabin.value = row.cabin_id ? String(row.cabin_id) : "";
  bkStatus.value = row.status || "confirmed";
  bkNotes.value = row.notes || "";
  selectedClientId = row.client_id || "";
  if (bkClientId) bkClientId.value = selectedClientId;
  if (bkClientSearch) {
    const linked = clientsCache.find((c) => c.id === selectedClientId);
    bkClientSearch.value = linked
      ? clientSearchLabel(linked)
      : (selectedClientId ? (row.guest_name || "") : "");
  }
  bkLinkClient.checked = Boolean(row.client_id);
  const serviceObj = selectedCatalogService() || {
    id: selectedServiceId || "custom",
    name: displayServiceName(firstService),
    categoryId: "",
    durationMin: row.duration_minutes || 60,
  };
  syncCabinSelectForService(serviceObj, row.cabin_id);
  syncDurationStep();
  if (bkTime) bkTime.value = formatTime(row.appointment_time);
  if (isBlockedTimeService(firstService)) {
    setBlockMode(true);
    bkCabin.value = row.cabin_id ? String(row.cabin_id) : "";
  }
  const title = document.querySelector("#bookingPanel .panel-title");
  if (title) title.textContent = blockMode ? "Επεξεργασία μπλοκαρίσματος" : "Επεξεργασία ραντεβού";
  if (bkSubmitBtn) bkSubmitBtn.textContent = "Αποθήκευση αλλαγών";
  if (bkRepeatBlock) bkRepeatBlock.hidden = true;
  if (bkRepeat) bkRepeat.value = "";
  syncRepeatUi();
}

function openBookingPanel(prefs = {}) {
  if (prefs.edit) {
    resetBookingForm();
    fillFormFromAppointment(prefs.edit);
    bookingPanel.hidden = false;
    syncCalModeClass();
    bookingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    refreshTimeOptions().then(() => {
      const time = formatTime(prefs.edit.appointment_time);
      if (bkTime && time) bkTime.value = time;
    }).catch(() => {});
    return;
  }

  resetBookingForm(prefs);
  bookingPanel.hidden = false;
  syncCalModeClass();
  bookingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  if (prefs.time && bkDate.value) {
    refreshTimeOptions().then(() => {
      if (prefs.time && bkTime) bkTime.value = prefs.time;
    }).catch(() => {});
  }
}

function closeBookingPanel() {
  bookingPanel.hidden = true;
  resetBookingForm();
  syncCalModeClass();
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

function endTimeLabel(startLabel, durationMin) {
  const start = timeLabelToMinutes(formatTime(startLabel));
  if (start == null) return "";
  const end = start + (Number(durationMin) || 0);
  return minutesToTimeLabel(end);
}

function updateCalNowLine() {
  document.querySelectorAll(".cal-now").forEach((el) => el.remove());
  const todayKey = toDateKey(new Date());
  const showToday = calendarSpan === "week"
    ? weekBounds(calendarDay || todayKey).days.includes(todayKey)
    : calendarDay === todayKey;
  if (!calendarDay || !showToday) return;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < BOOKING_DAY_START || mins > BOOKING_DAY_END) return;
  const top = (mins - BOOKING_DAY_START) * pxPerMin();

  const lineHtml = () => {
    const line = document.createElement("div");
    line.className = "cal-now";
    line.style.top = `${top}px`;
    line.setAttribute("aria-hidden", "true");
    return line;
  };

  calTimes?.appendChild(lineHtml());
  calCols?.querySelectorAll(".cal-col").forEach((col) => {
    if (calendarSpan === "week" && col.dataset.day !== todayKey) return;
    col.appendChild(lineHtml());
  });
}

function ensureNowLineTimer() {
  if (nowLineTimer != null) return;
  nowLineTimer = window.setInterval(() => {
    if (activeView === "calendar") updateCalNowLine();
  }, 30000);
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
      name: displayServiceName(s.name),
      categoryLabel: cat.id === "solarium" ? "Solarium" : cat.label,
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
      name: displayServiceName(String(row.name || "")),
      categoryLabel: displayServiceName(String(row.category_label || row.category_id || "Άλλο")),
      categoryId: String(row.category_id || ""),
      durationMin: row.id === "deep-cleanse" ? 90 : (Number(row.duration_minutes) || 60),
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

function normalizeClientSearch(value) {
  return greekNameToLatin(value);
}

function formatServiceMeta(row) {
  const euros = eurosFromCents(row.priceCents);
  const from = row.priceFrom ? "από " : "";
  const price = euros ? `${from}€${euros}` : "";
  const duration = `${row.durationMin || 60}′`;
  return [row.categoryLabel, price, duration].filter(Boolean).join(" · ");
}

function staffNotes(notes) {
  const t = String(notes || "").trim();
  if (!t) return "";
  if (/^(treatwell|google|gcal|ics|csv)\b/i.test(t)) return "";
  if (/\b(twa:|twcsv:|gcal:|ics:)\b/i.test(t)) return "";
  if (/treatwell import/i.test(t)) return "";
  return t;
}

function filterCatalog(query) {
  return filterServiceSuggestions(catalogCache, query);
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
  const list = queryWantsBlock(q) ? [blockedTimeRow(), ...rows.filter((row) => row.id !== "blocked-time")] : rows;

  if (!list.length) {
    bkServiceSuggest.innerHTML = `<div class="suggest-empty">Δεν βρέθηκε στον κατάλογο — θα αποθηκευτεί ως χειροκίνητη υπηρεσία.</div>`;
    bkServiceSuggest.classList.remove("hidden");
    suggestActiveIndex = -1;
    return;
  }

  bkServiceSuggest.innerHTML = list.map((row, index) => `
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

function blockedTimeRow() {
  return {
    id: "blocked-time",
    name: BLOCKED_TIME_SERVICE,
    durationMin: Number(bkDuration?.value) || 60,
    priceCents: 0,
    categoryLabel: "Ημερολόγιο",
    categoryId: "block",
  };
}

function queryWantsBlock(query) {
  const q = normalizeSearch(query);
  if (q.length < 3) return false;
  return ["μπλοκ", "block", "κλειστ"].some((token) => token.startsWith(q) || q.includes(token));
}

function isSolariumAppointment() {
  if (selectedServiceId === "solarium") return true;
  return displayServiceName(bkServiceSearch?.value || "") === "Solarium";
}

function syncDurationStep() {
  if (!bkDuration) return;
  bkDuration.step = isSolariumAppointment() ? "1" : "5";
}

function pickService(id) {
  if (id === "blocked-time") {
    setBlockMode(true);
    hideServiceSuggest();
    return;
  }
  if (blockMode) setBlockMode(false);
  const row = catalogCache.find((item) => item.id === id);
  if (!row) return;
  selectedServiceId = row.id;
  bkServiceId.value = row.id;
  bkServiceSearch.value = row.name;
  bkDuration.value = String((row.durationMin || 60) + extraApplied.duration);
  bkPrice.value = eurosFromCents((row.priceCents || 0) + extraApplied.cents);
  hideServiceSuggest();
  syncCabinSelectForService({
    id: row.id,
    categoryId: row.categoryId,
    durationMin: row.durationMin,
    name: row.name,
  });
  syncDurationStep();
  refreshTimeOptions().catch(() => {});
}

function hideService2Suggest() {
  bkService2Suggest?.classList.add("hidden");
  if (bkService2Suggest) bkService2Suggest.innerHTML = "";
  suggest2ActiveIndex = -1;
}

function showService2Suggest(rows, query = "") {
  if (!bkService2Suggest) return;
  const q = String(query || "").trim();
  if (!q) {
    hideService2Suggest();
    return;
  }
  if (!rows.length) {
    bkService2Suggest.innerHTML = `<div class="suggest-empty">Δεν βρέθηκε στον κατάλογο — θα αποθηκευτεί ως χειροκίνητη υπηρεσία.</div>`;
    bkService2Suggest.classList.remove("hidden");
    suggest2ActiveIndex = -1;
    return;
  }
  bkService2Suggest.innerHTML = rows.map((row, index) => `
    <button
      type="button"
      class="suggest-item${index === 0 ? " is-active" : ""}"
      role="option"
      data-service2-id="${escapeHtml(row.id)}"
    >
      <strong>${escapeHtml(row.name)}</strong>
      <span>${escapeHtml(formatServiceMeta(row))}</span>
    </button>
  `).join("");
  bkService2Suggest.classList.remove("hidden");
  suggest2ActiveIndex = 0;
  bkService2Suggest.querySelectorAll("[data-service2-id]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      pickService2(btn.dataset.service2Id);
    });
  });
}

function clearExtraService() {
  if (!extraApplied.duration && !extraApplied.cents) return;
  const dur = Math.max(5, (Number(bkDuration.value) || 0) - extraApplied.duration);
  const cents = Math.max(0, (centsFromEuros(bkPrice.value) || 0) - extraApplied.cents);
  extraApplied = { duration: 0, cents: 0 };
  bkDuration.value = String(dur);
  bkPrice.value = eurosFromCents(cents);
  refreshTimeOptions().catch(() => {});
}

function applyExtraService(row) {
  const nextDur = Number(row.durationMin) || 0;
  const nextCents = Number(row.priceCents) || 0;
  const dur = Math.max(5, (Number(bkDuration.value) || 0) - extraApplied.duration + nextDur);
  const cents = Math.max(0, (centsFromEuros(bkPrice.value) || 0) - extraApplied.cents + nextCents);
  extraApplied = { duration: nextDur, cents: nextCents };
  bkDuration.value = String(dur);
  bkPrice.value = eurosFromCents(cents);
  if (dur > 240) {
    showToast("Η συνολική διάρκεια ξεπερνά τα 240 λεπτά. Μείωσέ την πριν την αποθήκευση.", true);
  }
  refreshTimeOptions().catch(() => {});
}

function pickService2(id) {
  const row = catalogCache.find((item) => item.id === id);
  if (!row || !bkService2Search) return;
  bkService2Search.value = row.name;
  applyExtraService(row);
  hideService2Suggest();
}

/** Cabin dropdown — all cabins; staff may place any service in any cabin. */
function syncCabinSelectForService(service, preferredCabinId = null) {
  if (!bkCabin) return;
  const pool = CABIN_IDS.slice();
  const suggested = service ? getCabinPool(service) : pool;
  const current = preferredCabinId != null
    ? Number(preferredCabinId)
    : (bkCabin.value ? Number(bkCabin.value) : null);

  bkCabin.innerHTML = [
    `<option value="">Αυτόματα</option>`,
    ...pool.map((id) => {
      const meta = CABIN_SHORT[id] || { code: `Κ${id}`, role: "" };
      const tip = suggested.includes(id) ? "" : " · χειροκίνητα";
      return `<option value="${id}">${escapeHtml(meta.code)} — ${escapeHtml(meta.role)}${tip}</option>`;
    }),
  ].join("");

  if (current != null && pool.includes(current)) {
    bkCabin.value = String(current);
  } else {
    bkCabin.value = suggested.length === 1 ? String(suggested[0]) : "";
  }
  if (blockMode) syncBlockCabinOption(true);
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
  const name = displayServiceName(bkServiceSearch.value.trim());
  if (name === "Solarium") {
    const solarium = catalogCache.find((row) => row.id === "solarium") || getServiceById("solarium");
    if (solarium) {
      return {
        id: solarium.id,
        name: solarium.name,
        durationMin: Number(bkDuration.value) || solarium.durationMin || 10,
        categoryId: solarium.categoryId,
      };
    }
  }
  return {
    id: "custom",
    name,
    durationMin: Number(bkDuration.value) || 60,
    categoryId: "",
  };
}

function clientSearchLabel(client) {
  const phone = client.phone ? ` · ${client.phone}` : "";
  return `${client.full_name || ""}${phone}`.trim();
}

function mergeClients(rows) {
  const byId = new Map(clientsCache.map((row) => [row.id, row]));
  for (const row of rows || []) {
    if (!row?.id) continue;
    byId.set(row.id, {
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
    });
  }
  clientsCache = [...byId.values()].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""), "el", { sensitivity: "base" })
  );
}

function filterClients(query) {
  const q = normalizeClientSearch(query);
  const digits = String(query || "").replace(/\D/g, "");
  if (!q && digits.length < 3) return [];
  return clientsCache
    .filter((row) => {
      const hay = normalizeClientSearch(`${row.full_name} ${row.phone || ""} ${row.email || ""}`);
      if (q && hay.includes(q)) return true;
      if (digits.length >= 3) {
        const phoneDigits = String(row.phone || "").replace(/\D/g, "");
        if (phoneDigits.includes(digits)) return true;
      }
      return false;
    })
    .slice(0, 40);
}

let clientSuggestSeq = 0;
let clientSuggestTimer = 0;

async function searchClientsLive(query) {
  const q = String(query || "").trim();
  const seq = ++clientSuggestSeq;
  if (q.length < 2 && String(query || "").replace(/\D/g, "").length < 3) {
    return;
  }
  const { data, error } = await listClients(q, { lite: true, limit: 50 });
  if (error || seq !== clientSuggestSeq) return;
  mergeClients(data);
  if (String(bkClientSearch?.value || "").trim() !== q) return;
  const local = filterClients(q);
  const byId = new Map(local.map((row) => [row.id, row]));
  for (const row of data || []) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  }
  showClientSuggest([...byId.values()].slice(0, 40), q);
}

function queueClientSuggest(query) {
  const q = String(query || "").trim();
  if (!q) {
    hideClientSuggest();
    return;
  }
  const local = filterClients(q);
  if (local.length) {
    showClientSuggest(local, q);
  } else if (bkClientSuggest) {
    bkClientSuggest.innerHTML = `<div class="suggest-empty">Αναζήτηση…</div>`;
    bkClientSuggest.classList.remove("hidden");
    clientSuggestActiveIndex = -1;
  }
  window.clearTimeout(clientSuggestTimer);
  clientSuggestTimer = window.setTimeout(() => {
    searchClientsLive(q).catch(() => {});
  }, 120);
}

function hideClientSuggest() {
  if (!bkClientSuggest) return;
  bkClientSuggest.classList.add("hidden");
  bkClientSuggest.innerHTML = "";
  clientSuggestActiveIndex = -1;
}

function showClientSuggest(rows, query = "") {
  if (!bkClientSuggest) return;
  const q = String(query || "").trim();
  if (!q) {
    hideClientSuggest();
    return;
  }

  if (!rows.length) {
    bkClientSuggest.innerHTML = `<div class="suggest-empty">Δεν βρέθηκε πελάτης — συμπληρώστε τα στοιχεία ως νέος.</div>`;
    bkClientSuggest.classList.remove("hidden");
    clientSuggestActiveIndex = -1;
    return;
  }

  bkClientSuggest.innerHTML = rows.map((row, index) => `
    <button
      type="button"
      class="suggest-item${index === 0 ? " is-active" : ""}"
      role="option"
      data-client-id="${escapeHtml(row.id)}"
      data-index="${index}"
    >
      <strong>${escapeHtml(row.full_name || "—")}</strong>
      <span>${escapeHtml([row.phone, row.email].filter(Boolean).join(" · ") || "Χωρίς τηλέφωνο")}</span>
    </button>
  `).join("");
  bkClientSuggest.classList.remove("hidden");
  clientSuggestActiveIndex = 0;

  bkClientSuggest.querySelectorAll("[data-client-id]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      pickClient(btn.dataset.clientId).catch(() => {});
    });
  });
}

function clearPickedClient() {
  selectedClientId = "";
  if (bkClientId) bkClientId.value = "";
}

async function pickClient(id) {
  if (!id) {
    clearPickedClient();
    hideClientSuggest();
    return;
  }
  selectedClientId = id;
  if (bkClientId) bkClientId.value = id;
  hideClientSuggest();

  const cached = clientsCache.find((c) => c.id === id);
  if (cached) {
    if (bkClientSearch) bkClientSearch.value = clientSearchLabel(cached);
    bkName.value = cached.full_name || "";
    bkPhone.value = cached.phone || "";
    bkEmail.value = cached.email || "";
    if (bkLinkClient) bkLinkClient.checked = true;
    return;
  }
  const { data } = await getClient(id);
  if (data) {
    if (bkClientSearch) bkClientSearch.value = clientSearchLabel(data);
    bkName.value = data.full_name || "";
    bkPhone.value = data.phone || "";
    bkEmail.value = data.email || "";
    if (bkLinkClient) bkLinkClient.checked = true;
  }
}

async function refreshTimeOptions() {
  const date = readDayFirstDate(bkDate);
  const service = selectedServicePayload();
  const duration = Number(bkDuration.value) || service.durationMin || 60;
  const prev = parseTimeInput(bkTime?.value) || String(bkTime?.value || "").trim();

  if (!date || !service.name) {
    availableTimes = [];
    if (bkTimeSuggest && !bkTimeSuggest.classList.contains("hidden")) {
      showTimeSuggest(filterTimes(bkTime?.value), bkTime?.value);
    }
    return;
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
    const candidates = buildStartSlots(duration);
    availableTimes = filterAvailableStarts(candidates, booked, {
      id: service.id,
      categoryId: service.categoryId,
      durationMin: duration,
    });
  } catch (error) {
    console.warn(error);
    availableTimes = buildStartSlots(duration);
  }

  if (prev && (availableTimes.includes(prev) || parseTimeInput(prev))) {
    if (bkTime) bkTime.value = parseTimeInput(prev) || prev;
  }

  if (bkTimeSuggest && !bkTimeSuggest.classList.contains("hidden")) {
    showTimeSuggest(filterTimes(bkTime?.value), bkTime?.value);
  }
}

function parseTimeInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  let hours = 0;
  let mins = 0;
  if (digits.length === 1 || digits.length === 2) {
    hours = Number(digits);
    mins = 0;
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    mins = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    mins = Number(digits.slice(2, 4));
  }
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || hours > 23 || mins > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function filterTimes(query) {
  const slots = availableTimes.slice();
  const raw = String(query || "").trim();
  if (!raw) return slots;
  const digits = raw.replace(/\D/g, "");
  return slots.filter((slot) => {
    if (slot.includes(raw)) return true;
    const slotDigits = slot.replace(/\D/g, "");
    return Boolean(digits) && slotDigits.includes(digits);
  });
}

function hideTimeSuggest() {
  if (!bkTimeSuggest) return;
  bkTimeSuggest.classList.add("hidden");
  bkTimeSuggest.innerHTML = "";
  timeSuggestActiveIndex = -1;
}

function showTimeSuggest(rows, query = "") {
  if (!bkTimeSuggest) return;
  const date = readDayFirstDate(bkDate);
  const service = selectedServicePayload();

  if (!date || !service.name) {
    bkTimeSuggest.innerHTML = `<div class="suggest-empty">Επιλέξτε ημερομηνία και υπηρεσία…</div>`;
    bkTimeSuggest.classList.remove("hidden");
    timeSuggestActiveIndex = -1;
    return;
  }

  if (!availableTimes.length) {
    bkTimeSuggest.innerHTML = `<div class="suggest-empty">Καμία διαθέσιμη ώρα.</div>`;
    bkTimeSuggest.classList.remove("hidden");
    timeSuggestActiveIndex = -1;
    return;
  }

  if (!rows.length) {
    const typed = parseTimeInput(query);
    bkTimeSuggest.innerHTML = `<div class="suggest-empty">${typed ? `Δεν υπάρχει ${escapeHtml(typed)} — μπορείτε να την γράψετε χειροκίνητα.` : "Δεν βρέθηκε αυτή η ώρα."}</div>`;
    bkTimeSuggest.classList.remove("hidden");
    timeSuggestActiveIndex = -1;
    return;
  }

  bkTimeSuggest.innerHTML = rows.map((slot, index) => `
    <button
      type="button"
      class="suggest-item${index === 0 ? " is-active" : ""}"
      role="option"
      data-time="${escapeHtml(slot)}"
      data-index="${index}"
    >
      <strong>${escapeHtml(slot)}</strong>
    </button>
  `).join("");
  bkTimeSuggest.classList.remove("hidden");
  timeSuggestActiveIndex = 0;

  bkTimeSuggest.querySelectorAll("[data-time]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      pickTime(btn.dataset.time);
    });
  });
}

function pickTime(slot) {
  const parsed = parseTimeInput(slot) || slot;
  if (bkTime) bkTime.value = parsed;
  hideTimeSuggest();
}

async function loadCatalogAndClients() {
  try {
    const { data, error } = await listCatalogServices({ includeInactive: false });
    if (error) throw error;
    if (data?.length) {
      const patched = data.map((row) => {
        if (row.id === "massage-relaxing") return { ...row, price_cents: 2500 };
        return row;
      });
      applyCatalogFromRows(patched);
      const fromDb = catalogFromRows(patched);
      const extra = catalogFromDefaults().filter((row) =>
        !fromDb.some((d) => d.id === row.id || normalizeSearch(d.name) === normalizeSearch(row.name))
      );
      catalogCache = [...fromDb, ...extra];
    } else {
      catalogCache = catalogFromDefaults();
    }
  } catch {
    catalogCache = catalogFromDefaults();
  }

  try {
    const { data } = await listAllClientsLite();
    mergeClients(data);
  } catch {
    clientsCache = [];
  }
}

async function renderAppointments() {
  const seq = ++renderSeq;
  rowsBody.innerHTML = `<tr><td colspan="7" class="empty">Φόρτωση…</td></tr>`;
  const q = (searchInput?.value || "").trim();
  const status = statusFilter?.value || "";

  let hits = [];
  if (q) {
    const searchRes = await listAppointments({ status, query: q });
    if (seq !== renderSeq) return;
    if (searchRes.error) {
      rowsBody.innerHTML = `<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
      showToast(searchRes.error.message || "Αποτυχία φόρτωσης ραντεβού", true);
      hideSearchHits();
      renderCalendar([]);
      return;
    }
    hits = searchRes.data || [];
    searchHitsCache = hits;
    searchHitIds = new Set(hits.map((row) => row.id));
    searchHitDates = new Set(hits.map((row) => appointmentDateKey(row)).filter(Boolean));
    renderSearchHits(hits);

    if (activeView === "calendar" && hits.length && calendarDay && !searchHitDates.has(calendarDay)) {
      const best = pickBestSearchHit(hits);
      const nextDay = appointmentDateKey(best);
      if (nextDay) {
        calendarDay = nextDay;
        setDayFirstDate(fromDate, nextDay);
        setDayFirstDate(toDate, nextDay);
        pendingHighlightId = best.id;
      }
    }
    renderDayStrip();
  } else {
    searchHitsCache = [];
    searchHitIds = new Set();
    searchHitDates = new Set();
    pendingHighlightId = "";
    hideSearchHits();
    renderDayStrip();
  }

  let data;
  let error;
  if (activeView === "calendar" && calendarDay) {
    const range = calendarRange();
    const dayRes = await listAppointments({
      status,
      fromDate: range.start,
      toDate: range.end,
      query: "",
    });
    data = dayRes.data;
    error = dayRes.error;
  } else if (q) {
    data = hits;
    error = null;
  } else {
    const listRes = await listAppointments(filters());
    data = listRes.data;
    error = listRes.error;
  }

  if (seq !== renderSeq) return;
  if (error) {
    rowsBody.innerHTML = `<tr><td colspan="7" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
    showToast(error.message || "Αποτυχία φόρτωσης ραντεβού", true);
    renderCalendar([]);
    return;
  }

  const listRows = q ? hits : (data || []);
  appointmentsCache = data || [];
  const healed = await healMismatchedCabins(appointmentsCache);
  if (seq !== renderSeq) return;
  if (healed > 0) {
    showToast(`Διορθώθηκαν ${healed} ραντεβού σε σωστή καμπίνα.`);
  }
  renderCalendar(appointmentsCache);
  if (activeView === "calendar") {
    requestAnimationFrame(() => scrollCalToFocus(appointmentsCache));
  }

  if (!listRows.length) {
    rowsBody.innerHTML = `<tr><td colspan="7" class="empty">Δεν βρέθηκαν ραντεβού.</td></tr>`;
    return;
  }

  rowsBody.innerHTML = listRows.map((row) => `
    <tr data-id="${escapeHtml(row.id)}">
      <td>
        <strong>${escapeHtml(formatDate(row.appointment_date))}</strong><br />
        <span class="muted">${escapeHtml(formatTime(row.appointment_time))}${row.duration_minutes ? ` · ${escapeHtml(formatDurationMin(row.duration_minutes))}` : ""}</span>
      </td>
      <td>
        ${formatServiceLines(row.service)}<br />
        <span class="muted">${escapeHtml(formatPriceCents(row.price_cents))}${resolveCabinId(row) ? ` · Καμπίνα ${escapeHtml(String(resolveCabinId(row)))}` : ""}</span>
        ${staffNotes(row.notes) ? `<br /><span class="visit-note">${escapeHtml(staffNotes(row.notes))}</span>` : ""}
      </td>
      <td>
        ${isBlockedTimeService(row.service)
          ? escapeHtml(BLOCKED_TIME_SERVICE)
          : `${escapeHtml(row.guest_name)}<br /><a class="muted" href="tel:${escapeHtml(row.guest_phone)}">${escapeHtml(row.guest_phone)}</a>`}
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
      const row = listRows.find((item) => item.id === id);
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
      const row = listRows.find((item) => item.id === btn.dataset.edit);
      if (row) openBookingPanel({ edit: row });
    });
  });

  rowsBody.querySelectorAll("[data-to-client]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const appointment = listRows.find((row) => row.id === btn.dataset.toClient);
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
  applyAuthShell(true);
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showLogin() {
  applyAuthShell(false);
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
  buildRepeatDows();
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

bkBlockTime?.addEventListener("click", () => {
  setBlockMode(!blockMode);
});
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

calToday?.addEventListener("click", () => {
  lastFocusScrollDay = "";
  setCalendarDay(toDateKey(new Date()));
});

calWeekBtn?.addEventListener("click", () => {
  setCalendarSpan(calendarSpan === "week" ? "day" : "week");
});

calMonthLabel?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMonthPicker();
});
calYearPrev?.addEventListener("click", (event) => {
  event.stopPropagation();
  monthPickerYear -= 1;
  renderMonthPicker();
});
calYearNext?.addEventListener("click", (event) => {
  event.stopPropagation();
  monthPickerYear += 1;
  renderMonthPicker();
});
calMonthPop?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", () => hideMonthPicker());

function shiftCalendarDay(deltaDays) {
  if (!calendarDay) return;
  const d = parseDateKey(calendarDay);
  d.setDate(d.getDate() + deltaDays);
  setCalendarDay(toDateKey(d));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCalDetail();
    return;
  }
  if (activeView !== "calendar") return;
  const tag = (event.target?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    shiftCalendarDay(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    shiftCalendarDay(1);
  } else if (event.key === "t" || event.key === "T") {
    event.preventDefault();
    setCalendarDay(toDateKey(new Date()));
  }
});

/** Horizontal swipe on the day strip → previous / next day */
(() => {
  if (!calDayStrip) return;
  let startX = 0;
  let startY = 0;
  calDayStrip.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });
  calDayStrip.addEventListener("touchend", (event) => {
    const t = event.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    shiftCalendarDay(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

window.addEventListener("resize", () => {
  if (activeView !== "calendar") return;
  window.clearTimeout(window.__calResizeTimer);
  window.__calResizeTimer = window.setTimeout(() => {
    if (!calCols?.querySelector(".cal-col")) return;
    buildCalendarChrome();
    renderCalendar(appointmentsCache);
  }, 180);
});

bkClientSearch?.addEventListener("focus", () => {
  hideServiceSuggest();
  hideTimeSuggest();
  queueClientSuggest(bkClientSearch.value);
});

bkClientSearch?.addEventListener("input", () => {
  clearPickedClient();
  queueClientSuggest(bkClientSearch.value);
});

bkClientSearch?.addEventListener("keydown", (event) => {
  const items = [...(bkClientSuggest?.querySelectorAll("[data-client-id]") || [])];
  if (event.key === "Escape") {
    hideClientSuggest();
    return;
  }
  if (event.key === "ArrowDown" && items.length) {
    event.preventDefault();
    clientSuggestActiveIndex = Math.min(items.length - 1, clientSuggestActiveIndex + 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === clientSuggestActiveIndex));
    items[clientSuggestActiveIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "ArrowUp" && items.length) {
    event.preventDefault();
    clientSuggestActiveIndex = Math.max(0, clientSuggestActiveIndex - 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === clientSuggestActiveIndex));
    items[clientSuggestActiveIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "Enter" && bkClientSuggest && !bkClientSuggest.classList.contains("hidden") && items.length) {
    const active = items[Math.max(0, clientSuggestActiveIndex)] || items[0];
    if (active) {
      event.preventDefault();
      pickClient(active.dataset.clientId).catch(() => {});
    }
  }
});

bkClientSearch?.addEventListener("blur", () => {
  window.setTimeout(() => hideClientSuggest(), 120);
  const typed = bkClientSearch.value.trim();
  if (!typed) {
    clearPickedClient();
    return;
  }
  if (selectedClientId) return;
  const exact = clientsCache.find((row) => {
    const nameHit = normalizeClientSearch(row.full_name) === normalizeClientSearch(typed);
    const labelHit = normalizeClientSearch(clientSearchLabel(row)) === normalizeClientSearch(typed);
    return nameHit || labelHit;
  });
  if (exact) pickClient(exact.id).catch(() => {});
});

bkServiceSearch?.addEventListener("focus", () => {
  hideClientSuggest();
  hideTimeSuggest();
  showServiceSuggest(filterCatalog(bkServiceSearch.value), bkServiceSearch.value);
});

bkServiceSearch?.addEventListener("input", () => {
  clearPickedServiceKeepText();
  const shown = displayServiceName(bkServiceSearch.value.trim());
  if (shown === "Solarium" && bkServiceSearch.value.trim() !== "Solarium") bkServiceSearch.value = "Solarium";
  syncDurationStep();
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

bkService2Search?.addEventListener("focus", () => {
  hideServiceSuggest();
  hideClientSuggest();
  hideTimeSuggest();
  showService2Suggest(filterCatalog(bkService2Search.value), bkService2Search.value);
});

bkService2Search?.addEventListener("input", () => {
  if (!bkService2Search.value.trim()) clearExtraService();
  const shown = displayServiceName(bkService2Search.value.trim());
  if (shown === "Solarium" && bkService2Search.value.trim() !== "Solarium") bkService2Search.value = "Solarium";
  showService2Suggest(filterCatalog(bkService2Search.value), bkService2Search.value);
});

bkService2Search?.addEventListener("keydown", (event) => {
  const items = [...(bkService2Suggest?.querySelectorAll("[data-service2-id]") || [])];
  if (event.key === "Escape") {
    hideService2Suggest();
    return;
  }
  if (event.key === "ArrowDown" && items.length) {
    event.preventDefault();
    suggest2ActiveIndex = Math.min(items.length - 1, suggest2ActiveIndex + 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === suggest2ActiveIndex));
    return;
  }
  if (event.key === "ArrowUp" && items.length) {
    event.preventDefault();
    suggest2ActiveIndex = Math.max(0, suggest2ActiveIndex - 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === suggest2ActiveIndex));
    return;
  }
  if (event.key === "Enter" && bkService2Suggest && !bkService2Suggest.classList.contains("hidden") && items.length) {
    const active = items[Math.max(0, suggest2ActiveIndex)] || items[0];
    if (active) {
      event.preventDefault();
      pickService2(active.dataset.service2Id);
    }
  }
});

bkService2Search?.addEventListener("blur", () => {
  window.setTimeout(() => hideService2Suggest(), 120);
  const typed = displayServiceName(bkService2Search.value.trim());
  if (typed !== bkService2Search.value.trim()) bkService2Search.value = typed;
  if (!typed) {
    clearExtraService();
    return;
  }
  const exact = catalogCache.find((row) => normalizeSearch(row.name) === normalizeSearch(typed));
  if (exact) pickService2(exact.id);
});

bkServiceSearch?.addEventListener("blur", () => {
  window.setTimeout(() => hideServiceSuggest(), 120);
  const typed = displayServiceName(bkServiceSearch.value.trim());
  if (typed !== bkServiceSearch.value.trim()) bkServiceSearch.value = typed;
  if (!typed) {
    clearPickedServiceKeepText();
    syncDurationStep();
    return;
  }
  if (selectedServiceId) {
    syncDurationStep();
    return;
  }
  const exact = catalogCache.find(
    (row) => normalizeSearch(row.name) === normalizeSearch(typed)
  );
  if (exact) pickService(exact.id);
  syncDurationStep();
});

bkDate?.addEventListener("change", () => {
  refreshTimeOptions().catch(() => {});
  if (bkRepeat?.value === "weekly") syncRepeatUi();
});

bkDuration?.addEventListener("change", () => {
  refreshTimeOptions().catch(() => {});
});

bkTime?.addEventListener("focus", () => {
  hideServiceSuggest();
  hideClientSuggest();
  refreshTimeOptions()
    .then(() => showTimeSuggest(filterTimes(bkTime.value), bkTime.value))
    .catch(() => showTimeSuggest(filterTimes(bkTime.value), bkTime.value));
});

bkTime?.addEventListener("input", () => {
  showTimeSuggest(filterTimes(bkTime.value), bkTime.value);
});

bkTime?.addEventListener("keydown", (event) => {
  const items = [...(bkTimeSuggest?.querySelectorAll("[data-time]") || [])];
  if (event.key === "Escape") {
    hideTimeSuggest();
    return;
  }
  if (event.key === "ArrowDown" && items.length) {
    event.preventDefault();
    timeSuggestActiveIndex = Math.min(items.length - 1, timeSuggestActiveIndex + 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === timeSuggestActiveIndex));
    items[timeSuggestActiveIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "ArrowUp" && items.length) {
    event.preventDefault();
    timeSuggestActiveIndex = Math.max(0, timeSuggestActiveIndex - 1);
    items.forEach((el, i) => el.classList.toggle("is-active", i === timeSuggestActiveIndex));
    items[timeSuggestActiveIndex]?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (event.key === "Enter" && bkTimeSuggest && !bkTimeSuggest.classList.contains("hidden") && items.length) {
    const active = items[Math.max(0, timeSuggestActiveIndex)] || items[0];
    if (active) {
      event.preventDefault();
      pickTime(active.dataset.time);
    }
  }
});

bkTime?.addEventListener("blur", () => {
  window.setTimeout(() => hideTimeSuggest(), 120);
  const parsed = parseTimeInput(bkTime.value);
  if (parsed) bkTime.value = parsed;
});

document.addEventListener("click", (event) => {
  const serviceWrap = document.getElementById("bkServiceSuggestWrap");
  const clientWrap = document.getElementById("bkClientSuggestWrap");
  const timeWrap = document.getElementById("bkTimeSuggestWrap");
  if (serviceWrap && !serviceWrap.contains(event.target)) hideServiceSuggest();
  const service2Wrap = document.getElementById("bkService2SuggestWrap");
  if (service2Wrap && !service2Wrap.contains(event.target)) hideService2Suggest();
  if (clientWrap && !clientWrap.contains(event.target)) hideClientSuggest();
  if (timeWrap && !timeWrap.contains(event.target)) hideTimeSuggest();
  const searchWrap = event.target.closest(".search-wrap");
  if (!searchWrap) hideSearchHits();
});

bookingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const blockAll = blockMode && bkCabin?.value === "all";
  const service = blockMode ? blockedTimeRow() : selectedServicePayload();
  if (!service.name) {
    showToast("Επιλέξτε ή πληκτρολογήστε υπηρεσία.", true);
    bkServiceSearch.focus();
    return;
  }

  const time = parseTimeInput(bkTime.value);
  const date = readDayFirstDate(bkDate);
  if (bkDate.value.trim() && !date) {
    showToast("Η ημερομηνία γράφεται ημέρα/μήνας/έτος, π.χ. 06/10/2026.", true);
    bkDate.focus();
    return;
  }
  const duration = Number(bkDuration.value);
  syncDurationStep();
  if (!date || !time) {
    showToast("Συμπληρώστε ημερομηνία και ώρα (π.χ. 10:30).", true);
    bkTime?.focus();
    return;
  }
  if (timeLabelToMinutes(time) == null) {
    showToast("Μη έγκυρη ώρα.", true);
    bkTime?.focus();
    return;
  }
  if (bkTime) bkTime.value = time;
  if (!duration || duration < 5 || duration > 240) {
    showToast("Η διάρκεια πρέπει να είναι 5–240 λεπτά.", true);
    return;
  }

  const name = blockMode ? BLOCKED_TIME_SERVICE : bkName.value.trim();
  const phone = blockMode ? "00000000" : bkPhone.value.trim();
  if (!blockMode && (name.length < 2 || phone.length < 8)) {
    showToast("Ελέγξτε όνομα και τηλέφωνο.", true);
    return;
  }
  if (blockMode && !blockAll && !CABIN_IDS.includes(Number(bkCabin.value))) {
    showToast("Επίλεξε καμπίνα για το μπλοκάρισμα.", true);
    bkCabin?.focus();
    return;
  }

  let cabinId = bkCabin.value && bkCabin.value !== "all" ? Number(bkCabin.value) : null;
  const pool = getCabinPool(service);
  const poolLabel = pool.map((id) => CABIN_SHORT[id]?.code || `Κ${id}`).join(" / ");
  const manualCabin = CABIN_IDS.includes(cabinId);

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

    if (blockMode) {
      if (!blockAll) cabinId = Number(bkCabin.value);
    } else if (manualCabin) {
      cabinId = Number(cabinId);
    } else {
      const freeInPool = pickCabinForSlot(service, booked, time);
      if (!freeInPool) {
        showToast(`Καμία ελεύθερη καμπίνα (${poolLabel}) για αυτή την ώρα.`, true);
        await refreshTimeOptions();
        return;
      }
      cabinId = freeInPool;
    }

    if (!blockAll) syncCabinSelectForService(service, cabinId);
  } catch (error) {
    if (!manualCabin) cabinId = pool[0] || 1;
    console.warn("cabin pick fallback", error);
  }

  const payload = {
    service: blockMode ? BLOCKED_TIME_SERVICE : joinAppointmentServices(service.name, bkService2Search?.value),
    appointment_date: date,
    appointment_time: time.length === 5 ? `${time}:00` : time,
    duration_minutes: duration,
    price_cents: blockMode ? null : centsFromEuros(bkPrice.value),
    cabin_id: cabinId,
    guest_name: name,
    guest_phone: phone,
    guest_email: blockMode ? null : (bkEmail.value.trim() || null),
    status: bkStatus.value || "confirmed",
    notes: bkNotes.value.trim() || null,
    client_id: blockMode ? null : (selectedClientId || bkClientId?.value || null),
  };

  const untilIso = readDayFirstDate(bkRepeatUntil);
  if (!editingAppointmentId && bkRepeat?.value === "weekly" && bkRepeatUntil?.value.trim() && !untilIso) {
    showToast("Το «Μέχρι» γράφεται ημέρα/μήνας/έτος, π.χ. 06/10/2026.", true);
    bkRepeatUntil.focus();
    return;
  }

  const weekly = !editingAppointmentId && bkRepeat?.value === "weekly";
  const repeatDays = weekly ? selectedRepeatWeekdays() : new Set();
  if (weekly && !repeatDays.size) {
    showToast("Επιλέξτε τουλάχιστον μία ημέρα επανάληψης.", true);
    return;
  }
  const dates = weekly
    ? expandRepeatDates(date, untilIso, repeatDays)
    : [date];

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

      if (!blockMode && timeChanged) {
        notifyAppointmentEmail({
          type: "rescheduled",
          appointment: data || payload,
          previousDate: prevDate,
          previousTime: prevTime,
        }).catch(() => {});
      } else if (!blockMode && statusBecameConfirmed) {
        notifyAppointmentEmail({ type: "confirmed", appointment: data || payload }).catch(() => {});
      } else if (!blockMode && statusBecameCancelled) {
        notifyAppointmentEmail({ type: "cancelled", appointment: data || payload }).catch(() => {});
      } else if (!blockMode) {
        notifyAppointmentEmail({ type: "updated", appointment: data || payload }).catch(() => {});
      }

      showToast(blockMode ? "Το μπλοκάρισμα ενημερώθηκε." : "Το ραντεβού ενημερώθηκε.");
    } else {
      let created = 0;
      let skipped = 0;
      let firstSaved = null;
      let linkId = payload.client_id;

      for (const day of dates) {
        let dayCabins = blockAll ? CABIN_IDS.slice() : [cabinId];
        if (!blockMode) {
          let dayCabin = cabinId;
          try {
            const booked = await fetchBookedSlots(day);
            if (manualCabin) {
              dayCabin = Number(cabinId);
            } else {
              const freeInPool = pickCabinForSlot(service, booked, time);
              if (!freeInPool) {
                skipped += 1;
                continue;
              }
              dayCabin = freeInPool;
            }
          } catch {
            /* keep chosen cabin */
          }
          dayCabins = [dayCabin];
        }

        for (const dayCabin of dayCabins) {
          const row = { ...payload, appointment_date: day, cabin_id: dayCabin };
          const { data, error } = await createAppointment(row);
          if (error) {
            skipped += 1;
            continue;
          }
          created += 1;
          if (!firstSaved) firstSaved = data;
          if (!blockMode && bkLinkClient.checked && data && !data.client_id) {
            try {
              if (!linkId) linkId = await findOrCreateClientFromBooking(data);
              await updateAppointment(data.id, { client_id: linkId });
            } catch (linkErr) {
              console.warn(linkErr);
            }
          }
        }
      }

      if (!created) {
        showToast("Δεν δημιουργήθηκε ραντεβού — δοκιμάστε άλλη ώρα ή καμπίνα.", true);
        return;
      }

      if (!blockMode) {
        const mailType = payload.status === "confirmed" ? "confirmed" : "created";
        notifyAppointmentEmail({ type: mailType, appointment: firstSaved || payload }).catch(() => {});
      }
      if (blockMode && created && !skipped) showToast(created === 1 ? "Ο χρόνος μπλοκαρίστηκε." : `Μπλοκαρίστηκαν ${created} καμπίνες.`);
      else if (created === 1 && !skipped) showToast("Το ραντεβού καταχωρήθηκε.");
      else showToast(`Καταχωρήθηκαν ${created} ραντεβού${skipped ? ` · ${skipped} ημέρες παραλείφθηκαν` : ""}.`);
    }

    closeBookingPanel();
    await loadCatalogAndClients();
    await renderAppointments();
  } finally {
    bkSubmitBtn.disabled = false;
  }
});

let searchTimer = 0;
searchInput?.addEventListener("focus", () => {
  const q = (searchInput.value || "").trim();
  if (q && searchHitsCache.length) renderSearchHits(searchHitsCache);
});
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

bkRepeat?.addEventListener("change", () => syncRepeatUi());

async function boot() {
  const today = toDateKey(new Date());
  calendarDay = today;
  setDayFirstDate(fromDate, today);
  setDayFirstDate(toDate, today);
  paintSpanToggle();

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
  buildRepeatDows();
  await loadCatalogAndClients();
  buildCalendarChrome();
  renderDayStrip();
  setActiveView("calendar", { refresh: false });
  await renderAppointments();
  ensureNowLineTimer();
}

boot();
