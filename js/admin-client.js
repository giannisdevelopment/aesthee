import {
  requireSession,
  signOut,
  getClient,
  saveClient,
  deleteClient,
  listVisits,
  saveVisit,
  deleteVisit,
  listCatalogServices,
  listAppointmentsForClient,
  updateAppointment,
  deleteAppointment,
  showToast,
  formatDate,
  formatTime,
  setDayFirstDate,
  readDayFirstDate,
  formatMoney,
  APPOINTMENT_STATUS_LABELS,
} from "./admin-api.js?v=dmy-1";
import {
  DEFAULT_BOOKING_CATEGORIES,
  filterServiceSuggestions,
  splitAppointmentServices,
  joinAppointmentServices,
} from "./booking-services.js?v=two-svc-1";

const params = new URLSearchParams(location.search);
let clientId = params.get("id");

const pageTitle = document.getElementById("pageTitle");
const pageSub = document.getElementById("pageSub");
const clientForm = document.getElementById("clientForm");
const deleteClientBtn = document.getElementById("deleteClientBtn");
const signOutBtn = document.getElementById("signOutBtn");
const visitsList = document.getElementById("visitsList");
const visitForm = document.getElementById("visitForm");
const toggleVisitFormBtn = document.getElementById("toggleVisitFormBtn");
const cancelVisitBtn = document.getElementById("cancelVisitBtn");
const treatmentSearch = document.getElementById("treatmentSearch");
const treatmentId = document.getElementById("treatmentId");
const treatmentSuggest = document.getElementById("treatmentSuggest");
const apptForm = document.getElementById("apptForm");
const apptService = document.getElementById("apptService");
const apptSuggest = document.getElementById("apptSuggest");
const apptService2 = document.getElementById("apptService2");
const apptSuggest2 = document.getElementById("apptSuggest2");
const cancelApptBtn = document.getElementById("cancelApptBtn");
const deleteApptBtn = document.getElementById("deleteApptBtn");

/** @type {Array<{ id: string, name: string, categoryLabel: string, categoryId: string, durationMin: number, priceCents: number, priceFrom: boolean }>} */
let catalogCache = [];

/** @type {object[]} */
let appointmentsCache = [];

/** Raw notes of the appointment being edited, including import fingerprints. */
let editingApptNotesRaw = "";

/** Duration and price already added by the second service. */
let clientExtra = { duration: 0, cents: 0 };

/** @type {string} */
let selectedTreatmentId = "";

let suggestActiveIndex = -1;

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

function eurosFromCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2).replace(/\.00$/, "");
}

function normalizeSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

function formatTreatmentMeta(row) {
  const euros = eurosFromCents(row.priceCents);
  const from = row.priceFrom ? "από " : "";
  const price = euros ? `${from}€${euros}` : "";
  return [row.categoryLabel, price].filter(Boolean).join(" · ");
}

function filterCatalog(query) {
  return filterServiceSuggestions(catalogCache, query, 25);
}

function hideTreatmentSuggest() {
  treatmentSuggest.classList.add("hidden");
  treatmentSuggest.innerHTML = "";
  suggestActiveIndex = -1;
}

function showTreatmentSuggest(rows, query = "") {
  const q = String(query || "").trim();
  if (!q) {
    hideTreatmentSuggest();
    return;
  }

  if (!rows.length) {
    treatmentSuggest.innerHTML = `<div class="suggest-empty">Δεν βρέθηκε στον κατάλογο — θα αποθηκευτεί ως χειροκίνητη θεραπεία.</div>`;
    treatmentSuggest.classList.remove("hidden");
    suggestActiveIndex = -1;
    return;
  }

  treatmentSuggest.innerHTML = rows.map((row, index) => `
    <button
      type="button"
      class="suggest-item${index === 0 ? " is-active" : ""}"
      role="option"
      data-treatment-id="${escapeHtml(row.id)}"
      data-index="${index}"
    >
      <strong>${escapeHtml(row.name)}</strong>
      <span>${escapeHtml(formatTreatmentMeta(row))}</span>
    </button>
  `).join("");
  treatmentSuggest.classList.remove("hidden");
  suggestActiveIndex = 0;

  treatmentSuggest.querySelectorAll("[data-treatment-id]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      pickTreatment(btn.dataset.treatmentId);
    });
  });
}

