import { QuestionSolvingService } from "./question-solving-service.js";

export function createBrowserQuestionSolvingService(options = {}) {
  return new QuestionSolvingService(options);
}
