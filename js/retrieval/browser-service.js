import { IntelligentQuestionRetrievalService, hardFilter } from "./engine.js";

/** Browser/Dexie adapter; future server retrieval can replace only this source. */
export function createBrowserQuestionRetrievalService() {
  return new IntelligentQuestionRetrievalService({ candidateSource: async (query) => {
    const { db } = await import("../db/dexie-db.js");
    // Choose the most selective native index first. Never rely on arbitrary
    // insertion order when a grade/outcome constraint has been requested.
    let rows;
    if (query.unitName || query.topicName || query.limit === null) rows = await db.questions.toCollection().toArray();
    else if (query.learningOutcomeIds.length === 1) rows = await db.questions.where("learningOutcome.id").equals(query.learningOutcomeIds[0]).toArray();
    else if (query.subjectId && query.grade) rows = await db.questions.where("[metadata.subject.id+metadata.grade]").equals([query.subjectId, query.grade]).toArray();
    else if (query.subjectId) rows = await db.questions.where("metadata.subject.id").equals(query.subjectId).toArray();
    else rows = await db.questions.toCollection().limit(1000).toArray();
    // This early pass preserves candidate recall for selective constraints and
    // bounds the later lexical/ranking work in the engine.
    const filtered = rows.filter((question) => !hardFilter(question, query));
    return query.limit === null ? filtered : filtered.slice(0, 1000);
  } });
}
