/** Bookable services: duration in minutes, price in euro cents. */
export const BOOKING_DAY_START = 10 * 60; // 10:00
export const BOOKING_DAY_END = 21 * 60; // 21:00
export const SLOT_STEP_MINUTES = 15;

/** @typedef {{ id: string, name: string, durationMin: number, priceCents: number, priceFrom?: boolean }} BookingService */
/** @typedef {{ id: string, label: string, services: BookingService[] }} BookingCategory */

/** @type {BookingCategory[]} */
export const BOOKING_CATEGORIES = [
  {
    id: "brows",
    label: "Περιποίηση φρυδιών",
    services: [
      { id: "brow-shape", name: "Σχηματισμός φρυδιών", durationMin: 15, priceCents: 1000 },
      { id: "brow-shape-tint", name: "Σχηματισμός & βαφή", durationMin: 30, priceCents: 2500 },
      { id: "brow-lamination", name: "Brow Lamination", durationMin: 30, priceCents: 2500 },
      { id: "brow-lamination-tint", name: "Brow Lamination & Tint", durationMin: 45, priceCents: 3500 },
    ],
  },
  {
    id: "lashes",
    label: "Βλεφαρίδες",
    services: [
      { id: "lash-lift-keratin", name: "Lash Lift & Keratin Treatment", durationMin: 45, priceCents: 3500 },
      { id: "lash-lift-tint", name: "Lash Lift & Tint", durationMin: 60, priceCents: 3500 },
      { id: "lash-ext-classic", name: "Extensions βλεφαρίδων — τοποθέτηση one by one", durationMin: 120, priceCents: 5000 },
      { id: "lash-maint-classic", name: "Extension βλεφαρίδων — συντήρηση one by one", durationMin: 90, priceCents: 2500 },
      { id: "lash-ext-volume", name: "Extensions βλεφαρίδων — τοποθέτηση volume (3D)", durationMin: 120, priceCents: 6000 },
      { id: "lash-maint-volume", name: "Extension βλεφαρίδων — συντήρηση volume (3D)", durationMin: 90, priceCents: 3500 },
      { id: "lash-ext-mix", name: "Extensions βλεφαρίδων — τοποθέτηση mix (3D & one by one)", durationMin: 120, priceCents: 5500 },
      { id: "lash-maint-mix", name: "Extension βλεφαρίδων — συντήρηση mix (3D & one by one)", durationMin: 90, priceCents: 3000 },
    ],
  },
  {
    id: "electrolysis",
    label: "Ριζική αποτρίχωση με βελόνα",
    services: [
      { id: "elec-10", name: "Ριζική αποτρίχωση — 10′", durationMin: 10, priceCents: 1500 },
      { id: "elec-15", name: "Ριζική αποτρίχωση — 15′", durationMin: 15, priceCents: 2000 },
      { id: "elec-20", name: "Ριζική αποτρίχωση — 20′", durationMin: 20, priceCents: 2500 },
    ],
  },
  {
    id: "face",
    label: "Θεραπείες προσώπου",
    services: [
      { id: "hydra-cleanse", name: "Καθαρισμός προσώπου HydraFacial", durationMin: 90, priceCents: 6000 },
      { id: "dermapen-acne", name: "Θεραπεία προσώπου Dermapen για ουλές ακμής", durationMin: 60, priceCents: 6000 },
      { id: "dermapen-face-neck", name: "Θεραπεία Dermapen πρόσωπο & λαιμό", durationMin: 90, priceCents: 8000 },
      { id: "dermapen-full", name: "Θεραπεία Dermapen πρόσωπο & λαιμό & ντεκολτέ", durationMin: 120, priceCents: 10000 },
      { id: "hifu-face", name: "HIFU προσώπου", durationMin: 60, priceCents: 20000 },
      { id: "deep-acids", name: "Βαθύς καθαρισμός & οξέα φρούτων", durationMin: 90, priceCents: 8000 },
      { id: "glow-whitening", name: "Glow & whitening treatment", durationMin: 45, priceCents: 3500 },
      { id: "acne-oil", name: "Θεραπεία ακμής & λιπαρότητας", durationMin: 45, priceCents: 3500 },
      { id: "meso-dermapen", name: "Μεσοθεραπεία προσώπου με Dermapen", durationMin: 75, priceCents: 6000 },
      { id: "diamond-derm", name: "Δερμοαπόξεση με διαμάντι", durationMin: 90, priceCents: 6000 },
      { id: "hydrafacial", name: "HydraFacial", durationMin: 90, priceCents: 6000 },
      { id: "hydrafacial-diamond", name: "HydraFacial + διαμάντι", durationMin: 120, priceCents: 9000 },
      { id: "clean-14", name: "Καθαρισμός με 14 κεφαλές", durationMin: 120, priceCents: 11000 },
      { id: "herbal-peel", name: "Φυτικό peeling", durationMin: 60, priceCents: 12000 },
      { id: "chem-peel", name: "Χημικό peeling προσώπου", durationMin: 60, priceCents: 9000 },
      { id: "spot-removal", name: "Αφαίρεση πανάδας", durationMin: 45, priceCents: 6000, priceFrom: true },
      { id: "carbon-peel", name: "Carbon Peel Laser", durationMin: 45, priceCents: 7000 },
      { id: "tattoo-face", name: "Αφαίρεση tattoo (φρύδια–χείλη–eye liner)", durationMin: 45, priceCents: 8000 },
      { id: "tattoo-body", name: "Αφαίρεση tattoo σώματος", durationMin: 60, priceCents: 8000, priceFrom: true },
      { id: "micro-dose", name: "Micro Dose", durationMin: 60, priceCents: 6500 },
      { id: "rf-face", name: "RF Microneedling προσώπου", durationMin: 60, priceCents: 9000 },
      { id: "deep-cleanse", name: "Βαθύς καθαρισμός προσώπου", durationMin: 60, priceCents: 5000 },
      { id: "hydroderm", name: "Υδροδερμοαπόξεση", durationMin: 60, priceCents: 5500 },
      { id: "photo", name: "Φωτοθεραπεία", durationMin: 30, priceCents: 4000 },
      { id: "meso", name: "Μεσοθεραπεία", durationMin: 45, priceCents: 5500 },
      { id: "radio", name: "Ραδιοσυχνότητες", durationMin: 45, priceCents: 5000 },
      { id: "vit-c", name: "Θεραπεία βιταμίνης C", durationMin: 45, priceCents: 4500 },
      { id: "hyaluronic", name: "Θεραπεία υαλουρονικού οξέος (μη ενέσιμη)", durationMin: 45, priceCents: 5500 },
      { id: "whitening", name: "Θεραπεία λεύκανσης", durationMin: 45, priceCents: 5000 },
      { id: "exosomes", name: "Θεραπεία εξωσωμάτων (μη ενέσιμη)", durationMin: 60, priceCents: 9000 },
      { id: "pdrn", name: "Θεραπεία PDRN (μη ενέσιμη)", durationMin: 60, priceCents: 9000 },
    ],
  },
  {
    id: "laser-women",
    label: "Αποτρίχωση Laser — Γυναίκες",
    services: [
      { id: "lw-full-body", name: "Laser Γυναίκες — Full Body", durationMin: 60, priceCents: 14000 },
      { id: "lw-full-legs", name: "Laser Γυναίκες — Full πόδια", durationMin: 30, priceCents: 10000 },
      { id: "lw-full-bikini", name: "Laser Γυναίκες — Full bikini", durationMin: 15, priceCents: 5000 },
      { id: "lw-underarms", name: "Laser Γυναίκες — Μασχάλες", durationMin: 10, priceCents: 3000 },
      { id: "lw-arms", name: "Laser Γυναίκες — Χέρια", durationMin: 15, priceCents: 4000 },
      { id: "lw-nipples", name: "Laser Γυναίκες — Θηλές", durationMin: 5, priceCents: 1000 },
      { id: "lw-full-face", name: "Laser Γυναίκες — Full πρόσωπο", durationMin: 10, priceCents: 4000 },
      { id: "lw-calves-underarms", name: "Laser Γυναίκες — Γάμπες & μασχάλες", durationMin: 30, priceCents: 7000 },
      { id: "lw-mustache-chin", name: "Laser Γυναίκες — Μουστάκι + πηγούνι", durationMin: 10, priceCents: 2500 },
      { id: "lw-cheeks", name: "Laser Γυναίκες — Παρείες", durationMin: 10, priceCents: 2000 },
      { id: "lw-belly-line", name: "Laser Γυναίκες — Γραμμή κοιλιάς", durationMin: 10, priceCents: 2000 },
      { id: "lw-full-10", name: "Laser Full Body — 10 συνεδρίες", durationMin: 60, priceCents: 115000 },
      { id: "lw-full-6", name: "Laser Full Body — 6 συνεδρίες", durationMin: 60, priceCents: 69000 },
      { id: "lw-bikini-under-6", name: "Laser Full Bikini + Armpits — 6 συνεδρίες", durationMin: 20, priceCents: 30000 },
      { id: "lw-bikini-under-10", name: "Laser Full Bikini + Armpits — 10 συνεδρίες", durationMin: 20, priceCents: 50000 },
    ],
  },
  {
    id: "laser-men",
    label: "Αποτρίχωση Laser — Άντρες",
    services: [
      { id: "lm-full-body", name: "Laser Άντρες — Full Body", durationMin: 120, priceCents: 23000 },
      { id: "lm-back", name: "Laser Άντρες — Πλάτη", durationMin: 20, priceCents: 7000 },
      { id: "lm-waist", name: "Laser Άντρες — Μέση", durationMin: 10, priceCents: 4000 },
      { id: "lm-belly", name: "Laser Άντρες — Κοιλιά", durationMin: 15, priceCents: 6000 },
      { id: "lm-chest", name: "Laser Άντρες — Στήθος", durationMin: 15, priceCents: 6000 },
      { id: "lm-nape", name: "Laser Άντρες — Αυχένας", durationMin: 10, priceCents: 2500 },
      { id: "lm-full-legs", name: "Laser Άντρες — Full πόδια", durationMin: 40, priceCents: 14000 },
      { id: "lm-shoulders", name: "Laser Άντρες — Ώμοι", durationMin: 15, priceCents: 3000 },
      { id: "lm-cheekbones", name: "Laser Άντρες — Ζυγωματικά", durationMin: 10, priceCents: 1500 },
      { id: "lm-belly-chest-back-waist", name: "Laser Άντρες — Κοιλιά + στήθος + πλάτη + μέση", durationMin: 45, priceCents: 17000 },
      { id: "lm-belly-chest", name: "Laser Άντρες — Κοιλιά + στήθος", durationMin: 30, priceCents: 10000 },
      { id: "lm-back-waist", name: "Laser Άντρες — Πλάτη + μέση", durationMin: 30, priceCents: 10000 },
      { id: "lm-back-waist-shoulders", name: "Laser Άντρες — Πλάτη + μέση + ώμοι", durationMin: 30, priceCents: 12000 },
      { id: "lm-back-shoulders", name: "Laser Άντρες — Πλάτη + ώμοι", durationMin: 20, priceCents: 8000 },
      { id: "lm-ears-nose", name: "Laser Άντρες — Αυτιά + μύτη", durationMin: 10, priceCents: 2000 },
      { id: "lm-chest-back", name: "Laser Άντρες — Στήθος + πλάτη", durationMin: 30, priceCents: 11000 },
      { id: "lm-back-chest-shoulders-waist", name: "Laser Άντρες — Πλάτη + στήθος + ώμοι + μέση", durationMin: 40, priceCents: 16000 },
      { id: "lm-calves", name: "Laser Άντρες — Γάμπες", durationMin: 30, priceCents: 6000 },
      { id: "lm-neck", name: "Laser Άντρες — Λαιμός", durationMin: 10, priceCents: 3000 },
    ],
  },
  {
    id: "body",
    label: "Θεραπείες σώματος",
    services: [
      { id: "vacutherm", name: "Vacutherm Treadmill & Bike", durationMin: 30, priceCents: 3500 },
      { id: "vacutherm-pack", name: "Vacutherm — πακέτο 10+2 δώρο", durationMin: 30, priceCents: 25000 },
      { id: "endospheres", name: "ENDOSPHERES", durationMin: 45, priceCents: 4000 },
      { id: "endospheres-pack", name: "ENDOSPHERES — πακέτο 8+2 δώρο", durationMin: 45, priceCents: 34900 },
      { id: "cavitation", name: "Cavitation", durationMin: 30, priceCents: 2500 },
      { id: "cavitation-pack", name: "Cavitation — πακέτο 10 συνεδριών", durationMin: 30, priceCents: 20000 },
      { id: "vacuum-bbl", name: "Vacuum BBL", durationMin: 30, priceCents: 2000 },
      { id: "vacuum-bbl-pack", name: "Vacuum BBL — πακέτο 10 συνεδριών", durationMin: 30, priceCents: 15000 },
      { id: "presso", name: "Πρεσσοθεραπεία", durationMin: 30, priceCents: 2000 },
      { id: "presso-pack", name: "Πρεσσοθεραπεία — πακέτο 10 συνεδριών", durationMin: 30, priceCents: 15000 },
      { id: "cryo", name: "Κρυολιπόλυση 4 σημείων", durationMin: 60, priceCents: 16000 },
      { id: "cryo-pack", name: "Κρυολιπόλυση 4 σημείων — πακέτο 3 συνεδριών", durationMin: 60, priceCents: 39000 },
      { id: "madero", name: "Μαδεροθεραπεία", durationMin: 35, priceCents: 3000 },
      { id: "madero-pack", name: "Μαδεροθεραπεία — πακέτο 10+2 δώρο", durationMin: 35, priceCents: 25000 },
      { id: "rf-body", name: "RF Microneedling σώματος (έως 3 περιοχές)", durationMin: 60, priceCents: 18000 },
      { id: "rf-body-pack", name: "RF Microneedling σώματος — πακέτο 3 συνεδριών", durationMin: 60, priceCents: 45000 },
      { id: "massage", name: "Μασάζ χαλαρωτικό / αθλητικό / μυοχαλαρωτικό", durationMin: 55, priceCents: 4000 },
      { id: "massage-cupping", name: "Μασάζ βεντούζες", durationMin: 40, priceCents: 4000 },
      { id: "massage-neck-back", name: "Μασάζ αυχένα πλάτη μέση", durationMin: 30, priceCents: 3500 },
      { id: "wax", name: "Αποτρίχωση με κερί", durationMin: 30, priceCents: 2500, priceFrom: true },
    ],
  },
];

