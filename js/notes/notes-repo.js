import { db, RepoError } from "../db/dexie-db.js";
import { createSRS, normalizeSRS } from "../srs/srs.js";

function normalize(input = {}) {
  const title = String(input.title || "").trim();
  if (!title) throw new RepoError("Not başlığı boş olamaz.");
  return {
    title,
    content: String(input.content || "").trim(),
    subjectId: input.subjectId || null,
    subjectName: input.subjectName || null,
    topicId: input.topicId || null,
    topicName: input.topicName || null,
    learningOutcomeId: input.learningOutcomeId || null,
    learningOutcomeCode: input.learningOutcomeCode || null,
    learningOutcomeText: input.learningOutcomeText || null,
    tags: Array.isArray(input.tags) ? input.tags.filter(Boolean).slice(0, 30) : [],
    imageAssetId: input.imageAssetId ?? null,
    favorite: Boolean(input.favorite),
    srs: normalizeSRS(input.srs || createSRS()),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function createNote(input) {
  const note = normalize(input);
  const id = await db.notes.add(note);
  return { id, ...note };
}
export async function getNote(id) { return db.notes.get(Number(id)); }
export async function listNotes(filters = {}) {
  let rows = await db.notes.toArray();
  if (filters.subjectId) rows = rows.filter(n => n.subjectId === filters.subjectId);
  if (filters.topicId) rows = rows.filter(n => n.topicId === filters.topicId);
  if (filters.favorite) rows = rows.filter(n => n.favorite);
  if (filters.search) { const q = filters.search.toLocaleLowerCase("tr-TR"); rows = rows.filter(n => `${n.title} ${n.content} ${n.topicName} ${n.tags.join(" ")}`.toLocaleLowerCase("tr-TR").includes(q)); }
  return rows.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function updateNote(id, patch) {
  const current = await getNote(id);
  if (!current) throw new RepoError("Not bulunamadı.");
  const next = normalize({ ...current, ...(typeof patch === "function" ? patch(current) : patch) });
  next.id = Number(id);
  await db.notes.put(next);
  return next;
}
export async function deleteNote(id) { await db.notes.delete(Number(id)); return true; }
export async function toggleFavorite(id) { return updateNote(id, n => ({ favorite: !n.favorite })); }
