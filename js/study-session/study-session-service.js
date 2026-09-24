import * as SessionRepository from "./session-repository.js";
import { DeterministicRecommendationEngine } from "../recommendation/engine.js";
import { buildRecommendationContext } from "../recommendation/context.js";
import { CurriculumRepository } from "../curriculum/repository/curriculum-repository.js";
import { STUDY_SESSION_VERSION } from "./session-repository.js";
import { createBrowserQuestionRetrievalService } from "../retrieval/browser-service.js";

export const SESSION_STATUS = Object.freeze({ draft: "draft", ready: "ready", active: "active", completed: "completed", cancelled: "cancelled" });
const MAX_QUESTION_COUNT = 100;

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function clampCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count <= 0) throw createError("INVALID_CONFIG", "questionCount must be a positive integer.");
  if (count > MAX_QUESTION_COUNT) throw createError("INVALID_CONFIG", `questionCount must be less than or equal to ${MAX_QUESTION_COUNT}.`);
  return count;
}

function clampTimeLimit(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) throw createError("INVALID_CONFIG", "timeLimitMinutes must be a non-negative number.");
  return minutes;
}

function normalizeTargetSkills(skills) {
  if (skills == null) return [];
  if (!Array.isArray(skills)) throw createError("INVALID_SKILL", "targetSkills must be an array.");
  return [...new Set(skills.map((skill) => String(skill).trim()).filter(Boolean))];
}

function snapshotSessionItem(item, candidate, recommendationMetadata) {
  return {
    position: item.position,
    questionId: candidate.id ?? candidate.questionId,
    questionFingerprint: candidate.questionFingerprint ?? candidate.question?.questionFingerprint ?? null,
    recommendationScore: recommendationMetadata.score,
    selectionReason: recommendationMetadata.reasons?.slice(0, 3) ?? [],
    retrievalScore: candidate.relevanceScore ?? candidate.finalScore ?? null,
    masteryGap: recommendationMetadata.featureScores?.masteryGap ?? null,
    difficultyFit: recommendationMetadata.featureScores?.difficultyFit ?? null,
    expectedLearningGain: recommendationMetadata.featureScores?.expectedLearningGain ?? null,
    exposure: recommendationMetadata.featureScores?.exposurePenalty ?? null,
    diversityPenalty: recommendationMetadata.featureScores?.redundancyPenalty ?? null,
    rankingReasons: recommendationMetadata.reasons ?? []
  };
}

function createSessionPayload({ studentId, subject, grade, questionCount, timeLimitMinutes, targetSkills, targetLearningOutcomes, questionIds, items, status, startedAt, completedAt, reasonMessages }) {
  const now = new Date().toISOString();
  return {
    studentId,
    subject,
    grade,
    questionCount,
    timeLimitMinutes,
    targetSkills,
    targetLearningOutcomes,
    questionIds,
    items,
    currentIndex: 0,
    status,
    startedAt: startedAt || null,
    completedAt: completedAt || null,
    sessionVersion: STUDY_SESSION_VERSION,
    recommendationVersion: "adaptive-v1",
    reasonMessages,
    createdAt: now,
    updatedAt: now
  };
}

function buildSessionReasons({ targetSkills, targetLearningOutcomes, candidateCount }) {
  const reasons = [];
  if (targetLearningOutcomes?.length) reasons.push("Target a specific learning outcome");
  if (targetSkills?.length) reasons.push("Targeted skill practice");
  if (candidateCount && candidateCount > 0) reasons.push("Selected from available pool based on relevance and mastery gap");
  return reasons;
}

export class StudySessionService {
  constructor({ studentEventService, questionRepository, curriculumRepository, retrievalService, recommendationEngine, sessionRepository } = {}) {
    this.studentEventService = studentEventService;
    this.questionRepository = questionRepository;
    this.curriculumRepository = curriculumRepository || (this.questionRepository ? new CurriculumRepository(this.questionRepository.db) : null);
    this.retrievalService = retrievalService || createBrowserQuestionRetrievalService();
    this.recommendationEngine = recommendationEngine || new DeterministicRecommendationEngine();
    this.sessionRepository = sessionRepository || SessionRepository;
  }

  async validateConfig(config) {
    if (!config || typeof config !== "object") throw createError("INVALID_CONFIG", "Session config is required.");
    if (!config.studentId?.trim()) throw createError("INVALID_STUDENT", "studentId is required.");
    if (!config.subject?.trim()) throw createError("INVALID_SUBJECT", "subject is required.");
    if (config.grade == null || String(config.grade).trim() === "") throw createError("INVALID_GRADE", "grade is required.");
    const questionCount = clampCount(config.questionCount);
    const timeLimitMinutes = clampTimeLimit(config.timeLimitMinutes ?? 0);
    const targetSkills = normalizeTargetSkills(config.targetSkills);
    const targetLearningOutcomes = config.targetLearningOutcomes ? [...new Set(config.targetLearningOutcomes.map((id) => String(id).trim()).filter(Boolean))] : [];

    if (targetLearningOutcomes.length && !this.curriculumRepository) {
      throw createError("INVALID_CONFIG", "Curriculum repository is required to validate learning outcomes.");
    }

    for (const id of targetLearningOutcomes) {
      if (!(await this.curriculumRepository.getById(id))) throw createError("INVALID_LEARNING_OUTCOME", "Invalid learning outcome.");
    }

    return { questionCount, timeLimitMinutes, targetSkills, targetLearningOutcomes };
  }

