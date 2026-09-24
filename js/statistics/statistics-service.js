import { localDateStr, isDue } from "../srs/srs.js";

export function buildStatistics(questions = [], notes = [], { today = localDateStr() } = {}) {
  const q = questions.filter(x => x?.status !== "archived" && x?.status !== "deleted");
  const n = notes.filter(x => x?.deleted !== true);
  const solved = q.filter(x => Number(x.statistics?.timesSolved || 0) > 0);
  const correct = q.reduce((s,x)=>s+Number(x.statistics?.correct||0),0);
  const wrong = q.reduce((s,x)=>s+Number(x.statistics?.wrong||0),0);
  const blank = q.reduce((s,x)=>s+Number(x.statistics?.blank||0),0);
  const attempts = correct + wrong + blank;
  const dueQuestions = q.filter(x => isDue(x,today)).length;
  const dueNotes = n.filter(x => isDue(x,today)).length;
  const subjectMap = new Map();
  for (const x of q) { const key=x.metadata?.subject?.name||x.metadata?.subject?.id||"Bilinmeyen"; const row=subjectMap.get(key)||{subject:key,total:0,solved:0,correct:0,wrong:0,attempts:0}; row.total++; row.solved += Number(x.statistics?.timesSolved||0)>0?1:0; row.correct += Number(x.statistics?.correct||0); row.wrong += Number(x.statistics?.wrong||0); row.attempts += Number(x.statistics?.correct||0)+Number(x.statistics?.wrong||0)+Number(x.statistics?.blank||0); subjectMap.set(key,row); }
  return { totalQuestions:q.length, solvedQuestions:solved.length, unsolvedQuestions:q.length-solved.length, totalNotes:n.length, dueToday:dueQuestions+dueNotes, dueQuestions, dueNotes, attempts, correct, wrong, blank, accuracy:attempts?correct/attempts:0, subjects:[...subjectMap.values()].sort((a,b)=>b.attempts-a.attempts||b.total-a.total) };
}
