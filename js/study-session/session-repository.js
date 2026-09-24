export const STUDY_SESSION_VERSION = "v1";

function createRepoError(message) {
  const error = new Error(message);
  error.name = "RepoError";
  return error;
}

async function getDb() {
  return await import("../db/dexie-db.js");
}

export async function getSession(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) throw createRepoError("Geçersiz session id.");
  const { db } = await getDb();
  return db.studySessions.get(numericId);
}

export async function createSessionRecord(session) {
  const { db } = await getDb();
  return db.transaction("rw", db.studySessions, async () => {
    const id = await db.studySessions.add(session);
    return db.studySessions.get(id);
  });
}

export async function updateSessionRecord(id, patchFn) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) throw createRepoError("Geçersiz session id.");
  const { db } = await getDb();
  return db.transaction("rw", db.studySessions, async () => {
    const current = await db.studySessions.get(numericId);
    if (!current) throw createRepoError("SESSION_NOT_FOUND");
    const next = typeof patchFn === "function" ? patchFn(current) : { ...current, ...patchFn };
    next.id = numericId;
    await db.studySessions.put(next);
    return next;
  });
}

export async function querySessions(filters = {}) {
  const { db } = await getDb();
  const all = await db.studySessions.toArray();
  return all.filter((session) => {
    if (filters.studentId && session.studentId !== filters.studentId) return false;
    if (filters.status && session.status !== filters.status) return false;
    return true;
  });
}
