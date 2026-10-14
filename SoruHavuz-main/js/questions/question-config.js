export const QUESTION_TYPES = Object.freeze([
  { id: "bilgi", label: "Bilgi", aiValues: ["conceptual", "definition", "knowledge"] },
  { id: "yorum", label: "Yorum", aiValues: ["interpretation", "commentary"] },
  { id: "işlem", label: "İşlem", aiValues: ["calculation", "procedural"] },
  { id: "grafik", label: "Grafik", aiValues: ["graph", "chart"] },
  { id: "tablo", label: "Tablo", aiValues: ["table"] },
  { id: "problem", label: "Problem", aiValues: ["problem_solving", "problem"] },
  { id: "deney", label: "Deney", aiValues: ["experiment"] },
  { id: "paragraf", label: "Paragraf", aiValues: ["paragraph", "reading_comprehension"] },
  { id: "diğer", label: "Diğer", aiValues: ["other"] }
]);

export function normalizeQuestionType(value) {
  if (!value) return null;
  const key = String(value).toLocaleLowerCase("tr-TR");
  return QUESTION_TYPES.find((item) => item.id === key || item.aiValues.includes(key))?.id || "diğer";
}
