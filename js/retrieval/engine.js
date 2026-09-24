import { lexicalJaccard } from "./text-similarity.js"
import { normalizeQuestionType } from "../questions/question-config.js";

export const RETRIEVAL_SCORE_VERSION = "v1";
export const RETRIEVAL_CONFIG = Object.freeze({ scoreVersion: RETRIEVAL_SCORE_VERSION, candidateLimit: 500, defaultLimit: 20, diversity: .7, weights: { lexical: .35, curriculum: .3, questionType: .15, difficulty: .2 } });
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const setScore = (wanted, present) => !wanted.length ? 0 : wanted.filter((item) => present.includes(item)).length / wanted.length;
const normalizeText = (text) => String(text || "").replace(/\s+/g, " ").trim();

export function normalizeRetrievalQuery(raw = {}, config = RETRIEVAL_CONFIG) {
  const difficulty = raw.difficulty || {};
  const excludedQuestionIds = raw.excludedQuestionIds instanceof Set ? [...raw.excludedQuestionIds] : raw.excludedQuestionIds || [];
  const solvedQuestionIds = raw.solvedQuestionIds instanceof Set ? [...raw.solvedQuestionIds] : raw.solvedQuestionIds || [];
  return { subjectId: raw.subjectId || null, unitName: raw.unitName || null, topicName: raw.topicName || null, grade: raw.grade == null || raw.grade === "" ? null : String(raw.grade), learningOutcomeIds: [...new Set(raw.learningOutcomeIds || [])], questionTypes: [...new Set((raw.questionTypes || []).map(normalizeQuestionType).filter(Boolean))], difficulty: { min: Number.isFinite(Number(difficulty.min)) ? Number(difficulty.min) : null, max: Number.isFinite(Number(difficulty.max)) ? Number(difficulty.max) : null }, solvedPolicy: ["exclude", "include", "prefer_unsolved"].includes(raw.solvedPolicy) ? raw.solvedPolicy : "exclude", excludedQuestionIds: new Set(excludedQuestionIds.map(Number)), solvedQuestionIds: new Set(solvedQuestionIds.map(Number)), limit: raw.limit === null || raw.limit === "" || raw.limit === "all" ? null : clamp(Number(raw.limit) || config.defaultLimit, 1, 1000), diversity: clamp(Number(raw.diversity ?? config.diversity)), queryText: normalizeText(raw.queryText), allowCrossUnit: Boolean(raw.allowCrossUnit) };
}
export function hardFilter(question, query) {
  if (question.status === "archived" || question.status === "deleted") return "status";
  if (query.excludedQuestionIds.has(Number(question.id))) return "excluded";
  if (query.subjectId && question.metadata?.subject?.id !== query.subjectId) return "subject";
  if (query.grade && String(question.metadata?.grade ?? "") !== query.grade) return "grade";
  if (query.unitName && String(question.metadata?.unit?.name ?? "") !== query.unitName) return "unit";
  if (query.topicName && String(question.metadata?.topic?.name ?? "") !== query.topicName) return "topic";
  if (query.learningOutcomeIds.length && !query.learningOutcomeIds.includes(question.learningOutcome?.id)) return "learningOutcome";
  if (query.questionTypes.length && !query.questionTypes.includes(question.classification?.questionType)) return "questionType";
  if (query.solvedPolicy === "exclude" && query.solvedQuestionIds.has(Number(question.id))) return "solved";
  const d = Number(question.metadata?.difficulty?.value);
  if (query.difficulty.min !== null && (!Number.isFinite(d) || d < query.difficulty.min)) return "difficulty";
  if (query.difficulty.max !== null && (!Number.isFinite(d) || d > query.difficulty.max)) return "difficulty";
  return null;
}
export function scoreQuestion(question, query, config = RETRIEVAL_CONFIG) {
  const lexicalScore = query.queryText ? lexicalJaccard(query.queryText, question.question?.content?.text) : 0;
  const curriculumScore = query.learningOutcomeIds.length ? Number(query.learningOutcomeIds.includes(question.learningOutcome?.id)) : 0;
  const questionTypeScore = query.questionTypes.length ? Number(query.questionTypes.includes(question.classification?.questionType)) : 0;
  const target = query.difficulty.min !== null && query.difficulty.max !== null ? (query.difficulty.min + query.difficulty.max) / 2 : null, actual = Number(question.metadata?.difficulty?.value);
  const difficultyScore = target === null || !Number.isFinite(actual) ? 0 : clamp(1 - Math.abs(target - actual) / 4);
  const features = { lexicalScore, curriculumScore, questionTypeScore, difficultyScore, solvedState: query.solvedQuestionIds.has(Number(question.id)) ? "solved" : "unsolved" };
  let finalScore = Object.entries(config.weights).reduce((sum, [key, weight]) => sum + (features[`${key}Score`] || 0) * weight, 0);
  if (query.solvedPolicy === "prefer_unsolved" && features.solvedState === "unsolved") finalScore += .03;
  const reasons = []; if (curriculumScore) reasons.push("learning_outcome_match"); if (questionTypeScore) reasons.push("question_type_match"); if (difficultyScore) reasons.push("difficulty_match"); if (lexicalScore) reasons.push("text_match");
  return { features, finalScore: clamp(finalScore), reasons, scoreVersion: config.scoreVersion };
}
export function redundancy(left, right) { const text = lexicalJaccard(left.question?.content?.text, right.question?.content?.text); const curriculum = left.learningOutcome?.id && left.learningOutcome.id === right.learningOutcome?.id ? 1 : 0; return .75 * text + .25 * curriculum; }
export function mmrSelect(ranked, limit, diversity) {
  const selected = [], remaining = ranked.map((item) => ({ ...item, similarityPenalty: 0 })), lambda = 1 - diversity;
  // Maintain max(candidate, selected) incrementally. This is equivalent to
  // recomputing MMR each round but avoids repeating prior pair comparisons.
  while (remaining.length && selected.length < limit) {
    let bestIndex = 0, best = -Infinity;
    remaining.forEach((item, index) => { const score = lambda * item.finalScore - diversity * item.similarityPenalty; if (score > best) { best = score; bestIndex = index; } });
    const chosen = remaining.splice(bestIndex, 1)[0]; selected.push(chosen);
    for (const item of remaining) item.similarityPenalty = Math.max(item.similarityPenalty, redundancy(item.question, chosen.question));
  }
  return selected;
}
export class IntelligentQuestionRetrievalService {
  constructor({ candidateSource, config = RETRIEVAL_CONFIG }) { this.candidateSource = candidateSource; this.config = config; }
  async retrieve(rawQuery = {}) { const query = normalizeRetrievalQuery(rawQuery, this.config), source = await this.candidateSource(query); const rejected = new Map(), candidates = []; for (const question of source) { const reason = hardFilter(question, query); if (reason) { rejected.set(reason, (rejected.get(reason) || 0) + 1); continue; } candidates.push(question); if (query.limit !== null && Number.isFinite(this.config.candidateLimit) && candidates.length >= this.config.candidateLimit) break; } const ranked = candidates.map((question) => ({ question, ...scoreQuestion(question, query, this.config) })).sort((a,b) => b.finalScore - a.finalScore || Number(a.question.id) - Number(b.question.id)); const selected = mmrSelect(ranked, query.limit ?? ranked.length, query.diversity).map((item, index) => ({ questionId: item.question.id, rank: index + 1, relevanceScore: item.finalScore, reasons: item.reasons, features: item.features, scoreVersion: item.scoreVersion, similarityPenalty: item.similarityPenalty || 0, question: item.question })); return { query, candidateCount: candidates.length, resultCount: selected.length, results: selected, emptyReasons: selected.length ? [] : [...rejected.keys()] }; }
}
