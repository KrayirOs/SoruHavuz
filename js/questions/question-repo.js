// ============================================================================
// questions/question-repo.js
//
// Dexie "questions" tablosu uzerinde CRUD. Bu katman:
//  - question-model.js'teki saf fonksiyonlarla DB'yi birbirine baglar,
//  - asset-repo.js ile gorsel referanslarini yonetir,
//  - filtreleme/sorgulama (subject/topic/exam bazli) saglar.
//
// ONEMLI: Eski db.js'teki queryQuestions() gibi "hepsini cek, JS'te filtrele"
// yaklasimini burada da koruyoruz cunku Dexie compound index'leri (birden
// fazla dinamik filtreyi tek sorguda birlestirmek) bu asamada gereksiz
// karmasiklik katardi. Veri hacmi (rapordaki ~birkaç bin soru sinirinin
// altinda) bu yaklasim icin sorun olusturmaz. Olcek buyursen, Dexie'nin
// .where(...).and(...) veya compound index'lerine gecilebilir.
// ============================================================================

import { db, RepoError } from "../db/dexie-db.js";
import { createQuestionSkeleton, ensureStructuredContent } from "./question-model.js";
import { saveAsset, deleteAssetsForQuestion, relinkAssetsToQuestion } from "../assets/asset-repo.js";
import { CurriculumRepository } from "../curriculum/repository/curriculum-repository.js";
import { validateQuestionLearningOutcome, synchronizeLearningOutcomeSnapshot } from "../curriculum/validation/question-outcome-validator.js";

async function validateOutcomeBeforeSave(question) {
  const result = await validateQuestionLearningOutcome(question, new CurriculumRepository(db));
  if (!result.valid) throw new RepoError(result.errors.join(" "));
  return synchronizeLearningOutcomeSnapshot(question, result.outcome);
}

/**
 * Yeni bir soru olusturur. images verilirse (original/processed/thumbnail
 * Blob'lari) once assets tablosuna kaydedilir, sonra soru dokumanina
 * referanslari yazilir.
 *
 * @param {object} input - createQuestionSkeleton'a gidecek alanlar
 * @param {{original?: Blob, processed?: Blob, thumbnail?: Blob}} images
 */
export async function createQuestion(input, images = {}) {
  const skeleton = await validateOutcomeBeforeSave(createQuestionSkeleton(input));

  return db.transaction("rw", db.questions, db.assets, async () => {
    const assetRefs = {};

    for (const type of ["original", "processed", "thumbnail"]) {
      const blob = images[type];
      if (blob instanceof Blob) {
        const saved = await saveAsset(null, type, blob, images[`${type}Meta`] || {});
        assetRefs[type] = saved.id;
      }
    }

    skeleton.question.assets = {
      original: assetRefs.original ?? null,
      processed: assetRefs.processed ?? null,
      thumbnail: assetRefs.thumbnail ?? null
    };
    skeleton.question.visual.hasVisual = Boolean(assetRefs.original || assetRefs.processed);
    // İlk taslak, editör açılmadan önce de geçerli blok sırasına sahiptir.
    skeleton.question.content.blocks = [
      ...(skeleton.question.content.text ? [{ type: "text", content: skeleton.question.content.text }] : []),
      ...(assetRefs.processed ? [{ type: "image", assetId: assetRefs.processed }] : []),
      ...(skeleton.question.content.choices?.length ? [{ type: "choices", items: skeleton.question.content.choices }] : [])
    ];

    const id = await db.questions.add(skeleton);

    const idsToRelink = Object.values(assetRefs);
    if (idsToRelink.length) {
      await relinkAssetsToQuestion(idsToRelink, id);
    }

    return { id, ...skeleton };
  });
}

export async function getQuestion(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new RepoError("Gecersiz soru id.");
  }
  const question = await db.questions.get(numericId);
  return question ? ensureStructuredContent(question) : null;
}

export async function getAllQuestions() {
  return db.questions.toArray();
}

/**
 * Basit ama esnek filtreleme. Rapordaki "TYT Matematik - Fonksiyonlar - Orta
 * zorluk" gibi sorgular buradan gecer.
 */
export async function queryQuestions(filters = {}) {
  const all = await db.questions.toArray();

  return all
    .filter((q) => {
      if (filters.examType && q.metadata?.exam?.type !== filters.examType) return false;
      if (filters.subjectId && q.metadata?.subject?.id !== filters.subjectId) return false;
      if (filters.topicId && q.metadata?.topic?.id !== filters.topicId) return false;
      if (filters.grade && String(q.metadata?.grade ?? "") !== String(filters.grade)) return false;
      if (filters.unit && (q.metadata?.unit?.id !== filters.unit && q.metadata?.unit?.name !== filters.unit)) return false;
      if (filters.topic && (q.metadata?.topic?.id !== filters.topic && q.metadata?.topic?.name !== filters.topic)) return false;
      if (filters.learningOutcomeId && q.learningOutcome?.id !== filters.learningOutcomeId) return false;
      if (filters.source && (q.metadata?.source?.type !== filters.source && q.metadata?.source?.name !== filters.source)) return false;
      if (filters.difficultyValue && q.metadata?.difficulty?.value !== Number(filters.difficultyValue)) return false;
      if (filters.search) {
        const needle = filters.search.toLowerCase();
        const haystack = `${q.question?.content?.text || ""} ${q.metadata?.subject?.name || ""} ${q.metadata?.topic?.name || ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateQuestion(id, patchFn) {
  const numericId = Number(id);
  return db.transaction("rw", db.questions, db.curriculum, async () => {
    const current = await db.questions.get(numericId);
    if (!current) throw new RepoError(`Soru ${numericId} bulunamadi.`);

    let next = ensureStructuredContent(typeof patchFn === "function" ? patchFn(ensureStructuredContent(current)) : { ...current, ...patchFn });
    next = await validateOutcomeBeforeSave(next);
    next.id = numericId;
    next.updatedAt = new Date().toISOString();

    await db.questions.put(next);
    return next;
  });
}

export async function deleteQuestion(id) {
  const numericId = Number(id);
  return db.transaction("rw", db.questions, db.assets, async () => {
    await deleteAssetsForQuestion(numericId);
    await db.questions.delete(numericId);
    return true;
  });
}

export async function countQuestions() {
  return db.questions.count();
}
