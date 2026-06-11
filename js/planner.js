function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'task';
}

function task(id, title, category = 'Core') {
  return { id, title, category, generated: true };
}

function plannerItems(cfg, date = new Date()) {
  const day = date.getDay();
  const p1 = cfg.priority1 || 'Priority 1';
  const p2 = cfg.priority2 || 'Priority 2';
  const p3 = cfg.priority3 || 'Priority 3';

  const items = [
    task(`lecture-${slugify(p1)}`, `${p1} Lecture`, 'Subject'),
    task(`lecture-${slugify(p2)}`, `${p2} Lecture`, 'Subject'),
    task(`lecture-${slugify(p3)}`, `${p3} Lecture`, 'Subject'),
    task('newspaper', 'Newspaper', 'Daily'),
    task('current-affairs', 'Current Affairs', 'Daily'),
    task('mcqs-30', '30 MCQs', 'Practice'),
    task('answer-writing-2', '2 Answer Writing', 'Practice')
  ];

  if (day === 6) {
    items.push(task('ca-revision', 'CA Revision', 'Revision'));
    items.push(task('newspaper-revision', 'Newspaper Revision', 'Revision'));
  }

  if (day === 0) {
    items.push(task('gs-revision', 'GS Revision', 'Revision'));
    items.push(task('weekly-review', 'Weekly Review', 'Review'));
    items.push(task('test-1hr', '1 hr Test', 'Test'));
  }

  return items;
}
