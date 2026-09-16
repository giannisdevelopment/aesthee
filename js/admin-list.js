import {
  requireSession,
  signIn,
  signOut,
  listClients,
  showToast,
  mapAuthError,
  isSupabaseConfigured,
} from "./admin-api.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const clientsBody = document.getElementById("clientsBody");
const searchInput = document.getElementById("searchInput");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");
const submitBtn = loginForm?.querySelector('button[type="submit"]');

function setLoginError(message) {
  if (!loginError) {
    if (message) showToast(message, true);
    return;
  }
  if (!message) {
    loginError.hidden = true;
    loginError.textContent = "";
    return;
  }
  loginError.hidden = false;
  loginError.textContent = message;
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
        <td><a class="client-link" href="/admin/client?id=${escapeHtml(client.id)}">${escapeHtml(client.full_name)}</a></td>
        <td>${escapeHtml(client.phone || "—")}</td>
        <td>${escapeHtml(client.email || "—")}</td>
        <td>${visitCount}</td>
        <td><a class="btn btn-ghost btn-sm" href="/admin/client?id=${escapeHtml(client.id)}">Άνοιγμα</a></td>
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
  if (!isSupabaseConfigured()) configBanner?.classList.remove("hidden");
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginError("");
  if (!isSupabaseConfigured()) {
    setLoginError("Λείπει το js/supabase-config.js (URL + anon/publishable key).");
    return;
  }
  const email = event.target.email.value.trim();
  const password = event.target.password.value;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Σύνδεση…";
  }
  try {
    const { data, error } = await signIn(email, password);
    if (error) {
      const mapped = mapAuthError(error);
      setLoginError(mapped);
      showToast(mapped, true);
      return;
    }
    if (!data?.session) {
      setLoginError("Η σύνδεση δεν επέστρεψε session. Δοκιμάστε ξανά.");
      return;
    }
    showApp();
    await renderClients();
  } catch (err) {
    const mapped = mapAuthError(err);
    setLoginError(mapped);
    showToast(mapped, true);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Σύνδεση";
    }
  }
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
  showLogin();
  if (!isSupabaseConfigured()) return;
  try {
    const session = await requireSession();
    if (!session) return;
    showApp();
    await renderClients();
  } catch (err) {
    setLoginError(mapAuthError(err));
  }
}

boot();
