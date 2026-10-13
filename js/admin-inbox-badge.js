import { isSupabaseConfigured, listAppointments, listContactMessages, requireSession } from "./admin-api.js";

function paint(count) {
  document.querySelectorAll('a[href="/admin/messages"]').forEach((link) => {
    let badge = link.querySelector(".nav-alert");
    if (!count) {
      badge?.remove();
      link.classList.remove("has-alert");
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "nav-alert";
      badge.setAttribute("aria-hidden", "true");
      link.appendChild(badge);
    }
    badge.textContent = count > 99 ? "99+" : String(count);
    link.classList.add("has-alert");
    link.setAttribute("title", count === 1 ? "1 νέο μήνυμα" : `${count} νέα μηνύματα`);
  });
}

async function refresh() {
  if (!isSupabaseConfigured()) return;
  const session = await requireSession();
  if (!session) return;

  const [bookings, messages] = await Promise.all([
    listAppointments({ status: "pending" }),
    listContactMessages(),
  ]);
  if (bookings.error || messages.error) return;

  const pending = bookings.data?.length || 0;
  const unread = (messages.data || []).filter((row) => !row.is_read).length;
  paint(pending + unread);
}

refresh();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refresh();
});
setInterval(refresh, 60_000);
