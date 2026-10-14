// ============================================================================
// common.js
//
// Genel amacli, DB'den bagimsiz yardimci fonksiyonlar. Eski projedeki
// common.js'in gozden gecirilmis hali: kullanilmayan fonksiyonlar
// (validateEmail, throttle, cache objesi) bilerek CIKARILDI - onceki kod
// incelemesinde hicbir yerden cagrilmadiklari tespit edilmisti.
// ============================================================================

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function showMessage(el, message, type = "info") {
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`;
}

export function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDate(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR");
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./service-worker.js");
  } catch (error) {
    console.error("Service worker kaydı başarısız:", error);
  }
}

const MORE_PAGES = new Set(["retrieval.html", "statistics.html", "notes.html", "curriculum.html", "import.html", "settings.html"]);
const QUESTION_FLOW_PAGES = new Set(["liste.html", "duzenle.html"]);

export function setActiveNav(pathname) {
  const normalized = pathname || "index.html";
  const navLinks = $all(".top-nav a[data-nav]");
  let moreIsActive = false;

  navLinks.forEach((link) => {
    const href = link.getAttribute("data-nav") || link.getAttribute("href");
    const isActive = href === normalized || (normalized.endsWith("/") && href === "index.html");
    const isMoreLink = link.classList.contains("nav-more-link");
    const isQuestionFlowLink = href === "liste.html" && QUESTION_FLOW_PAGES.has(normalized);
    link.classList.toggle("active", isActive || isQuestionFlowLink);
    if (isActive || isQuestionFlowLink) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    if (isActive && isMoreLink) moreIsActive = true;
  });

  const moreButton = $(".nav-more-btn");
  if (moreButton) {
    moreButton.classList.toggle("active", moreIsActive || MORE_PAGES.has(normalized));
    if (moreIsActive || MORE_PAGES.has(normalized)) moreButton.setAttribute("aria-current", "page");
    else moreButton.removeAttribute("aria-current");
  }
}

export function initMoreMenu() {
  const wrap = $(".nav-more-wrap");
  const button = $(".nav-more-btn");
  const menu = $(".nav-more-menu");
  if (!wrap || !button || !menu) return;

  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = menu.hidden;
    menu.hidden = !nextOpen;
    button.setAttribute("aria-expanded", String(nextOpen));
  });

  menu.addEventListener("click", () => close());
  document.addEventListener("click", (event) => {
    if (!wrap.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}


export async function bootPage() {
  const current = location.pathname.split("/").pop() || "index.html";
  setActiveNav(current);
  initMoreMenu();
  await registerServiceWorker();
}