function pickTreatment(id) {
  const row = catalogCache.find((item) => item.id === id);
  if (!row) return;
  selectedTreatmentId = row.id;
  treatmentId.value = row.id;
  treatmentSearch.value = row.name;
  visitForm.payment_amount.value = eurosFromCents(row.priceCents);
  hideTreatmentSuggest();
}

function clearPickedTreatmentKeepText() {
  selectedTreatmentId = "";
  treatmentId.value = "";
}

function getSelectedTreatmentName() {
  if (selectedTreatmentId) {
    const row = catalogCache.find((item) => item.id === selectedTreatmentId);
    if (row) return row.name;
  }
  return treatmentSearch.value.trim();
}

function setTreatmentFromName(name = "") {
  selectedTreatmentId = "";
  treatmentId.value = "";
  treatmentSearch.value = name || "";
  if (!name) return;
  const exact = catalogCache.find(
    (row) => normalizeSearch(row.name) === normalizeSearch(name)
  );
  if (exact) {
    selectedTreatmentId = exact.id;
    treatmentId.value = exact.id;
    treatmentSearch.value = exact.name;
  }
}

async function loadTreatmentCatalog() {
  try {
    const { data, error } = await listCatalogServices({ includeInactive: false });
    if (error) throw error;
    if (data?.length) {
      const fromDb = catalogFromRows(data);
      const extra = catalogFromDefaults().filter((row) =>
        !fromDb.some((item) => item.id === row.id || normalizeSearch(item.name) === normalizeSearch(row.name))
      );
      catalogCache = [...fromDb, ...extra];
    } else {
      catalogCache = catalogFromDefaults();
    }
  } catch {
    catalogCache = catalogFromDefaults();
  }
}

function fillClientForm(client) {
  clientForm.full_name.value = client.full_name || "";
  clientForm.phone.value = client.phone || "";
  clientForm.email.value = client.email || "";
  clientForm.medical_history.value = client.medical_history || "";
  clientForm.notes.value = client.notes || "";
}

function normalizeLabel(value) {
  return normalizeSearch(value).replace(/[^a-z0-9α-ω]+/g, " ").trim();
}

function isImportFingerprint(notes) {
  const t = String(notes || "").trim();
  if (!t) return false;
  return /^(treatwell|google|gcal|ics|csv)\b/i.test(t)
    || /\b(twa:|twcsv:|gcal:|ics:)\b/i.test(t)
    || /Treatwell import/i.test(t);
}

function displayNotes(notes) {
  const t = String(notes || "").trim();
  if (!t || isImportFingerprint(t)) return "";
  return t;
}

function sameService(a, b) {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function resetVisitForm() {
  visitForm.reset();
  document.getElementById("visitId").value = "";
  setTreatmentFromName("");
  hideTreatmentSuggest();
  visitForm.classList.add("hidden");
}

function openVisitForm(visit = null) {
  closeApptForm();
  visitForm.classList.remove("hidden");
  if (visit) {
    document.getElementById("visitId").value = visit.id;
    setTreatmentFromName(visit.treatment || "");
    visitForm.payment_amount.value = visit.payment_amount ?? "";
    setDayFirstDate(visitForm.payment_date, visit.payment_date || "");
    visitForm.notes.value = visit.notes || "";
  } else {
    document.getElementById("visitId").value = "";
    visitForm.reset();
    setTreatmentFromName("");
    const today = new Date();
    setDayFirstDate(visitForm.payment_date, today.toISOString().slice(0, 10));
  }
}

function centsFromEuros(raw) {
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseTimeInput(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function hideApptSuggest() {
  apptSuggest?.classList.add("hidden");
  if (apptSuggest) apptSuggest.innerHTML = "";
}

function showApptSuggest(rows, query = "") {
  if (!apptSuggest) return;
  const q = String(query || "").trim();
  if (!q) {
    hideApptSuggest();
    return;
  }
  if (!rows.length) {
    apptSuggest.innerHTML = `<div class="suggest-empty">Δεν βρέθηκε στον κατάλογο — θα αποθηκευτεί ως χειροκίνητη υπηρεσία.</div>`;
    apptSuggest.classList.remove("hidden");
    return;
  }
  apptSuggest.innerHTML = rows.map((row, index) => `
    <button type="button" class="suggest-item${index === 0 ? " is-active" : ""}" data-appt-service="${escapeHtml(row.id)}">
      <strong>${escapeHtml(row.name)}</strong>
      <span>${escapeHtml(formatTreatmentMeta(row))}</span>
    </button>
  `).join("");
  apptSuggest.classList.remove("hidden");
  apptSuggest.querySelectorAll("[data-appt-service]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      pickApptService(btn.dataset.apptService);
    });
  });
}

