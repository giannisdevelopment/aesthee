const DAYS_EL = document.getElementById("days");
const TIMES_EL = document.getElementById("times");
const HEADER = document.getElementById("header");
const TOAST = document.getElementById("toast");
const NAV = document.getElementById("nav");
const MENU = document.getElementById("menuToggle");

const WEEKDAY = ["Κυρ", "Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ"];
const TIMES = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

const state = { date: null, time: null };

function upcomingDays(count = 10) {
  const days = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function keyFromDate(date) {
  return date.toISOString().slice(0, 10);
}

function renderDays() {
  const days = upcomingDays();
  state.date = keyFromDate(days[0]);
  DAYS_EL.innerHTML = "";
  days.forEach((date, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day-chip" + (index === 0 ? " is-active" : "");
    btn.dataset.date = keyFromDate(date);
    btn.innerHTML = `<small>${WEEKDAY[date.getDay()]}</small><strong>${date.getDate()}</strong>`;
    btn.addEventListener("click", () => {
      state.date = btn.dataset.date;
      DAYS_EL.querySelectorAll(".day-chip").forEach((el) => el.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
    DAYS_EL.appendChild(btn);
  });
}

function renderTimes() {
  state.time = TIMES[2];
  TIMES_EL.innerHTML = "";
  TIMES.forEach((time, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "time-slot" + (index === 2 ? " is-active" : "");
    btn.textContent = time;
    btn.addEventListener("click", () => {
      state.time = time;
      TIMES_EL.querySelectorAll(".time-slot").forEach((el) => el.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
    TIMES_EL.appendChild(btn);
  });
}

function showToast(message) {
  TOAST.textContent = message;
  TOAST.classList.add("is-visible");
  window.setTimeout(() => TOAST.classList.remove("is-visible"), 4200);
}

document.getElementById("bookingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const service = event.target.service.value;
  const name = event.target.name.value.trim();
  if (!service || !state.date || !state.time || !name) {
    showToast("Συμπληρώστε υπηρεσία, ημέρα, ώρα και όνομα.");
    return;
  }
  showToast(`Το ραντεβού καταχωρήθηκε για ${state.date} στις ${state.time}. Θα επικοινωνήσουμε για επιβεβαίωση.`);
  event.target.reset();
});

document.getElementById("contactForm").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("Το μήνυμα καταχωρήθηκε. Θα σας απαντήσουμε σύντομα.");
  event.target.reset();
});

window.addEventListener("scroll", () => {
  HEADER.classList.toggle("is-scrolled", window.scrollY > 12);
}, { passive: true });

MENU.addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  MENU.setAttribute("aria-expanded", String(open));
});

NAV.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    document.body.classList.remove("nav-open");
    MENU.setAttribute("aria-expanded", "false");
  });
});

renderDays();
renderTimes();

const mobileCta = document.querySelector(".mobile-cta");
const hideCtaFor = ["#booking", "#contact"];
const ctaObserver = new IntersectionObserver((entries) => {
  const hide = entries.some((entry) => entry.isIntersecting);
  mobileCta.classList.toggle("is-hidden", hide);
}, { threshold: 0.25 });

hideCtaFor.forEach((selector) => {
  const el = document.querySelector(selector);
  if (el) ctaObserver.observe(el);
});
