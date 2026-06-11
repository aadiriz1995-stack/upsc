const T2C_KEYS = {
  db: 't2c_database_v5',
  legacyConfig: 't2c_config_v2',
  legacyDayStatePrefix: 't2c_day_state_'
};

const DEFAULT_CONFIG = {
  priority1: 'Polity',
  priority2: 'Modern History',
  priority3: 'Economy',
  optionalSubject: '',
  examDate: '',
  missionStartDate: todayKey(),
  missionLength: 150,
  dailyLectureTarget: 3,
  dailyMcqTarget: 30,
  dailyAnswerTarget: 2,
  recoveryTokens: 3,
  levelSize: 500
};

function todayKey(date = new Date()) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return todayKey(date);
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeJsonParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; }
  catch (error) { console.warn('Track2Crack: invalid JSON, using fallback.', error); return fallback; }
}

function emptyDb() {
  return {
    app: 'Track2Crack',
    version: 5,
    config: { ...DEFAULT_CONFIG },
    lectures: [],
    articles: [],
    revisions: [],
    planner: { byDate: {} },
    activities: [],
    aiUploads: []
  };
}

function migrateLegacy(db) {
  const legacyConfig = safeJsonParse(localStorage.getItem(T2C_KEYS.legacyConfig), null);
  if (legacyConfig && !localStorage.getItem(T2C_KEYS.db)) {
    db.config.priority1 = legacyConfig.priority1 || db.config.priority1;
    db.config.priority2 = legacyConfig.priority2 || db.config.priority2;
    db.config.priority3 = legacyConfig.priority3 || db.config.priority3;
  }
  return db;
}

function loadDb() {
  const db = safeJsonParse(localStorage.getItem(T2C_KEYS.db), null);
  const base = db && db.app === 'Track2Crack' ? db : migrateLegacy(emptyDb());
  return normalizeDb(base);
}

function saveDb(db) {
  const normalized = normalizeDb(db);
  localStorage.setItem(T2C_KEYS.db, JSON.stringify(normalized));
  return normalized;
}

function normalizeDb(db) {
  const normalized = { ...emptyDb(), ...(db || {}) };
  normalized.config = { ...DEFAULT_CONFIG, ...(db?.config || {}) };
  normalized.lectures = Array.isArray(db?.lectures) ? db.lectures.map(normalizeLecture) : [];
  normalized.articles = Array.isArray(db?.articles) ? db.articles.map(normalizeArticle) : [];
  normalized.revisions = Array.isArray(db?.revisions) ? db.revisions.map(normalizeRevision) : [];
  normalized.planner = db?.planner && typeof db.planner === 'object' ? db.planner : { byDate: {} };
  normalized.planner.byDate = normalized.planner.byDate || {};
  normalized.activities = Array.isArray(db?.activities) ? db.activities : [];
  normalized.aiUploads = Array.isArray(db?.aiUploads) ? db.aiUploads : [];
  return normalized;
}

function normalizeLecture(item) {
  const lecture = {
    id: item.id || uid('lec'),
    subject: item.subject || '',
    code: item.code || '',
    title: item.title || item.lectureName || '',
    releaseDate: item.releaseDate || todayKey(),
    remarks: item.remarks || '',
    read: Boolean(item.read),
    notesUploaded: Boolean(item.notesUploaded),
    notesFileName: item.notesFileName || '',
    notesDataUrl: item.notesDataUrl || '',
    activeRecallScore: Number(item.activeRecallScore || 0),
    mcqsSolved: Number(item.mcqsSolved || 0),
    mcqsCorrect: Number(item.mcqsCorrect || 0),
    answersWritten: Number(item.answersWritten || 0),
    revisionDue: item.revisionDue || item.releaseDate || todayKey(),
    progress: Number(item.progress || 0)
  };
  lecture.progress = calculateLectureProgress(lecture);
  return lecture;
}

