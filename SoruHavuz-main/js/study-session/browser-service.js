import { StudySessionService } from "./study-session-service.js";

export function createBrowserStudySessionService(options = {}) {
  return new StudySessionService(options);
}
