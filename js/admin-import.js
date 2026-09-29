import {
  requireSession,
  signIn,
  signOut,
  getSupabase,
  showToast,
  mapAuthError,
  isSupabaseConfigured,
} from "./admin-api.js";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const signOutBtn = document.getElementById("signOutBtn");
const configBanner = document.getElementById("configBanner");
const clientsFile = document.getElementById("clientsFile");
const bookingsFile = document.getElementById("bookingsFile");
const startImportBtn = document.getElementById("startImportBtn");
const importProgress = document.getElementById("importProgress");
const importBarFill = document.getElementById("importBarFill");
const importStatus = document.getElementById("importStatus");
const importLog = document.getElementById("importLog");

const BATCH = 80;

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  if (!isSupabaseConfigured()) configBanner?.classList.remove("hidden");
}

function log(msg) {
  importLog.hidden = false;
  importLog.textContent += `${msg}\n`;
  importLog.scrollTop = importLog.scrollHeight;
}

function setProgress(pct, status) {
  importProgress.hidden = false;
  importBarFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  importStatus.textContent = status;
}

function normName(n) {
  return String(n || "")
    .trim()
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/[^a-zα-ωάέήίόύώϊϋΐΰ0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normPhone(p) {
  if (!p) return null;
  let s = String(p).replace(/[^\d+]/g, "");
  if (s.startsWith("+30")) s = s.slice(3);
  else if (s.startsWith("0030")) s = s.slice(4);
  s = s.replace(/\D/g, "");
  if (s.startsWith("30") && s.length > 10) s = s.slice(2);
  return s.length >= 8 ? s : null;
}

function syntheticPhone(name) {
  let h = 0;
  const key = normName(name);
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `000${String(h).padStart(7, "0")}`.slice(0, 10);
}

function parseEuro(s) {
  if (!s) return null;
  const n = Number(String(s).replace("€", "").replace(",", ".").replace(/\s+/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDt(s) {
  const raw = String(s || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, hh = "12", mm = "00"] = m;
  return {
    date: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    time: `${String(hh).padStart(2, "0")}:${mm}`,
  };
}

function mapStatus(st) {
  const s = String(st || "").trim();
  if (s.startsWith("Ολοκληρώθηκε")) return "completed";
  if (s.startsWith("Επιβεβαιώθηκε")) return "confirmed";
  if (s.startsWith("Ακυρώθηκε")) return "cancelled";
  if (s.startsWith("Μη εμφάνιση")) return "no_show";
  return "pending";
}

function mapCabin(emp) {
  const e = String(emp || "").toUpperCase();
  if (e.includes("ΚΑΜΠΙΝΑ 2")) return 2;
  if (e.includes("ΚΑΜΠΙΝΑ 1")) return 1;
  return null;
}

/** Minimal CSV parser (handles quotes + newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || (ch === "\r" && src[i + 1] === "\n")) {
      if (ch === "\r") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => String(c || "").trim())).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    return obj;
  });
}

async function insertBatches(table, rows, onBatch) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await getSupabase().from(table).insert(chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += chunk.length;
    if (onBatch) onBatch(inserted, rows.length);
  }
  return inserted;
}

async function loadPhoneIdMap() {
  const map = new Map();
  const names = new Set();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await getSupabase()
      .from("clients")
      .select("id, phone, full_name, email")
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const phone = normPhone(row.phone);
      if (phone) map.set(phone, row.id);
      if (row.full_name) names.add(normName(row.full_name));
      const email = String(row.email || "").trim().toLowerCase();
      if (email) map.set(`email:${email}`, row.id);
    }
    if (data.length < page) break;
    from += page;
  }
  return { phoneMap: map, existingNames: names };
}

async function loadExistingFingerprints(table, prefix) {
  const set = new Set();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await getSupabase()
      .from(table)
      .select("notes")
      .like("notes", `%${prefix}%`)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const m = String(row.notes || "").match(new RegExp(`${prefix}[^\\s]+`, "g"));
      if (m) m.forEach((x) => set.add(x));
    }
    if (data.length < page) break;
    from += page;
  }
  return set;
}

function prepareClients(rows) {
  const byPhone = new Map();
  const noPhone = [];
  for (const r of rows) {
    let name = String(r["όνομα"] || "").trim();
    if (!name) {
      name = `${String(r["Όνομα"] || "").trim()} ${String(r["Επώνυμο"] || "").trim()}`.trim();
    }
    name = name.replace(/\s+/g, " ");
    if (!name) continue;
    const phone = normPhone(r["τηλέφωνο"]);
    const email = String(r.email || "").trim().toLowerCase() || null;
    const notesRaw = String(r["σημειώσεις"] || "").trim();
    const gender = String(r["φύλο"] || "").trim();
    const optin = String(r["Κατάσταση opt in"] || "").trim();
    const bookings = String(r["αριθμός κρατήσεων"] || "").trim() || "0";
    const created = String(r["ώρα και μέρα δημιουργίας"] || "").trim();
    const meta = [];
    if (gender) meta.push(`φύλο: ${gender}`);
    if (bookings !== "0") meta.push(`κρατήσεις Treatwell: ${bookings}`);
    if (created) meta.push(`δημιουργία Treatwell: ${created}`);
    if (optin) meta.push(`opt-in: ${optin}`);
    const parts = [];
    if (notesRaw) parts.push(notesRaw);
    if (meta.length) parts.push(`[Treatwell] ${meta.join(" · ")}`);
    const notes = parts.length ? parts.join("\n\n") : null;
    const bcount = Number(bookings) || 0;
    const score = bcount * 10 + (notesRaw ? notesRaw.length : 0) + (email ? 5 : 0);
    const rec = { full_name: name, phone, email, notes, score };
    if (!phone) {
      noPhone.push(rec);
      continue;
    }
    const prev = byPhone.get(phone);
    if (!prev || score > prev.score) byPhone.set(phone, rec);
    else if (notes && (!prev.notes || !prev.notes.includes(notes))) {
      prev.notes = prev.notes ? `${prev.notes}\n\n${notes}` : notes;
    }
  }
  return [...byPhone.values(), ...noPhone].map(({ full_name, phone, email, notes }) => ({
    full_name,
    phone,
    email,
    notes,
  }));
}

function prepareBookings(rows, phoneByName) {
  const unique = new Map();
  const extras = new Map();

  for (const r of rows) {
    let name = String(r["Πελάτης"] || "").trim();
    if (!name) continue;
    const dt = parseDt(r["Ημερομηνία ραντεβού"]);
    if (!dt) continue;
    const service = String(r["Υπηρεσία"] || "").trim() || "Υπηρεσία";
    const status = mapStatus(r.Status);
    const amount = parseEuro(r["Αξία"]);
    const cabin = mapCabin(r["Υπάλληλος"]);
    const orderNo = String(r["Αριθμός παραγγελίας #"] || "").trim();
    let key = normName(name);
    let phone = phoneByName.get(key)?.phone || null;
    let email = phoneByName.get(key)?.email || null;
    let fullName = phoneByName.get(key)?.full_name || name;

    if (key === "walk-in" || key.startsWith("walk")) {
      fullName = "Walk-in";
      phone = "0000000001";
      key = "walk-in";
      extras.set(key, { full_name: fullName, phone, email: null, notes: "Treatwell Walk-in" });
    } else if (!phone) {
      phone = syntheticPhone(name);
      extras.set(key, {
        full_name: fullName,
        phone,
        email,
        notes: "Δημιουργήθηκε από Treatwell bookings import",
      });
    }

    const fingerprint = `${dt.date}|${dt.time}|${normName(fullName)}|${normName(service)}|${status}|${amount || 0}`;
    if (unique.has(fingerprint)) continue;
    unique.set(fingerprint, {
      full_name: fullName,
      phone,
      email,
      service,
      appointment_date: dt.date,
      appointment_time: dt.time,
      status,
      price_cents: amount != null ? Math.round(amount * 100) : null,
      payment_amount: amount,
      cabin_id: cabin,
      fingerprint,
      notes: `Treatwell import${orderNo ? ` · παραγγελία ${orderNo}` : ""}`,
    });
  }

  return { bookings: [...unique.values()], extras: [...extras.values()] };
}

function buildNamePhoneIndex(clientRows) {
  const map = new Map();
  for (const r of clientRows) {
    let name = String(r["όνομα"] || "").trim();
    if (!name) {
      name = `${String(r["Όνομα"] || "").trim()} ${String(r["Επώνυμο"] || "").trim()}`.trim();
    }
    if (!name) continue;
    const phone = normPhone(r["τηλέφωνο"]);
    const email = String(r.email || "").trim().toLowerCase() || null;
    const rec = { full_name: name, phone, email };
    const key = normName(name);
    if (!map.has(key)) map.set(key, rec);
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      const swapped = [parts[parts.length - 1], ...parts.slice(0, -1)].join(" ");
      const sk = normName(swapped);
      if (!map.has(sk)) map.set(sk, rec);
    }
  }
  return map;
}

function detectCsvKind(rows) {
  if (!rows?.length) return "unknown";
  const keys = Object.keys(rows[0]).join("|").toLowerCase();
  if (keys.includes("ημερομηνία ραντεβού") || keys.includes("υπηρεσία") || keys.includes("status")) {
    return "bookings";
  }
  if (keys.includes("τηλέφωνο") || keys.includes("επώνυμο") || keys.includes("όνομα")) {
    return "clients";
  }
  return "unknown";
}

function resolveCsvPair(fileA, textA, fileB, textB) {
  const rowsA = parseCsv(textA);
  const rowsB = parseCsv(textB);
  const kindA = detectCsvKind(rowsA);
  const kindB = detectCsvKind(rowsB);

  if (kindA === "clients" && kindB === "bookings") {
    return { clientRows: rowsA, bookingRows: rowsB, swapped: false, names: [fileA.name, fileB.name] };
  }
  if (kindA === "bookings" && kindB === "clients") {
    return { clientRows: rowsB, bookingRows: rowsA, swapped: true, names: [fileB.name, fileA.name] };
  }
  throw new Error(
    "Δεν αναγνώρισα τα CSV. Βεβαιώσου ότι είναι η εξαγωγή πελατών + το bookings.csv από το Treatwell.",
  );
}

async function runImport() {
  const cFile = clientsFile.files?.[0];
  const bFile = bookingsFile.files?.[0];
  if (!cFile || !bFile) {
    showToast("Διάλεξε και τα δύο CSV αρχεία.", true);
    return;
  }

  startImportBtn.disabled = true;
  importLog.textContent = "";
  importLog.hidden = false;
  setProgress(2, "Διάβασμα αρχείων…");

  try {
    const [cText, bText] = await Promise.all([cFile.text(), bFile.text()]);
    const resolved = resolveCsvPair(cFile, cText, bFile, bText);
    const { clientRows, bookingRows, swapped } = resolved;
    if (swapped) {
      log("⚠ Τα αρχεία ήταν ανάποδα — τα έβαλα στη σωστή σειρά αυτόματα.");
    }
    log(`Πελάτες CSV: ${clientRows.length} γραμμές (${resolved.names[0]})`);
    log(`Κρατήσεις CSV: ${bookingRows.length} γραμμές (${resolved.names[1]})`);

    setProgress(8, "Προετοιμασία πελατών…");
    const clients = prepareClients(clientRows);
    const nameIndex = buildNamePhoneIndex(clientRows);
    const { bookings, extras } = prepareBookings(bookingRows, nameIndex);
    log(`Μοναδικοί πελάτες από CSV: ${clients.length}`);
    log(`Έξτρα ονόματα μόνο από κρατήσεις: ${extras.length}`);
    log(`Μοναδικές κρατήσεις: ${bookings.length}`);

    setProgress(12, "Έλεγχος υπάρχοντων πελατών (χωρίς διπλότυπα)…");
    let { phoneMap, existingNames } = await loadPhoneIdMap();
    log(`Ήδη στη βάση: ${phoneMap.size} τηλέφωνα / ${existingNames.size} ονόματα`);

    const candidates = [...clients, ...extras];
    let skippedExisting = 0;
    const seen = new Set();
    const clientsToInsert = [];
    for (const c of candidates) {
      const phone = normPhone(c.phone);
      const email = String(c.email || "").trim().toLowerCase();
      const nameKey = normName(c.full_name);

      if (phone && phoneMap.has(phone)) {
        skippedExisting += 1;
        continue;
      }
      if (email && phoneMap.has(`email:${email}`)) {
        skippedExisting += 1;
        continue;
      }
      // No phone: skip if same name already exists (avoids duplicate blank-phone rows)
      if (!phone && nameKey && existingNames.has(nameKey)) {
        skippedExisting += 1;
        continue;
      }

      const dedupeKey = phone || (email ? `email:${email}` : `name:${nameKey}`);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      clientsToInsert.push({
        full_name: c.full_name,
        phone: c.phone,
        email: c.email,
        notes: c.notes,
      });
    }

    log(`Παραλείφθηκαν (ήδη υπάρχουν): ${skippedExisting}`);
    setProgress(18, `Εισαγωγή ${clientsToInsert.length} νέων πελατών…`);
    if (clientsToInsert.length) {
      await insertBatches("clients", clientsToInsert, (n, total) => {
        setProgress(18 + (n / Math.max(total, 1)) * 20, `Πελάτες ${n}/${total}`);
      });
    }
    log(`Νέοι πελάτες που μπήκαν: ${clientsToInsert.length}`);

    ({ phoneMap, existingNames } = await loadPhoneIdMap());
    // phoneMap now includes email: keys — appointments need phone->id only
    const idByPhone = new Map();
    for (const [k, id] of phoneMap.entries()) {
      if (!String(k).startsWith("email:")) idByPhone.set(k, id);
    }

    setProgress(42, "Έλεγχος υπάρχοντων επισκέψεων…");
    const visitFp = await loadExistingFingerprints("visits", "twv:");
    const visits = [];
    for (const b of bookings) {
      if (b.status !== "completed" || !b.payment_amount) continue;
      const fp = `twv:${b.fingerprint}`;
      if (visitFp.has(fp)) continue;
      const clientId = idByPhone.get(normPhone(b.phone));
      if (!clientId) continue;
      visits.push({
        client_id: clientId,
        treatment: b.service,
        payment_amount: b.payment_amount,
        payment_date: b.appointment_date,
        notes: `${b.notes} · ${fp}`,
      });
    }

    setProgress(48, `Εισαγωγή ${visits.length} επισκέψεων (ταμείο)…`);
    if (visits.length) {
      await insertBatches("visits", visits, (n, total) => {
        setProgress(48 + (n / Math.max(total, 1)) * 20, `Επισκέψεις ${n}/${total}`);
      });
    }
    log(`Νέες επισκέψεις: ${visits.length} (παραλείφθηκαν ήδη εισαγμένες: ${visitFp.size})`);

    setProgress(70, "Έλεγχος υπάρχοντων ραντεβού…");
    const apptFp = await loadExistingFingerprints("appointments", "twa:");
    const appts = [];
    for (const b of bookings) {
      const fp = `twa:${b.fingerprint}`;
      if (apptFp.has(fp)) continue;
      appts.push({
        service: b.service,
        appointment_date: b.appointment_date,
        appointment_time: b.appointment_time,
        duration_minutes: 60,
        price_cents: b.price_cents,
        guest_name: b.full_name,
        guest_phone: b.phone,
        guest_email: b.email,
        status: b.status,
        notes: `${b.notes} · ${fp}`,
        cabin_id: b.cabin_id,
        client_id: idByPhone.get(normPhone(b.phone)) || null,
      });
    }

    setProgress(75, `Εισαγωγή ${appts.length} ραντεβού…`);
    if (appts.length) {
      await insertBatches("appointments", appts, (n, total) => {
        setProgress(75 + (n / Math.max(total, 1)) * 22, `Ραντεβού ${n}/${total}`);
      });
    }
    log(`Νέα ραντεβού: ${appts.length} (παραλείφθηκαν ήδη εισαγμένα: ${apptFp.size})`);

    setProgress(100, "Ολοκληρώθηκε");
    log("Έτοιμο. Άνοιξε Πελάτες / Ταμείο / Ραντεβού για έλεγχο.");
    showToast("Η εισαγωγή Treatwell ολοκληρώθηκε.");
  } catch (error) {
    console.error(error);
    log(`Σφάλμα: ${error.message || error}`);
    setProgress(0, "Αποτυχία");
    showToast(error.message || "Αποτυχία εισαγωγής", true);
  } finally {
    startImportBtn.disabled = false;
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { error } = await signIn(loginForm.email.value, loginForm.password.value);
  if (error) {
    showToast(mapAuthError(error), true);
    return;
  }
  showApp();
});

signOutBtn?.addEventListener("click", async () => {
  await signOut();
  showLogin();
});

startImportBtn?.addEventListener("click", () => runImport());

if (!isSupabaseConfigured()) {
  showLogin();
} else {
  requireSession().then((session) => {
    if (!session) showLogin();
    else showApp();
  });
}
