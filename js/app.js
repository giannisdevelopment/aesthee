const HEADER = document.getElementById("header");
const TOAST = document.getElementById("toast");
const NAV = document.getElementById("nav");
const MENU = document.getElementById("menuToggle");
const PILL = document.getElementById("navPill");
const PAGE = document.body.dataset.page || "home";

const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
const TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const BOOKING_HORIZON_MONTHS = 3;
const state = { date: null, time: null, viewYear: null, viewMonth: null };

function isDesktopNav() {
  return window.matchMedia("(min-width: 1081px)").matches;
}

function currentNavLink() {
  return NAV?.querySelector(`[data-nav="${PAGE}"]`) || NAV?.querySelector("a.is-active");
}

function placePill(target) {
  const track = document.querySelector(".nav-track");
  if (!PILL || !track || !target || !isDesktopNav()) {
    if (PILL) PILL.hidden = true;
    return;
  }
  const trackBox = track.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  PILL.hidden = false;
  PILL.style.width = `${box.width}px`;
  PILL.style.transform = `translateX(${box.left - trackBox.left}px)`;
}

function setActiveNav() {
  NAV?.querySelectorAll("a[data-nav]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === PAGE);
  });
  placePill(currentNavLink());
}

function updateHeader() {
  HEADER.classList.toggle("is-scrolled", window.scrollY > 16);
}

function showToast(message) {
  if (!TOAST) return;
  TOAST.textContent = message;
  TOAST.classList.add("is-visible");
  window.setTimeout(() => TOAST.classList.remove("is-visible"), 4200);
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function keyFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function bookingBounds() {
  const min = startOfDay();
  const max = startOfDay();
  max.setMonth(max.getMonth() + BOOKING_HORIZON_MONTHS);
  return { min, max };
}

function firstBookableDate() {
  const { min, max } = bookingBounds();
  const cursor = new Date(min);
  while (cursor <= max) {
    if (!isWeekend(cursor)) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return min;
}

function isBookableDate(date) {
  const { min, max } = bookingBounds();
  const day = startOfDay(date);
  return day >= min && day <= max && !isWeekend(day);
}

function setSelectedDate(date) {
  const key = keyFromDate(date);
  state.date = key;
  const hidden = document.getElementById("bookingDate");
  if (hidden) hidden.value = key;
}

function canShiftMonth(delta) {
  const { min, max } = bookingBounds();
  const probe = new Date(state.viewYear, state.viewMonth + delta, 1);
  const earliest = new Date(min.getFullYear(), min.getMonth(), 1);
  const latest = new Date(max.getFullYear(), max.getMonth(), 1);
  return probe >= earliest && probe <= latest;
}

function renderDatePicker() {
  const root = document.getElementById("datePicker");
  if (!root) return;

  const grid = root.querySelector("[data-date-grid]");
  const label = root.querySelector("[data-date-label]");
  const prev = root.querySelector("[data-date-prev]");
  const next = root.querySelector("[data-date-next]");
  if (!grid || !label || !prev || !next) return;

  if (state.viewYear == null) {
    const initial = firstBookableDate();
    setSelectedDate(initial);
    state.viewYear = initial.getFullYear();
    state.viewMonth = initial.getMonth();
  }

  label.textContent = `${MONTHS[state.viewMonth]} ${state.viewYear}`;
  prev.disabled = !canShiftMonth(-1);
  next.disabled = !canShiftMonth(1);

  const firstOfMonth = new Date(state.viewYear, state.viewMonth, 1);
  // Monday-first index: Mon=0 … Sun=6
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate();

  grid.innerHTML = "";

  for (let i = 0; i < startOffset; i += 1) {
    const spacer = document.createElement("span");
    spacer.className = "date-cell is-empty";
    spacer.setAttribute("aria-hidden", "true");
    grid.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(state.viewYear, state.viewMonth, day);
    const key = keyFromDate(date);
    const weekend = isWeekend(date);
    const bookable = isBookableDate(date);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "date-cell";
    btn.textContent = String(day);
    btn.dataset.date = key;
    btn.setAttribute("role", "gridcell");
    btn.setAttribute("aria-label", key);

    if (weekend) btn.classList.add("is-weekend");
    if (!bookable) {
      btn.disabled = true;
      btn.classList.add("is-disabled");
    }
    if (state.date === key) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
    } else {
      btn.setAttribute("aria-selected", "false");
    }

    if (bookable) {
      btn.addEventListener("click", () => {
        setSelectedDate(date);
        renderDatePicker();
      });
    }

    grid.appendChild(btn);
  }

  if (!prev.dataset.bound) {
    prev.dataset.bound = "1";
    prev.addEventListener("click", () => {
      if (!canShiftMonth(-1)) return;
      const nextView = new Date(state.viewYear, state.viewMonth - 1, 1);
      state.viewYear = nextView.getFullYear();
      state.viewMonth = nextView.getMonth();
      renderDatePicker();
    });
  }

  if (!next.dataset.bound) {
    next.dataset.bound = "1";
    next.addEventListener("click", () => {
      if (!canShiftMonth(1)) return;
      const nextView = new Date(state.viewYear, state.viewMonth + 1, 1);
      state.viewYear = nextView.getFullYear();
      state.viewMonth = nextView.getMonth();
      renderDatePicker();
    });
  }
}

function renderTimes() {
  const timesEl = document.getElementById("times");
  if (!timesEl) return;
  state.time = TIMES[2];
  timesEl.innerHTML = "";
  TIMES.forEach((time, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "time-slot" + (index === 2 ? " is-active" : "");
    btn.textContent = time;
    btn.addEventListener("click", () => {
      state.time = time;
      timesEl.querySelectorAll(".time-slot").forEach((el) => el.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
    timesEl.appendChild(btn);
  });
}

function initBooking() {
  const form = document.getElementById("bookingForm");
  const select = document.getElementById("service");
  if (!form || !select) return;

  const wanted = new URLSearchParams(location.search).get("service");
  if (wanted) {
    const match = [...select.options].some((option) => option.value === wanted);
    if (match) select.value = wanted;
  }

  renderDatePicker();
  renderTimes();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const service = event.target.service.value;
    const name = event.target.name.value.trim();
    if (!service || !state.date || !state.time || !name) {
      showToast("Συμπληρώστε υπηρεσία, ημέρα, ώρα και όνομα.");
      return;
    }
    showToast(`Το ραντεβού καταχωρήθηκε για ${state.date} στις ${state.time}. Θα επικοινωνήσουμε για επιβεβαίωση.`);
    event.target.reset();
    if (wanted) select.value = wanted;
  });
}

function initContact() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showToast("Το μήνυμα καταχωρήθηκε. Θα σας απαντήσουμε σύντομα.");
    event.target.reset();
  });
}

