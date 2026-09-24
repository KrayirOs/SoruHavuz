import Dexie from "https://unpkg.com/dexie@4/dist/modern/dexie.mjs";
import { createSRS } from "../srs/srs.js";

export const db = new Dexie("SoruHavuzuDB");
const base = {
  questions: ["++id", "metadata.exam.type", "metadata.subject.id", "metadata.topic.id", "metadata.difficulty.value", "createdAt"].join(", "),
  assets: ["++id", "questionId", "type"].join(", "),
  exams: ["++id", "examType", "createdAt"].join(", "), examPages: ["++id", "examId", "pageNumber"].join(", "), attempts: ["++id", "examId", "questionId", "answeredAt"].join(", "), settings: "key"
};
db.version(1).stores(base);
db.version(2).stores(base);
const v3 = { ...base, questions: ["++id", "metadata.exam.type", "metadata.subject.id", "metadata.topic.id", "metadata.difficulty.value", "metadata.tags*", "status", "createdAt"].join(", ") };
db.version(3).stores(v3).upgrade((tx) => tx.table("questions").toCollection().modify((q) => { q.question ??= {}; q.question.content ??= {}; if (!Array.isArray(q.question.content.blocks)) { const blocks = []; if (q.question.content.text) blocks.push({ type: "text", content: q.question.content.text }); if (q.question.assets?.processed) blocks.push({ type: "image", assetId: q.question.assets.processed }); if (q.question.content.choices?.length) blocks.push({ type: "choices", items: q.question.content.choices }); q.question.content.blocks = blocks; } q.status ??= "draft"; }));
const v4 = { ...v3 };
db.version(4).stores(v4);
const v5 = { ...v4, curriculum: ["++id", "id", "code", "exam", "subject", "topic", "[exam+subject]", "[subject+topic]", "source.documentId"].join(", ") };
db.version(5).stores(v5);
const v6 = { ...v5, pdfDocuments: ["++id", "id", "checksum", "extraction.extractorId", "extraction.extractorVersion", "createdAt"].join(", ") };
db.version(6).stores(v6);
// PDF extraction kaldırıldı: migration yalnızca pdfDocuments tablosunu siler.
db.version(7).stores(v5);
const v8 = { ...v5, questions: ["++id", "metadata.exam.type", "metadata.subject.id", "metadata.grade", "metadata.topic.id", "learningOutcome.id", "metadata.difficulty.value", "metadata.tags*", "status", "createdAt"].join(", ") };
db.version(8).stores(v8).upgrade((tx) => tx.table("questions").toCollection().modify((q) => {
  q.metadata ??= {};
  q.metadata.grade ??= null;
  q.metadata.unit ??= { id: null, name: null };
  q.question ??= {}; q.question.content ??= {};
  q.question.content.solution ??= null;
  q.classification ??= {}; q.classification.questionType ??= null;
  q.learningOutcome ??= { id: null, code: null, text: null, confidence: null, source: null };
  q.learningOutcome.source ??= null;
}));
const v9 = { ...v8, questions: ["++id", "metadata.exam.type", "metadata.subject.id", "metadata.grade", "metadata.topic.id", "learningOutcome.id", "questionFingerprint", "importId", "metadata.difficulty.value", "metadata.tags*", "status", "createdAt"].join(", "), imports: "id, status, createdAt", importErrors: "++id, importId, rowNumber, code" };
db.version(9).stores(v9).upgrade((tx) => tx.table("questions").toCollection().modify((q) => { q.questionFingerprint ??= null; q.fingerprintVersion ??= null; q.importId ??= null; }));
// Retrieval candidate generation only: subject+grade and outcome are observed hard-filter paths.
const v10 = { ...v9, questions: ["++id", "metadata.exam.type", "metadata.subject.id", "metadata.grade", "[metadata.subject.id+metadata.grade]", "metadata.topic.id", "learningOutcome.id", "classification.questionType", "questionFingerprint", "importId", "metadata.difficulty.value", "metadata.tags*", "status", "createdAt"].join(", ") };
db.version(10).stores(v10);
const v11 = { ...v10, attemptEvents: "id, studentId, questionId, timestamp, [studentId+timestamp], [studentId+questionId], [studentId+learningOutcomeId]", studentMastery: "id, studentId, skillId, [studentId+skillId], updatedAt", studentModelMeta: "id, studentId, updatedAt" };
db.version(11).stores(v11);
const v12 = { ...v11, studySessions: "++id, studentId, status, createdAt, updatedAt" };
db.version(12).stores(v12);
// Added studySolvings table for tracking active/archived solving instances (v13)
const v13 = { ...v12, studySolvings: "++id, sessionId, sessionItemId, questionId, status, startedAt, submittedAt, requestId" };
db.version(13).stores(v13);
const v14 = { ...v13, notes: "++id, title, subjectId, topicId, createdAt, updatedAt, favorite" };
db.version(14).stores(v14).upgrade((tx) => tx.table("questions").toCollection().modify((q) => { delete q.aiAnalysis; }));
const v15 = { ...v14 };
db.version(15).stores(v15).upgrade((tx) => {
  tx.table("questions").toCollection().modify((q) => { q.srs = q.srs || createSRS(); });
  tx.table("notes").toCollection().modify((n) => { n.srs = n.srs || createSRS(); });
});
const v16 = {
  ...v15,
  questions: [...v15.questions.split(", "), "srs.nextReviewDate"].join(", "),
  notes: ["++id", "title", "subjectId", "topicId", "learningOutcomeId", "srs.nextReviewDate", "createdAt", "updatedAt", "favorite"].join(", ")
};
db.version(16).stores(v16);

let openPromise = null;
export async function initDB() { if (!openPromise) openPromise = db.open(); await openPromise; return db; }
export class RepoError extends Error { constructor(message, cause) { super(message); this.name = "RepoError"; this.cause = cause; } }
