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
} from "./booking-services.js";
import { fetchBookedSlots } from "./booking-api.js";

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

const openBookingBtn = document.getElementById("openBookingBtn");
const cancelBookingBtn = document.getElementById("cancelBookingBtn");
const bookingPanel = document.getElementById("bookingPanel");
const bookingForm = document.getElementById("bookingForm");
const bkClient = document.getElementById("bkClient");
const bkStatus = document.getElementById("bkStatus");
const bkName = document.getElementById("bkName");
const bkPhone = document.getElementById("bkPhone");
const bkEmail = document.getElementById("bkEmail");
const bkService = document.getElementById("bkService");
const bkServiceCustom = document.getElementById("bkServiceCustom");
const bkDate = document.getElementById("bkDate");
const bkTime = document.getElementById("bkTime");
const bkDuration = document.getElementById("bkDuration");
const bkPrice = document.getElementById("bkPrice");
const bkCabin = document.getElementById("bkCabin");
const bkNotes = document.getElementById("bkNotes");
const bkLinkClient = document.getElementById("bkLinkClient");
const bkSubmitBtn = document.getElementById("bkSubmitBtn");

const OTHER_SERVICE = "__other__";

/** @type {Array<{ id: string, name: string, categoryLabel: string, durationMin: number, priceCents: number, priceFrom: boolean, categoryId: string }>} */
let catalogCache = [];

/** @type {Array<{ id: string, full_name: string, phone: string | null, email: string | null }>} */
let clientsCache = [];

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
  return {
    status: statusFilter?.value || "",
    fromDate: fromDate?.value || "",
    toDate: toDate?.value || "",
    query: searchInput?.value || "",
  };
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

function renderServiceOptions() {
  const groups = new Map();
  for (const row of catalogCache) {
    if (!groups.has(row.categoryLabel)) groups.set(row.categoryLabel, []);
    groups.get(row.categoryLabel).push(row);
  }

  const parts = [`<option value="">Επιλέξτε υπηρεσία…</option>`];
  for (const [label, rows] of groups) {
    parts.push(`<optgroup label="${escapeHtml(label)}">`);
    for (const row of rows) {
      const euros = eurosFromCents(row.priceCents);
      const from = row.priceFrom ? "από " : "";
      const meta = euros ? ` — ${from}€${euros} · ${row.durationMin}′` : ` — ${row.durationMin}′`;
      parts.push(
        `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}${escapeHtml(meta)}</option>`
      );
    }
    parts.push("</optgroup>");
  }
  parts.push(`<option value="${OTHER_SERVICE}">Άλλο (χειροκίνητα)…</option>`);
  bkService.innerHTML = parts.join("");
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

function selectedCatalogService() {
  if (!bkService.value || bkService.value === OTHER_SERVICE) return null;
  return catalogCache.find((row) => row.id === bkService.value) || getServiceById(bkService.value) || null;
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
  const name = bkServiceCustom.value.trim();
  return {
    id: "custom",
    name,
    durationMin: Number(bkDuration.value) || 60,
    categoryId: "",
  };
}

function applyServiceDefaults() {
  const isOther = bkService.value === OTHER_SERVICE;
  bkServiceCustom.classList.toggle("hidden", !isOther);
  bkServiceCustom.required = isOther;
  if (isOther) return;

  const row = selectedCatalogService();
  if (!row) return;
  bkDuration.value = String(row.durationMin || 60);
  bkPrice.value = eurosFromCents(row.priceCents);
}

async function refreshTimeOptions() {
  const date = bkDate.value;
  const service = selectedServicePayload();
  const duration = Number(bkDuration.value) || service.durationMin || 60;

  if (!date || (!service.name && bkService.value !== OTHER_SERVICE && !bkService.value)) {
    bkTime.innerHTML = `<option value="">Επιλέξτε ημερομηνία &amp; υπηρεσία…</option>`;
    return;
  }

  if (bkService.value === OTHER_SERVICE && !service.name) {
    bkTime.innerHTML = `<option value="">Συμπληρώστε όνομα υπηρεσίας…</option>`;
    return;
  }

  const prev = bkTime.value;
  bkTime.innerHTML = `<option value="">Φόρτωση ωρών…</option>`;

  try {
    const booked = await fetchBookedSlots(date);
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

function resetBookingForm() {
  bookingForm.reset();
  bkStatus.value = "confirmed";
  bkLinkClient.checked = true;
  bkServiceCustom.classList.add("hidden");
  bkServiceCustom.required = false;
  const today = new Date();
  bkDate.value = today.toISOString().slice(0, 10);
  bkTime.innerHTML = `<option value="">Επιλέξτε ημερομηνία &amp; υπηρεσία…</option>`;
  renderServiceOptions();
}

function openBookingPanel() {
  resetBookingForm();
  bookingPanel.hidden = false;
  bookingPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeBookingPanel() {
  bookingPanel.hidden = true;
  resetBookingForm();
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
  renderServiceOptions();

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
    return;
  }
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
      const { error: updError } = await updateAppointment(id, { status: select.value });
      if (updError) {
        showToast(updError.message || "Αποτυχία ενημέρωσης", true);
        await renderAppointments();
        return;
      }
      showToast("Η κατάσταση ενημερώθηκε.");
      await renderAppointments();
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
  await renderAppointments();
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  showLogin();
});

openBookingBtn?.addEventListener("click", () => openBookingPanel());
cancelBookingBtn?.addEventListener("click", () => closeBookingPanel());

bkClient?.addEventListener("change", () => {
  onClientPicked().catch(() => {});
});

bkService?.addEventListener("change", () => {
  applyServiceDefaults();
  refreshTimeOptions().catch(() => {});
});

bkServiceCustom?.addEventListener("change", () => {
  refreshTimeOptions().catch(() => {});
});

bkDate?.addEventListener("change", () => {
  refreshTimeOptions().catch(() => {});
});

bkDuration?.addEventListener("change", () => {
  refreshTimeOptions().catch(() => {});
});

bookingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const service = selectedServicePayload();
  if (!service.name) {
    showToast("Επιλέξτε ή πληκτρολογήστε υπηρεσία.", true);
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
  try {
    const booked = await fetchBookedSlots(date);
    if (!cabinId) {
      cabinId = pickCabinForSlot(service, booked, time);
    }
    if (!cabinId) {
      showToast("Η ώρα δεν είναι διαθέσιμη σε καμία καμπίνα.", true);
      await refreshTimeOptions();
      return;
    }
  } catch (error) {
    if (!cabinId) cabinId = 1;
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
    const { data, error } = await createAppointment(payload);
    if (error) {
      showToast(error.message || "Αποτυχία αποθήκευσης", true);
      return;
    }

    if (bkLinkClient.checked && data && !data.client_id) {
      try {
        const clientId = await findOrCreateClientFromBooking(data);
        await updateAppointment(data.id, { client_id: clientId });
      } catch (linkErr) {
        console.warn(linkErr);
      }
    }

    showToast("Το ραντεβού καταχωρήθηκε.");
    closeBookingPanel();
    await loadCatalogAndClients();
    await renderAppointments();
  } finally {
    bkSubmitBtn.disabled = false;
  }
});

let searchTimer = 0;
[searchInput, statusFilter, fromDate, toDate].forEach((el) => {
  el?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => renderAppointments(), 200);
  });
  el?.addEventListener("change", () => renderAppointments());
});

async function boot() {
  const today = new Date();
  if (fromDate && !fromDate.value) {
    fromDate.value = today.toISOString().slice(0, 10);
  }
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
  await renderAppointments();
}

boot();
