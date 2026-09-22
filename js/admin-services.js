import {
  requireSession,
  signIn,
  signOut,
  listCatalogServices,
  updateCatalogService,
  createCatalogService,
  deleteCatalogService,
  showToast,
} from "./admin-api.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const rowsBody = document.getElementById("servicesBody");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const showInactive = document.getElementById("showInactive");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");
const offerPanel = document.getElementById("offerPanel");
const offerForm = document.getElementById("offerForm");
const openOfferBtn = document.getElementById("openOfferBtn");
const cancelOfferBtn = document.getElementById("cancelOfferBtn");
const offerCategory = document.getElementById("offerCategory");

/** @type {Array<Record<string, unknown>>} */
let cache = [];

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
  const amount = Number(cents) / 100;
  if (Number.isNaN(amount)) return "";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function centsFromEuros(value) {
  const num = Number(String(value).replace(",", "."));
  if (Number.isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

function slugify(name) {
  const base = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9α-ωάέήίόύώ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `offer-${base || "new"}-${Date.now().toString(36)}`;
}

function uniqueCategories() {
  const map = new Map();
  for (const row of cache) {
    if (!map.has(row.category_id)) {
      map.set(row.category_id, row.category_label);
    }
  }
  return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), "el"));
}

function fillCategorySelects() {
  const cats = uniqueCategories();
  const current = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">Όλες οι κατηγορίες</option>`;
  for (const [id, label] of cats) {
    categoryFilter.innerHTML += `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
  }
  if ([...categoryFilter.options].some((o) => o.value === current)) {
    categoryFilter.value = current;
  }

  offerCategory.innerHTML = cats
    .map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`)
    .join("");
}

function filteredRows() {
  const q = (searchInput.value || "").trim().toLowerCase();
  const cat = categoryFilter.value;
  const inactive = showInactive.checked;
  return cache.filter((row) => {
    if (!inactive && !row.is_active) return false;
    if (cat && row.category_id !== cat) return false;
    if (!q) return true;
    return (
      String(row.name).toLowerCase().includes(q)
      || String(row.category_label).toLowerCase().includes(q)
    );
  });
}

function render() {
  fillCategorySelects();
  const rows = filteredRows();
  if (!rows.length) {
    rowsBody.innerHTML = `<tr><td colspan="6" class="empty">Δεν βρέθηκαν υπηρεσίες. Τρέξτε το <code>supabase/migrate-catalog.sql</code> στο Supabase.</td></tr>`;
    return;
  }

  let lastCat = "";
  const html = [];
  for (const row of rows) {
    if (row.category_label !== lastCat) {
      lastCat = row.category_label;
      html.push(`
        <tr class="cat-row">
          <td colspan="6"><strong>${escapeHtml(row.category_label)}</strong></td>
        </tr>
      `);
    }
    html.push(`
      <tr data-id="${escapeHtml(row.id)}" class="${row.is_active ? "" : "is-inactive"}">
        <td>
          <input class="inline-input name-input" type="text" value="${escapeHtml(row.name)}" aria-label="Όνομα" />
          ${row.is_offer ? `<span class="badge badge-offer">Προσφορά</span>` : ""}
          ${row.price_from ? `<span class="muted">από</span>` : ""}
        </td>
        <td>
          <input class="inline-input price-input" type="number" min="0" step="0.01" value="${escapeHtml(eurosFromCents(row.price_cents))}" aria-label="Τιμή ευρώ" />
        </td>
        <td>
          <input class="inline-input duration-input" type="number" min="5" max="480" step="5" value="${escapeHtml(row.duration_minutes)}" aria-label="Διάρκεια λεπτά" />
        </td>
        <td>
          <input class="offer-check" type="checkbox" ${row.is_offer ? "checked" : ""} aria-label="Προσφορά" />
        </td>
        <td>
          <input class="active-check" type="checkbox" ${row.is_active ? "checked" : ""} aria-label="Ενεργή" />
        </td>
        <td class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-save>Αποθήκευση</button>
          <button class="btn btn-danger btn-sm" type="button" data-delete title="Διαγραφή">×</button>
        </td>
      </tr>
    `);
  }
  rowsBody.innerHTML = html.join("");

  rowsBody.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = tr?.dataset.id;
      if (!id) return;
      const name = tr.querySelector(".name-input")?.value.trim();
      const priceCents = centsFromEuros(tr.querySelector(".price-input")?.value);
      const duration = Number(tr.querySelector(".duration-input")?.value);
      const isOffer = tr.querySelector(".offer-check")?.checked;
      const isActive = tr.querySelector(".active-check")?.checked;

      if (!name || name.length < 2) {
        showToast("Το όνομα είναι πολύ μικρό.", true);
        return;
      }
      if (priceCents == null) {
        showToast("Μη έγκυρη τιμή.", true);
        return;
      }
      if (!duration || duration < 5) {
        showToast("Μη έγκυρη διάρκεια.", true);
        return;
      }

      btn.disabled = true;
      const { error } = await updateCatalogService(id, {
        name,
        price_cents: priceCents,
        duration_minutes: duration,
        is_offer: Boolean(isOffer),
        is_active: Boolean(isActive),
      });
      btn.disabled = false;
      if (error) {
        showToast(error.message || "Αποτυχία αποθήκευσης", true);
        return;
      }
      showToast("Αποθηκεύτηκε.");
      await load();
    });
  });

  rowsBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = tr?.dataset.id;
      if (!id) return;
      if (!window.confirm("Διαγραφή αυτής της υπηρεσίας από τον κατάλογο;")) return;
      const { error } = await deleteCatalogService(id);
      if (error) {
        showToast(error.message || "Αποτυχία διαγραφής", true);
        return;
      }
      showToast("Διαγράφηκε.");
      await load();
    });
  });
}

