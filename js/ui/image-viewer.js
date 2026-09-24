const VIEWER_ID = "questionImageViewer";

function clampScale(value) {
  return Math.max(0.5, Math.min(6, value));
}

export function openImageViewer(src, alt = "Görsel") {
  if (!src) return;

  document.getElementById(VIEWER_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = VIEWER_ID;
  overlay.className = "image-viewer-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Soru görseli görüntüleyici");
  overlay.innerHTML = `
    <div class="image-viewer-toolbar">
      <button type="button" class="secondary image-viewer-btn" data-viewer-action="out" aria-label="Uzaklaştır">−</button>
      <button type="button" class="secondary image-viewer-btn" data-viewer-action="fit">Sığdır</button>
      <button type="button" class="secondary image-viewer-btn" data-viewer-action="reset">100%</button>
      <button type="button" class="secondary image-viewer-btn" data-viewer-action="in" aria-label="Yakınlaştır">＋</button>
      <button type="button" class="secondary image-viewer-btn image-viewer-close" data-viewer-action="close" aria-label="Kapat">✕</button>
    </div>
    <div class="image-viewer-stage" data-viewer-action="stage" tabindex="0">
      <img class="image-viewer-image" alt="">
    </div>`;

  const stage = overlay.querySelector(".image-viewer-stage");
  const image = overlay.querySelector(".image-viewer-image");
  const zoomButton = overlay.querySelector('[data-viewer-action="reset"]');
  image.src = src;
  image.alt = alt;

  let scale = 1;
  let startDistance = null;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let scrollTop = 0;

  function getFitScale() {
    if (!image.naturalWidth || !image.naturalHeight) return 1;
    const padding = 20;
    return Math.max(0.25, Math.min(1, (stage.clientWidth - padding) / image.naturalWidth, (stage.clientHeight - padding) / image.naturalHeight));
  }

  function applyScale(nextScale) {
    scale = clampScale(nextScale);
    image.style.transform = `scale(${scale})`;
    zoomButton.textContent = `${Math.round(scale * 100)}%`;
  }

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") close();
    else if (event.key === "+" || event.key === "=") applyScale(scale + 0.25);
    else if (event.key === "-") applyScale(scale - 0.25);
    else if (event.key === "0") applyScale(1);
    else if (event.key === "f" || event.key === "F") applyScale(getFitScale());
  }

  overlay.addEventListener("click", (event) => {
    const action = event.target.closest("[data-viewer-action]")?.dataset.viewerAction;
    if (action === "close") close();
    if (action === "in") applyScale(scale + 0.25);
    if (action === "out") applyScale(scale - 0.25);
    if (action === "reset") applyScale(1);
    if (action === "fit") applyScale(getFitScale());
    if (action === "stage" && event.target === stage && !moved && scale === 1) close();
  });

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    applyScale(scale + (event.deltaY < 0 ? 0.2 : -0.2));
  }, { passive: false });

  stage.addEventListener("dblclick", (event) => {
    if (event.target !== image) return;
    applyScale(scale === 1 ? 2 : 1);
  });

  stage.addEventListener("pointerdown", (event) => {
    moved = false;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stage.setPointerCapture?.(event.pointerId);
    startX = event.clientX;
    startY = event.clientY;
    scrollLeft = stage.scrollLeft;
    scrollTop = stage.scrollTop;
  });

  stage.addEventListener("pointermove", (event) => {
    if (!stage.hasPointerCapture?.(event.pointerId)) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    if (scale > 1) {
      stage.scrollLeft = scrollLeft - dx;
      stage.scrollTop = scrollTop - dy;
    }
  });

  stage.addEventListener("pointerup", (event) => {
    stage.releasePointerCapture?.(event.pointerId);
  });

  stage.addEventListener("touchstart", (event) => {
    if (event.touches.length === 2) {
      startDistance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
    }
  }, { passive: true });

  stage.addEventListener("touchmove", (event) => {
    if (event.touches.length !== 2 || !startDistance) return;
    const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
    applyScale(scale * (distance / startDistance));
    startDistance = distance;
    event.preventDefault();
  }, { passive: false });

  stage.addEventListener("touchend", () => { startDistance = null; }, { passive: true });

  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKeyDown);
  image.addEventListener("load", () => applyScale(getFitScale()), { once: true });
  window.addEventListener("resize", () => { if (Math.abs(scale - getFitScale()) < 0.01 || scale < 1) applyScale(getFitScale()); }, { passive: true });
  applyScale(1);
  requestAnimationFrame(() => stage.focus?.());
}
