let db = loadDb();
let currentRoute = 'dashboard';
let dragTaskId = null;
let toastTimer = null;

const els = {};
const REVISION_INTERVALS = [1, 3, 7, 14, 30, 60, 90];

function $(id) { return document.getElementById(id); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
}
function percentBar(value) { return `<div class="progress-bar"><span style="width:${Math.max(0, Math.min(100, Number(value) || 0))}%"></span></div>`; }
function miniBar(value) { return `<div class="mini-bar"><span style="width:${Math.max(0, Math.min(100, Number(value) || 0))}%"></span></div>`; }
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}
function setDb(nextDb = db) { db = saveDb(nextDb); }
function routeName(route) {
  return ({
    dashboard: 'Mission Control', lectures: 'Lectures', planner: 'Planner',
    'current-affairs': 'Current Affairs', revisions: 'Revision Engine',
    'ai-mentor': 'AI Mentor', analytics: 'Analytics', settings: 'Settings'
  })[route] || 'Mission Control';
}
function setHeader(route) {
  els.todayLabel.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  els.pageTitle.textContent = routeName(route);
  const cfg = db.config;
  const countdown = countdownToExam(db);
  const focus = `${cfg.priority1 || 'Priority 1'} | ${cfg.priority2 || 'Priority 2'} | ${cfg.priority3 || 'Priority 3'}`;
  els.pageSummary.textContent = countdown === null ? `Current focus: ${focus}. Set your exam date in Settings.` : `Current focus: ${focus}. ${countdown} days to Prelims.`;

  const plan = ensurePlannerForDate(db, todayKey());
  const daily = dailyCompletion(plan);
  els.dailyPercent.textContent = `${daily.percent}%`;
  els.dailyText.textContent = `${daily.complete} of ${daily.total} tasks complete today`;
  els.dailyFill.style.width = `${daily.percent}%`;
}
function refresh(route = currentRoute) {
  db = loadDb();
  currentRoute = route;
  setHeader(route);
  if (typeof updateFirebaseMiniStatus === 'function') updateFirebaseMiniStatus(db);
  qsa('.side-menu a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  if (route === 'lectures') renderLectures();
  else if (route === 'planner') renderPlanner();
  else if (route === 'current-affairs') renderCurrentAffairs();
  else if (route === 'revisions') renderRevisions();
  else if (route === 'ai-mentor') renderAiMentor();
  else if (route === 'analytics') renderAnalytics();
  else if (route === 'settings') renderSettings();
  else renderDashboard();
}
function go(route) { location.hash = route; }
function readRoute() { return (location.hash || '#dashboard').slice(1) || 'dashboard'; }
function appHtml(html) { els.app.innerHTML = html; }

function hasActivityKey(key) { return db.activities.some((a) => a.meta && a.meta.key === key); }
function awardOnce({ key, type, xp, score = 0, subject = '', lectureId = '', articleId = '', revisionId = '', taskId = '', meta = {} }) {
  if (!key || hasActivityKey(key)) return false;
  recordActivity(db, { type, xp, score, subject, lectureId, articleId, revisionId, taskId, meta: { ...meta, key } });
  db = loadDb();
  return true;
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `track2crack-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Backup exported.');
}
function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importAllData(JSON.parse(reader.result));
      db = loadDb();
      refresh(currentRoute);
      showToast('Backup imported.');
    } catch (error) { alert(error.message || 'Could not import this file.'); }
  };
  reader.readAsText(file);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function fileToText(file) {
  return new Promise((resolve) => {
    if (!file || !/^text\//.test(file.type)) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

function openModal(html, opts = {}) {
  els.modalRoot.hidden = false;
  els.modalRoot.innerHTML = `<div class="modal ${opts.large ? 'large' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const close = els.modalRoot.querySelector('[data-close-modal]');
  if (close) close.addEventListener('click', closeModal);
}
function closeModal() { els.modalRoot.hidden = true; els.modalRoot.innerHTML = ''; }

function renderDashboard() {
  const plan = ensurePlannerForDate(db, todayKey());
  const daily = dailyCompletion(plan);
  const level = levelInfo(db);
  const countdown = countdownToExam(db);
  const pendingLectures = db.lectures.filter((l) => Number(l.progress) < 100);
  const revisionDue = db.revisions.filter((r) => r.dueDate <= todayKey() && r.status !== 'Completed');
  const mcqsDue = Math.max(0, Number(db.config.dailyMcqTarget || 0) - todayMcqCount(db));
  const answersDue = Math.max(0, Number(db.config.dailyAnswerTarget || 0) - todayAnswerCount(db));
  const missionLength = Number(db.config.missionLength || 150);
  const mDay = missionDay(db);
  const missionPercent = Math.min(100, Math.round((mDay / missionLength) * 100));
  const badges = badgeStatus(db);
  appHtml(`
    <section class="grid-4">
      ${metric('Mission 150 Progress', `${missionPercent}%`, `Day ${mDay} of ${missionLength}`)}
      ${metric('Countdown to UPSC Prelims', countdown === null ? 'Set date' : `${countdown}`, countdown === null ? 'Configure in Settings' : 'days remaining')}
      ${metric('Mission Day', mDay, 'auto-calculated')}
      ${metric('XP', level.xp, `Level ${level.level}`)}
      ${metric('Level', level.level, `${level.remaining} XP to next level`)}
      ${metric('Mission Streak', missionStreak(db), 'days')}
      ${metric('Reading Streak', readingStreak(db), 'days')}
      ${metric('Recovery Tokens', Number(db.config.recoveryTokens || 0), 'available')}
      ${metric('Mission Score', `${missionScore(db)}/100`, 'daily + syllabus + streak')}
      ${metric('Daily Completion', `${daily.percent}%`, `${daily.complete}/${daily.total} tasks`)}
      ${metric('Overall Syllabus Progress', `${overallSyllabusProgress(db)}%`, `${db.lectures.length} lectures tracked`)}
      ${metric('Database', db.config.firebaseLastSyncAt ? 'Firebase Cloud' : 'Local', db.config.firebaseLastSyncAt ? `Last sync ${new Date(db.config.firebaseLastSyncAt).toLocaleString()}` : 'Not synced yet')}
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="section-head"><h2>Today\'s Planner</h2><button class="secondary" data-go="planner">Open Planner</button></div>
        ${renderTaskListStatic(plan.tasks.slice(0, 8))}
      </div>
      <div class="card">
        <h2>Daily Alerts</h2>
        <div class="grid-2">
          ${alertBox('Pending Lectures', pendingLectures.length, pendingLectures.slice(0, 3).map((l) => `${l.subject}: ${l.title}`))}
          ${alertBox('Revision Due', revisionDue.length, revisionDue.slice(0, 3).map((r) => r.topic))}
          ${alertBox('MCQs Due', mcqsDue, [`Target: ${db.config.dailyMcqTarget || 0}`])}
          ${alertBox('Answer Writing Due', answersDue, [`Target: ${db.config.dailyAnswerTarget || 0}`])}
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Quick Launch</h2>
      <div class="section-actions">
        ${['lectures','planner','current-affairs','ai-mentor','analytics'].map((r) => `<button data-go="${r}">${routeName(r)}</button>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Badges</h2>
      <div class="badge-grid">${badges.map((b) => `<span class="badge ${b.unlocked ? 'unlocked' : ''}">${escapeHtml(b.title)} · ${escapeHtml(b.progress)}</span>`).join('')}</div>
      <p class="hint">Progress to next level: ${level.nextLevelPercent}%</p>
      ${percentBar(level.nextLevelPercent)}
    </section>
  `);
  bindGoButtons();
}
function metric(label, value, note = '') { return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`; }
function alertBox(title, value, details) { return `<div class="detail-box"><h3>${escapeHtml(title)}</h3><strong>${escapeHtml(value)}</strong><p class="hint">${(details.length ? details : ['No pending items']).map(escapeHtml).join('<br>')}</p></div>`; }
function renderTaskListStatic(tasks) {
  if (!tasks.length) return '<div class="empty">No planner tasks for today.</div>';
  return `<ul class="task-list">${tasks.map((t) => `<li class="task-item ${t.completed ? 'done' : ''}"><span>${t.completed ? '✓' : '□'}</span><span class="task-title">${escapeHtml(t.title)}</span><span class="task-meta">${escapeHtml(t.category)}</span></li>`).join('')}</ul>`;
}
function bindGoButtons() { qsa('[data-go]').forEach((btn) => btn.addEventListener('click', () => go(btn.dataset.go))); }
function todayMcqCount(db) { return db.activities.filter((a) => a.date === todayKey() && (a.type === 'mcq' || a.type === 'lectureMcq')).reduce((s, a) => s + Number(a.meta?.solved || 0), 0); }
function todayAnswerCount(db) { return db.activities.filter((a) => a.date === todayKey() && (a.type === 'answerWriting' || a.type === 'lectureAnswer')).reduce((s, a) => s + Number(a.meta?.answers || 0), 0); }

function renderPlanner() {
  const dateKey = todayKey();
  const plan = ensurePlannerForDate(db, dateKey);
  appHtml(`
    <section class="card">
      <div class="section-head">
        <div><h2>Intelligent Planner Engine</h2><p class="hint">Weekday rules, priority lectures, editing, dragging, and completion are stored for ${dateKey}.</p></div>
        <div class="section-actions"><button id="regenPlanner" class="secondary">Regenerate</button><button id="addPlannerTask">Add Task</button></div>
      </div>
      <ul id="plannerTasks" class="task-list"></ul>
    </section>
  `);
  renderPlannerTasks(plan);
  $('regenPlanner').addEventListener('click', () => {
    ensurePlannerForDate(db, dateKey, true);
    db = loadDb();
    showToast('Planner regenerated from current settings and lecture database.');
    refresh('planner');
  });
  $('addPlannerTask').addEventListener('click', openAddPlannerTaskModal);
}
function renderPlannerTasks(plan) {
  const list = $('plannerTasks');
  list.innerHTML = '';
  (plan.tasks || []).sort((a, b) => a.order - b.order).forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'done' : ''}`;
    li.draggable = true;
    li.dataset.taskId = task.id;
    li.innerHTML = `
      <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Complete ${escapeHtml(task.title)}">
      <span class="task-title" contenteditable="true">${escapeHtml(task.title)}</span>
      <span class="task-meta">${escapeHtml(task.category)}${task.subject ? ` · ${escapeHtml(task.subject)}` : ''}</span>
      <span class="drag-handle">↕</span>
    `;
    li.querySelector('input').addEventListener('change', (event) => togglePlannerTask(task.id, event.target.checked));
    li.querySelector('.task-title').addEventListener('blur', (event) => editPlannerTask(task.id, event.target.textContent.trim()));
    li.addEventListener('dragstart', () => { dragTaskId = task.id; li.classList.add('dragging'); });
    li.addEventListener('dragend', () => { dragTaskId = null; li.classList.remove('dragging'); });
    li.addEventListener('dragover', (event) => event.preventDefault());
    li.addEventListener('drop', () => reorderPlannerTask(dragTaskId, task.id));
    list.appendChild(li);
  });
}
function getTodayPlanMutable() { return getDatePlanner(db, todayKey()); }
function togglePlannerTask(taskId, checked) {
  const plan = getTodayPlanMutable();
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.completed = checked;
  plan.edited = true;
  setDb(db);
  if (checked) {
    let xp = XP_RULES.plannerTask;
    let type = 'plannerTask';
    if (task.sourceType === 'lecture') { xp = XP_RULES.lecture; type = 'lecture'; }
    if (/newspaper/i.test(task.title)) { xp = XP_RULES.reading; type = 'reading'; }
    if (/answer/i.test(task.title)) { xp = XP_RULES.answerWriting; type = 'answerWriting'; }
    awardOnce({ key: `task:${todayKey()}:${taskId}`, type, xp, score: xp, subject: task.subject, lectureId: task.sourceType === 'lecture' ? task.sourceId : '', taskId });
  }
  refresh('planner');
}
function editPlannerTask(taskId, title) {
  const plan = getTodayPlanMutable();
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task || !title) return refresh('planner');
  task.title = title;
  task.generated = false;
  plan.edited = true;
  setDb(db);
  showToast('Task edited and saved.');
  refresh('planner');
}
function reorderPlannerTask(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const plan = getTodayPlanMutable();
  const tasks = plan.tasks.sort((a, b) => a.order - b.order);
  const fromIndex = tasks.findIndex((t) => t.id === fromId);
  const toIndex = tasks.findIndex((t) => t.id === toId);
  if (fromIndex < 0 || toIndex < 0) return;
  const [moved] = tasks.splice(fromIndex, 1);
  tasks.splice(toIndex, 0, moved);
  tasks.forEach((task, index) => task.order = index + 1);
  plan.tasks = tasks;
  plan.edited = true;
  setDb(db);
  refresh('planner');
}
function openAddPlannerTaskModal() {
  openModal(`
    <div class="modal-head"><h2>Add Planner Task</h2><button class="modal-close" data-close-modal>Close</button></div>
    <form id="plannerTaskForm" class="grid">
      <label>Task Title<input id="plannerTaskTitle" required maxlength="140"></label>
      <label>Category<input id="plannerTaskCategory" value="Custom"></label>
      <button type="submit">Save Task</button>
    </form>
  `);
  $('plannerTaskForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const plan = getTodayPlanMutable();
    plan.tasks.push(plannerTask({ id: uid('custom-task'), title: $('plannerTaskTitle').value.trim(), category: $('plannerTaskCategory').value.trim() || 'Custom', generated: false, order: plan.tasks.length + 1 }));
    plan.edited = true;
    setDb(db);
    closeModal();
    showToast('Custom planner task added.');
    refresh('planner');
  });
}

function renderLectures() {
  const subjects = unique(db.lectures.map((l) => l.subject));
  appHtml(`
    <section class="card">
      <div class="section-head">
        <div><h2>Lectures Module</h2><p class="hint">The backbone database for lectures, notes, recall, MCQs, answer writing, revision, and progress.</p></div>
        <button id="addLectureBtn">Add Lecture</button>
      </div>
      <div class="filters">
        <label>Search<input id="lectureSearch" placeholder="Lecture name, subject, or code"></label>
        <label>Subject<select id="lectureSubjectFilter"><option value="">All</option>${subjects.map((s) => `<option>${escapeHtml(s)}</option>`).join('')}</select></label>
        <label>Status<select id="lectureStatusFilter"><option value="">All</option><option>Incomplete</option><option>Completed</option><option>Read</option><option>Notes Pending</option></select></label>
        <button id="lectureClearFilters" class="secondary">Clear</button>
      </div>
    </section>
    <section class="card"><div id="lectureTable"></div></section>
  `);
  $('addLectureBtn').addEventListener('click', () => openLectureForm());
  ['lectureSearch','lectureSubjectFilter','lectureStatusFilter'].forEach((id) => $(id).addEventListener('input', renderLectureTable));
  $('lectureClearFilters').addEventListener('click', () => { $('lectureSearch').value=''; $('lectureSubjectFilter').value=''; $('lectureStatusFilter').value=''; renderLectureTable(); });
  renderLectureTable();
}
function renderLectureTable() {
  const search = ($('lectureSearch')?.value || '').toLowerCase();
  const subject = $('lectureSubjectFilter')?.value || '';
  const status = $('lectureStatusFilter')?.value || '';
  let lectures = db.lectures.filter((l) => {
    const hay = `${l.title} ${l.subject} ${l.code}`.toLowerCase();
    if (search && !hay.includes(search)) return false;
    if (subject && l.subject !== subject) return false;
    if (status === 'Incomplete' && Number(l.progress) >= 100) return false;
    if (status === 'Completed' && Number(l.progress) < 100) return false;
    if (status === 'Read' && !l.read) return false;
    if (status === 'Notes Pending' && l.notesUploaded) return false;
    return true;
  }).sort((a,b) => String(a.subject).localeCompare(String(b.subject)) || String(a.releaseDate).localeCompare(String(b.releaseDate)) || String(a.code).localeCompare(String(b.code)));
  const target = $('lectureTable');
  if (!lectures.length) { target.innerHTML = '<div class="empty">No lectures found. Add your first lecture to start the backbone database.</div>'; return; }
  target.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Subject</th><th>Lecture Name</th><th>Read</th><th>Notes</th><th>Active Recall</th><th>MCQs Solved</th><th>MCQs Correct</th><th>Answers Written</th><th>Progress %</th></tr></thead>
    <tbody>${lectures.map((l) => `<tr class="clickable" data-lecture-id="${l.id}">
      <td>${escapeHtml(l.subject)}</td><td><strong>${escapeHtml(l.title)}</strong><br><span class="hint">${escapeHtml(l.code || 'No code')}</span></td>
      <td><button class="small secondary" data-read-toggle="${l.id}">${l.read ? 'Yes' : 'No'}</button></td>
      <td>${l.notesUploaded ? `<button class="small secondary" data-view-notes="${l.id}">View</button>` : '<span class="no">Upload</span>'}</td>
      <td>${Number(l.activeRecallScore || 0)}/10</td><td>${Number(l.mcqsSolved || 0)}</td><td>${Number(l.mcqsCorrect || 0)}</td><td>${Number(l.answersWritten || 0)}</td>
      <td><strong>${l.progress}%</strong>${miniBar(l.progress)}</td>
    </tr>`).join('')}</tbody></table></div>`;
  qsa('[data-lecture-id]', target).forEach((row) => row.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    openLectureDetail(row.dataset.lectureId);
  }));
  qsa('[data-read-toggle]', target).forEach((btn) => btn.addEventListener('click', (event) => { event.stopPropagation(); toggleLectureRead(btn.dataset.readToggle); }));
  qsa('[data-view-notes]', target).forEach((btn) => btn.addEventListener('click', (event) => { event.stopPropagation(); viewLectureNotes(btn.dataset.viewNotes); }));
}
function openLectureForm(existing = null) {
  const l = existing || {};
  openModal(`
    <div class="modal-head"><h2>${existing ? 'Edit Lecture' : 'Add Lecture'}</h2><button class="modal-close" data-close-modal>Close</button></div>
    <form id="lectureForm" class="grid">
      <label>Subject<input id="lectureSubject" required value="${escapeHtml(l.subject || '')}"></label>
      <label>Lecture Code<input id="lectureCode" required value="${escapeHtml(l.code || '')}"></label>
      <label>Lecture Name<input id="lectureTitle" required value="${escapeHtml(l.title || '')}"></label>
      <label>Release Date<input id="lectureReleaseDate" type="date" value="${escapeHtml(l.releaseDate || todayKey())}"></label>
      <label class="wide">Remarks<textarea id="lectureRemarks">${escapeHtml(l.remarks || '')}</textarea></label>
      <button type="submit">Save Lecture</button>
    </form>
  `);
  $('lectureForm').addEventListener('submit', (event) => {
    event.preventDefault();
    upsertLecture(db, {
      ...l,
      id: l.id || uid('lec'),
      subject: $('lectureSubject').value.trim(),
      code: $('lectureCode').value.trim(),
      title: $('lectureTitle').value.trim(),
      releaseDate: $('lectureReleaseDate').value || todayKey(),
      remarks: $('lectureRemarks').value.trim(),
      revisionDue: l.revisionDue || $('lectureReleaseDate').value || todayKey()
    });
    db = loadDb();
    ensurePlannerForDate(db, todayKey(), true);
    closeModal();
    showToast('Lecture saved and planner refreshed.');
    refresh('lectures');
  });
}
function toggleLectureRead(id) {
  const lecture = db.lectures.find((l) => l.id === id);
  if (!lecture) return;
  lecture.read = !lecture.read;
  lecture.progress = calculateLectureProgress(lecture);
  upsertLecture(db, lecture);
  if (lecture.read) awardOnce({ key: `lecture-read:${id}`, type: 'lecture', xp: XP_RULES.lecture, score: 20, subject: lecture.subject, lectureId: id });
  db = loadDb();
  refresh('lectures');
}
function viewLectureNotes(id) {
  const lecture = db.lectures.find((l) => l.id === id);
  if (!lecture?.notesDataUrl) return showToast('No notes uploaded yet.');
  const win = window.open();
  win.document.write(`<iframe src="${lecture.notesDataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
}
function openLectureDetail(id) {
  const lecture = db.lectures.find((l) => l.id === id);
  if (!lecture) return;
  const revision = db.revisions.find((r) => r.sourceType === 'lecture' && r.sourceId === id);
  openModal(`
    <div class="modal-head"><h2>${escapeHtml(lecture.title)}</h2><button class="modal-close" data-close-modal>Close</button></div>
    <p class="hint">${escapeHtml(lecture.subject)} · ${escapeHtml(lecture.code)} · Release: ${escapeHtml(lecture.releaseDate)}</p>
    <div class="detail-grid">
      <div class="detail-box"><h3>Read Status</h3><button id="detailRead" class="secondary">${lecture.read ? 'Yes' : 'No'}</button></div>
      <div class="detail-box"><h3>Notes Upload/View</h3><input id="lectureNotesFile" type="file" accept=".pdf,.txt,.md,.doc,.docx,image/*"><p class="hint">${lecture.notesUploaded ? escapeHtml(lecture.notesFileName || 'Uploaded') : 'No notes uploaded'}</p>${lecture.notesUploaded ? '<button id="detailViewNotes" class="secondary">View Notes</button>' : ''}</div>
      <div class="detail-box"><h3>Active Recall Score</h3><input id="detailRecall" type="number" min="0" max="10" value="${Number(lecture.activeRecallScore || 0)}"><button id="saveRecall" class="secondary">Save</button></div>
      <div class="detail-box"><h3>MCQs Solved & Correct</h3><label>Solved<input id="detailMcqSolved" type="number" min="0" value="${Number(lecture.mcqsSolved || 0)}"></label><label>Correct<input id="detailMcqCorrect" type="number" min="0" value="${Number(lecture.mcqsCorrect || 0)}"></label><button id="saveMcq" class="secondary">Save MCQs</button></div>
      <div class="detail-box"><h3>Answers Written</h3><input id="detailAnswers" type="number" min="0" value="${Number(lecture.answersWritten || 0)}"><button id="saveAnswers" class="secondary">Save Answers</button></div>
      <div class="detail-box"><h3>Revision Status</h3><p>Due: ${escapeHtml(revision?.dueDate || lecture.revisionDue || 'Not scheduled')}</p><p>Count: ${Number(revision?.revisionCount || 0)}</p></div>
      <div class="detail-box"><h3>Progress</h3><strong>${lecture.progress}%</strong>${percentBar(lecture.progress)}</div>
      <div class="detail-box"><h3>AI Mentor</h3><p class="hint">Future AI will analyze uploaded notes, extract topics, generate MCQs, answer-writing questions, and schedule revisions.</p><button data-go="ai-mentor" class="secondary">Open AI Mentor</button></div>
    </div>
    <div class="section-actions" style="margin-top:14px"><button id="editLecture" class="secondary">Edit Lecture</button></div>
  `, { large: true });
  $('detailRead').addEventListener('click', () => { closeModal(); toggleLectureRead(id); });
  if ($('detailViewNotes')) $('detailViewNotes').addEventListener('click', () => viewLectureNotes(id));
  $('lectureNotesFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    lecture.notesDataUrl = await fileToDataUrl(file);
    lecture.notesFileName = file.name;
    lecture.notesUploaded = true;
    lecture.progress = calculateLectureProgress(lecture);
    upsertLecture(db, lecture);
    awardOnce({ key: `lecture-notes:${id}`, type: 'lectureNotes', xp: 10, score: 20, subject: lecture.subject, lectureId: id });
    showToast('Notes uploaded and progress updated.');
    closeModal(); refresh('lectures');
  });
  $('saveRecall').addEventListener('click', () => updateLectureMetric(id, { activeRecallScore: clamp($('detailRecall').value, 0, 10) }, 'Active recall saved.'));
  $('saveMcq').addEventListener('click', () => updateLectureMetric(id, { mcqsSolved: Number($('detailMcqSolved').value || 0), mcqsCorrect: Number($('detailMcqCorrect').value || 0) }, 'MCQs saved.'));
  $('saveAnswers').addEventListener('click', () => updateLectureMetric(id, { answersWritten: Number($('detailAnswers').value || 0) }, 'Answer writing saved.'));
  $('editLecture').addEventListener('click', () => { closeModal(); openLectureForm(lecture); });
  bindGoButtons();
}
function updateLectureMetric(id, patch, message) {
  const lecture = db.lectures.find((l) => l.id === id);
  Object.assign(lecture, patch);
  lecture.mcqsCorrect = Math.min(Number(lecture.mcqsCorrect || 0), Number(lecture.mcqsSolved || 0));
  lecture.progress = calculateLectureProgress(lecture);
  upsertLecture(db, lecture);
  if (patch.mcqsSolved !== undefined) {
    const correct = Number(lecture.mcqsCorrect || 0);
    const incorrect = Math.max(0, Number(lecture.mcqsSolved || 0) - correct);
    awardOnce({ key: `lecture-mcq:${id}:${lecture.mcqsSolved}:${correct}`, type: 'lectureMcq', xp: correct * XP_RULES.correctMcq + incorrect * XP_RULES.incorrectMcq, score: 20, subject: lecture.subject, lectureId: id, meta: { solved: lecture.mcqsSolved, correct } });
  }
  if (patch.answersWritten !== undefined) awardOnce({ key: `lecture-answer:${id}:${lecture.answersWritten}`, type: 'lectureAnswer', xp: Number(lecture.answersWritten || 0) * XP_RULES.answerWriting, score: 20, subject: lecture.subject, lectureId: id, meta: { answers: lecture.answersWritten } });
  if (patch.activeRecallScore !== undefined) awardOnce({ key: `lecture-recall:${id}:${lecture.activeRecallScore}`, type: 'activeRecall', xp: 10, score: 20, subject: lecture.subject, lectureId: id });
  db = loadDb();
  showToast(message);
  closeModal(); refresh('lectures');
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value || 0))); }
function unique(values) { return [...new Set(values.filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b))); }

function renderCurrentAffairs() {
  const sources = unique(db.articles.map((a) => a.source));
  const papers = unique(db.articles.map((a) => a.gsPaper));
  const subjects = unique(db.articles.map((a) => a.subject));
  appHtml(`
    <section class="card"><div class="section-head"><div><h2>Current Affairs Management System</h2><p class="hint">Articles link to subjects, revision, planner readiness, and future AI generation.</p></div><button id="addArticleBtn">Add Article</button></div>
      <div class="filters"><label>Search<input id="articleSearch" placeholder="Title, source, subject, keyword"></label><label>Source<select id="articleSource"><option value="">All</option>${sources.map((s)=>`<option>${escapeHtml(s)}</option>`).join('')}</select></label><label>GS Paper<select id="articlePaper"><option value="">All</option>${papers.map((s)=>`<option>${escapeHtml(s)}</option>`).join('')}</select></label><label>Subject<select id="articleSubject"><option value="">All</option>${subjects.map((s)=>`<option>${escapeHtml(s)}</option>`).join('')}</select></label></div>
    </section><section class="card"><div id="articleTable"></div></section>`);
  $('addArticleBtn').addEventListener('click', openArticleForm);
  ['articleSearch','articleSource','articlePaper','articleSubject'].forEach((id) => $(id).addEventListener('input', renderArticleTable));
  renderArticleTable();
}
function renderArticleTable() {
  const search = ($('articleSearch')?.value || '').toLowerCase();
  const source = $('articleSource')?.value || '';
  const paper = $('articlePaper')?.value || '';
  const subject = $('articleSubject')?.value || '';
  const articles = db.articles.filter((a) => {
    const hay = `${a.title} ${a.source} ${a.subject} ${a.gsPaper} ${(a.keywords || []).join(' ')}`.toLowerCase();
    return (!search || hay.includes(search)) && (!source || a.source === source) && (!paper || a.gsPaper === paper) && (!subject || a.subject === subject);
  }).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  const target = $('articleTable');
  if (!articles.length) { target.innerHTML = '<div class="empty">No current affairs articles added yet.</div>'; return; }
  target.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Source</th><th>Title</th><th>GS Paper</th><th>Subject</th><th>Keywords</th><th>Revision</th></tr></thead><tbody>${articles.map((a) => `<tr class="clickable" data-article-id="${a.id}"><td>${escapeHtml(a.date)}</td><td>${escapeHtml(a.source)}</td><td><strong>${escapeHtml(a.title)}</strong></td><td>${escapeHtml(a.gsPaper)}</td><td>${escapeHtml(a.subject)}</td><td>${(a.keywords || []).map((k) => `<span class="pill">${escapeHtml(k)}</span>`).join(' ')}</td><td>${escapeHtml(a.revisionStatus)}</td></tr>`).join('')}</tbody></table></div>`;
  qsa('[data-article-id]', target).forEach((row) => row.addEventListener('click', () => openArticleDetail(row.dataset.articleId)));
}
function openArticleForm() {
  openModal(`
    <div class="modal-head"><h2>Add Current Affairs Article</h2><button class="modal-close" data-close-modal>Close</button></div>
    <form id="articleForm" class="grid">
      <label>Date<input id="articleDate" type="date" value="${todayKey()}"></label><label>Source<input id="articleSourceInput" required placeholder="The Hindu, IE, PIB"></label><label>Title<input id="articleTitle" required></label><label>Image<input id="articleImage" type="file" accept="image/*"></label><label>GS Paper<input id="articleGs" placeholder="GS2"></label><label>Subject<input id="articleSubj" placeholder="Polity"></label><label>Keywords<input id="articleKeywords" placeholder="comma separated"></label><label>Revision Status<select id="articleRevision"><option>Due</option><option>Revised</option><option>Skipped</option></select></label><label>Summary<textarea id="articleSummary"></textarea></label><label>Notes<textarea id="articleNotes"></textarea></label><button type="submit">Save Article</button>
    </form>
  `, { large: true });
  $('articleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = $('articleImage').files[0];
    const image = file ? await fileToDataUrl(file) : '';
    upsertArticle(db, { id: uid('ca'), date: $('articleDate').value || todayKey(), source: $('articleSourceInput').value.trim(), title: $('articleTitle').value.trim(), image, imageName: file?.name || '', summary: $('articleSummary').value.trim(), gsPaper: $('articleGs').value.trim(), subject: $('articleSubj').value.trim(), keywords: splitKeywords($('articleKeywords').value), notes: $('articleNotes').value.trim(), revisionStatus: $('articleRevision').value });
    awardOnce({ key: `article:${$('articleTitle').value.trim()}:${todayKey()}`, type: 'currentAffairs', xp: XP_RULES.reading, score: 5, subject: $('articleSubj').value.trim() });
    db = loadDb();
    closeModal(); showToast('Article saved and revision created.'); refresh('current-affairs');
  });
}
function openArticleDetail(id) {
  const article = db.articles.find((a) => a.id === id);
  if (!article) return;
  const revision = db.revisions.find((r) => r.sourceType === 'article' && r.sourceId === id);
  openModal(`
    <div class="modal-head"><h2>${escapeHtml(article.title)}</h2><button class="modal-close" data-close-modal>Close</button></div>
    <p class="hint">${escapeHtml(article.date)} · ${escapeHtml(article.source)} · ${escapeHtml(article.gsPaper)} · ${escapeHtml(article.subject)}</p>
    <div class="detail-grid">
      <div class="detail-box"><h3>Image</h3>${article.image ? `<img class="image-preview" src="${article.image}" alt="Article image">` : '<p class="hint">No image.</p>'}</div>
      <div class="detail-box"><h3>Summary</h3><p>${escapeHtml(article.summary || 'Future AI can generate this automatically.')}</p></div>
      <div class="detail-box"><h3>Keywords</h3><p>${(article.keywords || []).map((k) => `<span class="pill">${escapeHtml(k)}</span>`).join(' ') || 'None'}</p></div>
      <div class="detail-box"><h3>Notes</h3><p>${escapeHtml(article.notes || 'No notes added.')}</p></div>
      <div class="detail-box"><h3>MCQs</h3><p>${article.mcqs.length ? article.mcqs.map(escapeHtml).join('<br>') : 'Future AI placeholder.'}</p></div>
      <div class="detail-box"><h3>Answer Writing</h3><p>${article.answerWriting.length ? article.answerWriting.map(escapeHtml).join('<br>') : 'Future AI placeholder.'}</p></div>
      <div class="detail-box"><h3>Revision Cards</h3><p>Due: ${escapeHtml(revision?.dueDate || 'Not scheduled')}</p><p>Status: ${escapeHtml(article.revisionStatus)}</p></div>
      <div class="detail-box"><h3>AI</h3><p class="hint">AI can later summarize, generate MCQs, answer questions, and revision cards from this article.</p><button data-go="ai-mentor" class="secondary">Open AI Mentor</button></div>
    </div>
  `, { large: true });
  bindGoButtons();
}

