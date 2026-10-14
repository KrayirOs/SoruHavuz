export const QUESTION_INDEX_VERSION = "v1";

/** In-memory benchmark/prototype index. Browser production uses Dexie indexes. */
export class MetadataCandidateIndex {
  constructor() { this.bySubject = new Map(); this.bySubjectGrade = new Map(); this.byOutcome = new Map(); }
  add(question) { const subject = question.metadata?.subject?.id, grade = question.metadata?.grade, outcome = question.learningOutcome?.id; const push = (map, key) => { if (!key) return; const values = map.get(key) || []; values.push(question); map.set(key, values); }; push(this.bySubject, subject); push(this.bySubjectGrade, subject && grade != null ? `${subject}\u0000${grade}` : null); push(this.byOutcome, outcome); }
  build(records) { for (const record of records) this.add(record); return this; }
  candidates(query) { if (query.learningOutcomeIds?.length === 1) return this.byOutcome.get(query.learningOutcomeIds[0]) || []; if (query.subjectId && query.grade) return this.bySubjectGrade.get(`${query.subjectId}\u0000${query.grade}`) || []; if (query.subjectId) return this.bySubject.get(query.subjectId) || []; return []; }
}
