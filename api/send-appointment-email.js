/**
 * Vercel serverless: send appointment emails via Resend.
 *
 * Env (Vercel project):
 *   RESEND_API_KEY   — required
 *   EMAIL_FROM       — e.g. "Aesthée <onboarding@resend.dev>" or your verified domain
 *   SITE_URL         — optional, default https://aesthee.vercel.app
 */

const TYPE_SUBJECT = {
  created: "Το ραντεβού σας καταχωρήθηκε — Aesthée",
  confirmed: "Το ραντεβού σας επιβεβαιώθηκε — Aesthée",
  rescheduled: "Αλλαγή ώρας ραντεβού — Aesthée",
  cancelled: "Ακύρωση ραντεβού — Aesthée",
  updated: "Ενημέρωση ραντεβού — Aesthée",
};

function formatDateEl(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(isoDate);
  return new Intl.DateTimeFormat("el-GR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatTime(value) {
  return String(value || "").slice(0, 5) || "—";
}

function formatPrice(cents) {
  if (cents == null || Number.isNaN(Number(cents))) return null;
  const euros = Number(cents) / 100;
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(euros);
}

function buildBody(type, appt, extra = {}) {
  const name = appt.guest_name || "σας";
  const when = `${formatDateEl(appt.appointment_date)} στις ${formatTime(appt.appointment_time)}`;
  const service = appt.service || "θεραπεία";
  const duration = appt.duration_minutes ? `${appt.duration_minutes}′` : null;
  const price = formatPrice(appt.price_cents);
  const site = process.env.SITE_URL || "https://aesthee.vercel.app";
  const phone = "2294 152510";

  const lines = [`Γεια σας ${name},`, ""];

  if (type === "created") {
    lines.push("Το ραντεβού σας καταχωρήθηκε επιτυχώς.");
  } else if (type === "confirmed") {
    lines.push("Το ραντεβού σας επιβεβαιώθηκε.");
  } else if (type === "rescheduled") {
    lines.push("Η ώρα του ραντεβού σας άλλαξε.");
    if (extra.previousDate || extra.previousTime) {
      lines.push(
        `Προηγουμένως: ${formatDateEl(extra.previousDate || appt.appointment_date)} στις ${formatTime(extra.previousTime || "")}.`
      );
    }
    lines.push(`Νέα ώρα: ${when}.`);
  } else if (type === "cancelled") {
    lines.push("Το ραντεβού σας ακυρώθηκε.");
  } else {
    lines.push("Υπάρχει ενημέρωση για το ραντεβού σας.");
  }

  if (type !== "rescheduled") {
    lines.push(`Ημερομηνία & ώρα: ${when}.`);
  }
  lines.push(`Υπηρεσία: ${service}.`);
  if (duration) lines.push(`Διάρκεια: ${duration}.`);
  if (price) lines.push(`Τιμή: ${price}.`);
  if (appt.cabin_id) lines.push(`Καμπίνα: ${appt.cabin_id}.`);

  lines.push(
    "",
    "Aesthée Beauty & Tanning Bar",
    "Λ. Βασιλέως Κωνσταντίνου 77, Αρτέμιδα",
    `Τηλ. ${phone}`,
    site,
    "",
    "Αν χρειάζεστε αλλαγή, επικοινωνήστε μαζί μας."
  );

  return lines.join("\n");
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Aesthée <onboarding@resend.dev>";

  if (!apiKey) {
    return json(res, 503, { error: "Email not configured (RESEND_API_KEY)" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }
  body = body || {};

  const type = String(body.type || "updated");
  const email = String(body.email || "").trim();
  const appointment = body.appointment || {};

  if (!email || !email.includes("@")) {
    return json(res, 400, { error: "Missing guest email" });
  }
  if (!TYPE_SUBJECT[type]) {
    return json(res, 400, { error: "Invalid type" });
  }

  const subject = TYPE_SUBJECT[type];
  const text = buildBody(type, appointment, {
    previousDate: body.previousDate,
    previousTime: body.previousTime,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(res, 502, { error: data.message || "Resend failed", details: data });
    }
    return json(res, 200, { ok: true, id: data.id || null });
  } catch (error) {
    return json(res, 500, { error: error.message || "Send failed" });
  }
};