/** Deep-link aliases from services.html (?service=…) → catalog id */
const SERVICE_ALIASES = {
  "βαθύς καθαρισμός προσώπου": "deep-cleanse",
  "υδροδερμοαπόξεση": "hydroderm",
  "δερμοαπόξεση με διαμάντι": "diamond-derm",
  "οξέα": "deep-acids",
  "χημικό peeling": "chem-peel",
  "φυτικό peeling": "herbal-peel",
  "φωτοθεραπεία": "photo",
  "μεσοθεραπεία": "meso",
  "ραδιοσυχνότητες": "radio",
  "θεραπεία βιταμίνης c": "vit-c",
  "θεραπεία υαλουρονικού οξέος (μη ενέσιμη)": "hyaluronic",
  "θεραπεία λεύκανσης": "whitening",
  "hifu": "hifu-face",
  "rf microneedling προσώπου": "rf-face",
  "carbon peel": "carbon-peel",
  "θεραπεία εξωσωμάτων (μη ενέσιμη)": "exosomes",
  "θεραπεία pdrn (μη ενέσιμη)": "pdrn",
  "αφαίρεση τατουάζ / ημιμόνιμου μακιγιάζ": "tattoo-face",
  "vacutherm treadmill & bike": "vacutherm",
  "endospheres": "endospheres",
  "cavitation": "cavitation",
  "vacuum bbl": "vacuum-bbl",
  "vacum bbl": "vacuum-bbl",
  "πρεσσοθεραπεία": "presso",
  "κρυολιπόλυση": "cryo",
  "κρυολιπόλυση 4 σημείων": "cryo",
  "rf microneedling": "rf-body",
  "rf microneedling σώματος": "rf-body",
  "rf microneedling σώματος (έως 3 περιοχές)": "rf-body",
  "μαδεροθεραπεία": "madero",
  "μασάζ": "massage",
  "μασάζ χαλαρωτικό / αθλητικό / μυοχαλαρωτικό": "massage",
  "μασάζ βεντούζες": "massage-cupping",
  "μασάζ αυχένα πλάτη μέση": "massage-neck-back",
  "αποτρίχωση με κερί": "wax",
  "brow lamination & tint": "brow-lamination-tint",
  "lash lift & tint": "lash-lift-tint",
  "brow shape": "brow-shape",
  "brow shape & tint": "brow-shape-tint",
  "τοποθέτηση βλεφαρίδων extensions": "lash-ext-classic",
  "συντήρηση βλεφαρίδων extensions": "lash-maint-classic",
  "laser αποτρίχωση — διοδικό": "lw-full-body",
  "laser αποτρίχωση — αλεξανδρίτης": "lw-full-body",
  "ριζική αποτρίχωση προσώπου & λαιμού": "elec-15",
};

