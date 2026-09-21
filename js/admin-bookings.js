import {
  requireSession,
  signIn,
  signOut,
  listAppointments,
  updateAppointment,
  deleteAppointment,
  findOrCreateClientFromBooking,
  showToast,
  formatDate,
  formatTime,
  APPOINTMENT_STATUS_LABELS,
} from "./admin-api.js";

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
        await updateAppointment(appointment.id, { client_id: clientId, status: appointment.status === "pending" ? "confirmed" : appointment.status });
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
  await renderAppointments();
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  showLogin();
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
  await renderAppointments();
}

boot();