function renderRevisions() {
  const today = todayKey();
  const todayRows = db.revisions.filter((r) => r.dueDate === today && r.status !== 'Completed');
  const upcoming = db.revisions.filter((r) => r.dueDate > today && r.status !== 'Completed').sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 20);
  const missed = db.revisions.filter((r) => r.dueDate < today && r.status !== 'Completed').sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  appHtml(`<section class="grid-3">${revisionPanel('Today\'s Revision', todayRows)}${revisionPanel('Upcoming Revision', upcoming)}${revisionPanel('Missed Revision', missed)}</section>`);
  bindRevisionButtons();
}
function revisionPanel(title, rows) {
  return `<div class="card"><h2>${title}</h2>${rows.length ? `<ul class="task-list">${rows.map((r) => `<li class="task-item"><span>↻</span><span><strong>${escapeHtml(r.topic)}</strong><br><span class="hint">${escapeHtml(r.subject)} · Due ${escapeHtml(r.dueDate)} · Count ${r.revisionCount}</span></span><span class="task-meta">${escapeHtml(r.sourceType)}</span><span class="section-actions"><button class="small" data-complete-revision="${r.id}">Done</button><button class="small secondary" data-reschedule-revision="${r.id}">Reschedule</button></span></li>`).join('')}</ul>` : '<div class="empty">No items.</div>'}</div>`;
}
function bindRevisionButtons() {
  qsa('[data-complete-revision]').forEach((btn) => btn.addEventListener('click', () => openCompleteRevision(btn.dataset.completeRevision)));
  qsa('[data-reschedule-revision]').forEach((btn) => btn.addEventListener('click', () => openRescheduleRevision(btn.dataset.rescheduleRevision)));
}
function openCompleteRevision(id) {
  const rev = db.revisions.find((r) => r.id === id);
  if (!rev) return;
  openModal(`<div class="modal-head"><h2>Complete Revision</h2><button class="modal-close" data-close-modal>Close</button></div><p>${escapeHtml(rev.topic)}</p><label>Confidence Score /10<input id="confidence" type="number" min="0" max="10" value="7"></label><button id="saveRevisionComplete">Save Completion</button>`);
  $('saveRevisionComplete').addEventListener('click', () => {
    const confidence = clamp($('confidence').value, 0, 10);
    rev.confidenceScore = confidence;
    rev.lastRevised = todayKey();
    rev.revisionCount += 1;
    rev.status = 'Due';
    const interval = REVISION_INTERVALS[Math.min(rev.revisionCount - 1, REVISION_INTERVALS.length - 1)];
    rev.dueDate = addDays(todayKey(), interval);
    setDb(db);
    awardOnce({ key: `revision:${id}:${rev.revisionCount}`, type: 'revision', xp: XP_RULES.revision, score: 15, subject: rev.subject, revisionId: id });
    closeModal(); showToast('Revision completed and next due date scheduled.'); refresh('revisions');
  });
}
function openRescheduleRevision(id) {
  const rev = db.revisions.find((r) => r.id === id);
  if (!rev) return;
  openModal(`<div class="modal-head"><h2>Reschedule Revision</h2><button class="modal-close" data-close-modal>Close</button></div><p>${escapeHtml(rev.topic)}</p><label>New Due Date<input id="newDueDate" type="date" value="${escapeHtml(rev.dueDate)}"></label><button id="saveDueDate">Save Date</button>`);
  $('saveDueDate').addEventListener('click', () => { rev.dueDate = $('newDueDate').value || todayKey(); rev.status = 'Due'; setDb(db); closeModal(); showToast('Revision rescheduled.'); refresh('revisions'); });
}

