import { createBrowserQuestionRetrievalService } from "../retrieval/browser-service.js";
import { getBrowserRecommendationContext } from "./context.js";
import { DeterministicRecommendationEngine } from "./engine.js";

export function createBrowserAdaptiveRecommendationService() {
  const retrieval = createBrowserQuestionRetrievalService(), engine = new DeterministicRecommendationEngine();
  return { async recommend({ studentId, retrievalQuery = {}, limit = 20 }) { const [retrievalResult, context] = await Promise.all([retrieval.retrieve({ ...retrievalQuery, limit: Math.max(Number(limit) * 3, 50), solvedPolicy: "include" }), getBrowserRecommendationContext(studentId)]); const result = engine.recommend({ studentId, candidates: retrievalResult.results, recommendationContext: context, limit: Number(limit) }); return { ...result, retrievalDiagnostics: { candidateCount: retrievalResult.candidateCount, emptyReasons: retrievalResult.emptyReasons } }; } };
}
