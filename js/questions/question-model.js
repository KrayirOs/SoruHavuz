// ============================================================================
// questions/question-model.js
//
// "Soru" dokumaninin sekli ve onunla ilgili SAF fonksiyonlar (DB'ye dokunmaz).
// Rapordaki dort bolumlu ayrimi birebir uyguluyoruz:
//
//   question     -> sorunun kendisi (icerik)
//   metadata     -> soru hakkinda bildiklerimiz (kullanici kaynakli, "gercek")
//   statistics   -> kullanicinin bu soruyla gecmisi (cozum sayisi, basari...)
//
// ============================================================================

import { SOURCE_TYPES } from "../core/constants.js";
import { normalizeQuestionType } from "./question-config.js";
import { createSRS } from "../srs/srs.js";

/**
 * Yeni bir soru iskeleti olusturur. Gorseller henuz assets tablosuna
 * kaydedilmemis olabilir; bu durumda question.assets.* alanlari null kalir
 * ve repo katmani (question-repo.js) bunlari asset kaydi olustuktan sonra
 * doldurur.
 */
export function createQuestionSkeleton(input = {}) {
  const now = new Date().toISOString();

  return {
    question: {
      content: {
        text: input.text || "",
        choices: Array.isArray(input.choices) ? input.choices : [],
        solution: input.solution || null,
        blocks: []
      },
      visual: {
        hasVisual: Boolean(input.hasVisual),
        hasFigure: false,
        hasGraph: false,
        hasTable: false,
        importance: 0
      },
      assets: {
        original: null,
        processed: null,
        thumbnail: null
      }
    },

    metadata: {
      exam: {
        type: input.examType || null,
        year: input.year ?? null
      },
      subject: {
        id: input.subjectId || null,
        name: input.subjectName || null
      },
      grade: input.grade ?? null,
      unit: {
        id: input.unitId || null,
        name: input.unitName || null
      },
      topic: {
        id: input.topicId || null,
        name: input.topicName || null
      },
      subtopic: null,
      difficulty: {
        value: input.difficultyValue ?? null,
        source: "user",
        confidence: null
      },
      source: {
        type: input.sourceType || SOURCE_TYPES.MANUAL,
        name: input.sourceName || null
      },
      tags: Array.isArray(input.tags) ? input.tags : []
    },

    answer: {
      correct: input.answer ?? null,
      source: "user"
    },

    classification: { questionType: normalizeQuestionType(input.questionType) },

    curriculumMatch: { status: "pending", candidates: [], selectedId: null, reviewedBy: null, reviewedAt: null },
    learningOutcome: {
      id: input.learningOutcome?.id || null,
      code: input.learningOutcome?.code || null,
      text: input.learningOutcome?.text || null,
      confidence: input.learningOutcome?.confidence ?? null,
      source: input.learningOutcome?.source || null
    },

    srs: createSRS(),

    statistics: {
      timesSolved: 0,
      correct: 0,
      wrong: 0,
      blank: 0,
      lastSolvedAt: null
    },

    status: input.status || "draft",

    createdAt: now,
    updatedAt: now
  };
}

/** Sprint 1/2 kayıtlarını blok tabanlı Sprint 3 görünümüne güvenle taşır. */
export function ensureStructuredContent(question) {
  const next = structuredClone(question);
  next.question ??= {}; next.question.content ??= {}; next.question.assets ??= {};
  next.question.content.solution ??= null;
  next.metadata ??= {}; next.metadata.grade ??= null; next.metadata.unit ??= { id: null, name: null };
  next.classification ??= {}; next.classification.questionType ??= null;
  next.learningOutcome ??= { id: null, code: null, text: null, confidence: null, source: null };
  next.learningOutcome.source ??= null;
  if (!Array.isArray(next.question.content.blocks)) {
    const blocks = [];
    if (next.question.content.text) blocks.push({ type: "text", content: next.question.content.text });
    if (next.question.assets.processed) blocks.push({ type: "image", assetId: next.question.assets.processed });
    if (next.question.content.choices?.length) blocks.push({ type: "choices", items: next.question.content.choices });
    next.question.content.blocks = blocks;
  }
  next.srs ??= createSRS();
  next.status ??= "draft";
  return next;
}

export function buildBlocks({ text, processedAssetId, choices }) {
  const blocks = [];
  if (text?.trim()) blocks.push({ type: "text", content: text.trim() });
  if (processedAssetId) blocks.push({ type: "image", assetId: processedAssetId });
  const filled = (choices || []).filter((item) => item.content?.trim()).map((item) => ({ id: item.id, content: item.content.trim() }));
  if (filled.length) blocks.push({ type: "choices", items: filled });
  return blocks;
}

export function isReadyForSave(question) {
  const metadata = question.metadata || {}, blocks = question.question?.content?.blocks || [];
  const text = blocks.some((block) => block.type === "text" && block.content?.trim());
  const image = blocks.some((block) => block.type === "image");
  // Şıklar soru fotoğrafında yer alır; ayrı bir şık girişi Sprint 3'te zorunlu değildir.
  return Boolean(metadata.exam?.type && metadata.subject?.id && metadata.topic?.name && question.learningOutcome?.id && (text || image));
}

/** Bir cozum girisimini statistics blogunda gunceller. */
export function recordAttemptOnQuestion(question, result) {
  const stats = { ...question.statistics };
  stats.timesSolved += 1;
  if (result === "correct") stats.correct += 1;
  else if (result === "wrong") stats.wrong += 1;
  else if (result === "blank") stats.blank += 1;
  stats.lastSolvedAt = new Date().toISOString();

  return {
    ...question,
    statistics: stats,
    updatedAt: new Date().toISOString()
  };
}

export function isQuestionReadyForReview(question) {
  return Boolean(question.question?.content?.text || question.question?.assets?.original);
}

/** Matcher adayları deterministik metadata ve canonical kazanımlardan üretilir. */
export function applyCurriculumCandidates(question, candidates) {
  return { ...question, curriculumMatch: { status: "pending", candidates: structuredClone(candidates), selectedId: null, reviewedBy: null, reviewedAt: null }, updatedAt: new Date().toISOString() };
}
export function selectCurriculumCandidate(question, curriculumId, reviewedBy = "user") {
  const match = question.curriculumMatch || { candidates: [] };
  if (!match.candidates.some((candidate) => candidate.curriculumId === curriculumId)) throw new TypeError("Curriculum candidate not found.");
  return { ...question, curriculumMatch: { ...match, status: "selected", selectedId: curriculumId, reviewedBy, reviewedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() };
}
