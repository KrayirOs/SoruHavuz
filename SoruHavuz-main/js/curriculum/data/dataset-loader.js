import { createCurriculumRecord } from "../core/index.js";
import { CURRICULUM_DATASET_BASE_URL, CURRICULUM_DATASET_FILES } from "./catalog.js";

export function mapDatasetOutcome(row, { fileName, importedAt }) {
  if (!row?.id || !row.kazanim_kodu || !row.kazanim || !row.ders) throw new TypeError(`Invalid curriculum source row in ${fileName}.`);
  return createCurriculumRecord({ sourceRecordId: row.id, sourceOrder: row.sira ?? null, sourceComment: row.yorum ?? null, sourceTags: Array.isArray(row.etiketler) ? row.etiketler : [], exam: null, subject: row.ders, grade: row.sinif ?? null, unit: row.unite ?? null, topic: row.konu ?? null, code: row.kazanim_kodu, text: row.kazanim, explanations: row.aciklama ? [row.aciklama] : [], source: { documentId: `kazanımlar/${fileName}`, documentName: fileName, page: 1 } }, { id: row.id, importedAt });
}

export class CurriculumDatasetLoader {
  constructor({ repository, fetchFn = (...args) => globalThis.fetch(...args), clock = () => new Date().toISOString(), files = CURRICULUM_DATASET_FILES, baseUrl = CURRICULUM_DATASET_BASE_URL } = {}) { this.repository = repository; this.fetchFn = fetchFn; this.clock = clock; this.files = files; this.baseUrl = baseUrl; }
  async load() {
    if (!this.repository) throw new TypeError("Curriculum repository is required.");
    const importedAt = this.clock(), records = [];
    for (const fileName of this.files) { const response = await this.fetchFn(new URL(fileName, this.baseUrl)); if (!response.ok) throw new Error(`Curriculum dataset could not be loaded: ${fileName}`); const rows = await response.json(); if (!Array.isArray(rows)) throw new TypeError(`Curriculum dataset is not an array: ${fileName}`); rows.forEach((row) => records.push(mapDatasetOutcome(row, { fileName, importedAt }))); }
    const result = await this.repository.importMany(records);
    return { files: this.files.length, recordsDetected: records.length, ...result };
  }
  async synchronize() {
    if (!this.repository || typeof this.repository.replaceAll !== "function") throw new TypeError("Curriculum repository replaceAll() is required.");
    const importedAt = this.clock(), records = [];
    for (const fileName of this.files) { const response = await this.fetchFn(new URL(fileName, this.baseUrl)); if (!response.ok) throw new Error(`Curriculum dataset could not be loaded: ${fileName}`); const rows = await response.json(); if (!Array.isArray(rows)) throw new TypeError(`Curriculum dataset is not an array: ${fileName}`); rows.forEach((row) => records.push(mapDatasetOutcome(row, { fileName, importedAt }))); }
    const result = await this.repository.replaceAll(records);
    return { files: this.files.length, recordsDetected: records.length, ...result };
  }
}
