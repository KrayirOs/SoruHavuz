// Canonical curriculum subject names and application subject ids meet here.
// Do not duplicate this normalization in forms, matchers or repositories.
const normalize = (value) => String(value || "")
  .toLocaleUpperCase("tr-TR")
  .replace(/İ/g, "I")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]+/g, " ")
  .trim();

const entries = [
  ["mathematics", "Matematik", "MATEMATİK"],
  ["physics", "Fizik", "FİZİK"],
  ["chemistry", "Kimya", "KİMYA"],
  ["biology", "Biyoloji", "BİYOLOJİ"],
  ["history", "Tarih", "TARİH"],
  ["geography", "Coğrafya", "COĞRAFYA"],
  ["turkish", "Türkçe", "TÜRK DİLİ VE EDEBİYATI"],
  ["literature", "Edebiyat", "TÜRK DİLİ VE EDEBİYATI"]
];

const byAppId = new Map(entries.map(([id, name, curriculum]) => [id, { id, name, curriculum }]));
const byName = new Map(entries.flatMap(([id, name, curriculum]) => [
  [normalize(name), curriculum], [normalize(curriculum), curriculum]
]));

export function normalizeSubjectName(value) { return normalize(value); }

export function curriculumSubjectForApp(subject = {}) {
  if (typeof subject === "string") return byName.get(normalize(subject)) || subject;
  return byAppId.get(subject.id)?.curriculum || byName.get(normalize(subject.name)) || subject.name || null;
}

export function curriculumSubjectsPresent(rows = []) {
  return [...new Set(rows.map((row) => row.subject).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "tr-TR"));
}

export function appSubjectForCurriculum(curriculumSubject, examType = null) {
  const canonical = byName.get(normalize(curriculumSubject)) || curriculumSubject;
  if (canonical === "TÜRK DİLİ VE EDEBİYATI") {
    return examType === "AYT" ? byAppId.get("literature") : byAppId.get("turkish");
  }
  return [...byAppId.values()].find((entry) => entry.curriculum === canonical) || null;
}
