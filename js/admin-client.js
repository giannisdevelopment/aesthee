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
const treatmentSearch = document.getElementById("treatmentSearch");
const treatmentId = document.getElementById("treatmentId");
const treatmentSuggest = document.getElementById("treatmentSuggest");

/** @type {Array<{ id: string, name: string, categoryLabel: string, priceCents: number, priceFrom: boolean }>} */
let catalogCache = [];

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

function formatTreatmentMeta(row) {
  const euros = eurosFromCents(row.priceCents);
  const from = row.priceFrom ? "από " : "";
  const price = euros ? `${from}€${euros}` : "";
  return [row.categoryLabel, price].filter(Boolean).join(" · ");
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
    catalogCache = data?.length ? catalogFromRows(data) : catalogFromDefaults();
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

function resetVisitForm() {
  visitForm.reset();
  document.getElementById("visitId").value = "";
  setTreatmentFromName("");
  hideTreatmentSuggest();
  visitForm.classList.add("hidden");
}

function openVisitForm(visit = null) {
  visitForm.classList.remove("hidden");
  if (visit) {
    document.getElementById("visitId").value = visit.id;
    setTreatmentFromName(visit.treatment || "");
    visitForm.payment_amount.value = visit.payment_amount ?? "";
    visitForm.payment_date.value = visit.payment_date || "";
    visitForm.notes.value = visit.notes || "";
  } else {
    document.getElementById("visitId").value = "";
    visitForm.reset();
    setTreatmentFromName("");
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
