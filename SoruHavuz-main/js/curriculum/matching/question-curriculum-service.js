import { applyCurriculumCandidates, selectCurriculumCandidate } from "../../questions/question-model.js";

// Question verisini canonical kazanım kaydına yalnızca immutable `id` ile bağlar.
export class QuestionCurriculumService {
  constructor({ questionRepo, curriculumRepository, matcher }) { this.questionRepo = questionRepo; this.curriculumRepository = curriculumRepository; this.matcher = matcher; }
  async suggest(questionId) {
    const question = await this.questionRepo.getQuestion(questionId);
    if (!question) throw new Error("Question not found.");
    const match = await this.matcher.match({ exam: question.metadata?.exam?.type ?? null, question });
    return this.questionRepo.updateQuestion(questionId, (current) => applyCurriculumCandidates(current, match.candidates));
  }
  async select(questionId, curriculumId, reviewedBy = "user") {
    const outcome = await this.curriculumRepository.getById(curriculumId);
    if (!outcome) throw new Error("Learning outcome not found.");
    const question = await this.questionRepo.getQuestion(questionId);
    if (!question) throw new Error("Question not found.");
    return this.questionRepo.updateQuestion(questionId, (current) => ({ ...selectCurriculumCandidate({ ...current, curriculumMatch: { ...(current.curriculumMatch || {}), candidates: current.curriculumMatch?.candidates?.length ? current.curriculumMatch.candidates : [{ curriculumId, score: null, reasons: ["manual_selection"] }] } }, curriculumId, reviewedBy), learningOutcome: { id: outcome.id, code: outcome.code, text: outcome.text, confidence: null } }));
  }
}
