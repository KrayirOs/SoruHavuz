export const MASTERY_MODEL_VERSION = "deterministic-v1";
export const DETERMINISTIC_MASTERY_CONFIG = Object.freeze({ priorSuccesses: 1, priorFailures: 1, recencyDecayPerDay: .015, confidenceScale: 10, recentWindow: 5 });
const clamp = (value) => Math.max(0, Math.min(1, value));
const daysBetween = (a, b) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export function initialMastery(studentId, skillId, now = new Date().toISOString()) { return { id: `${studentId}:${skillId}`, studentId, skillId, mastery: .5, confidence: 0, attempts: 0, successes: 0, failures: 0, recentAccuracy: null, recentErrors: 0, streak: 0, exposure: 0, lastAttemptAt: null, modelVersion: MASTERY_MODEL_VERSION, updatedAt: now, processedEventIds: [] }; }
export function reduceDeterministic(state, event, config = DETERMINISTIC_MASTERY_CONFIG) {
  if (state.processedEventIds?.includes(event.id)) return state;
  const next = structuredClone(state), correct = event.isCorrect === true;
  next.attempts++; next.exposure++; if (correct) next.successes++; else next.failures++;
  next.streak = correct ? Math.max(1, next.streak + 1) : Math.min(-1, next.streak - 1);
  const age = next.lastAttemptAt ? daysBetween(next.lastAttemptAt, event.timestamp) : 0, decay = Math.exp(-config.recencyDecayPerDay * age);
  const priorWeight = Math.max(1, next.attempts - 1) * decay;
  const previous = Number.isFinite(next.mastery) ? next.mastery : .5;
  const evidence = (next.successes + config.priorSuccesses) / (next.attempts + config.priorSuccesses + config.priorFailures);
  next.mastery = clamp((previous * priorWeight + evidence) / (priorWeight + 1));
  const recent = [...(next._recent || []), correct].slice(-config.recentWindow); next._recent = recent; next.recentAccuracy = recent.filter(Boolean).length / recent.length; next.recentErrors = recent.filter((value) => !value).length;
  const consistency = 1 - Math.abs(next.recentAccuracy - .5) * 2; next.confidence = clamp((1 - Math.exp(-next.attempts / config.confidenceScale)) * (.5 + .5 * consistency));
  next.lastAttemptAt = event.timestamp; next.updatedAt = event.createdAt; next.modelVersion = MASTERY_MODEL_VERSION; next.processedEventIds = [...(next.processedEventIds || []), event.id].slice(-100);
  return next;
}
export function buildDeterministicMastery(studentId, skillId, events, config) { return events.filter((event) => event.skillIds.includes(skillId)).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).reduce((state,event) => reduceDeterministic(state,event,config), initialMastery(studentId,skillId)); }
export function predictDeterministic(events) { if (!events.length) return .5; const state = buildDeterministicMastery(events[0].studentId, events[0].skillIds[0], events); return state.mastery; }

export function predictPFA(events, config = { intercept: 0, successWeight: .35, failureWeight: -.25 }) { const success = events.filter((event) => event.isCorrect).length, failure = events.length - success; return 1 / (1 + Math.exp(-(config.intercept + success * config.successWeight + failure * config.failureWeight))); }
export function predictBKT(events, config = { pL0: .3, pT: .1, pG: .2, pS: .1 }) { let p = config.pL0; for (const event of events) { const likelihood = event.isCorrect ? p * (1-config.pS) + (1-p)*config.pG : p*config.pS + (1-p)*(1-config.pG); p = event.isCorrect ? p*(1-config.pS)/likelihood : p*config.pS/likelihood; p += (1-p)*config.pT; } return clamp(p); }
export function predictMultiElo(events, config = { initial: 0, k: .4 }) { let rating = config.initial; for (const event of events) { const p = 1/(1+Math.exp(-rating)); rating += config.k*((event.isCorrect?1:0)-p); } return 1/(1+Math.exp(-rating)); }
