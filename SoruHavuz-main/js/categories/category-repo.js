import { db } from "../db/dexie-db.js";

export function normalizeCategoryName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export function categoryNameOf(record) {
  return record?.category?.name || record?.categoryName || record?.metadata?.topic?.name || record?.topicName || "";
}

export async function ensureCategory(value) {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!name) return null;
  const normalizedName = normalizeCategoryName(name);
  const existing = await db.categories.where("normalizedName").equals(normalizedName).first();
  if (existing) return existing;
  const now = new Date().toISOString();
  const id = await db.categories.add({ name, normalizedName, createdAt: now, updatedAt: now });
  return { id, name, normalizedName, createdAt: now, updatedAt: now };
}

export async function listCategories() {
  return (await db.categories.toArray()).sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
}

/** Eski konu/ders alanlarını veri kaybetmeden kategoriye dönüştürür. */
export async function migrateLegacyCategories() {
  const [questions, notes] = await Promise.all([db.questions.toArray(), db.notes.toArray()]);
  const names = new Set([...questions, ...notes].map(categoryNameOf).filter(Boolean));
  for (const name of names) await ensureCategory(name);
  const categories = await listCategories();
  const byName = new Map(categories.map((category) => [category.normalizedName, category]));
  await db.transaction("rw", db.questions, db.notes, async () => {
    for (const question of questions) {
      const category = byName.get(normalizeCategoryName(categoryNameOf(question)));
      if (category && question.category?.id !== category.id) {
        await db.questions.update(question.id, { category: { id: category.id, name: category.name, normalizedName: category.normalizedName } });
      }
    }
    for (const note of notes) {
      const category = byName.get(normalizeCategoryName(categoryNameOf(note)));
      if (category && note.category?.id !== category.id) {
        await db.notes.update(note.id, { category: { id: category.id, name: category.name, normalizedName: category.normalizedName } });
      }
    }
  });
}
