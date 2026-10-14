export function buildRecommendationContext({ studentId, mastery = [], events = [] }) {
  const masteryBySkill = Object.fromEntries(mastery.map((row) => [row.skillId, row]));
  const exposureByQuestion = {};
  const exposureBySkill = {};
  const recentErrors = {};
  const ordered = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const event of events) {
    exposureByQuestion[event.questionId] = (exposureByQuestion[event.questionId] || 0) + 1;
    for (const skill of event.skillIds || []) exposureBySkill[skill] = (exposureBySkill[skill] || 0) + 1;
  }

  ordered.slice(0, 5).forEach((event, index) => {
    if (!event.isCorrect) for (const skill of event.skillIds || []) recentErrors[skill] = Math.max(recentErrors[skill] || 0, Math.pow(.75, index));
  });

  return {
    studentId,
    masteryBySkill,
    exposureByQuestion,
    exposureBySkill,
    recentErrors,
    recentAttempts: ordered.slice(0, 5),
    totalAttempts: events.length,
    stateVersion: `${mastery.map((row) => `${row.skillId}:${row.updatedAt}`).sort().join("|")}:${ordered[0]?.id || "none"}`
  };
}

export async function getBrowserRecommendationContext(studentId) {
  const { db } = await import("../db/dexie-db.js");
  const [mastery, events] = await Promise.all([db.studentMastery.where("studentId").equals(studentId).toArray(), db.attemptEvents.where("studentId").equals(studentId).toArray()]);
  return buildRecommendationContext({ studentId, mastery, events });
}