/** Cabins as parallel resources:
 * 1–2 πρόσωπο + laser, 3 φρύδια/βλεφαρίδες/κερί, 4 Vacutherm, 5 σώμα + μασάζ
 */
export const CABIN_LABELS = {
  1: "Καμπίνα 1 — πρόσωπο & laser",
  2: "Καμπίνα 2 — πρόσωπο & laser",
  3: "Καμπίνα 3 — φρύδια, βλεφαρίδες & κερί",
  4: "Καμπίνα 4 — Vacutherm",
  5: "Καμπίνα 5 — σώμα & μασάζ",
};

/** @param {{ id: string, categoryId?: string } | null | undefined} service */
export function getCabinPool(service) {
  if (!service) return [1, 2];
  const id = service.id;
  if (id === "vacutherm" || id === "vacutherm-pack") return [4];
  if (
    id === "wax"
    || service.categoryId === "brows"
    || service.categoryId === "lashes"
  ) {
    return [3];
  }
  if (service.categoryId === "body") return [5];
  // face, laser, electrolysis
  return [1, 2];
}

/** Infer cabin pool from a stored appointment service name (legacy rows). */
export function getCabinPoolForServiceName(serviceName) {
  const service = findServiceByName(serviceName);
  if (service) {
    const withCat = getServiceById(service.id);
    return getCabinPool(withCat || service);
  }
  const key = String(serviceName || "").toLowerCase();
  if (key.includes("vacutherm")) return [4];
  if (
    key.includes("μασάζ")
    || key.includes("endosphere")
    || key.includes("cavitation")
    || key.includes("vacuum bbl")
    || key.includes("vacum bbl")
    || key.includes("πρεσσο")
    || key.includes("κρυολιπ")
    || key.includes("μαδερο")
    || (key.includes("rf") && key.includes("σώμα"))
  ) {
    return [5];
  }
  if (
    key.includes("brow")
    || key.includes("lash")
    || key.includes("φρύδ")
    || key.includes("βλεφαρίδ")
    || key.includes("κερί")
    || key.includes("σχηματισμός")
  ) {
    return [3];
  }
  return [1, 2];
}

