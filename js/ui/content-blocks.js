// ui/content-blocks.js: Form verisini bloklara dönüştürür ve güvenli önizleme DOM'u üretir.
export const CHOICE_IDS = ["A", "B", "C", "D", "E"];

export function readChoices(root) {
  return CHOICE_IDS.map((id) => ({ id, content: root.querySelector(`[name="choice-${id}"]`)?.value || "" }));
}

export function renderBlocksPreview(container, question, assetUrl, originalAssetUrl = "") {
  container.replaceChildren();
  for (const block of question.question.content.blocks || []) {
    if (block.type === "text") { const p = document.createElement("p"); p.textContent = block.content; container.appendChild(p); }
    if (block.type === "image" && (originalAssetUrl || assetUrl)) { const image = document.createElement("img"); image.className = "inline-image-full question-image"; image.src = originalAssetUrl || assetUrl; image.alt = "Soru görseli"; container.appendChild(image); }
    if (block.type === "choices") { const list = document.createElement("div"); list.className = "preview-choices"; for (const item of block.items) { const choice = document.createElement("div"); choice.textContent = `${item.id}) ${item.content}`; list.appendChild(choice); } container.appendChild(list); }
  }
}