function renderAiMentor() {
  const uploads = db.aiUploads || [];
  appHtml(`
    <section class="card"><h2>AI Mentor Module</h2><p class="hint">This offline build stores uploads and prepares AI-ready outputs. Pasted notes/articles can be processed with a simple local heuristic; true PDF/screenshot AI analysis needs a future API/backend.</p>
      <form id="aiUploadForm" class="grid"><label>Content Type<select id="aiType"><option>PDF</option><option>Screenshot</option><option>Notes</option><option>Article</option></select></label><label>Subject<input id="aiSubject" placeholder="Polity"></label><label>Link to Lecture<select id="aiLecture"><option value="">Auto / None</option>${db.lectures.map((l) => `<option value="${l.id}">${escapeHtml(l.subject)} - ${escapeHtml(l.title)}</option>`).join('')}</select></label><label>Upload File<input id="aiFile" type="file" accept=".pdf,.txt,.md,image/*"></label><label class="wide">Paste Notes / Article Text<textarea id="aiText" placeholder="Paste content here for local draft generation"></textarea></label><button type="submit">Upload & Generate Draft</button></form>
    </section>
    <section class="card"><h2>Discussion Mode</h2><p class="hint">Instead of merely explaining, this mode asks you questions from the extracted topics.</p><button id="startDiscussion" class="secondary">Ask Me Questions</button><div id="discussionBox"></div></section>
    <section class="card"><h2>AI Uploads</h2>${uploads.length ? uploads.map(renderAiUploadCard).join('') : '<div class="empty">No AI Mentor uploads yet.</div>'}</section>
  `);
  $('aiUploadForm').addEventListener('submit', handleAiUpload);
  $('startDiscussion').addEventListener('click', startDiscussionMode);
}
function renderAiUploadCard(item) {
  return `<div class="detail-box"><h3>${escapeHtml(item.title || item.type)}</h3><p class="hint">${escapeHtml(item.type)} · ${escapeHtml(item.subject || 'No subject')} · ${escapeHtml(item.fileName || 'Pasted text')}</p><p><strong>Summary:</strong> ${escapeHtml(item.summary || 'Not generated.')}</p><p><strong>Topics:</strong> ${(item.topics || []).map((t) => `<span class="pill">${escapeHtml(t)}</span>`).join(' ')}</p><p><strong>MCQs:</strong><br>${(item.mcqs || []).map(escapeHtml).join('<br>') || 'None'}</p><p><strong>Answer Writing:</strong><br>${(item.answerQuestions || []).map(escapeHtml).join('<br>') || 'None'}</p><p><strong>Revision Cards:</strong><br>${(item.revisionCards || []).map(escapeHtml).join('<br>') || 'None'}</p><p><strong>Linked Lecture:</strong> ${escapeHtml(linkedLectureTitle(item.linkedLectureId) || 'Not linked')}</p></div>`;
}
async function handleAiUpload(event) {
  event.preventDefault();
  const file = $('aiFile').files[0];
  const pasted = $('aiText').value.trim();
  const text = pasted || await fileToText(file);
  const analysis = generateLocalAiDraft(text, $('aiSubject').value.trim());
  const linkedLectureId = $('aiLecture').value || guessLectureLink(analysis.topics, $('aiSubject').value.trim());
  const dataUrl = file ? await fileToDataUrl(file) : '';
  const item = { id: uid('ai'), type: $('aiType').value, subject: $('aiSubject').value.trim(), fileName: file?.name || '', dataUrl, title: file?.name || analysis.title || 'Pasted Content', linkedLectureId, ...analysis, createdAt: new Date().toISOString() };
  db.aiUploads.unshift(item);
  setDb(db);
  showToast('AI Mentor upload stored and draft outputs generated.');
  refresh('ai-mentor');
}
function generateLocalAiDraft(text, subject) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { title: `${subject || 'Content'} upload`, summary: 'Upload stored. Add pasted text or connect future AI to generate analysis.', topics: [], mcqs: [], answerQuestions: [], revisionCards: [] };
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const summary = sentences.slice(0, 3).join(' ').slice(0, 650);
  const words = clean.toLowerCase().match(/[a-z][a-z]{4,}/g) || [];
  const stop = new Set(['about','which','there','their','would','could','should','because','through','between','after','before','where','these','those','current','affairs','notes','article','important','subject']);
  const counts = {};
  words.forEach((w) => { if (!stop.has(w)) counts[w] = (counts[w] || 0) + 1; });
  const topics = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 6).map(([w]) => w.replace(/^./, (c) => c.toUpperCase()));
  const mcqs = topics.slice(0, 4).map((t) => `MCQ: Which statement best explains ${t} in this context?`);
  const answerQuestions = topics.slice(0, 3).map((t) => `Answer Writing: Discuss the significance of ${t} for UPSC GS preparation.`);
  const revisionCards = topics.slice(0, 5).map((t) => `Revision Card: Define ${t} and recall one example.`);
  return { title: topics[0] ? `${topics[0]} Notes` : 'Generated Notes', summary, topics, mcqs, answerQuestions, revisionCards };
}
function guessLectureLink(topics, subject) {
  const hayTopics = (topics || []).join(' ').toLowerCase();
  const sub = String(subject || '').toLowerCase();
  const match = db.lectures.find((l) => (sub && l.subject.toLowerCase() === sub) || hayTopics.includes(l.title.toLowerCase()) || hayTopics.includes(l.subject.toLowerCase()));
  return match?.id || '';
}
function linkedLectureTitle(id) { const l = db.lectures.find((x) => x.id === id); return l ? `${l.subject} - ${l.title}` : ''; }
function startDiscussionMode() {
  const latest = db.aiUploads[0];
  const box = $('discussionBox');
  if (!latest || !latest.topics?.length) { box.innerHTML = '<div class="empty">Upload notes/article text first, then I can ask topic questions.</div>'; return; }
  box.innerHTML = `<ul class="task-list">${latest.topics.slice(0, 5).map((topic, index) => `<li class="task-item"><span>${index + 1}</span><span class="task-title">Explain ${escapeHtml(topic)} in 60 seconds. Then give one UPSC-style example.</span><span class="task-meta">Discussion</span></li>`).join('')}</ul>`;
}