const byId = new Map();
const byName = new Map();
for (const category of BOOKING_CATEGORIES) {
  for (const service of category.services) {
    const enriched = { ...service, categoryId: category.id, categoryLabel: category.label };
    byId.set(service.id, enriched);
    byName.set(service.name.toLowerCase(), enriched);
  }
}

export function getServiceById(id) {
  return byId.get(id) || null;
}

export function resolveServiceQuery(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const byExactId = getServiceById(raw);
  if (byExactId) return byExactId;
  const key = raw.toLowerCase();
  const aliasId = SERVICE_ALIASES[key];
  if (aliasId) return getServiceById(aliasId);
  return byName.get(key) || null;
}

export function findServiceByName(name) {
  if (!name) return null;
  return resolveServiceQuery(name);
}

export function formatPrice(service) {
  if (!service) return "";
  const amount = service.priceCents / 100;
  const text = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(".", ",");
  return service.priceFrom ? `από € ${text}` : `€ ${text}`;
}

export function formatDuration(minutes) {
  if (!minutes || minutes < 1) return "";
  if (minutes < 60) return `${minutes} λεπτά`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return hours === 1 ? "1 ώρα" : `${hours} ώρες`;
  if (hours === 1) return `1 ώρα ${rest} λεπτά`;
  return `${hours} ώρες ${rest} λεπτά`;
}

