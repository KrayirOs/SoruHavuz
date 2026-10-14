import { detectQuestionRegion } from "./auto-crop.js";
import { analyseImageQuality } from "./image-quality.js";
import { loadOpenCv } from "./opencv-loader.js";

function toImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Görsel yüklenemedi.")); };
    image.src = url;
  });
}

export async function getImageDimensions(file) {
  const image = await toImage(file);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

async function canvasFrom(file, maxSide = null) {
  const image = await toImage(file);
  const ratio = maxSide ? Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight)) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function blobFrom(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Görsel kodlanamadı.")), mimeType, quality));
}

function normalizeCrop(crop) {
  if (!crop) return null;
  return { x: Math.max(0, crop.x), y: Math.max(0, crop.y), width: Math.min(1, crop.width), height: Math.min(1, crop.height) };
}

async function perspectiveCanvas(source, points) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  const cv = await loadOpenCv(), src = cv.imread(source), dst = new cv.Mat();
  try {
    const p = points.map((point) => ({ x: point.x * source.width, y: point.y * source.height }));
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const width = Math.max(1, Math.round(Math.max(distance(p[0], p[1]), distance(p[2], p[3]))));
    const height = Math.max(1, Math.round(Math.max(distance(p[0], p[3]), distance(p[1], p[2]))));
    const from = cv.matFromArray(4, 1, cv.CV_32FC2, p.flatMap((q) => [q.x, q.y]));
    const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width - 1, 0, width - 1, height - 1, 0, height - 1]);
    const transform = cv.getPerspectiveTransform(from, to);
    try { cv.warpPerspective(src, dst, transform, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REPLICATE); }
    finally { from.delete(); to.delete(); transform.delete(); }
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; cv.imshow(canvas, dst); return canvas;
  } finally { src.delete(); dst.delete(); }
}

/** Analiz küçük kopyada yapılır; dönen koordinatlar kaynak görsele göre normalize edilir. */
export async function analyseImage(file, { mode = "visual" } = {}) {
  const canvas = await canvasFrom(file, 1200);
  const quality = analyseImageQuality(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height), canvas.width, canvas.height);
  let candidate = null, warning = null;
  try { candidate = await detectQuestionRegion(canvas); }
  catch (error) { warning = error.message || "OpenCV kullanılamadı; manuel kırpma kullanılabilir."; }
  return { candidate, quality, mode, warning };
}

/** Kırpma yalnızca bellek içindeki Canvas kopyasına uygulanır; orijinal Blob değişmez. */
export async function processImage(file, options = {}) {
  if (!(file instanceof Blob)) throw new Error("processImage bir File/Blob bekler.");
  const mode = options.mode === "document" ? "document" : "visual";
  // Görseli varsayılan olarak küçültmüyoruz. Tam çözünürlük korunur; yalnızca
  // açıkça maxSide verilirse küçültme yapılır. Bu, soru metninin yakınlaştırmada
  // düşük çözünürlüklü bir kopyaya dönüşmesini engeller.
  let source = await canvasFrom(file, options.maxSide ?? null);
  let perspectiveCorrected = false;
  if (options.perspectivePoints) {
    try { source = await perspectiveCanvas(source, options.perspectivePoints); perspectiveCorrected = true; }
    catch (_) { /* Perspective başarısızsa aynı orijinal kopya ile güvenli şekilde sürer. */ }
  }
  const crop = normalizeCrop(options.crop);
  const sx = crop ? Math.round(crop.x * source.width) : 0, sy = crop ? Math.round(crop.y * source.height) : 0;
  const sw = crop ? Math.max(1, Math.round(crop.width * source.width)) : source.width, sh = crop ? Math.max(1, Math.round(crop.height * source.height)) : source.height;
  const output = document.createElement("canvas"); output.width = sw; output.height = sh;
  const ctx = output.getContext("2d", { alpha: false });
  // visual modu renk/şekilleri korur; document modunda da siyah-beyaz threshold uygulanmaz.
  ctx.filter = mode === "document" ? "brightness(1.04) contrast(1.08)" : "brightness(1.02) contrast(1.04)";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh); ctx.filter = "none";
  const quality = analyseImageQuality(ctx.getImageData(0, 0, output.width, output.height), output.width, output.height);
  const mimeType = options.mimeType || "image/jpeg";
  const encodeQuality = options.quality ?? .97;
  const blob = await blobFrom(output, mimeType, encodeQuality);
  return { blob, meta: { width: output.width, height: output.height, mimeType: blob.type || mimeType, originalSize: file.size, compressedSize: blob.size, quality, processing: { version: "2.0", mode, perspectiveCorrected, enhanced: true, crop: crop ? { x: sx, y: sy, width: sw, height: sh } : null } } };
}

export async function makeThumbnail(file, options = {}) {
  const canvas = await canvasFrom(file, options.maxWidth || 320);
  const mimeType = options.mimeType || "image/webp", blob = await blobFrom(canvas, mimeType, options.quality || .7);
  return { blob, meta: { width: canvas.width, height: canvas.height, mimeType: blob.type || mimeType } };
}

/** Convert a Blob/File to a base64 data string without retaining the Blob. */
export async function blobToBase64(blob) {
  if (!(blob instanceof Blob)) throw new TypeError("blobToBase64 bir Blob/File bekler.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
}
