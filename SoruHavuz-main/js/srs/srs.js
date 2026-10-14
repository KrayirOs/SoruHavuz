export const DEFAULT_SRS_INTERVALS = Object.freeze([1, 2, 4, 7, 14, 30, 60]);

export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysToDateStr(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + Number(days));
  return localDateStr(date);
}

export function normalizeIntervals(value = DEFAULT_SRS_INTERVALS) {
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const intervals = raw.map(Number).filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.round(n));
  return intervals.length ? intervals.slice(0, 20) : [...DEFAULT_SRS_INTERVALS];
}

export function createSRS(now = new Date()) {
  return {
    stage: 0,
    nextReviewDate: localDateStr(now),
    reviewCount: 0,
    lastReviewedAt: null,
    lastResult: null
  };
}

export function normalizeSRS(value, now = new Date()) {
  const base = createSRS(now);
  const source = value && typeof value === "object" ? value : {};
  return {
    stage: Number.isInteger(source.stage) && source.stage >= 0 ? source.stage : base.stage,
    nextReviewDate: typeof source.nextReviewDate === "string" ? source.nextReviewDate : base.nextReviewDate,
    reviewCount: Number.isInteger(source.reviewCount) && source.reviewCount >= 0 ? source.reviewCount : base.reviewCount,
    lastReviewedAt: source.lastReviewedAt || null,
    lastResult: source.lastResult || null
  };
}

export function isDue(item, today = localDateStr()) {
  return (item?.srs?.nextReviewDate || today) <= today;
}

export function applyReview(value, result, { now = new Date(), intervals = DEFAULT_SRS_INTERVALS, resetOnWrong = true } = {}) {
  const current = normalizeSRS(value, now);
  const schedule = normalizeIntervals(intervals);
  const previousStage = Math.min(current.stage, schedule.length - 1);
  let stage = previousStage;

  if (result === "correct") stage = Math.min(previousStage + 1, schedule.length - 1);
  else if (result === "wrong" && resetOnWrong) stage = 0;

  const today = localDateStr(now);
  return {
    stage,
    nextReviewDate: addDaysToDateStr(today, schedule[stage]),
    reviewCount: current.reviewCount + 1,
    lastReviewedAt: now.toISOString(),
    lastResult: result
  };
}
