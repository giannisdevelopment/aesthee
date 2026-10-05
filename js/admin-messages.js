import {
  requireSession,
  signIn,
  signOut,
  listContactMessages,
  markContactRead,
  deleteContactMessage,
  listAppointments,
  updateAppointment,
  deleteAppointment,
  findOrCreateClientFromBooking,
  showToast,
  formatDate,
  formatTime,
  APPOINTMENT_STATUS_LABELS,
} from "./admin-api.js?v=login-fix-1";
import { notifyAppointmentEmail } from "./appointment-email.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const listEl = document.getElementById("messagesList");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");
const inboxFilters = document.getElementById("inboxFilters");
const pendingCountEl = document.getElementById("pendingCount");
const unreadCountEl = document.getElementById("unreadCount");

/** @type {"all" | "bookings" | "messages"} */
let activeFilter = "all";
/** @type {Array<Record<string, unknown>>} */
let pendingBookings = [];
/** @type {Array<Record<string, unknown>>} */
let contactMessages = [];

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

function formatPriceCents(cents) {
  if (cents == null || Number.isNaN(Number(cents))) return "";
  return `${(Number(cents) / 100).toFixed(0)}€`;
}

function formatGreekDate(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = String(isoDate).split("-");
  if (!y || !m || !d) return String(isoDate);
  return `${d}/${m}/${y}`;
}

function createdTs(row) {
  const t = Date.parse(String(row?.created_at || ""));
  return Number.isFinite(t) ? t : 0;
}

function renderBookingCard(row) {
  const price = formatPriceCents(row.price_cents);
  const cabin = row.cabin_id ? ` · Καμπίνα ${escapeHtml(String(row.cabin_id))}` : "";
  const email = row.guest_email
    ? `<a href="mailto:${escapeHtml(row.guest_email)}">${escapeHtml(row.guest_email)}</a>`
    : `<span class="muted">Χωρίς email</span>`;

  return `
    <article class="message-card message-card--booking is-unread" data-booking-id="${escapeHtml(row.id)}">
      <div class="message-head">
        <div>
          <p class="inbox-kind">Νέα κράτηση · ${escapeHtml(APPOINTMENT_STATUS_LABELS.pending)}</p>
          <h3>${escapeHtml(row.guest_name)}</h3>
          <p class="message-contact">
            <a href="tel:${escapeHtml(row.guest_phone)}">${escapeHtml(row.guest_phone)}</a>
            · ${email}
          </p>
        </div>
        <span class="muted">${escapeHtml(formatDate(row.created_at))}</span>
      </div>
      <p class="booking-summary">
        <strong>${escapeHtml(row.service)}</strong><br />
        ${escapeHtml(formatGreekDate(row.appointment_date))} · ${escapeHtml(formatTime(row.appointment_time))}
        · ${escapeHtml(String(row.duration_minutes || 60))}′${price ? ` · ${escapeHtml(price)}` : ""}${cabin}
      </p>
      ${row.notes ? `<p class="muted">${escapeHtml(row.notes)}</p>` : ""}
      <div class="visit-actions">
        <button class="btn btn-gold btn-sm" type="button" data-approve="${escapeHtml(row.id)}">Έγκριση</button>
        <button class="btn btn-ghost btn-sm" type="button" data-decline="${escapeHtml(row.id)}">Απόρριψη</button>
        <button class="btn btn-ghost btn-sm" type="button" data-to-client="${escapeHtml(row.id)}">Πελάτης</button>
        <a class="btn btn-ghost btn-sm" href="/admin/bookings">Στο ημερολόγιο</a>
        <button class="btn btn-danger btn-sm" type="button" data-delete-booking="${escapeHtml(row.id)}">Διαγραφή</button>
      </div>
    </article>
  `;
}

function renderMessageCard(row) {
  return `
    <article class="message-card ${row.is_read ? "" : "is-unread"}" data-id="${escapeHtml(row.id)}">
      <div class="message-head">
        <div>
          <p class="inbox-kind">Επικοινωνία</p>
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
  `;
}

function updateFilterCounts() {
  if (pendingCountEl) pendingCountEl.textContent = String(pendingBookings.length);
  if (unreadCountEl) {
    unreadCountEl.textContent = String(contactMessages.filter((row) => !row.is_read).length);
  }
}