export function minutesToTimeLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeLabelToMinutes(label) {
  const [h, m] = String(label).slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Candidate start times for a service that finish by closing. */
export function buildStartSlots(durationMin) {
  const duration = Math.max(5, Number(durationMin) || 60);
  const lastStart = BOOKING_DAY_END - duration;
  if (lastStart < BOOKING_DAY_START) return [];

  const step = duration >= 60 ? 30 : duration >= 30 ? 15 : Math.min(SLOT_STEP_MINUTES, duration);
  const slots = [];
  for (let t = BOOKING_DAY_START; t <= lastStart; t += step) {
    slots.push(minutesToTimeLabel(t));
  }
  return slots;
}

/**
 * @param {string[]} candidateStarts
 * @param {{ time: string, service?: string, durationMin?: number, cabinId?: number | null }[]} booked
 * @param {{ id: string, categoryId?: string, durationMin: number }} service
 */
export function filterAvailableStarts(candidateStarts, booked, service) {
  const duration = Math.max(5, Number(service?.durationMin) || 60);
  const pool = getCabinPool(service);
  /** @type {Map<number, { start: number, end: number }[]>} */
  const busyByCabin = new Map();

  for (const row of booked || []) {
    const start = timeLabelToMinutes(row.time);
    if (start == null) continue;
    const known = row.durationMin || findServiceByName(row.service)?.durationMin || 60;
    const cabinId = Number(row.cabinId)
      || getCabinPoolForServiceName(row.service)[0]
      || 1;
    if (!busyByCabin.has(cabinId)) busyByCabin.set(cabinId, []);
    busyByCabin.get(cabinId).push({ start, end: start + known });
  }

  return candidateStarts.filter((label) => {
    const start = timeLabelToMinutes(label);
    if (start == null) return false;
    const end = start + duration;
    if (end > BOOKING_DAY_END) return false;
    return pool.some((cabinId) => {
      const intervals = busyByCabin.get(cabinId) || [];
      return !intervals.some((b) => start < b.end && end > b.start);
    });
  });
}

/** Pick the first free cabin in the service pool for a slot. */
export function pickCabinForSlot(service, booked, startLabel) {
  const duration = Math.max(5, Number(service?.durationMin) || 60);
  const start = timeLabelToMinutes(startLabel);
  if (start == null) return null;
  const end = start + duration;
  const pool = getCabinPool(service);

  /** @type {Map<number, { start: number, end: number }[]>} */
  const busyByCabin = new Map();
  for (const row of booked || []) {
    const bStart = timeLabelToMinutes(row.time);
    if (bStart == null) continue;
    const known = row.durationMin || findServiceByName(row.service)?.durationMin || 60;
    const cabinId = Number(row.cabinId)
      || getCabinPoolForServiceName(row.service)[0]
      || 1;
    if (!busyByCabin.has(cabinId)) busyByCabin.set(cabinId, []);
    busyByCabin.get(cabinId).push({ start: bStart, end: bStart + known });
  }

  for (const cabinId of pool) {
    const intervals = busyByCabin.get(cabinId) || [];
    if (!intervals.some((b) => start < b.end && end > b.start)) return cabinId;
  }
  return null;
}
