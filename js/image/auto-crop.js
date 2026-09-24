import { loadOpenCv } from "./opencv-loader.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function orderPoints(points) {
  const bySum = [...points].sort((a, b) => a.x + a.y - b.x - b.y);
  const topLeft = bySum[0], bottomRight = bySum[3];
  const rest = points.filter((p) => p !== topLeft && p !== bottomRight).sort((a, b) => a.y - a.x - (b.y - b.x));
  return [topLeft, rest[0], bottomRight, rest[1]]; // TL, TR, BR, BL
}

export async function detectQuestionRegion(canvas) {
  const cv = await loadOpenCv();
  const src = cv.imread(canvas), gray = new cv.Mat(), blurred = new cv.Mat(), edges = new cv.Mat();
  const contours = new cv.MatVector(), hierarchy = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    const area = canvas.width * canvas.height;
    let best = null;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i), perimeter = cv.arcLength(contour, true), approx = new cv.Mat();
      try {
        cv.approxPolyDP(contour, approx, .02 * perimeter, true);
        const contourArea = cv.contourArea(contour);
        if (approx.rows !== 4 || contourArea < area * .08) continue;
        const rect = cv.boundingRect(approx), fill = contourArea / Math.max(1, rect.width * rect.height);
        const borderDistance = Math.min(rect.x, rect.y, canvas.width - rect.x - rect.width, canvas.height - rect.y - rect.height) / Math.max(canvas.width, canvas.height);
        const score = (contourArea / area) * .65 + clamp(fill, 0, 1) * .25 + clamp(borderDistance * 12, 0, .1);
        if (!best || score > best.score) {
          const raw = Array.from({ length: 4 }, (_, index) => ({ x: approx.intPtr(index, 0)[0], y: approx.intPtr(index, 0)[1] }));
          best = { x: rect.x / canvas.width, y: rect.y / canvas.height, width: rect.width / canvas.width, height: rect.height / canvas.height, points: orderPoints(raw).map((p) => ({ x: p.x / canvas.width, y: p.y / canvas.height })), score, perspectiveCorrected: true };
        }
      } finally { contour.delete(); approx.delete(); }
    }
    return best;
  } finally { src.delete(); gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hierarchy.delete(); }
}