function paintInbox() {
  updateFilterCounts();

  const showBookings = activeFilter === "all" || activeFilter === "bookings";
  const showMessages = activeFilter === "all" || activeFilter === "messages";

  /** @type {Array<{ kind: "booking" | "message", ts: number, html: string }>} */
  const items = [];

  if (showBookings) {
    pendingBookings.forEach((row) => {
      items.push({ kind: "booking", ts: createdTs(row), html: renderBookingCard(row) });
    });
  }
  if (showMessages) {
    contactMessages.forEach((row) => {
      items.push({ kind: "message", ts: createdTs(row), html: renderMessageCard(row) });
    });
  }

  items.sort((a, b) => b.ts - a.ts);

  if (!items.length) {
    const empty =
      activeFilter === "bookings"
        ? "Καμία κράτηση σε αναμονή."
        : activeFilter === "messages"
          ? "Κανένα μήνυμα ακόμα."
          : "Κανένα νέο στα εισερχόμενα.";
    listEl.innerHTML = `<p class="empty">${empty}</p>`;
    return;
  }

  listEl.innerHTML = items.map((item) => item.html).join("");
  bindInboxActions();
}

function bindInboxActions() {
  listEl.querySelectorAll("[data-approve]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.approve;
      const row = pendingBookings.find((item) => item.id === id);
      if (!row) return;
      btn.disabled = true;
      const { error } = await updateAppointment(id, { status: "confirmed" });
      if (error) {
        showToast(error.message || "Αποτυχία έγκρισης", true);
        btn.disabled = false;
        return;
      }
      const updated = { ...row, status: "confirmed" };
      notifyAppointmentEmail({ type: "confirmed", appointment: updated }).catch(() => {});
      showToast("Η κράτηση εγκρίθηκε.");
      await loadInbox();
    });
  });

  listEl.querySelectorAll("[data-decline]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.decline;
      const row = pendingBookings.find((item) => item.id === id);
      if (!row) return;
      if (!confirm("Απόρριψη / ακύρωση αυτής της κράτησης;")) return;
      btn.disabled = true;
      const { error } = await updateAppointment(id, { status: "cancelled" });
      if (error) {
        showToast(error.message || "Αποτυχία απόρριψης", true);
        btn.disabled = false;
        return;
      }
      const updated = { ...row, status: "cancelled" };
      notifyAppointmentEmail({ type: "cancelled", appointment: updated }).catch(() => {});
      showToast("Η κράτηση απορρίφθηκε.");
      await loadInbox();
    });
  });

  listEl.querySelectorAll("[data-to-client]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.toClient;
      const row = pendingBookings.find((item) => item.id === id);
      if (!row) return;
      try {
        btn.disabled = true;
        const clientId = await findOrCreateClientFromBooking(row);
        await updateAppointment(id, {
          client_id: clientId,
          status: "confirmed",
        });
        notifyAppointmentEmail({
          type: "confirmed",
          appointment: { ...row, status: "confirmed", client_id: clientId },
        }).catch(() => {});
        location.href = `/admin/client?id=${clientId}`;
      } catch (err) {
        showToast(err.message || "Αποτυχία δημιουργίας πελάτη", true);
        btn.disabled = false;
      }
    });
  });

  listEl.querySelectorAll("[data-delete-booking]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Οριστική διαγραφή αυτής της κράτησης;")) return;
      const { error } = await deleteAppointment(btn.dataset.deleteBooking);
      if (error) {
        showToast(error.message || "Αποτυχία διαγραφής", true);
        return;
      }
      showToast("Διαγράφηκε.");
      await loadInbox();
    });
  });

  listEl.querySelectorAll("[data-toggle-read]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = btn.dataset.read !== "1";
      const { error: updError } = await markContactRead(btn.dataset.toggleRead, next);
      if (updError) {
        showToast(updError.message || "Αποτυχία", true);
        return;
      }
      await loadInbox();
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
      await loadInbox();
    });
  });
}

async function loadInbox() {
  listEl.innerHTML = `<p class="empty">Φόρτωση…</p>`;

  const [bookingsRes, messagesRes] = await Promise.all([
    listAppointments({ status: "pending" }),
    listContactMessages(),
  ]);

  if (bookingsRes.error) {
    listEl.innerHTML = `<p class="empty">Σφάλμα φόρτωσης κρατήσεων.</p>`;
    showToast(bookingsRes.error.message || "Αποτυχία φόρτωσης κρατήσεων", true);
    return;
  }
  if (messagesRes.error) {
    listEl.innerHTML = `<p class="empty">Σφάλμα φόρτωσης μηνυμάτων.</p>`;
    showToast(messagesRes.error.message || "Αποτυχία φόρτωσης μηνυμάτων", true);
    return;
  }

  pendingBookings = [...(bookingsRes.data || [])].sort((a, b) => createdTs(b) - createdTs(a));
  contactMessages = messagesRes.data || [];
  paintInbox();
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

inboxFilters?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-filter]");
  if (!(btn instanceof HTMLElement)) return;
  activeFilter = /** @type {"all"|"bookings"|"messages"} */ (btn.dataset.filter || "all");
  inboxFilters.querySelectorAll("[data-filter]").forEach((el) => {
    const on = el === btn;
    el.classList.toggle("is-active", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
  });
  paintInbox();
});

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
  await loadInbox();
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
  await loadInbox();
}

boot();