function normalizeArticle(item) {
  return {
    id: item.id || uid('ca'),
    date: item.date || todayKey(),
    source: item.source || '',
    title: item.title || '',
    image: item.image || '',
    imageName: item.imageName || '',
    summary: item.summary || '',
    gsPaper: item.gsPaper || '',
    subject: item.subject || '',
    keywords: Array.isArray(item.keywords) ? item.keywords : splitKeywords(item.keywords || ''),
    notes: item.notes || '',
    mcqs: Array.isArray(item.mcqs) ? item.mcqs : [],
    answerWriting: Array.isArray(item.answerWriting) ? item.answerWriting : [],
    revisionStatus: item.revisionStatus || 'Due'
  };
}

function normalizeRevision(item) {
  return {
    id: item.id || uid('rev'),
    sourceType: item.sourceType || 'manual',
    sourceId: item.sourceId || '',
    subject: item.subject || '',
    topic: item.topic || '',
    dueDate: item.dueDate || todayKey(),
    revisionCount: Number(item.revisionCount || 0),
    confidenceScore: Number(item.confidenceScore || 0),
    lastRevised: item.lastRevised || '',
    status: item.status || 'Due'
  };
}

function splitKeywords(value) {
  return String(value || '').split(',').map((x) => x.trim()).filter(Boolean);
}

function calculateLectureProgress(lecture) {
  let progress = 0;
  if (lecture.read) progress += 20;
  if (lecture.notesUploaded) progress += 20;
  if (Number(lecture.activeRecallScore) > 0) progress += 20;
  if (Number(lecture.mcqsSolved) > 0) progress += 20;
  if (Number(lecture.answersWritten) > 0) progress += 20;
  return Math.min(100, progress);
}

function upsertLecture(db, lecture) {
  const item = normalizeLecture(lecture);
  const index = db.lectures.findIndex((x) => x.id === item.id);
  if (index >= 0) db.lectures[index] = item;
  else db.lectures.push(item);
  ensureRevisionForLecture(db, item);
  return saveDb(db);
}

function upsertArticle(db, article) {
  const item = normalizeArticle(article);
  const index = db.articles.findIndex((x) => x.id === item.id);
  if (index >= 0) db.articles[index] = item;
  else db.articles.push(item);
  ensureRevisionForArticle(db, item);
  return saveDb(db);
}

function ensureRevisionForLecture(db, lecture) {
  const exists = db.revisions.some((rev) => rev.sourceType === 'lecture' && rev.sourceId === lecture.id);
  if (!exists) {
    db.revisions.push(normalizeRevision({
      sourceType: 'lecture',
      sourceId: lecture.id,
      subject: lecture.subject,
      topic: lecture.title,
      dueDate: lecture.revisionDue || lecture.releaseDate || todayKey(),
      status: 'Due'
    }));
  }
}

function ensureRevisionForArticle(db, article) {
  const exists = db.revisions.some((rev) => rev.sourceType === 'article' && rev.sourceId === article.id);
  if (!exists) {
    db.revisions.push(normalizeRevision({
      sourceType: 'article',
      sourceId: article.id,
      subject: article.subject,
      topic: article.title,
      dueDate: addDays(article.date || todayKey(), 1),
      status: 'Due'
    }));
  }
}

function recordActivity(db, activity) {
  db.activities.push({
    id: uid('act'),
    date: todayKey(),
    at: new Date().toISOString(),
    type: activity.type || 'activity',
    subject: activity.subject || '',
    lectureId: activity.lectureId || '',
    articleId: activity.articleId || '',
    revisionId: activity.revisionId || '',
    taskId: activity.taskId || '',
    xp: Number(activity.xp || 0),
    score: Number(activity.score || 0),
    meta: activity.meta || {}
  });
  return saveDb(db);
}

function getDatePlanner(db, dateKey = todayKey()) {
  db.planner.byDate[dateKey] = db.planner.byDate[dateKey] || { tasks: [], generatedAt: '', edited: false };
  return db.planner.byDate[dateKey];
}

function exportAllData() {
  return { exportedAt: new Date().toISOString(), ...loadDb() };
}

function importAllData(payload) {
  if (!payload || payload.app !== 'Track2Crack') throw new Error('This file is not a valid Track2Crack export.');
  saveDb(payload);
}
