const XP_RULES = {
  lecture: 20,
  revision: 15,
  correctMcq: 2,
  incorrectMcq: 0.5,
  answerWriting: 30,
  plannerTask: 5,
  reading: 8
};

function sumActivities(db, type) {
  return db.activities.filter((a) => a.type === type).reduce((sum, a) => sum + Number(a.xp || 0), 0);
}

function totalXp(db) {
  return db.activities.reduce((sum, a) => sum + Number(a.xp || 0), 0);
}

function missionScore(db) {
  const todayPlan = getDatePlanner(db, todayKey());
  const daily = dailyCompletion(todayPlan).percent;
  const syllabus = overallSyllabusProgress(db);
  const streak = missionStreak(db);
  return Math.min(100, Math.round((daily * 0.35) + (syllabus * 0.45) + (Math.min(streak, 30) / 30 * 20)));
}

function levelInfo(db) {
  const xp = totalXp(db);
  const levelSize = Number(db.config.levelSize || 500);
  const level = Math.floor(xp / levelSize) + 1;
  const currentLevelXp = xp % levelSize;
  const nextLevelPercent = Math.round((currentLevelXp / levelSize) * 100);
  return { xp, level, levelSize, currentLevelXp, nextLevelPercent, remaining: levelSize - currentLevelXp };
}

function dateSetForActivity(db, predicate) {
  return new Set(db.activities.filter(predicate).map((a) => a.date));
}

function consecutiveStreak(dateSet, endDate = todayKey()) {
  let count = 0;
  let cursor = endDate;
  while (dateSet.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function missionStreak(db) {
  const goodDates = new Set();
  Object.entries(db.planner.byDate || {}).forEach(([date, dayPlan]) => {
    if (dailyCompletion(dayPlan).percent >= 60) goodDates.add(date);
  });
  db.activities.forEach((a) => {
    if (a.type === 'revision' || a.type === 'lecture' || a.type === 'answerWriting' || a.type === 'plannerTask') goodDates.add(a.date);
  });
  return consecutiveStreak(goodDates);
}

function readingStreak(db) {
  const readingDates = dateSetForActivity(db, (a) => a.type === 'reading' || a.type === 'currentAffairs');
  Object.entries(db.planner.byDate || {}).forEach(([date, dayPlan]) => {
    if ((dayPlan.tasks || []).some((task) => task.completed && /newspaper|current affairs/i.test(task.title))) readingDates.add(date);
  });
  return consecutiveStreak(readingDates);
}

function overallSyllabusProgress(db) {
  if (!db.lectures.length) return 0;
  const sum = db.lectures.reduce((total, lecture) => total + Number(lecture.progress || 0), 0);
  return Math.round(sum / db.lectures.length);
}

function subjectProgress(db) {
  const grouped = {};
  db.lectures.forEach((lecture) => {
    const key = lecture.subject || 'Uncategorised';
    grouped[key] = grouped[key] || { subject: key, count: 0, progress: 0, completed: 0 };
    grouped[key].count += 1;
    grouped[key].progress += Number(lecture.progress || 0);
    if (Number(lecture.progress || 0) >= 100) grouped[key].completed += 1;
  });
  return Object.values(grouped).map((row) => ({ ...row, average: row.count ? Math.round(row.progress / row.count) : 0 }));
}

function missionDay(db) {
  const start = db.config.missionStartDate || todayKey();
  const diff = Math.floor((new Date(`${todayKey()}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;
  return Math.max(1, diff);
}

function countdownToExam(db) {
  if (!db.config.examDate) return null;
  return Math.ceil((new Date(`${db.config.examDate}T00:00:00`) - new Date(`${todayKey()}T00:00:00`)) / 86400000);
}

function badgeStatus(db) {
  const lecturesCompleted = db.lectures.filter((l) => Number(l.progress) >= 100).length;
  const mcqsSolved = db.lectures.reduce((sum, l) => sum + Number(l.mcqsSolved || 0), 0);
  const answersWritten = db.lectures.reduce((sum, l) => sum + Number(l.answersWritten || 0), 0);
  const streak = missionStreak(db);
  return [
    { title: '100 Lectures', unlocked: lecturesCompleted >= 100, progress: `${lecturesCompleted}/100` },
    { title: '1000 MCQs', unlocked: mcqsSolved >= 1000, progress: `${mcqsSolved}/1000` },
    { title: '100 Answers', unlocked: answersWritten >= 100, progress: `${answersWritten}/100` },
    { title: '30-Day Streak', unlocked: streak >= 30, progress: `${streak}/30` }
  ];
}
