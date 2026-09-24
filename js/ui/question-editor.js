// ui/question-editor.js: Formdan Sprint 3 soru nesnesi güncellemesini üretir.
import { buildBlocks, isReadyForSave } from "../questions/question-model.js";

export function collectEditorData(question, root) {
  const next = structuredClone(question), subject = root.querySelector("#subject"), topic = root.querySelector("#topic");
  const text = root.querySelector("#questionText").value;
  next.metadata.exam = { ...next.metadata.exam, type: root.querySelector("#examType").value, year: Number(root.querySelector("#year").value) || null };
  next.metadata.subject = { id: subject.value || null, name: subject.selectedOptions[0]?.textContent || null };
  next.metadata.topic = { id: topic.value.trim().toLowerCase().replace(/\s+/g, "-") || null, name: topic.value.trim() || null };
  next.metadata.difficulty = { value: Number(root.querySelector("#difficulty").value) || null, source: "user", confidence: null };
  next.metadata.tags = root.querySelector("#tags").value.split(",").map((tag) => tag.trim()).filter(Boolean);
  const solution = root.querySelector("#solution");
  const questionType = root.querySelector("#questionType");
  if (solution) next.question.content.solution = solution.value.trim() || null;
  if (questionType) { next.classification ??= {}; next.classification.questionType = questionType.value || null; }
  // Eski choice verisi silinmez; aktif blok yapısına tekrar eklenmez.
  next.question.content.text = text;
  next.question.content.blocks = buildBlocks({ text, processedAssetId: next.question.assets.processed, choices: [] });
  next.status = isReadyForSave(next) ? "ready" : "draft";
  return next;
}