  async buildCandidateQuery(config, solvedQuestionIds = new Set()) {
    return {
      subjectId: config.subject,
      grade: config.grade,
      learningOutcomeIds: config.targetLearningOutcomes,
      skillIds: config.targetSkills,
      questionTypes: config.questionType ? [config.questionType] : [],
      difficulty: config.difficulty ? { min: config.difficulty.min ?? null, max: config.difficulty.max ?? null } : { min: null, max: null },
      excludedQuestionIds: new Set(config.excludeQuestionIds || []),
      solvedQuestionIds: new Set(solvedQuestionIds),
      limit: Math.max(100, config.questionCount * 3),
      diversity: 0.7,
      queryText: "",
      solvedPolicy: "exclude"
    };
  }

  async buildRecommendationContext(studentId) {
    const mastery = this.studentEventService ? await this.studentEventService.getMastery(studentId) : [];
    let events = [];
    if (this.studentEventService?.db?.attemptEvents) {
      events = await this.studentEventService.db.attemptEvents.where("studentId").equals(studentId).toArray();
    }
    return buildRecommendationContext({ studentId, mastery, events });
  }

  async createSession(config, { requestId } = {}) {
    const validated = await this.validateConfig(config);
    const recommendationContext = await this.buildRecommendationContext(config.studentId);
    const solvedQuestionIds = new Set((recommendationContext.recentAttempts || []).map((event) => Number(event.questionId)).filter(Number.isFinite));
    // recentAttempts is intentionally bounded; use the full exposure map for solved filtering.
    const fullExposureQuestionIds = new Set(Object.keys(recommendationContext.exposureByQuestion || {}).map(Number).filter(Number.isFinite));
    const query = await this.buildCandidateQuery({ ...config, ...validated }, fullExposureQuestionIds);
    const candidatePool = await this.retrievalService.retrieve(query);
    const recommendationResult = await this.recommendationEngine.recommend({
      studentId: config.studentId,
      candidates: candidatePool.results,
      recommendationContext,
      limit: validated.questionCount
    });

    const selected = recommendationResult.recommendations || [];
    if (selected.length !== validated.questionCount) {
      throw createError("INSUFFICIENT_CANDIDATES", `İstenen ${validated.questionCount} soru için yalnızca ${selected.length} uygun soru bulundu.`);
    }
    const items = selected.map((recommendation, index) => {
      const candidate = recommendation.candidate || candidatePool.results.find((item) => item.questionId === recommendation.questionId);
      return snapshotSessionItem({ position: index + 1 }, candidate, {
        score: recommendation.score,
        reasons: recommendation.reasons,
        featureScores: recommendation.featureScores
      });
    });
    const questionIds = selected.map((recommendation) => recommendation.questionId);
    const status = selected.length ? SESSION_STATUS.ready : SESSION_STATUS.draft;
    const reasonMessages = buildSessionReasons({ targetSkills: validated.targetSkills, targetLearningOutcomes: validated.targetLearningOutcomes, candidateCount: selected.length });
    const session = createSessionPayload({
      studentId: config.studentId,
      subject: config.subject,
      grade: config.grade,
      questionCount: selected.length,
      timeLimitMinutes: validated.timeLimitMinutes,
      targetSkills: validated.targetSkills,
      targetLearningOutcomes: validated.targetLearningOutcomes,
      questionIds,
      items,
      status,
      reasonMessages
    });

    return this.sessionRepository.createSessionRecord(session);
  }

  async startSession(sessionId) {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session) throw createError("SESSION_NOT_FOUND", "Session not found.");
    if (session.status === SESSION_STATUS.completed) throw createError("SESSION_ALREADY_COMPLETED", "Completed session cannot be started.");
    if (session.status === SESSION_STATUS.cancelled) throw createError("SESSION_CANCELLED", "Cancelled session cannot be started.");
    if (session.status === SESSION_STATUS.active) return session;
    if (![SESSION_STATUS.draft, SESSION_STATUS.ready].includes(session.status)) throw createError("SESSION_INVALID_STATE", "Session cannot be started.");
    return this.sessionRepository.updateSessionRecord(sessionId, (current) => ({ ...current, status: SESSION_STATUS.active, startedAt: current.startedAt || new Date().toISOString(), updatedAt: new Date().toISOString() }));
  }

  async getCurrentItem(sessionId) {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session) throw createError("SESSION_NOT_FOUND", "Session not found.");
    const index = Number(session.currentIndex || 0);
    return session.items[index] || null;
  }

  async completeSession(sessionId) {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session) throw createError("SESSION_NOT_FOUND", "Session not found.");
    if (session.status === SESSION_STATUS.completed) return session;
    if (session.status === SESSION_STATUS.cancelled) throw createError("SESSION_CANCELLED", "Cancelled session cannot be completed.");
    const items = Array.isArray(session.items) ? session.items : [];
    if (!items.length || items.some((item) => !item.submittedAt)) {
      throw createError("SESSION_INCOMPLETE", "Session cannot be completed before every item is submitted.");
    }
    if (session.status !== SESSION_STATUS.active) throw createError("SESSION_INVALID_STATE", "Only an active session can be completed.");
    return this.sessionRepository.updateSessionRecord(sessionId, (current) => ({ ...current, status: SESSION_STATUS.completed, completedAt: current.completedAt || new Date().toISOString(), updatedAt: new Date().toISOString() }));
  }

  async cancelSession(sessionId) {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session) throw createError("SESSION_NOT_FOUND", "Session not found.");
    if (session.status === SESSION_STATUS.completed) throw createError("SESSION_ALREADY_COMPLETED", "Completed session cannot be cancelled.");
    if (session.status === SESSION_STATUS.cancelled) return session;
    return this.sessionRepository.updateSessionRecord(sessionId, (current) => ({ ...current, status: SESSION_STATUS.cancelled, updatedAt: new Date().toISOString() }));
  }
}
