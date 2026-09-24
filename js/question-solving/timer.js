export function computeElapsedSeconds(startedAtIso, nowIso = new Date().toISOString()) {
  if (!startedAtIso) return 0;
  const started = new Date(startedAtIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(now)) throw new TypeError("INVALID_TIMESTAMP");
  const diff = Math.floor((now - started) / 1000);
  return diff < 0 ? 0 : diff;
}