function pickApptService(id) {
  const row = catalogCache.find((item) => item.id === id);
  if (!row || !apptForm) return;
  apptService.value = row.name;
  const duration = (Number(row.durationMin) || 60) + clientExtra.duration;
  apptForm.duration_minutes.value = String(duration);
  apptForm.price_euros.value = eurosFromCents((Number(row.priceCents) || 0) + clientExtra.cents);
  hideApptSuggest();
}

function hideApptSuggest2() {
  apptSuggest2?.classList.add("hidden");
  if (apptSuggest2) apptSuggest2.innerHTML = "";
}

function clearClientExtra() {
  if (!apptForm || (!clientExtra.duration && !clientExtra.cents)) return;
  const dur = Math.max(5, (Number(apptForm.duration_minutes.value) || 0) - clientExtra.duration);
  const cents = Math.max(0, (centsFromEuros(apptForm.price_euros.value) || 0) - clientExtra.cents);
  clientExtra = { duration: 0, cents: 0 };
  apptForm.duration_minutes.value = String(dur);
  apptForm.price_euros.value = eurosFromCents(cents);
}

function applyClientExtra(row) {
  if (!apptForm) return;
  const nextDur = Number(row.durationMin) || 0;
  const nextCents = Number(row.priceCents) || 0;
  const dur = Math.max(5, (Number(apptForm.duration_minutes.value) || 0) - clientExtra.duration + nextDur);
  const cents = Math.max(0, (centsFromEuros(apptForm.price_euros.value) || 0) - clientExtra.cents + nextCents);
  clientExtra = { duration: nextDur, cents: nextCents };
  apptForm.duration_minutes.value = String(dur);
  apptForm.price_euros.value = eurosFromCents(cents);
  if (dur > 240) {
    showToast("Η συνολική διάρκεια ξεπερνά τα 240 λεπτά. Μείωσέ την πριν την αποθήκευση.", true);
  }
}

function pickApptService2(id) {
  const row = catalogCache.find((item) => item.id === id);
  if (!row || !apptService2) return;
  apptService2.value = row.name;
  applyClientExtra(row);
  hideApptSuggest2();
}

function showApptSuggest2(rows, query = "") {
  if (!apptSuggest2) return;
  const q = String(query || "").trim();
  if (!q) {
    hideApptSuggest2();
    return;
  }
  if (!rows.length) {
    apptSuggest2.innerHTML = `<div class="suggest-empty">Δεν βρέθηκε στον κατάλογο — θα αποθηκευτεί ως χειροκίνητη υπηρεσία.</div>`;
    apptSuggest2.classList.remove("hidden");
    return;
  }
  apptSuggest2.innerHTML = rows.map((row, index) => `
    <button type="button" class="suggest-item${index === 0 ? " is-active" : ""}" data-appt-service2="${escapeHtml(row.id)}">
      <strong>${escapeHtml(row.name)}</strong>
      <span>${escapeHtml(formatTreatmentMeta(row))}</span>
    </button>
  `).join("");
  apptSuggest2.classList.remove("hidden");
  apptSuggest2.querySelectorAll("[data-appt-service2]").forEach((btn) => {
    btn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      pickApptService2(btn.dataset.apptService2);
    });
  });
}

