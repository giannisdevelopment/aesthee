import {
  requireSession,
  signIn,
  signOut,
  listClients,
  showToast,
} from "./admin-api.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const clientsBody = document.getElementById("clientsBody");
const searchInput = document.getElementById("searchInput");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");

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

async function renderClients(query = "") {
  clientsBody.innerHTML = `<tr><td colspan="5" class="empty">Φόρτωση…</td></tr>`;
  const { data, error } = await listClients(query);
  if (error) {
    clientsBody.innerHTML = `<tr><td colspan="5" class="empty">Σφάλμα φόρτωσης.</td></tr>`;
    showToast(error.message || "Αποτυχία φόρτωσης πελατών", true);
    return;
  }
  if (!data?.length) {
    clientsBody.innerHTML = `<tr><td colspan="5" class="empty">Δεν βρέθηκαν πελάτες.</td></tr>`;
    return;
  }

  clientsBody.innerHTML = data.map((client) => {
    const visitCount = client.visits?.[0]?.count ?? 0;
    return `
      <tr>
        <td><a class="client-link" href="client.html?id=${escapeHtml(client.id)}">${escapeHtml(client.full_name)}</a></td>
        <td>${escapeHtml(client.phone || "—")}</td>
        <td>${escapeHtml(client.email || "—")}</td>
        <td>${visitCount}</td>
        <td><a class="btn btn-ghost btn-sm" href="client.html?id=${escapeHtml(client.id)}">Άνοιγμα</a></td>
      </tr>
    `;
  }).join("");
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
  await renderClients();
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
  await renderClients();
}

boot();
