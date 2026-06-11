function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function plannerTask(data) {
  return {
    id: data.id || uid('task'),
    title: data.title || 'Untitled task',
    category: data.category || 'Core',
    subject: data.subject || '',
    sourceType: data.sourceType || 'manual',
    sourceId: data.sourceId || '',
    completed: Boolean(data.completed),
    generated: data.generated !== false,
    order: Number(data.order || 0)
  };
}

function getNextIncompleteLecture(db, subject) {
  const clean = String(subject || '').trim().toLowerCase();
  if (!clean) return null;
  return db.lectures
    .filter((lecture) => String(lecture.subject || '').trim().toLowerCase() === clean && Number(lecture.progress) < 100)
    .sort((a, b) => {
      const dateSort = String(a.releaseDate || '').localeCompare(String(b.releaseDate || ''));
      if (dateSort !== 0) return dateSort;
      return String(a.code || '').localeCompare(String(b.code || ''));
    })[0] || null;
}

function buildLecturePlannerTask(db, subject, priorityNumber) {
  const lecture = getNextIncompleteLecture(db, subject);
  if (lecture) {
    return plannerTask({
      id: `lecture-${lecture.id}`,
      title: `Priority ${priorityNumber}: ${lecture.subject} - ${lecture.title}`,
      category: 'Lecture',
      subject: lecture.subject,
      sourceType: 'lecture',
      sourceId: lecture.id
    });
  }
  return plannerTask({
    id: `lecture-empty-${priorityNumber}-${slugify(subject)}`,
    title: `Priority ${priorityNumber}: Add next ${subject || 'subject'} lecture`,
    category: 'Lecture',
    subject,
    sourceType: 'lecture-placeholder'
  });
}

function basePlannerItems(db, date = new Date()) {
  const cfg = db.config;
  const day = date.getDay();
  const dailyMcqTarget = Number(cfg.dailyMcqTarget || 0);
  const dailyAnswerTarget = Number(cfg.dailyAnswerTarget || 0);
  const items = [];

  if (day >= 1 && day <= 5) {
    items.push(buildLecturePlannerTask(db, cfg.priority1, 1));
    items.push(buildLecturePlannerTask(db, cfg.priority2, 2));
    items.push(buildLecturePlannerTask(db, cfg.priority3, 3));
    items.push(plannerTask({ id: 'newspaper', title: 'Newspaper', category: 'Reading', sourceType: 'newspaper' }));
    items.push(plannerTask({ id: 'current-affairs', title: 'Current Affairs', category: 'Current Affairs', sourceType: 'current-affairs' }));
    items.push(plannerTask({ id: 'mcqs', title: `${dailyMcqTarget || 30} MCQs`, category: 'Practice', sourceType: 'mcq' }));
    items.push(plannerTask({ id: 'answer-writing', title: `${dailyAnswerTarget || 2} Answer Writing`, category: 'Practice', sourceType: 'answer-writing' }));
  }

  if (day === 6) {
    items.push(buildLecturePlannerTask(db, cfg.priority1, 1));
    items.push(buildLecturePlannerTask(db, cfg.priority2, 2));
    items.push(buildLecturePlannerTask(db, cfg.priority3, 3));
    items.push(plannerTask({ id: 'newspaper', title: 'Newspaper', category: 'Reading', sourceType: 'newspaper' }));
    items.push(plannerTask({ id: 'current-affairs', title: 'Current Affairs', category: 'Current Affairs', sourceType: 'current-affairs' }));
    items.push(plannerTask({ id: 'mcqs', title: `${dailyMcqTarget || 30} MCQs`, category: 'Practice', sourceType: 'mcq' }));
    items.push(plannerTask({ id: 'answer-writing', title: `${dailyAnswerTarget || 2} Answer Writing`, category: 'Practice', sourceType: 'answer-writing' }));
    items.push(plannerTask({ id: 'newspaper-revision', title: 'Newspaper Revision', category: 'Revision', sourceType: 'revision' }));
    items.push(plannerTask({ id: 'current-affairs-revision', title: 'Current Affairs Revision', category: 'Revision', sourceType: 'revision' }));
  }

  if (day === 0) {
    items.push(plannerTask({ id: 'gs-revision', title: 'GS Revision', category: 'Revision', sourceType: 'revision' }));
    items.push(plannerTask({ id: 'weekly-reflection', title: 'Weekly Reflection', category: 'Reflection', sourceType: 'reflection' }));
    items.push(plannerTask({ id: 'one-hour-test', title: 'One Hour Test', category: 'Test', sourceType: 'test' }));
  }

  return items.map((item, index) => plannerTask({ ...item, order: index + 1 }));
}

function plannerNeedsRefresh(dayPlan, generatedItems) {
  if (!dayPlan.generatedAt) return true;
  const existingGenerated = dayPlan.tasks.filter((task) => task.generated !== false).map((task) => `${task.id}|${task.title}`).join('::');
  const nextGenerated = generatedItems.map((task) => `${task.id}|${task.title}`).join('::');
  return existingGenerated !== nextGenerated && !dayPlan.edited;
}

function ensurePlannerForDate(db, dateKey = todayKey(), force = false) {
  const date = new Date(`${dateKey}T00:00:00`);
  const generated = basePlannerItems(db, date);
  const dayPlan = getDatePlanner(db, dateKey);

  if (force || plannerNeedsRefresh(dayPlan, generated)) {
    const custom = (dayPlan.tasks || []).filter((task) => task.generated === false);
    const completedMap = Object.fromEntries((dayPlan.tasks || []).map((task) => [task.id, Boolean(task.completed)]));
    dayPlan.tasks = [...generated, ...custom].map((task, index) => plannerTask({
      ...task,
      completed: Boolean(completedMap[task.id] || task.completed),
      order: index + 1
    }));
    dayPlan.generatedAt = new Date().toISOString();
    dayPlan.edited = false;
  } else {
    dayPlan.tasks = (dayPlan.tasks || []).map(plannerTask).sort((a, b) => a.order - b.order);
  }

  saveDb(db);
  return dayPlan;
}

function dailyCompletion(dayPlan) {
  const tasks = dayPlan?.tasks || [];
  const complete = tasks.filter((task) => task.completed).length;
  return {
    total: tasks.length,
    complete,
    percent: tasks.length ? Math.round((complete / tasks.length) * 100) : 0
  };
}
