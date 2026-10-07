/** Instant EL/EN for the public site. Greek stays in the HTML; English is a local dictionary. */
const STORAGE_KEY = "aesthee-lang";
const DICT = window.AESTHEE_EN || {};
const ATTRS = ["alt", "aria-label", "placeholder", "title", "content"];
const SKIP = "script, style, noscript, .lang-toggle, textarea, input";

const textOriginal = new Map();
const attrOriginal = new Map();
let originalTitle = "";
let applying = false;

function holdApply() {
  applying = true;
  queueMicrotask(() => {
    applying = false;
  });
}

function preferredLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "el";
  } catch (error) {
    return "el";
  }
}

function cookieHosts() {
  const host = location.hostname;
  const bare = host.replace(/^www\./, "");
  return ["", host, `.${host}`, bare, `.${bare}`].filter((value, index, all) => value && all.indexOf(value) === index);
}

function clearTranslateCookie() {
  document.cookie = "googtrans=;path=/;max-age=0";
  for (const domain of cookieHosts()) {
    document.cookie = `googtrans=;path=/;domain=${domain};max-age=0`;
  }
}

function keyOf(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function translatePhrase(value) {
  const key = keyOf(value);
  if (!key || !/[Α-Ωα-ωΆ-ώ]/.test(key)) return null;
  if (DICT[key]) return DICT[key];

  const booked = key.match(/^Το ραντεβού καταχωρήθηκε: (.+) \((.+), (.+)\) — (\d{4}-\d{2}-\d{2}) στις (\d{2}:\d{2})\.$/);
  if (booked) {
    const name = translatePhrase(booked[1]) || booked[1];
    const duration = translatePhrase(booked[2]) || booked[2];
    const price = translatePhrase(booked[3]) || booked[3];
    return `Appointment booked: ${name} (${duration}, ${price}) — ${booked[4]} at ${booked[5]}.`;
  }

  const offer = key.match(/^Προσφορά · (.+)$/);
  if (offer) {
    const rest = translatePhrase(offer[1]) || offer[1];
    return `Offer · ${rest}`;
  }

  const priced = key.match(/^(.+) — (από € [\d.,]+|€ [\d.,]+)$/);
  if (priced) {
    const left = DICT[priced[1]] || translatePhrase(priced[1]);
    const right = translatePhrase(priced[2]);
    if (left && right) return `${left} — ${right}`;
  }

  const counted = key.match(/^(.+) \((\d+)\)$/);
  if (counted && DICT[counted[1]]) return `${DICT[counted[1]]} (${counted[2]})`;

  const rules = [
    [/^από € ([\d.,]+)$/, "from €$1"],
    [/^€ ([\d.,]+)$/, "€$1"],
    [/^από ([\d.,]+)€$/, "from €$1"],
    [/^(\d+) λεπτά$/, "$1 min"],
    [/^(\d+) ώρες$/, "$1 hours"],
    [/^1 ώρα$/, "1 hour"],
    [/^2 ώρες$/, "2 hours"],
    [/^1 ώρα (\d+) λεπτά$/, "1 hour $1 min"],
    [/^(\d+) ώρες (\d+) λεπτά$/, "$1 hours $2 min"],
    [/^1 ώρα (\d+)′$/, "1 hour $1 min"],
    [/^ΕΠ\/ΚΟ (\d+) λεπτά$/, "Follow-up $1 min"],
    [/^Ριζική αποτρίχωση — (\d+)′$/, "Electrolysis — $1 min"],
    [/^Laser (Γυναίκες|Άντρες) — (.+)$/, null],
    [/^(.+) — πακέτο (\d+)\+(\d+) δώρο$/, null],
    [/^(.+) — πακέτο (\d+) συνεδριών$/, null],
  ];
  for (const [pattern, replacement] of rules) {
    if (typeof replacement === "string" && pattern.test(key)) return key.replace(pattern, replacement);
  }

  const beforeAfter = key.match(/^Πριν και μετά — (.+)$/);
  if (beforeAfter) {
    const rest = DICT[beforeAfter[1]] || translatePhrase(beforeAfter[1]) || beforeAfter[1];
    return `Before and after — ${rest}`;
  }
  const sessions = key.match(/^(\d+) συνεδρίες (.+)$/);
  if (sessions) {
    const what = DICT[sessions[2]] || sessions[2];
    return `${sessions[1]} ${what} sessions`;
  }
  const laserPack = key.match(/^Laser (.+) — (\d+) συνεδρίες \+ δώρο (.+)$/);
  if (laserPack) return `Laser ${laserPack[1]} — ${laserPack[2]} sessions + ${laserPack[3]} included`;
  const laserCount = key.match(/^Laser (.+) — (\d+) συνεδρίες$/);
  if (laserCount) return `Laser ${laserCount[1]} — ${laserCount[2]} sessions`;
  const room = key.match(/^Χώρος (\d+)$/);
  if (room) return `Room ${room[1]}`;
  const numbered = key.match(/^(\d{2}) — (.+)$/);
  if (numbered && (DICT[numbered[2]] || translatePhrase(numbered[2]))) {
    return `${numbered[1]} — ${DICT[numbered[2]] || translatePhrase(numbered[2])}`;
  }

  const laser = key.match(/^Laser (Γυναίκες|Άντρες) — (.+)$/);
  if (laser) {
    const who = laser[1] === "Γυναίκες" ? "Women" : "Men";
    const area = DICT[laser[2]] || laser[2];
    return `Laser ${who} — ${area}`;
  }
  const packGift = key.match(/^(.+) — πακέτο (\d+)\+(\d+) δώρο$/);
  if (packGift) {
    const name = DICT[packGift[1]] || packGift[1];
    return `${name} — pack of ${packGift[2]}+${packGift[3]} free`;
  }
  const pack = key.match(/^(.+) — πακέτο (\d+) συνεδριών$/);
  if (pack) {
    const name = DICT[pack[1]] || pack[1];
    return `${name} — pack of ${pack[2]} sessions`;
  }
  return null;
}

function paintToggle(button) {
  const english = preferredLang() === "en";
  button.textContent = english ? "ΕΛ" : "EN";
  button.setAttribute("aria-pressed", english ? "true" : "false");
  button.setAttribute("aria-label", english ? "Ελληνικά" : "English");
  document.documentElement.lang = english ? "en" : "el";
  const locale = document.querySelector('meta[property="og:locale"]');
  if (locale) locale.setAttribute("content", english ? "en_GB" : "el_GR");
}

function rememberText(node) {
  if (!textOriginal.has(node)) textOriginal.set(node, node.nodeValue);
  return textOriginal.get(node);
}

function applyText(node, english) {
  const raw = rememberText(node);
  if (!raw || !raw.trim()) return;
  if (!english) {
    node.nodeValue = raw;
    return;
  }
  const next = translatePhrase(raw);
  if (!next) return;
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  if (node.nodeValue !== lead + next + trail) node.nodeValue = lead + next + trail;
}

function applyAttrs(el, english) {
  let stored = attrOriginal.get(el);
  for (const name of ATTRS) {
    if (!el.hasAttribute(name)) continue;
    const current = el.getAttribute(name);
    if (!stored) stored = {};
    if (stored[name] == null) stored[name] = current;
    const source = stored[name];
    if (!english) {
      if (el.getAttribute(name) !== source) el.setAttribute(name, source);
      continue;
    }
    const next = translatePhrase(source);
    if (next && el.getAttribute(name) !== next) el.setAttribute(name, next);
  }
  if (stored) attrOriginal.set(el, stored);
}

function applyRoot(root, english) {
  if (!root) return;
  const scope = root.nodeType === 1 || root.nodeType === 11 ? root : document.body;
  if (scope.nodeType === 1) applyAttrs(scope, english);
  const elements = scope.querySelectorAll ? scope.querySelectorAll("*") : [];
  elements.forEach((el) => {
    if (el.closest(SKIP)) return;
    applyAttrs(el, english);
  });
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => applyText(node, english));
}

