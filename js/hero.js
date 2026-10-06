/* Homepage hero motion. Flip particles off here. */
const HERO_MOTION = {
  particles: true,
  particleCount: 18,
  scrollDistance: 400,
  mouseMax: 40,
  mouseLerp: 0.08,
  countMs: 1200,
  rating: 4.9,
};

(function initHero() {
  const hero = document.querySelector(".page-home .hero");
  if (!hero) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const logo = hero.querySelector(".hero-logo");
  const brand = document.querySelector(".header .brand");
  const glow = hero.querySelector(".hero-glow");
  const canvas = hero.querySelector(".hero-dust");
  const proof = hero.querySelector(".hero-proof");
  const score = hero.querySelector(".hero-score");
  const star = hero.querySelector(".hero-star");
  const hint = hero.querySelector(".scroll-hint");
  const parallax = [...hero.querySelectorAll(".hero-parallax")];
  const next = hero.nextElementSibling;

  let home = null;
  let lock = null;

  function measure() {
    if (!logo || !brand) return;
    const previous = logo.style.transform;
    logo.style.transform = "none";
    const h = logo.getBoundingClientRect();
    const b = brand.getBoundingClientRect();
    home = {
      left: h.left,
      top: h.top + window.scrollY,
      width: h.width,
    };
    lock = { left: b.left, top: b.top, width: b.width };
    logo.style.transform = previous;
  }

  function applyScroll() {
    if (reduceMotion || !home || !lock) return;
    const y = window.scrollY;
    const p = Math.min(1, Math.max(0, y / HERO_MOTION.scrollDistance));
    if (p === 0) {
      logo.style.transform = "";
      logo.style.opacity = "";
      brand.style.opacity = "";
      brand.style.pointerEvents = "";
      parallax.forEach((el) => {
        el.style.transform = "";
        el.style.opacity = "";
      });
      return;
    }
    const dx = (lock.left - home.left) * p;
    const dy = (lock.top - (home.top - y)) * p;
    const scale = 1 + (lock.width / home.width - 1) * p;
    logo.style.transformOrigin = "0 0";
    logo.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`;
    logo.style.opacity = String(1 - p);
    brand.style.opacity = String(p);
    brand.style.pointerEvents = p > 0.45 ? "auto" : "none";
    parallax.forEach((el) => {
      el.style.transform = `translate3d(0, ${-16 * p}px, 0)`;
      el.style.opacity = String(Math.max(0, 1 - p));
    });
  }

  let scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      applyScroll();
      scrollQueued = false;
    });
  }

  function formatScore(value) {
    return value.toFixed(1).replace(".", ",");
  }

  function runCount() {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / HERO_MOTION.countMs);
      const eased = 1 - (1 - t) ** 3;
      score.textContent = formatScore(HERO_MOTION.rating * eased);
      if (t < 1) {
        requestAnimationFrame(step);
        return;
      }
      score.textContent = formatScore(HERO_MOTION.rating);
      star.classList.add("is-on");
    };
    score.textContent = "0,0";
    requestAnimationFrame(step);
  }

  hero.querySelectorAll(".hero-in").forEach((el) => {
    el.addEventListener("animationend", (event) => {
      if (event.target !== el) return;
      el.classList.add("is-shown");
      applyScroll();
    });
  });

  if (reduceMotion) {
    star?.classList.add("is-on");
    hero.querySelectorAll(".hero-in").forEach((el) => el.classList.add("is-shown"));
  } else if (proof && score && star) {
    proof.addEventListener("animationstart", () => runCount(), { once: true });
  }

  hint?.addEventListener("click", () => {
    next?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  });

  const allowMouse = finePointer && window.innerWidth >= 900 && !reduceMotion;
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  if (allowMouse && glow) {
    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const rect = hero.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = Math.max(-1, Math.min(1, nx * 2)) * HERO_MOTION.mouseMax;
      targetY = Math.max(-1, Math.min(1, ny * 2)) * HERO_MOTION.mouseMax;
    });
    hero.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
    });
  }

  const ctx = canvas?.getContext("2d");
  let dots = [];
  const useParticles = HERO_MOTION.particles && finePointer && window.innerWidth >= 800 && !reduceMotion;

  function makeDot(anywhere) {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 6,
      r: 1 + Math.random() * 1.6,
      a: 0.2 + Math.random() * 0.3,
      vy: 0.18 + Math.random() * 0.32,
      sway: 6 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function sizeCanvas() {
    if (!ctx || !useParticles) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, hero.clientWidth) * dpr;
    canvas.height = Math.max(1, hero.clientHeight) * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (useParticles) {
    sizeCanvas();
    dots = Array.from({ length: HERO_MOTION.particleCount }, () => makeDot(true));
  }

  let looping = false;
  function frame() {
    if (allowMouse && glow) {
      curX += (targetX - curX) * HERO_MOTION.mouseLerp;
      curY += (targetY - curY) * HERO_MOTION.mouseLerp;
      glow.style.transform = `translate3d(calc(-50% + ${curX}px), calc(-50% + ${curY}px), 0)`;
    }
    if (dots.length && ctx) {
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (const dot of dots) {
        dot.y -= dot.vy;
        dot.phase += 0.012;
        if (dot.y < -8) Object.assign(dot, makeDot(false));
        ctx.beginPath();
        ctx.fillStyle = `rgba(196, 163, 106, ${dot.a})`;
        ctx.arc(dot.x + Math.sin(dot.phase) * dot.sway, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (!document.hidden) requestAnimationFrame(frame);
    else looping = false;
  }

  function startLoop() {
    if (looping || reduceMotion || document.hidden) return;
    if (!allowMouse && !dots.length) return;
    looping = true;
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) startLoop();
  });

  measure();
  applyScroll();
  window.addEventListener("load", () => {
    measure();
    applyScroll();
    sizeCanvas();
  });
  document.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    applyScroll();
    sizeCanvas();
  });
  startLoop();
})();
