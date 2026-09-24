// Extracted text is handled conservatively: unknown lines never become
// curriculum records. That prevents layout fragments from being persisted.
const headings = [["EXAM", "exam"], ["SINAV", "exam"], ["SUBJECT", "subject"], ["DERS", "subject"], ["GRADE", "grade"], ["SINIF", "grade"], ["UNIT", "unit"], ["ÜNİTE", "unit"], ["TOPIC", "topic"], ["KONU", "topic"]];
const outcomeCode = /^(?:[A-ZÇĞİÖŞÜ]{1,12}\.)?\d{1,2}(?:\.\d{1,3}){2,5}$/u;
const hasLowerCaseLetter = (value) => /\p{Ll}/u.test(value);
function plainMebHeading(line) {
  const gradeAndSubject = /^(\d{1,2})\.\s*SINIF\s+(.+?)\s+DERS(?:İ|I)?(?:\s+ÖĞRETİM\s+PROGRAMI)?$/iu.exec(line);
  if (gradeAndSubject) return { grade: gradeAndSubject[1], subject: gradeAndSubject[2] };
  const subjectAndGrade = /^(.+?)\s+DERS(?:İ|I)?\s+(\d{1,2})\.\s*SINIF(?:\s+ÖĞRETİM\s+PROGRAMI)?$/iu.exec(line);
  if (subjectAndGrade) return { subject: subjectAndGrade[1], grade: subjectAndGrade[2] };
  const subjectOnly = /^(.+?)\s+DERS(?:İ|I)?\s+ÖĞRETİM\s+PROGRAMI\b/iu.exec(line);
  if (subjectOnly) return { subject: subjectOnly[1] };
  const gradeOnly = /^(\d{1,2})\.\s*SINIF\b/iu.exec(line);
  return gradeOnly ? { grade: gradeOnly[1] } : null;
}

export function parseCurriculumText(text, source) {
  if (typeof text !== "string" || !text.trim()) return { records: [], warnings: [{ code: "EMPTY_EXTRACTION", message: "No extractable text." }] };
  const context = { exam: null, subject: null, grade: null, unit: null, topic: null }, records = [], warnings = [];
  text.split(/\f/).forEach((pageText, pageIndex) => pageText.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim(); if (!trimmed) return;
    const heading = headings.map(([prefix, key]) => [key, new RegExp(`^${prefix}\\s*:\\s*(.+)$`, "iu").exec(trimmed)]).find(([, match]) => match);
    if (heading) { context[heading[0]] = heading[1][1]; return; }
    const mebHeading = plainMebHeading(trimmed);
    if (mebHeading) { Object.assign(context, mebHeading); return; }
    const outcome = /^(?:KAZANIM\s*:\s*)?((?:[A-ZÇĞİÖŞÜ]{1,12}\.)?\d{1,2}(?:\.\s*\d{1,3}){2,5})\.?\s+(.+)$/u.exec(trimmed)
      || /^(?:KAZANIM\s*:\s*)?(.+?)\s*(?:[-–—:]|\.(?=\s))\s*(.+)$/u.exec(trimmed);
    const code = outcome?.[1].replace(/\s+/g, "").replace(/\.$/, "");
    if (!outcome || !outcomeCode.test(code) || !hasLowerCaseLetter(outcome[2]) || !context.subject) return;
    records.push({ ...context, code, text: outcome[2], explanations: [], source: { ...source, page: pageIndex + 1 } });
  }));
  if (!records.length) warnings.push({ code: "NO_RECORDS_DETECTED", message: "No outcomes with a recognised official code and subject context were detected." });
  return { records, warnings };
}
