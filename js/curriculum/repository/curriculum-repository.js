import { curriculumDedupKey } from "../core/index.js";
export class CurriculumRepository {
  constructor(db) { this.db = db; }
  async getById(id) { return this.db.curriculum.get(id); }
  async getByCode(code) { return this.db.curriculum.where("code").equals(code).toArray(); }
  async findBySubject(subject) { return this.db.curriculum.where("subject").equals(subject).toArray(); }
  async findByTopic(subject, topic) { return this.db.curriculum.where("[subject+topic]").equals([subject, topic]).toArray(); }
  async findByExam(exam, subject = null) { return subject ? this.db.curriculum.where("[exam+subject]").equals([exam, subject]).toArray() : this.db.curriculum.where("exam").equals(exam).toArray(); }
  async search(query = {}) { const rows = query.exam && query.subject ? await this.findByExam(query.exam, query.subject) : query.subject ? await this.findBySubject(query.subject) : query.exam ? await this.findByExam(query.exam) : await this.db.curriculum.toArray(); const needle = query.text?.toLocaleLowerCase("tr-TR"); return rows.filter((row) => (!query.grade || String(row.grade) === String(query.grade)) && (!query.unit || row.unit === query.unit) && (!query.topic || row.topic === query.topic) && (!needle || `${row.code || ""} ${row.text} ${(row.explanations || []).join(" ")}`.toLocaleLowerCase("tr-TR").includes(needle))); }
  async replaceAll(records) { await this.db.curriculum.clear(); if (records.length) await this.db.curriculum.bulkAdd(records); return { imported: records.length, duplicates: 0 }; }
  async importMany(records) {
    const existing = await this.db.curriculum.toArray();
    const keys = new Set(existing.map(curriculumDedupKey));
    const ids = new Set(existing.map((row) => row.id));
    const accepted = [];
    let duplicates = 0;

    for (const record of records) {
      const key = curriculumDedupKey(record);
      if (keys.has(key) || ids.has(record.id)) {
        duplicates++;
        continue;
      }
      keys.add(key);
      ids.add(record.id);
      accepted.push(record);
    }

    if (accepted.length) await this.db.curriculum.bulkAdd(accepted);
    return { imported: accepted.length, duplicates };
  }
}
