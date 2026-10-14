export const CURRICULUM_SCHEMA_VERSION = "1.0";
export function createCurriculumRecord(input, { id, importedAt }) {
  return { id, exam: input.exam ?? null, subject: input.subject ?? null, grade: input.grade ?? null, unit: input.unit ?? null, topic: input.topic ?? null, code: input.code ?? null, text: input.text ?? "", explanations: input.explanations ?? [], source: { documentId: input.source?.documentId ?? null, documentName: input.source?.documentName ?? null, page: input.source?.page ?? null }, metadata: { importedAt, schemaVersion: CURRICULUM_SCHEMA_VERSION, sourceRecordId: input.sourceRecordId ?? null, sourceOrder: input.sourceOrder ?? null, sourceComment: input.sourceComment ?? null, sourceTags: input.sourceTags ?? [] } };
}
// Outcome codes are only unique within a curriculum context: for example,
// multiple subjects can legitimately contain "9.1.1.1". Include the subject
// and grade so importing one subject never suppresses another.
export function curriculumDedupKey(record) { return record.code ? `${record.source.documentId}::${record.subject || ""}::${record.grade || ""}::${record.code}` : `${record.source.documentId}::${record.exam}|${record.subject}|${record.grade}|${record.unit}|${record.topic}|${record.text}`; }