function renderAnalytics() {
  const subjects = unique(db.lectures.map((l) => l.subject));
  appHtml(`<section class="card"><h2>Analytics Dashboard</h2><div class="filters"><label>Subject<select id="anaSubject"><option value="">All</option>${subjects.map((s)=>`<option>${escapeHtml(s)}</option>`).join('')}</select></label><label>Date<input id="anaDate" type="date"></label><label>Lecture<select id="anaLecture"><option value="">All</option>${db.lectures.map((l)=>`<option value="${l.id}">${escapeHtml(l.subject)} - ${escapeHtml(l.title)}</option>`).join('')}</select></label><button id="applyAnalytics" class="secondary">Apply</button></div></section><div id="analyticsBody"></div>`);
  $('applyAnalytics').addEventListener('click', renderAnalyticsBody);
  renderAnalyticsBody();
}
function filteredDbForAnalytics() {
  const subject = $('anaSubject')?.value || '';
  const lectureId = $('anaLecture')?.value || '';
  const date = $('anaDate')?.value || '';
  const lectures = db.lectures.filter((l) => (!subject || l.subject === subject) && (!lectureId || l.id === lectureId));
  const activities = db.activities.filter((a) => (!subject || a.subject === subject) && (!lectureId || a.lectureId === lectureId) && (!date || a.date === date));
  return { lectures, activities };
}
function renderAnalyticsBody() {
  const { lectures, activities } = filteredDbForAnalytics();
  const lectureCompletion = lectures.length ? Math.round(lectures.filter((l) => l.progress >= 100).length / lectures.length * 100) : 0;
  const xp = activities.reduce((s,a)=>s+Number(a.xp||0),0);
  const mcqs = lectures.reduce((s,l)=>s+Number(l.mcqsSolved||0),0);
  const answers = lectures.reduce((s,l)=>s+Number(l.answersWritten||0),0);
  $('analyticsBody').innerHTML = `
    <section class="grid-4">${metric('Lecture Completion', `${lectureCompletion}%`, `${lectures.filter((l)=>l.progress>=100).length}/${lectures.length}`)}${metric('XP Trend', xp, 'filtered activity XP')}${metric('Mission Score Trend', `${missionScore(db)}/100`, 'current computed score')}${metric('Questions Written', answers, 'answers tracked')}${metric('MCQs Solved', mcqs, 'lecture-level MCQs')}</section>
    <section class="grid-2"><div class="card"><h2>Subject-wise Progress</h2>${renderSubjectBars(subjectProgress({ ...db, lectures }))}</div><div class="card"><h2>XP Trend</h2>${renderTrendBars(activities, 'xp')}</div></section>
    <section class="grid-2"><div class="card"><h2>Mission Score Trend</h2>${renderMissionTrend()}</div><div class="card"><h2>Revision Heatmap</h2>${renderHeatmap()}</div></section>
    <section class="grid-2"><div class="card"><h2>Weekly Productivity</h2>${renderProductivity(7)}</div><div class="card"><h2>Monthly Productivity</h2>${renderProductivity(30)}</div></section>
  `;
}
function renderSubjectBars(rows) { return rows.length ? `<div class="bar-list">${rows.map((r)=>`<div class="bar-row"><span>${escapeHtml(r.subject)}</span>${miniBar(r.average)}<strong>${r.average}%</strong></div>`).join('')}</div>` : '<div class="empty">No lecture data.</div>'; }
function groupByDate(activities, field = 'xp') {
  const grouped = {};
  activities.forEach((a) => { grouped[a.date] = (grouped[a.date] || 0) + Number(a[field] || 0); });
  return Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14);
}
function renderTrendBars(activities) { const rows = groupByDate(activities); const max = Math.max(1, ...rows.map((r)=>r[1])); return rows.length ? `<div class="bar-list">${rows.map(([date,value])=>`<div class="bar-row"><span>${date}</span>${miniBar(value/max*100)}<strong>${Math.round(value)}</strong></div>`).join('')}</div>` : '<div class="empty">No activity yet.</div>'; }
function renderMissionTrend() { const rows = Object.entries(db.planner.byDate || {}).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14).map(([date,plan])=>[date,dailyCompletion(plan).percent]); return rows.length ? `<div class="bar-list">${rows.map(([date,value])=>`<div class="bar-row"><span>${date}</span>${miniBar(value)}<strong>${value}</strong></div>`).join('')}</div>` : '<div class="empty">No planner history yet.</div>'; }
function renderHeatmap() { const days = Array.from({ length: 56 }, (_, i) => addDays(todayKey(), i - 55)); const revised = new Set(db.activities.filter((a)=>a.type==='revision').map((a)=>a.date)); return `<div class="heatmap">${days.map((d)=>`<div title="${d}" class="heat ${revised.has(d) ? 'strong' : db.revisions.some((r)=>r.dueDate===d) ? 'on' : ''}"></div>`).join('')}</div><p class="hint">Darker cells indicate completed revision; lighter cells indicate scheduled revision.</p>`; }
function renderProductivity(days) { const start = addDays(todayKey(), -(days-1)); const plans = Object.entries(db.planner.byDate || {}).filter(([date])=>date>=start).sort((a,b)=>a[0].localeCompare(b[0])); const avg = plans.length ? Math.round(plans.reduce((s,[,p])=>s+dailyCompletion(p).percent,0)/plans.length) : 0; return `${metric(`${days}-Day Average`, `${avg}%`, `${plans.length} active days`)}${plans.length ? renderMissionTrend() : ''}`; }

