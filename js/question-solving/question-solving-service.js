import { recordAttemptOnQuestion } from "../questions/question-model.js";
import { computeElapsedSeconds } from "./timer.js";

function createError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

export class QuestionSolvingService {
  constructor({ studySessionService, studentEventService, questionRepository, sessionRepository, db = undefined, clock = () => new Date().toISOString(), idFactory = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sol-${Date.now()}-${Math.random()}`), staleAfterSeconds = 60 * 60 * 24 } = {}) {
    this.studySessionService = studySessionService;
    this.studentEventService = studentEventService;
    this.questionRepository = questionRepository;
    this.sessionRepository = sessionRepository || studySessionService?.sessionRepository;
    this.db = db; // if not provided, will import dynamically when needed
    this.clock = clock;
    this.idFactory = idFactory;
    this.staleAfterSeconds = staleAfterSeconds;
  }

  // sessionItemId in current sessions is represented by the 1-based position field.
  _resolveSessionItem(session, sessionItemId) {
    if (!session) return null;
    if (sessionItemId == null) return session.items[session.currentIndex] || null;
    const numeric = Number(sessionItemId);
    return session.items.find((it) => Number(it.position) === numeric) || null;
  }

  async startSolving(sessionId, sessionItemId = null) {
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session) throw createError("SESSION_NOT_FOUND", "Session not found");
    if (session.status !== "active") throw createError("SESSION_NOT_ACTIVE", "Session is not active");

    const item = this._resolveSessionItem(session, sessionItemId);
    if (!item) throw createError("SESSION_ITEM_NOT_FOUND", "Session item not found");

    const questionId = Number(item.questionId);
    const solving = {
      id: this.idFactory(),
      sessionId: Number(session.id),
      sessionItemId: Number(item.position),
      questionId,
      questionFingerprint: item.questionFingerprint || null,
      startedAt: this.clock(),
      submittedAt: null,
      elapsedSeconds: 0,
      status: "active"
    };

    const db = this.db || (await import("../db/dexie-db.js")).db;
    await db.transaction("rw", db.studySolvings, async () => {
      const id = await db.studySolvings.add(solving);
      // return stored record
      const stored = await db.studySolvings.get(id);
      return stored;
    });

    return solving;
  }

  async getActiveSolving(sessionId, sessionItemId) {
    const db = this.db || (await import("../db/dexie-db.js")).db;
    const where = db.studySolvings.where("sessionId").equals(Number(sessionId));
    const list = await where.toArray();
    const numericItem = Number(sessionItemId);
    return list.find((s) => Number(s.sessionItemId) === numericItem && s.status === "active") || null;
  }

  async submitAnswer(sessionId, sessionItemId, answer = {}, { requestId } = {}) {
    // validations
    const session = await this.sessionRepository.getSession(sessionId);
    if (!session) throw createError("SESSION_NOT_FOUND", "Session not found");
    if (session.status !== "active") throw createError("SESSION_NOT_ACTIVE", "Session not active");

    const item = this._resolveSessionItem(session, sessionItemId);
    if (!item) throw createError("SESSION_ITEM_NOT_FOUND", "Session item not found");

    // ensure the item belongs to the session (position match)
    const position = Number(item.position);

    // fetch canonical question
    const question = await this.questionRepository.getQuestion(item.questionId);
    if (!question) throw createError("QUESTION_NOT_FOUND", "Question not found");

    // validate answer shape
    const selected = answer.selectedOption ?? answer.selectedAnswer ?? null;
    if (selected == null && (answer.result !== "unanswered" && answer.result !== undefined)) {
      // allow explicit unanswered only
    }

    // compute elapsed
    const activeSolving = await this.getActiveSolving(sessionId, position).catch(() => null);
    const startedAt = (activeSolving && activeSolving.startedAt) || this.clock();
    const elapsedSeconds = computeElapsedSeconds(startedAt, this.clock());
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw createError("INVALID_DURATION", "Invalid elapsed time");

    // determine canonical result server-side
    let result;
    if (answer.result === "unanswered") {
      result = "unanswered";
    } else if (selected == null) {
      // treat missing selection as invalid
      throw createError("INVALID_ANSWER", "No selected answer provided");
    } else {
      // compare with question.answer.correct
      const canonical = question.answer?.correct ?? null;
      if (canonical == null) throw createError("QUESTION_SNAPSHOT_UNAVAILABLE", "Canonical answer not available");
      result = String(selected) === String(canonical) ? "correct" : "incorrect";
    }

    // idempotency: use requestId as attempt event id to avoid duplicates
    const attemptId = requestId || `attempt:${sessionId}:${position}:${startedAt}`;

    // prepare attempt input for StudentEventService
    const attemptInput = {
      id: attemptId,
      studentId: session.studentId,
      questionId: Number(question.id),
      isCorrect: result === "correct",
      outcome: result === "unanswered" ? "blank" : (result === "correct" ? "correct" : "wrong"),
      timeSpentMs: Number(elapsedSeconds * 1000),
      timestamp: this.clock(),
      attemptNumber: 1,
      hintUsed: false,
      solutionViewed: false,
      skipped: false,
      source: "study_session",
      sessionId: Number(session.id),
      sessionItemId: position,
      solvingId: activeSolving?.id || null
    };

    // ensure idempotency: StudentEventService.submitAttempt uses event.id to dedupe
    let eventResult;

    try {
      eventResult = await this.studentEventService.submitAttempt(attemptInput);
    } catch (err) {
      // If attempt already exists in event store, studentEventService may return existing event — propagate
      if (err && err.code === "DUPLICATE") {
        // Attempt already recorded; fetch existing and proceed
      } else {
        throw err;
      }
    }

    // persist solving record update and session progress atomically-ish
    const db = this.db || (await import("../db/dexie-db.js")).db;
    await db.transaction("rw", db.studySolvings, db.studySessions, db.questions, async () => {
      // mark solving as submitted
      const where = db.studySolvings.where("sessionId").equals(Number(sessionId));
      const list = await where.toArray();
      const solving = list.find((s) => Number(s.sessionItemId) === position && s.status === "active");
      if (solving) {
        solving.status = "submitted";
        solving.submittedAt = this.clock();
        solving.elapsedSeconds = elapsedSeconds;
        solving.requestId = requestId || null;
        await db.studySolvings.put(solving);
      }

      // Keep the question-level statistics in sync with the immutable attempt event.
      // A repeated requestId is idempotent and must not increment counters twice.
      if (!eventResult?.duplicate) {
        const currentQuestion = await db.questions.get(Number(question.id));
        if (currentQuestion) {
          const nextQuestion = recordAttemptOnQuestion(currentQuestion, result === "unanswered" ? "blank" : result);
          await db.questions.put(nextQuestion);
        }
      }

      // update session item state and progress
      await this.sessionRepository.updateSessionRecord(sessionId, (current) => {
        const idx = (current.items || []).findIndex((it) => Number(it.position) === position);
        if (idx === -1) throw createError("SESSION_ITEM_NOT_FOUND", "Session item not found when updating");
        const nextItems = structuredClone(current.items || []);
        nextItems[idx] = { ...nextItems[idx], submittedAt: this.clock(), result, elapsedSeconds };
        const submittedCount = (nextItems.filter((i) => i.submittedAt).length);
        const total = nextItems.length;
        const currentIndex = Math.min(current.currentIndex + 1, total - 1);
        const status = submittedCount === total ? "completed" : current.status;
        const updated = { ...current, items: nextItems, currentIndex, updatedAt: this.clock() };
        if (status === "completed") {
          updated.status = "completed";
          updated.completedAt = updated.completedAt || this.clock();
        }
        return updated;
      });
    });

    // return next item or session completed
    const updatedSession = await this.sessionRepository.getSession(sessionId);
    const totalItems = updatedSession.items.length;
    const submittedCount = updatedSession.items.filter((i) => i.submittedAt).length;
    const nextIndex = updatedSession.currentIndex;
    const hasNext = submittedCount < totalItems;

    return {
      status: hasNext ? "NEXT_ITEM_AVAILABLE" : "SESSION_COMPLETED",
      nextItem: hasNext ? updatedSession.items[nextIndex] : null,
      attemptEvent: eventResult?.event || null
    };
  }
}