function closeApptForm() {
  apptForm?.classList.add("hidden");
  apptForm?.reset();
  editingApptNotesRaw = "";
  clientExtra = { duration: 0, cents: 0 };
  hideApptSuggest();
  hideApptSuggest2();
}

function openApptForm(row) {
  if (!apptForm) return;
  resetVisitForm();
  editingApptNotesRaw = row.notes || "";
  clientExtra = { duration: 0, cents: 0 };
  apptForm.classList.remove("hidden");
  document.getElementById("apptId").value = row.id;
  const [firstService, secondService] = splitAppointmentServices(row.service || "");
  apptService.value = firstService;
  if (apptService2) apptService2.value = secondService;
  setDayFirstDate(apptForm.appointment_date, row.appointment_date || "");
  apptForm.appointment_time.value = row.appointment_time ? String(row.appointment_time).slice(0, 5) : "";
  apptForm.duration_minutes.value = String(row.duration_minutes || 60);
  apptForm.price_euros.value = row.price_cents != null ? eurosFromCents(row.price_cents) : "";
  apptForm.cabin_id.value = row.cabin_id ? String(row.cabin_id) : "";
  apptForm.status.value = row.status || "confirmed";
  apptForm.notes.value = displayNotes(row.notes);
  const secondMatch = secondService
    ? catalogCache.find((item) => normalizeSearch(item.name) === normalizeSearch(secondService))
    : null;
  clientExtra = secondMatch
    ? { duration: Number(secondMatch.durationMin) || 0, cents: Number(secondMatch.priceCents) || 0 }
    : { duration: 0, cents: 0 };
  apptForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function renderVisits() {
  if (!clientId) {
    visitsList.innerHTML = `<p class="empty">Αποθηκεύστε τον πελάτη για να προσθέσετε επισκέψεις.</p>`;
    toggleVisitFormBtn.disabled = true;
    return;
  }

  toggleVisitFormBtn.disabled = false;
  visitsList.innerHTML = `<p class="empty">Φόρτωση…</p>`;

  const phone = document.getElementById("phone")?.value || "";
  const [{ data: visits, error: visitErr }, { data: appts, error: apptErr }] = await Promise.all([
    listVisits(clientId),
    listAppointmentsForClient({ clientId, phone }),
  ]);

  if (visitErr) {
    visitsList.innerHTML = `<p class="empty">Σφάλμα φόρτωσης επισκέψεων.</p>`;
    showToast(visitErr.message || "Αποτυχία φόρτωσης", true);
    return;
  }
  if (apptErr) {
    showToast(apptErr.message || "Αποτυχία φόρτωσης ραντεβού", true);
  }

  appointmentsCache = appts || [];
  const todayKey = new Date().toISOString().slice(0, 10);
  /** @type {Array<{ kind: string, sort: string, html: string, visit?: object }>} */
  const items = [];
  const appointmentKeys = [];

  for (const row of appts || []) {
    const day = String(row.appointment_date || "").slice(0, 10);
    appointmentKeys.push({ day, service: row.service || "" });
    const upcoming = day >= todayKey && row.status !== "cancelled" && row.status !== "completed" && row.status !== "no_show";
    const status = APPOINTMENT_STATUS_LABELS[row.status] || row.status || "";
    const euros = row.price_cents != null ? Number(row.price_cents) / 100 : null;
    const notes = displayNotes(row.notes);
    items.push({
      kind: "appointment",
      sort: `${day}T${formatTime(row.appointment_time)}`,
      html: `
        <article class="visit-card${upcoming ? " is-upcoming" : ""}${row.status === "cancelled" ? " is-cancelled" : ""}">
          <h3>${splitAppointmentServices(row.service || "Ραντεβού").filter(Boolean).map((part) => escapeHtml(part)).join("<br>")}</h3>
          <div class="visit-meta">
            <span>${escapeHtml(formatDate(row.appointment_date))} · ${escapeHtml(formatTime(row.appointment_time))}</span>
            ${euros != null && euros > 0 ? `<span>${escapeHtml(formatMoney(euros))}</span>` : ""}
            ${status ? `<span>${escapeHtml(status)}</span>` : ""}
          </div>
          ${notes ? `<p class="muted visit-note">${escapeHtml(notes)}</p>` : ""}
          <div class="visit-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-edit-appt="${escapeHtml(row.id)}">Επεξεργασία</button>
          </div>
        </article>
      `,
    });
  }

  for (const visit of visits || []) {
    const day = String(visit.payment_date || "").slice(0, 10);
    const duplicate = appointmentKeys.some(
      (key) => key.day === day && sameService(key.service, visit.treatment)
    );
    if (duplicate) continue;
    const notes = displayNotes(visit.notes);
    items.push({
      kind: "visit",
      sort: `${visit.payment_date || "0000-00-00"}T00:00`,
      visit,
      html: `
        <article class="visit-card" data-visit-id="${escapeHtml(visit.id)}">
          <h3>${escapeHtml(visit.treatment)}</h3>
          <div class="visit-meta">
            <span>${escapeHtml(formatDate(visit.payment_date))}</span>
            <span>${escapeHtml(formatMoney(visit.payment_amount))}</span>
          </div>
          ${notes ? `<p class="muted visit-note">${escapeHtml(notes)}</p>` : ""}
          <div class="visit-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-edit-visit="${escapeHtml(visit.id)}">Επεξεργασία</button>
            <button class="btn btn-danger btn-sm" type="button" data-delete-visit="${escapeHtml(visit.id)}">Διαγραφή</button>
          </div>
        </article>
      `,
    });
  }

  items.sort((a, b) => String(b.sort).localeCompare(String(a.sort)));

  if (!items.length) {
    visitsList.innerHTML = `<p class="empty">Κανένα ραντεβού ή επίσκεψη ακόμα.</p>`;
    return;
  }

  visitsList.innerHTML = items.map((item) => item.html).join("");

  visitsList.querySelectorAll("[data-edit-appt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = appointmentsCache.find((item) => item.id === btn.dataset.editAppt);
      if (row) openApptForm(row);
    });
  });

  visitsList.querySelectorAll("[data-edit-visit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const visit = (visits || []).find((row) => row.id === btn.dataset.editVisit);
      if (visit) openVisitForm(visit);
    });
  });

  visitsList.querySelectorAll("[data-delete-visit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Διαγραφή αυτής της επίσκεψης;")) return;
      const { error: delError } = await deleteVisit(btn.dataset.deleteVisit);
      if (delError) {
        showToast(delError.message || "Αποτυχία διαγραφής", true);
        return;
      }
      showToast("Η επίσκεψη διαγράφηκε.");
      await renderVisits();
    });
  });
}

