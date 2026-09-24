import { createCurriculumRecord } from "../core/index.js";
import { normalizeExtractedRecord } from "./curriculum-normalizer.js";
import { parseCurriculumText } from "./curriculum-parser.js";

export function validateCurriculumRecord(record) {
  const errors = [];
  if (!record.id) errors.push({ code: "MISSING_ID" });
  if (!record.text) errors.push({ code: "MISSING_TEXT" });
  if (!record.subject) errors.push({ code: "MISSING_SUBJECT" });
  if (!record.code) errors.push({ code: "MISSING_OFFICIAL_CODE" });
  if (!record.source?.documentId || !record.source?.documentName || !Number.isInteger(record.source.page) || record.source.page < 1) errors.push({ code: "INVALID_SOURCE" });
  return { valid: !errors.length, errors, warnings: [] };
}

// Elle hazırlanan metin/JSON akışları için; PDF okuma sorumluluğu yoktur.
export class CurriculumImporter {
  constructor({ repository, createId = ({ documentId, record, index }) => `curriculum_${String(`${documentId}_${record.subject || "unknown"}_${record.grade || "unknown"}_${record.code || index}`).replace(/[^\w.-]/g, "_")}`, clock = () => new Date().toISOString() }) { this.repository = repository; this.createId = createId; this.clock = clock; }
  async importText(text, source) {
    if (!source?.documentId || !source?.documentName) return { success: false, code: "IMPORT_FAILED", message: "Document provenance is required." };
    const parsed = parseCurriculumText(text, source), warnings = [...parsed.warnings], records = [], errors = [];
    parsed.records.forEach((raw, index) => { const normalized = normalizeExtractedRecord(raw), record = createCurriculumRecord(normalized, { id: this.createId({ documentId: source.documentId, record: normalized, index }), importedAt: this.clock() }), validation = validateCurriculumRecord(record); if (validation.valid) records.push(record); else errors.push({ index, errors: validation.errors }); });
    if (errors.length) return { success: false, code: "IMPORT_FAILED", recordsDetected: parsed.records.length, imported: 0, duplicates: 0, warnings, errors };
    const persisted = await this.repository.importMany(records);
    return { success: true, document: source.documentName, recordsDetected: parsed.records.length, imported: persisted.imported, duplicates: persisted.duplicates, warnings, errors: [], subjects: [...new Set(records.map((record) => record.subject).filter(Boolean))], examGroups: [...new Set(records.map((record) => record.exam).filter(Boolean))] };
  }
}
