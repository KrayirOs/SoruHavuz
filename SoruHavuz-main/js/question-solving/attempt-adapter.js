// Converts solving-layer answer/result into the StudentEventService.submitAttempt input
export function buildAttemptInput({ solving, session, sessionItem, question, answer, clock = () => new Date().toISOString(), idFactory = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `evt-${Date.now()}-${Math.random()}`) }) {
  const timeSpentMs = Number((answer.elapsedSeconds ?? 0) * 1000);
  const isCorrect = answer.result === "correct";
  const outcome = answer.result === "unanswered" ? "blank" : (isCorrect ? "correct" : "wrong");

  return {
    id: answer.requestId || idFactory(),
    studentId: session.studentId,
    questionId: Number(question.id),
    isCorrect,
    outcome,
    timeSpentMs,
    attemptNumber: 1,
    hintUsed: false,
    solutionViewed: false,
    skipped: false,
    source: "practice",
    timestamp: clock(),
    // adapter: preserving question snapshot fields consumed by event service
    questionSnapshot: undefined
  };
}