async function loadClient() {
  if (!clientId) {
    pageTitle.textContent = "Νέος πελάτης";
    pageSub.textContent = "Συμπληρώστε στοιχεία, ιστορικό και σημειώσεις.";
    deleteClientBtn.classList.add("hidden");
    await renderVisits();
    return;
  }

  const { data, error } = await getClient(clientId);
  if (error || !data) {
    showToast(error?.message || "Ο πελάτης δεν βρέθηκε", true);
    window.setTimeout(() => { location.href = "/admin/"; }, 1200);
    return;
  }

  pageTitle.textContent = data.full_name;
  pageSub.textContent = "Επεξεργασία στοιχείων και ιστορικού επισκέψεων.";
  deleteClientBtn.classList.remove("hidden");
  fillClientForm(data);
  await renderVisits();
}

clientForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    full_name: clientForm.full_name.value.trim(),
    phone: clientForm.phone.value.trim() || null,
    email: clientForm.email.value.trim() || null,
    medical_history: clientForm.medical_history.value.trim() || null,
    notes: clientForm.notes.value.trim() || null,
  };

  const { data, error } = await saveClient(payload, clientId);
  if (error) {
    showToast(error.message || "Αποτυχία αποθήκευσης", true);
    return;
  }

  showToast("Αποθηκεύτηκε.");
  if (!clientId && data?.id) {
    clientId = data.id;
    history.replaceState(null, "", `/admin/client?id=${clientId}`);
  }
  pageTitle.textContent = data.full_name;
  deleteClientBtn.classList.remove("hidden");
  await renderVisits();
});

