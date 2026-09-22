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
  showToast,
  formatDate,
  formatMoney,
} from "./admin-api.js";
import { DEFAULT_BOOKING_CATEGORIES } from "./booking-services.js";

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
const treatmentSelect = document.getElementById("treatment");
const treatmentCustom = document.getElementById("treatmentCustom");

/** @type {Array<{ id: string, name: string, categoryLabel: string, priceCents: number, priceFrom: boolean }>} */
let catalogCache = [];

const OTHER_VALUE = "__other__";

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

function formatOptionLabel(row) {
  const euros = eurosFromCents(row.priceCents);
  const from = row.priceFrom ? "από " : "";
  return euros ? `${row.name} — ${from}€${euros}` : row.name;
}

function catalogFromDefaults() {
  return DEFAULT_BOOKING_CATEGORIES.flatMap((cat) =>
    cat.services.map((s) => ({
      id: s.id,
      name: s.name,
      categoryLabel: cat.label,
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
      priceCents: Number(row.price_cents) || 0,
      priceFrom: Boolean(row.price_from),
    }))
    .filter((row) => row.name);
}

function renderTreatmentOptions(selectedName = "") {
  const groups = new Map();
  for (const row of catalogCache) {
    if (!groups.has(row.categoryLabel)) groups.set(row.categoryLabel, []);
    groups.get(row.categoryLabel).push(row);
  }

  const parts = [`<option value="">Επιλέξτε θεραπεία…</option>`];
  for (const [label, rows] of groups) {
    parts.push(`<optgroup label="${escapeHtml(label)}">`);
    for (const row of rows) {
      const selected = selectedName && selectedName === row.name ? " selected" : "";
      parts.push(
        `<option value="${escapeHtml(row.id)}" data-name="${escapeHtml(row.name)}" data-price-cents="${row.priceCents}"${selected}>${escapeHtml(formatOptionLabel(row))}</option>`
      );
    }
    parts.push("</optgroup>");
  }

  const known = catalogCache.some((row) => row.name === selectedName);
  const otherSelected = selectedName && !known ? " selected" : "";
  parts.push(`<option value="${OTHER_VALUE}"${otherSelected}>Άλλο (χειροκίνητα)…</option>`);

  treatmentSelect.innerHTML = parts.join("");

  if (selectedName && !known) {
    treatmentCustom.classList.remove("hidden");
    treatmentCustom.required = true;
    treatmentCustom.value = selectedName;
  } else {
    treatmentCustom.classList.add("hidden");
    treatmentCustom.required = false;
    treatmentCustom.value = "";
  }
}

function applySelectedTreatmentPrice() {
  const option = treatmentSelect.selectedOptions[0];
  if (!option || option.value === "" || option.value === OTHER_VALUE) return;
  const cents = Number(option.dataset.priceCents);
  if (!Number.isFinite(cents)) return;
  visitForm.payment_amount.value = eurosFromCents(cents);
}

function syncTreatmentCustomVisibility() {
  const isOther = treatmentSelect.value === OTHER_VALUE;
  treatmentCustom.classList.toggle("hidden", !isOther);
  treatmentCustom.required = isOther;
  if (!isOther) treatmentCustom.value = "";
}

function getSelectedTreatmentName() {
  if (treatmentSelect.value === OTHER_VALUE) {
    return treatmentCustom.value.trim();
  }
  const option = treatmentSelect.selectedOptions[0];
  return option?.dataset?.name?.trim() || "";
}

async function loadTreatmentCatalog() {
  try {
    const { data, error } = await listCatalogServices({ includeInactive: false });
    if (error) throw error;
    catalogCache = data?.length ? catalogFromRows(data) : catalogFromDefaults();
  } catch {
    catalogCache = catalogFromDefaults();
  }
  renderTreatmentOptions();
}

function fillClientForm(client) {
  clientForm.full_name.value = client.full_name || "";
  clientForm.phone.value = client.phone || "";
  clientForm.email.value = client.email || "";
  clientForm.medical_history.value = client.medical_history || "";
  clientForm.notes.value = client.notes || "";
}

function resetVisitForm() {
  visitForm.reset();
  document.getElementById("visitId").value = "";
  renderTreatmentOptions();
  visitForm.classList.add("hidden");
}

function openVisitForm(visit = null) {
  visitForm.classList.remove("hidden");
  if (visit) {
    document.getElementById("visitId").value = visit.id;
    renderTreatmentOptions(visit.treatment || "");
    visitForm.payment_amount.value = visit.payment_amount ?? "";
    visitForm.payment_date.value = visit.payment_date || "";
    visitForm.notes.value = visit.notes || "";
  } else {
    document.getElementById("visitId").value = "";
    visitForm.reset();
    renderTreatmentOptions();
    const today = new Date();
    visitForm.payment_date.value = today.toISOString().slice(0, 10);
  }
}

async function renderVisits() {
  if (!clientId) {
    visitsList.innerHTML = `<p class="empty">Αποθηκεύστε τον πελάτη για να προσθέσετε επισκέψεις.</p>`;
    toggleVisitFormBtn.disabled = true;
    return;
  }

  toggleVisitFormBtn.disabled = false;
  visitsList.innerHTML = `<p class="empty">Φόρτωση…</p>`;
  const { data, error } = await listVisits(clientId);
  if (error) {
    visitsList.innerHTML = `<p class="empty">Σφάλμα φόρτωσης επισκέψεων.</p>`;
    showToast(error.message || "Αποτυχία φόρτωσης", true);
    return;
  }
  if (!data?.length) {
    visitsList.innerHTML = `<p class="empty">Καμία επίσκεψη ακόμα.</p>`;
    return;
  }

  visitsList.innerHTML = data.map((visit) => `
    <article class="visit-card" data-visit-id="${escapeHtml(visit.id)}">
      <h3>${escapeHtml(visit.treatment)}</h3>
      <div class="visit-meta">
        <span>${formatMoney(visit.payment_amount)}</span>
        <span>${formatDate(visit.payment_date)}</span>
      </div>
      ${visit.notes ? `<p class="muted">${escapeHtml(visit.notes)}</p>` : ""}
      <div class="visit-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-edit-visit="${escapeHtml(visit.id)}">Επεξεργασία</button>
        <button class="btn btn-danger btn-sm" type="button" data-delete-visit="${escapeHtml(visit.id)}">Διαγραφή</button>
      </div>
    </article>
  `).join("");

  visitsList.querySelectorAll("[data-edit-visit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const visit = data.find((row) => row.id === btn.dataset.editVisit);
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

treatmentSelect?.addEventListener("change", () => {
  syncTreatmentCustomVisibility();
  if (treatmentSelect.value && treatmentSelect.value !== OTHER_VALUE) {
    applySelectedTreatmentPrice();
  }
});

visitForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!clientId) return;

  const treatment = getSelectedTreatmentName();
  if (!treatment) {
    showToast("Επιλέξτε ή πληκτρολογήστε θεραπεία.", true);
    return;
  }

  const visitId = document.getElementById("visitId").value || null;
  const amountRaw = visitForm.payment_amount.value;
  const payload = {
    client_id: clientId,
    treatment,
    payment_amount: amountRaw === "" ? null : Number(amountRaw),
    payment_date: visitForm.payment_date.value || null,
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
