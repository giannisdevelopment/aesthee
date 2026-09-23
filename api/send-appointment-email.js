/**
 * Vercel serverless: send appointment emails via Resend.
 *
 * Env (Vercel project):
 *   RESEND_API_KEY   — required
 *   EMAIL_FROM       — e.g. "Aesthée <info@aesthee.gr>" (verified domain)
 *   SITE_URL         — optional, default https://aesthee.gr
 */

const SITE = () => (process.env.SITE_URL || "https://aesthee.gr").replace(/\/$/, "");

const BRAND = {
  name: "Aesthée",
  fullName: "Aesthée Beauty & Tanning Bar",
  tagline: "When science meets beauty.",
  address: "Λεωφ. Βραυρώνος 45, Αρτέμιδα 190 16",
  phone: "2294 152510",
  phoneAlt: "2294 080026",
  phoneHref: "+302294152510",
  email: "info@aesthee.gr",
  maps: "https://share.google/XnyMbfBsML6BrGBiT",
  instagram: "https://www.instagram.com/aesthee_beautyandtan/",
  cream: "#f6f0e6",
  creamDeep: "#ebe2d2",
  ivory: "#fbf7f0",
  gold: "#c4a36a",
  goldDeep: "#9a7b4a",
  ink: "#2c241c",
  inkMuted: "#6b5e50",
  inkDim: "#9a8b7a",
};