function initServices() {
  document.querySelectorAll(".svc-list, .treatment-list").forEach((list) => {
    list.addEventListener("toggle", (event) => {
      if (!(event.target instanceof HTMLDetailsElement) || !event.target.open) return;
      list.querySelectorAll("details[open]").forEach((item) => {
        if (item !== event.target) item.open = false;
      });
    }, true);
  });

  const rail = document.getElementById("svcRail");
  const panels = [...document.querySelectorAll(".svc-panel[data-panel]")];
  if (!rail || !panels.length) return;

  const links = [...rail.querySelectorAll("[data-rail]")];

  const setActive = (id) => {
    links.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.rail === id);
    });
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]?.target?.dataset?.panel) {
      setActive(visible[0].target.dataset.panel);
    }
  }, {
    rootMargin: "-28% 0px -52% 0px",
    threshold: [0.1, 0.35, 0.6],
  });

  panels.forEach((panel) => observer.observe(panel));
}

function initNav() {
  setActiveNav();
  updateHeader();

  const track = document.querySelector(".nav-track");
  track?.querySelectorAll("a[data-nav]").forEach((link) => {
    link.addEventListener("mouseenter", () => placePill(link));
    link.addEventListener("focus", () => placePill(link));
  });
  track?.addEventListener("mouseleave", () => placePill(currentNavLink()));

  MENU?.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    MENU.setAttribute("aria-expanded", String(open));
  });

  NAV?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.classList.remove("nav-open");
      MENU?.setAttribute("aria-expanded", "false");
    });
  });

  window.addEventListener("scroll", updateHeader, { passive: true });
  window.addEventListener("resize", () => placePill(currentNavLink()));
  requestAnimationFrame(() => placePill(currentNavLink()));
}

function initMobileCta() {
  const mobileCta = document.querySelector(".mobile-cta");
  if (!mobileCta || PAGE === "booking" || PAGE === "contact") return;
  const hideFor = document.querySelectorAll("#bookingForm, #contactForm, .footer");
  if (!hideFor.length) return;
  const observer = new IntersectionObserver((entries) => {
    mobileCta.classList.toggle("is-hidden", entries.some((entry) => entry.isIntersecting));
  }, { threshold: 0.12 });
  hideFor.forEach((el) => observer.observe(el));
}

function initAtmosphere() {
  const root = document.querySelector("[data-atmosphere]");
  if (!root) return;

  const stage = root.querySelector(".atm-stage");
  const slides = [...root.querySelectorAll(".atm-slide")];
  const dots = [...root.querySelectorAll(".atm-rail button")];
  if (!stage || !slides.length) return;

  let index = 0;
  let timer = 0;
  let syncing = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setActive = (next) => {
    index = Math.max(0, Math.min(next, slides.length - 1));
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
    dots.forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", String(active));
    });
  };

  const goTo = (next, behavior = "smooth") => {
    const target = slides[(next + slides.length) % slides.length];
    if (!target) return;
    setActive(slides.indexOf(target));
    syncing = true;
    const left = target.offsetLeft - (stage.clientWidth - target.offsetWidth) / 2;
    stage.scrollTo({ left: Math.max(0, left), behavior });
    window.setTimeout(() => {
      syncing = false;
    }, behavior === "smooth" ? 500 : 0);
  };

  const nearestIndex = () => {
    const mid = stage.scrollLeft + stage.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const center = slide.offsetLeft + slide.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const play = () => {
    window.clearInterval(timer);
    if (reduceMotion) return;
    timer = window.setInterval(() => goTo(index + 1), 4800);
  };

  stage.addEventListener("scroll", () => {
    if (syncing) return;
    setActive(nearestIndex());
  }, { passive: true });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      goTo(i);
      play();
    });
  });

  let drag = null;
  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startLeft: stage.scrollLeft,
    };
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
    window.clearInterval(timer);
  });

  stage.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    stage.scrollLeft = drag.startLeft - (event.clientX - drag.startX);
  });

  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    stage.classList.remove("is-dragging");
    setActive(nearestIndex());
    play();
  };

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  root.addEventListener("mouseenter", () => window.clearInterval(timer));
  root.addEventListener("mouseleave", play);
  root.addEventListener("focusin", () => window.clearInterval(timer));
  root.addEventListener("focusout", play);

  goTo(0, "auto");
  play();
}

initNav();
initBooking();
initContact();
initServices();
initMobileCta();
initAtmosphere();
