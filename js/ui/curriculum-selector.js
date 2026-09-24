import { curriculumSubjectsPresent } from "../curriculum/core/subject-mapping.js";

const option = (value, label) => `<option value="${String(value ?? "").replaceAll('"', '&quot;')}">${label}</option>`;
const unique = (values) => [...new Set(values.filter((item) => item !== null && item !== undefined && item !== ""))]
  .sort((a, b) => String(a).localeCompare(String(b), "tr-TR"));

/** Shared, canonical-only cascading curriculum picker for create and edit pages. */
export function createCurriculumSelector(root, records, onChange = () => {}) {
  const controls = Object.fromEntries(["subject", "grade", "unit", "topic", "outcome"].map((key) => [key, root.querySelector(`[data-curriculum-${key}]`)]));
  if (Object.values(controls).some((control) => !control)) throw new Error("Kazanım seçim alanları bulunamadı.");
  let selected = null;
  const fill = (control, values, placeholder, formatter = (value) => value) => {
    control.innerHTML = option("", placeholder) + values.map((value) => option(value.id ?? value, formatter(value))).join("");
    control.disabled = values.length === 0;
  };
  const filtered = () => records.filter((row) =>
    (!controls.subject.value || row.subject === controls.subject.value)
    && (!controls.grade.value || String(row.grade) === controls.grade.value)
    && (!controls.unit.value || row.unit === controls.unit.value)
    && (!controls.topic.value || row.topic === controls.topic.value));
  const refresh = (level) => {
    if (level <= 0) fill(controls.subject, curriculumSubjectsPresent(records), "Ders seçin");
    if (level <= 1) fill(controls.grade, unique(filtered().map((row) => row.grade)), "Sınıf seçin");
    if (level <= 2) fill(controls.unit, unique(filtered().map((row) => row.unit)), "Ünite seçin");
    if (level <= 3) fill(controls.topic, unique(filtered().map((row) => row.topic)), "Konu seçin");
    if (level <= 4) fill(controls.outcome, filtered(), "Kazanım seçin", (row) => `${row.code || "—"} — ${row.text}`);
  };
  const clearAfter = (key) => {
    const keys = ["subject", "grade", "unit", "topic", "outcome"];
    keys.slice(keys.indexOf(key) + 1).forEach((name) => { controls[name].value = ""; });
    selected = null; onChange(null);
  };
  ["subject", "grade", "unit", "topic"].forEach((key, index) => controls[key].addEventListener("change", () => { clearAfter(key); refresh(index + 1); }));
  controls.outcome.addEventListener("change", () => {
    selected = records.find((row) => row.id === controls.outcome.value) || null;
    onChange(selected);
  });
  refresh(0);
  return {
    get selected() { return selected; },
    setSelected(id) {
      const row = records.find((item) => item.id === id);
      if (!row) return false;
      controls.subject.value = row.subject; refresh(1);
      controls.grade.value = String(row.grade ?? ""); refresh(2);
      controls.unit.value = row.unit || ""; refresh(3);
      controls.topic.value = row.topic || ""; refresh(4);
      controls.outcome.value = row.id; selected = row; onChange(row); return true;
    }
  };
}
