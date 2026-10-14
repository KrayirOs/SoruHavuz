const VIEWER_ID = "questionImageViewer";

/**
 * Mobilde görüntüyü ekrana sığdıran sade tam ekran önizleme.
 * Transform ve özel sürükleme mantığı kullanılmaz; böylece görsel köşeye
 * taşarak büyümez.
 */
export function openImageViewer(src, alt = "Görsel") {
  if (!src) return;

  document.getElementById(VIEWER_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = VIEWER_ID;
  overlay.className = "image-viewer-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", alt);
  overlay.innerHTML = `
    <button type="button" class="secondary image-viewer-close" aria-label="Kapat">×</button>
    <div class="image-viewer-stage">
      <img class="image-viewer-image" alt="">
    </div>`;

  const closeButton = overlay.querySelector(".image-viewer-close");
  const image = overlay.querySelector(".image-viewer-image");
  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };

  image.src = src;
  image.alt = alt;
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.appendChild(overlay);
  closeButton.focus();
}
