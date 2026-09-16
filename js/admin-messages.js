import {
  requireSession,
  signIn,
  signOut,
  listContactMessages,
  markContactRead,
  deleteContactMessage,
  showToast,
  formatDate,
} from "./admin-api.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const listEl = document.getElementById("messagesList");
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

async function renderMessages() {
  listEl.innerHTML = `<p class="empty">Φόρτωση…</p>`;
  const { data, error } = await listContactMessages();
  if (error) {
    listEl.innerHTML = `<p class="empty">Σφάλμα φόρτωσης.</p>`;
    showToast(error.message || "Αποτυχία φόρτωσης", true);
    return;
  }
  if (!data?.length) {
    listEl.innerHTML = `<p class="empty">Κανένα μήνυμα ακόμα.</p>`;
    return;
  }

  listEl.innerHTML = data.map((row) => `
    <article class="message-card ${row.is_read ? "" : "is-unread"}" data-id="${escapeHtml(row.id)}">
      <div class="message-head">
        <div>
          <h3>${escapeHtml(row.full_name)}</h3>
          <a href="mailto:${escapeHtml(row.email)}">${escapeHtml(row.email)}</a>
        </div>
        <span class="muted">${escapeHtml(formatDate(row.created_at))}</span>
      </div>
      <p>${escapeHtml(row.message)}</p>
      <div class="visit-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-toggle-read="${escapeHtml(row.id)}" data-read="${row.is_read ? "1" : "0"}">
          ${row.is_read ? "Σημείωση ως μη διαβασμένο" : "Σημείωση ως διαβασμένο"}
        </button>
        <button class="btn btn-danger btn-sm" type="button" data-delete="${escapeHtml(row.id)}">Διαγραφή</button>
      </div>
    </article>
  `).join("");

  listEl.querySelectorAll("[data-toggle-read]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = btn.dataset.read !== "1";
      const { error: updError } = await markContactRead(btn.dataset.toggleRead, next);
      if (updError) {
        showToast(updError.message || "Αποτυχία", true);
        return;
      }
      await renderMessages();
    });
  });

  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Διαγραφή μηνύματος;")) return;
      const { error: delError } = await deleteContactMessage(btn.dataset.delete);
      if (delError) {
        showToast(delError.message || "Αποτυχία διαγραφής", true);
        return;
      }
      await renderMessages();
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
  const { error } = await signIn(event.target.email.value.trim(), event.target.password.value);
  if (error) {
    showToast(error.message || "Αποτυχία σύνδεσης", true);
    return;
  }
  showApp();
  await renderMessages();
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  showLogin();
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
  await renderMessages();
}

boot();