const TYPE_META = {
  created: {
    subject: "Το ραντεβού σας καταχωρήθηκε — Aesthée",
    eyebrow: "Νέο ραντεβού",
    title: "Το ραντεβού σας καταχωρήθηκε",
    lead: "Σας ευχαριστούμε. Κρατήσαμε τη θέση σας και θα σας περιμένουμε.",
  },
  confirmed: {
    subject: "Το ραντεβού σας επιβεβαιώθηκε — Aesthée",
    eyebrow: "Επιβεβαίωση",
    title: "Το ραντεβού σας επιβεβαιώθηκε",
    lead: "Όλα έτοιμα. Σας περιμένουμε στην ώρα σας.",
  },
  rescheduled: {
    subject: "Αλλαγή ώρας ραντεβού — Aesthée",
    eyebrow: "Αλλαγή ώρας",
    title: "Η ώρα του ραντεβού άλλαξε",
    lead: "Ενημερώσαμε τα στοιχεία του ραντεβού σας. Παρακαλούμε ελέγξτε τη νέα ώρα.",
  },
  cancelled: {
    subject: "Ακύρωση ραντεβού — Aesthée",
    eyebrow: "Ακύρωση",
    title: "Το ραντεβού ακυρώθηκε",
    lead: "Το ραντεβού σας ακυρώθηκε. Αν θέλετε νέα ημερομηνία, είμαστε στη διάθεσή σας.",
  },
  updated: {
    subject: "Ενημέρωση ραντεβού — Aesthée",
    eyebrow: "Ενημέρωση",
    title: "Ενημέρωση για το ραντεβού σας",
    lead: "Υπάρχει αλλαγή στα στοιχεία του ραντεβού σας.",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

function formatDuration(minutes) {
  const n = Number(minutes);
  if (!n || n < 1) return null;
  if (n < 60) return `${n} λεπτά`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (!m) return h === 1 ? "1 ώρα" : `${h} ώρες`;
  return `${h}ώ ${m}′`;
}

function firstName(fullName) {
  const raw = String(fullName || "").trim();
  if (!raw) return null;
  return raw.split(/\s+/)[0];
}

function detailRows(appt, extra = {}, type) {
  const rows = [];
  if (type === "rescheduled" && (extra.previousDate || extra.previousTime)) {
    rows.push({
      label: "Προηγουμένως",
      value: `${formatDateEl(extra.previousDate || appt.appointment_date)} · ${formatTime(extra.previousTime || "")}`,
      muted: true,
    });
    rows.push({
      label: "Νέα ώρα",
      value: `${formatDateEl(appt.appointment_date)} · ${formatTime(appt.appointment_time)}`,
      emphasize: true,
    });
  } else {
    rows.push({
      label: "Ημερομηνία",
      value: formatDateEl(appt.appointment_date),
    });
    rows.push({
      label: "Ώρα",
      value: formatTime(appt.appointment_time),
    });
  }
  rows.push({ label: "Υπηρεσία", value: appt.service || "Θεραπεία" });
  const duration = formatDuration(appt.duration_minutes);
  if (duration) rows.push({ label: "Διάρκεια", value: duration });
  const price = formatPrice(appt.price_cents);
  if (price) rows.push({ label: "Τιμή", value: price });
  return rows;
}

function buildText(type, appt, extra = {}) {
  const meta = TYPE_META[type] || TYPE_META.updated;
  const greet = firstName(appt.guest_name);
  const site = SITE();
  const lines = [
    greet ? `Γεια σας ${greet},` : "Γεια σας,",
    "",
    meta.title + ".",
    meta.lead,
    "",
  ];

  for (const row of detailRows(appt, extra, type)) {
    lines.push(`${row.label}: ${row.value}`);
  }

  lines.push(
    "",
    BRAND.fullName,
    BRAND.address,
    `Τηλ. ${BRAND.phone} · ${BRAND.phoneAlt}`,
    BRAND.email,
    site,
    "",
    "Για οποιαδήποτε αλλαγή, γράψτε στο info@aesthee.gr ή καλέστε μας."
  );

  return lines.join("\n");
}

function buildHtml(type, appt, extra = {}) {
  const meta = TYPE_META[type] || TYPE_META.updated;
  const site = SITE();
  const greet = firstName(appt.guest_name);
  const rows = detailRows(appt, extra, type);

  const rowsHtml = rows
    .map((row, i) => {
      const border = i === rows.length - 1 ? "none" : `1px solid ${BRAND.creamDeep}`;
      const valueColor = row.emphasize ? BRAND.goldDeep : BRAND.ink;
      const valueWeight = row.emphasize ? "600" : "500";
      const valueOpacity = row.muted ? "0.72" : "1";
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:${border};vertical-align:top;width:38%;">
            <span style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.inkDim};font-weight:600;">
              ${escapeHtml(row.label)}
            </span>
          </td>
          <td style="padding:14px 0;border-bottom:${border};vertical-align:top;text-align:right;">
            <span style="font-size:15px;line-height:1.45;color:${valueColor};font-weight:${valueWeight};opacity:${valueOpacity};">
              ${escapeHtml(row.value)}
            </span>
          </td>
        </tr>`;
    })
    .join("");

  const greeting = greet
    ? `Γεια σας <strong style="font-weight:600;color:${BRAND.ink};">${escapeHtml(greet)}</strong>,`
    : "Γεια σας,";

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(meta.subject)}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};color:${BRAND.ink};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(meta.lead)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.cream};">
    <tr>
      <td align="center" style="padding:36px 16px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;">

          <!-- Brand (text mark — SVGs often blocked in mail clients) -->
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <a href="${escapeHtml(site)}" style="text-decoration:none;color:${BRAND.ink};">
                <span style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:10px;background:${BRAND.gold};color:${BRAND.ivory};font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:20px;font-weight:700;">é</span>
                <div style="margin-top:12px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;letter-spacing:0.04em;color:${BRAND.ink};">
                  Aesthée
                </div>
                <div style="margin-top:4px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.inkDim};">
                  Beauty &amp; Tanning Bar
                </div>
              </a>
              <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;color:${BRAND.goldDeep};letter-spacing:0.02em;">
                ${escapeHtml(BRAND.tagline)}
              </p>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${BRAND.ivory};border:1px solid ${BRAND.creamDeep};border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(44,36,28,0.04);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,${BRAND.goldDeep},${BRAND.gold},${BRAND.goldDeep});font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:36px 32px 28px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${BRAND.goldDeep};font-weight:600;">
                      ${escapeHtml(meta.eyebrow)}
                    </p>
                    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-weight:600;font-size:28px;line-height:1.25;color:${BRAND.ink};letter-spacing:-0.02em;">
                      ${escapeHtml(meta.title)}
                    </h1>
                    <p style="margin:0 0 8px;font-size:16px;line-height:1.55;color:${BRAND.inkMuted};">
                      ${greeting}
                    </p>
                    <p style="margin:0;font-size:16px;line-height:1.55;color:${BRAND.inkMuted};">
                      ${escapeHtml(meta.lead)}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${BRAND.creamDeep};">
                      ${rowsHtml}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 32px 36px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" align="center">
                    ${
                      type === "cancelled"
                        ? `<a href="${escapeHtml(site)}/booking.html" style="display:inline-block;padding:14px 28px;background:${BRAND.gold};color:${BRAND.ink};text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.04em;border-radius:999px;">Κλείστε νέο ραντεβού</a>`
                        : `<a href="${escapeHtml(site)}/location.html" style="display:inline-block;padding:14px 28px;background:${BRAND.gold};color:${BRAND.ink};text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.04em;border-radius:999px;">Πώς θα έρθετε</a>`
                    }
                    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${BRAND.inkDim};">
                      Χρειάζεστε αλλαγή; Γράψτε μας στο
                      <a href="mailto:${BRAND.email}" style="color:${BRAND.goldDeep};text-decoration:none;font-weight:600;">${BRAND.email}</a>
                      ή καλέστε
                      <a href="tel:${BRAND.phoneHref}" style="color:${BRAND.goldDeep};text-decoration:none;font-weight:600;">${BRAND.phone}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 12px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:${BRAND.ink};">
                ${escapeHtml(BRAND.fullName)}
              </p>
              <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:${BRAND.inkMuted};">
                <a href="${escapeHtml(BRAND.maps)}" style="color:${BRAND.inkMuted};text-decoration:none;">${escapeHtml(BRAND.address)}</a>
              </p>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${BRAND.inkMuted};">
                <a href="mailto:${BRAND.email}" style="color:${BRAND.goldDeep};text-decoration:none;">${BRAND.email}</a>
                <br />
                <a href="tel:${BRAND.phoneHref}" style="color:${BRAND.goldDeep};text-decoration:none;">${BRAND.phone}</a>
                &nbsp;·&nbsp;
                <a href="tel:+302294080026" style="color:${BRAND.goldDeep};text-decoration:none;">${BRAND.phoneAlt}</a>
              </p>
              <p style="margin:0;font-size:12px;">
                <a href="${escapeHtml(site)}" style="color:${BRAND.inkDim};text-decoration:none;margin:0 8px;">aesthee.gr</a>
                <a href="${escapeHtml(BRAND.instagram)}" style="color:${BRAND.inkDim};text-decoration:none;margin:0 8px;">Instagram</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
  const from = process.env.EMAIL_FROM || "Aesthée <info@aesthee.gr>";

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
  if (!TYPE_META[type]) {
    return json(res, 400, { error: "Invalid type" });
  }

  const extra = {
    previousDate: body.previousDate,
    previousTime: body.previousTime,
  };
  const subject = TYPE_META[type].subject;
  const text = buildText(type, appointment, extra);
  const html = buildHtml(type, appointment, extra);

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
        reply_to: BRAND.email,
        subject,
        text,
        html,
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
