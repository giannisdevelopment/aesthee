/** Public site stays Greek. EN translates the whole page; ΕΛ returns to the original. */
const STORAGE_KEY = "aesthee-lang";

function preferredLang() {
  return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "el";
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

function setTranslateCookie(value) {
  document.cookie = `googtrans=${value};path=/;max-age=31536000`;
  const host = location.hostname.replace(/^www\./, "");
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    document.cookie = `googtrans=${value};path=/;domain=.${host};max-age=31536000`;
  }
}

function mountToggle() {
  const inner = document.querySelector(".header-inner");
  if (!inner || inner.querySelector("[data-lang-toggle]")) return null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lang-toggle notranslate";
  button.setAttribute("translate", "no");
  button.dataset.langToggle = "";
  const anchor = inner.querySelector(".header-cta") || inner.querySelector(".menu-toggle");
  if (anchor) inner.insertBefore(button, anchor);
  else inner.appendChild(button);
  return button;
}

function paintToggle(button) {
  const english = preferredLang() === "en";
  button.textContent = english ? "ΕΛ" : "EN";
  button.setAttribute("aria-pressed", english ? "true" : "false");
  button.setAttribute("aria-label", english ? "Ελληνικά" : "English");
  document.documentElement.lang = english ? "en" : "el";
}

function watchNavWidth() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const observer = new MutationObserver(() => window.dispatchEvent(new Event("resize")));
  observer.observe(nav, { subtree: true, childList: true, characterData: true });
  window.setTimeout(() => observer.disconnect(), 8000);
}

function loadTranslator() {
  if (document.getElementById("google-translate-script")) return;
  const holder = document.createElement("div");
  holder.id = "google_translate_element";
  holder.className = "notranslate";
  holder.hidden = true;
  document.body.appendChild(holder);
  window.googleTranslateElementInit = () => {
    if (!window.google?.translate?.TranslateElement) return;
    new window.google.translate.TranslateElement(
      { pageLanguage: "el", includedLanguages: "en", autoDisplay: false },
      "google_translate_element",
    );
  };
  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.head.appendChild(script);
  watchNavWidth();
}

function boot() {
  const button = mountToggle();
  if (!button) return;
  const english = preferredLang() === "en";
  paintToggle(button);
  if (english) {
    setTranslateCookie("/el/en");
    loadTranslator();
  } else {
    clearTranslateCookie();
  }
  button.addEventListener("click", () => {
    const next = preferredLang() === "en" ? "el" : "en";
    localStorage.setItem(STORAGE_KEY, next);
    if (next === "en") setTranslateCookie("/el/en");
    else clearTranslateCookie();
    location.reload();
  });
}

boot();