deleteClientBtn?.addEventListener("click", async () => {
  if (!clientId) return;
  if (!confirm("Οριστική διαγραφή πελάτη και όλων των επισκέψεων;")) return;
  const { error } = await deleteClient(clientId);
  if (error) {
    showToast(error.message || "Αποτυχία διαγραφής", true);
    return;
  }
  location.href = "/admin/";
});

toggleVisitFormBtn?.addEventListener("click", () => {
  if (!clientId) {
    showToast("Αποθηκεύστε πρώτα τον πελάτη.", true);
    return;
  }
  openVisitForm();
});

cancelVisitBtn?.addEventListener("click", resetVisitForm);

treatmentSearch?.addEventListener("focus", () => {
  showTreatmentSuggest(filterCatalog(treatmentSearch.value), treatmentSearch.value);
});

treatmentSearch?.addEventListener("input", () => {
  clearPickedTreatmentKeepText();
  showTreatmentSuggest(filterCatalog(treatmentSearch.value), treatmentSearch.value);
});

treatmentSearch?.addEventListener("keydown", (event) => {
  const items = [...treatmentSuggest.querySelectorAll("[data-treatment-id]")];
  if (event.key === "Escape") {
    hideTreatmentSuggest();
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
  if (event.key === "Enter" && !treatmentSuggest.classList.contains("hidden") && items.length) {
    const active = items[Math.max(0, suggestActiveIndex)] || items[0];
    if (active) {
      event.preventDefault();
      pickTreatment(active.dataset.treatmentId);
    }
  }
});

treatmentSearch?.addEventListener("blur", () => {
  window.setTimeout(() => hideTreatmentSuggest(), 120);
  const typed = treatmentSearch.value.trim();
  if (!typed) {
    clearPickedTreatmentKeepText();
    return;
  }
  if (selectedTreatmentId) return;
  const exact = catalogCache.find(
    (row) => normalizeSearch(row.name) === normalizeSearch(typed)
  );
  if (exact) pickTreatment(exact.id);
});

document.addEventListener("click", (event) => {
  const wrap = document.getElementById("treatmentSuggestWrap");
  if (wrap && !wrap.contains(event.target)) hideTreatmentSuggest();
  const apptWrap = document.getElementById("apptSuggestWrap");
  if (apptWrap && !apptWrap.contains(event.target)) hideApptSuggest();
  const apptWrap2 = document.getElementById("apptSuggest2Wrap");
  if (apptWrap2 && !apptWrap2.contains(event.target)) hideApptSuggest2();
});

apptService2?.addEventListener("focus", () => {
  hideApptSuggest();
  showApptSuggest2(filterCatalog(apptService2.value), apptService2.value);
});

apptService2?.addEventListener("input", () => {
  if (!apptService2.value.trim()) clearClientExtra();
  showApptSuggest2(filterCatalog(apptService2.value), apptService2.value);
});

apptService2?.addEventListener("blur", () => {
  window.setTimeout(() => hideApptSuggest2(), 120);
  const typed = apptService2.value.trim();
  if (!typed) {
    clearClientExtra();
    return;
  }
  const exact = catalogCache.find((row) => normalizeSearch(row.name) === normalizeSearch(typed));
  if (exact) pickApptService2(exact.id);
});

apptService?.addEventListener("focus", () => {
  showApptSuggest(filterCatalog(apptService.value), apptService.value);
});

apptService?.addEventListener("input", () => {
  showApptSuggest(filterCatalog(apptService.value), apptService.value);
});

cancelApptBtn?.addEventListener("click", closeApptForm);

deleteApptBtn?.addEventListener("click", async () => {
  const id = document.getElementById("apptId")?.value;
  if (!id) return;
  if (!confirm("Οριστική διαγραφή αυτού του ραντεβού;")) return;
  const { error } = await deleteAppointment(id);
  if (error) {
    showToast(error.message || "Αποτυχία διαγραφής", true);
    return;
  }
  showToast("Το ραντεβού διαγράφηκε.");
  closeApptForm();
  await renderVisits();
});

apptForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("apptId")?.value;
  const service = joinAppointmentServices(apptService.value, apptService2?.value);
  const date = readDayFirstDate(apptForm.appointment_date);
  const time = parseTimeInput(apptForm.appointment_time.value);
  const duration = Number(apptForm.duration_minutes.value);
  if (!id || !service) {
    showToast("Συμπληρώστε την υπηρεσία.", true);
    apptService.focus();
    return;
  }
  if (apptForm.appointment_date.value.trim() && !date) {
    showToast("Η ημερομηνία γράφεται ημέρα/μήνας/έτος, π.χ. 06/10/2026.", true);
    apptForm.appointment_date.focus();
    return;
  }
  if (!date || !time) {
    showToast("Συμπληρώστε ημερομηνία και ώρα (π.χ. 14:00).", true);
    return;
  }
  if (!duration || duration < 5 || duration > 240) {
    showToast("Η διάρκεια πρέπει να είναι 5–240 λεπτά.", true);
    return;
  }
  const typedNotes = apptForm.notes.value.trim();
  const notes = !typedNotes && isImportFingerprint(editingApptNotesRaw)
    ? editingApptNotesRaw
    : (typedNotes || null);
  const cabin = Number(apptForm.cabin_id.value);
  const { error } = await updateAppointment(id, {
    service,
    appointment_date: date,
    appointment_time: `${time}:00`,
    duration_minutes: duration,
    price_cents: centsFromEuros(apptForm.price_euros.value),
    cabin_id: Number.isFinite(cabin) && cabin >= 1 ? cabin : null,
    status: apptForm.status.value || "confirmed",
    notes,
  });
  if (error) {
    showToast(error.message || "Αποτυχία αποθήκευσης ραντεβού", true);
    return;
  }
  showToast("Το ραντεβού ενημερώθηκε.");
  closeApptForm();
  await renderVisits();
});

visitForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!clientId) return;

  const treatment = getSelectedTreatmentName();
  if (!treatment) {
    showToast("Επιλέξτε ή πληκτρολογήστε θεραπεία.", true);
    treatmentSearch?.focus();
    return;
  }

  const visitId = document.getElementById("visitId").value || null;
  const amountRaw = visitForm.payment_amount.value;
  const paymentDate = readDayFirstDate(visitForm.payment_date);
  if (visitForm.payment_date.value.trim() && !paymentDate) {
    showToast("Η ημερομηνία γράφεται ημέρα/μήνας/έτος, π.χ. 06/10/2026.", true);
    visitForm.payment_date.focus();
    return;
  }
  const payload = {
    client_id: clientId,
    treatment,
    payment_amount: amountRaw === "" ? null : Number(amountRaw),
    payment_date: paymentDate || null,
    notes: visitForm.notes.value.trim() || null,
  };

  const { error } = await saveVisit(payload, visitId);
  if (error) {
    showToast(error.message || "Αποτυχία αποθήκευσης επίσκεψης", true);
    return;
  }

  showToast("Η επίσκεψη αποθηκεύτηκε.");
  resetVisitForm();
  await renderVisits();
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  location.href = "/admin/";
});

async function boot() {
  if (configMissing()) {
    showToast("Ρυθμίστε το js/supabase-config.js", true);
    window.setTimeout(() => { location.href = "/admin/"; }, 900);
    return;
  }
  const session = await requireSession();
  if (!session) {
    location.href = "/admin/";
    return;
  }
  await loadTreatmentCatalog();
  await loadClient();
}

boot();
