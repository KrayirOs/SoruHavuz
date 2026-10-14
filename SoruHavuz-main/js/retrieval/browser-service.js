import { IntelligentQuestionRetrievalService, hardFilter } from "./engine.js";

/** Browser/Dexie adapter; future server retrieval can replace only this source. */
export function createBrowserQuestionRetrievalService() {
  return new IntelligentQuestionRetrievalService({ candidateSource: async (query) => {
    const { db } = await import("../db/dexie-db.js");
    let rows;
    if (query.categoryId) rows = await db.questions.where("category.id").equals(query.categoryId).toArray();
    else rows = await db.questions.toCollection().limit(1000).toArray();
    // This early pass preserves candidate recall for selective constraints and
    // bounds the later lexical/ranking work in the engine.
    const filtered = rows.filter((question) => !hardFilter(question, query));
    return query.limit === null ? filtered : filtered.slice(0, 1000);
  } });
}