function renderSettings() {
  const c = db.config;
  appHtml(`
    <section class="card">
      <h2>Settings Engine</h2>
      <p class="hint">These values drive planner generation, dashboard metrics, analytics and recommendations.</p>
      <form id="settingsForm" class="grid">
        <label>Priority 1 Subject<input id="setP1" value="${escapeHtml(c.priority1)}"></label>
        <label>Priority 2 Subject<input id="setP2" value="${escapeHtml(c.priority2)}"></label>
        <label>Priority 3 Subject<input id="setP3" value="${escapeHtml(c.priority3)}"></label>
        <label>Optional Subject<input id="setOptional" value="${escapeHtml(c.optionalSubject)}"></label>
        <label>Exam Date<input id="setExamDate" type="date" value="${escapeHtml(c.examDate)}"></label>
        <label>Mission Start Date<input id="setMissionStart" type="date" value="${escapeHtml(c.missionStartDate)}"></label>
        <label>Mission Length<input id="setMissionLength" type="number" min="1" value="${Number(c.missionLength)}"></label>
        <label>Daily Lecture Target<input id="setLectureTarget" type="number" min="0" value="${Number(c.dailyLectureTarget)}"></label>
        <label>Daily MCQ Target<input id="setMcqTarget" type="number" min="0" value="${Number(c.dailyMcqTarget)}"></label>
        <label>Daily Answer Writing Target<input id="setAnswerTarget" type="number" min="0" value="${Number(c.dailyAnswerTarget)}"></label>
        <label>Recovery Tokens<input id="setRecovery" type="number" min="0" value="${Number(c.recoveryTokens)}"></label>
        <button type="submit">Save Settings</button>
      </form>
    </section>
    ${typeof firebaseCloudSettingsHtml === 'function' ? firebaseCloudSettingsHtml(db) : ''}
    <section class="card">
      <h2>Database Utilities</h2>
      <p class="hint">Use JSON export/import for a manual backup. Use Firebase Cloud Sync above for multi-device access.</p>
      <div class="section-actions">
        <button type="button" class="secondary" id="settingsExportBtn">Export JSON Backup</button>
        <label class="import-btn secondary" for="settingsImportInput">Import JSON Backup</label>
        <input id="settingsImportInput" type="file" accept="application/json" hidden>
      </div>
    </section>
  `);
  $('settingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    db.config = { ...db.config, priority1: $('setP1').value.trim(), priority2: $('setP2').value.trim(), priority3: $('setP3').value.trim(), optionalSubject: $('setOptional').value.trim(), examDate: $('setExamDate').value, missionStartDate: $('setMissionStart').value || todayKey(), missionLength: Number($('setMissionLength').value || 150), dailyLectureTarget: Number($('setLectureTarget').value || 0), dailyMcqTarget: Number($('setMcqTarget').value || 0), dailyAnswerTarget: Number($('setAnswerTarget').value || 0), recoveryTokens: Number($('setRecovery').value || 0) };
    setDb(db);
    ensurePlannerForDate(db, todayKey(), true);
    showToast('Settings saved. Planner, dashboard, analytics and recommendations updated.');
    refresh('settings');
  });
  $('settingsExportBtn')?.addEventListener('click', downloadJson);
  $('settingsImportInput')?.addEventListener('change', (event) => importJson(event.target.files[0]));
  if (typeof bindFirebaseCloudSettings === 'function') bindFirebaseCloudSettings(() => refresh('settings'));
}

function init() {
  ['app','pageTitle','pageSummary','todayLabel','dailyPercent','dailyText','dailyFill','toast','modalRoot','exportDataBtn','importDataInput','firebaseStatus'].forEach((id) => { els[id] = $(id); });
  db = loadDb();
  ensurePlannerForDate(db, todayKey());
  els.exportDataBtn.addEventListener('click', downloadJson);
  els.importDataInput.addEventListener('change', (event) => importJson(event.target.files[0]));
  window.addEventListener('hashchange', () => refresh(readRoute()));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  refresh(readRoute());
}

document.addEventListener('DOMContentLoaded', init);