async function load() {
  rowsBody.innerHTML = `<tr><td colspan="6" class="empty">Φόρτωση…</td></tr>`;
  const { data, error } = await listCatalogServices({ includeInactive: true });
  if (error) {
    rowsBody.innerHTML = `<tr><td colspan="6" class="empty">Σφάλμα: ${escapeHtml(error.message)}. Αν λείπει ο πίνακας, τρέξτε <code>supabase/migrate-catalog.sql</code>.</td></tr>`;
    showToast(error.message || "Αποτυχία φόρτωσης", true);
    return;
  }
  cache = data || [];
  render();
}

function setOfferPanel(open) {
  offerPanel.hidden = !open;
  if (open) fillCategorySelects();
}

async function boot() {
  if (configMissing()) {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    configBanner?.classList.remove("hidden");
    return;
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = event.target.email.value.trim();
    const password = event.target.password.value;
    const { error } = await signIn(email, password);
    if (error) {
      showToast(error.message || "Αποτυχία σύνδεσης", true);
      return;
    }
    await showApp();
  });

  signOutBtn?.addEventListener("click", async () => {
    await signOut();
    location.reload();
  });

  searchInput?.addEventListener("input", () => render());
  categoryFilter?.addEventListener("change", () => render());
  showInactive?.addEventListener("change", () => render());
  openOfferBtn?.addEventListener("click", () => setOfferPanel(true));
  cancelOfferBtn?.addEventListener("click", () => setOfferPanel(false));

  offerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const categoryId = offerCategory.value;
    const categoryLabel = offerCategory.selectedOptions[0]?.textContent?.trim();
    const name = document.getElementById("offerName").value.trim();
    const priceCents = centsFromEuros(document.getElementById("offerPrice").value);
    const duration = Number(document.getElementById("offerDuration").value);
    const isOffer = document.getElementById("offerIsOffer").checked;
    const priceFrom = document.getElementById("offerPriceFrom").checked;

    if (!categoryId || !categoryLabel || !name || priceCents == null || !duration) {
      showToast("Συμπληρώστε όλα τα πεδία.", true);
      return;
    }

    const maxSort = cache
      .filter((r) => r.category_id === categoryId)
      .reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), 0);

    const { error } = await createCatalogService({
      id: slugify(name),
      category_id: categoryId,
      category_label: categoryLabel,
      name,
      duration_minutes: duration,
      price_cents: priceCents,
      price_from: priceFrom,
      is_offer: isOffer,
      sort_order: maxSort + 10,
      is_active: true,
    });

    if (error) {
      showToast(error.message || "Αποτυχία δημιουργίας", true);
      return;
    }

    showToast("Η προσφορά προστέθηκε.");
    offerForm.reset();
    document.getElementById("offerIsOffer").checked = true;
    document.getElementById("offerDuration").value = "30";
    setOfferPanel(false);
    await load();
  });

  const session = await requireSession();
  if (!session) {
    loginView.classList.remove("hidden");
    appView.classList.add("hidden");
    return;
  }
  await showApp();
}

async function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  await load();
}

boot();