function apply(english) {
  holdApply();
  if (!originalTitle) originalTitle = document.title;
  document.title = english ? (translatePhrase(originalTitle) || originalTitle) : originalTitle;
  applyRoot(document.body, english);
  document.documentElement.classList.remove("i18n-pending");
  window.dispatchEvent(new Event("resize"));
}

function mountToggle() {
  const inner = document.querySelector(".header-inner");
  if (!inner || inner.querySelector("[data-lang-toggle]")) return null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lang-toggle";
  button.dataset.langToggle = "";
  const anchor = inner.querySelector(".header-cta") || inner.querySelector(".menu-toggle");
  if (anchor) inner.insertBefore(button, anchor);
  else inner.appendChild(button);
  return button;
}

function boot() {
  clearTranslateCookie();
  const button = mountToggle();
  if (!button) {
    document.documentElement.classList.remove("i18n-pending");
    return;
  }
  paintToggle(button);
  if (preferredLang() === "en") apply(true);
  else document.documentElement.classList.remove("i18n-pending");

  const observer = new MutationObserver((records) => {
    if (applying || preferredLang() !== "en") return;
    holdApply();
    for (const record of records) {
      if (record.type === "characterData" && record.target.nodeType === 3) {
        const value = record.target.nodeValue || "";
        if (/[Α-Ωα-ωΆ-ώ]/.test(value)) textOriginal.set(record.target, value);
        applyText(record.target, true);
      }
      record.addedNodes.forEach((node) => {
        if (node.nodeType === 3) applyText(node, true);
        else if (node.nodeType === 1) applyRoot(node, true);
      });
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });

  button.addEventListener("click", () => {
    const next = preferredLang() === "en" ? "el" : "en";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      /* keep the click working if storage is blocked */
    }
    paintToggle(button);
    apply(next === "en");
  });
}

window.aestheeTranslate = translatePhrase;
window.aestheeT = (value) => (preferredLang() === "en" ? (translatePhrase(value) || value) : value);

boot();
