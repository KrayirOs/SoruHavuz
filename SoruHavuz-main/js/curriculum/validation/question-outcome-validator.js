import { curriculumSubjectForApp, normalizeSubjectName } from "../core/subject-mapping.js";

const same = (a, b) => !a || !b || String(a).trim() === String(b).trim();
const sameSubject = (questionSubject, outcomeSubject) => !questionSubject || !outcomeSubject
  || normalizeSubjectName(curriculumSubjectForApp(questionSubject)) === normalizeSubjectName(outcomeSubject);

export async function validateQuestionLearningOutcome(question, repository) {
  const selectedId = question.learningOutcome?.id;
  if (!selectedId) return { valid: true, errors: [], outcome: null };

  const outcome = await repository.getById(selectedId);
  if (!outcome) return { valid: false, errors: ["Seçilen kazanım canonical curriculum tablosunda bulunamadı."], outcome: null };

  const metadata = question.metadata || {};
  const errors = [];
  if (!sameSubject(metadata.subject, outcome.subject)) errors.push("Seçilen kazanımın dersi soru dersiyle uyuşmuyor.");
  if (!same(metadata.grade, outcome.grade)) errors.push("Seçilen kazanımın sınıfı soru sınıfıyla uyuşmuyor.");
  if (!same(metadata.unit?.name || metadata.unit?.id, outcome.unit)) errors.push("Seçilen kazanımın ünitesi soru ünitesiyle uyuşmuyor.");
  if (!same(metadata.topic?.name || metadata.topic?.id, outcome.topic)) errors.push("Seçilen kazanımın konusu soru konusuyla uyuşmuyor.");
  return { valid: errors.length === 0, errors, outcome };
}

export function synchronizeLearningOutcomeSnapshot(question, outcome) {
  if (!outcome) return question;
  return {
    ...question,
    learningOutcome: {
      ...question.learningOutcome,
      id: outcome.id,
      code: outcome.code || null,
      text: outcome.text || null,
      confidence: question.learningOutcome?.confidence ?? null,
      source: question.learningOutcome?.source || "manual"
    }
  };
}
