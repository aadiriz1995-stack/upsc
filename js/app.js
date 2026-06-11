const DEFAULT_CONFIG = { priority1: 'Polity', priority2: 'Modern History', priority3: 'HL1' };

const els = {};
let cfg = loadConfig() || DEFAULT_CONFIG;
let state = loadDayState();
let toastTimer = null;

function $(id) {
  return document.getElementById(id);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function normaliseConfigFromForm() {
  return {
    priority1: els.p1.value.trim() || DEFAULT_CONFIG.priority1,
    priority2: els.p2.value.trim() || DEFAULT_CONFIG.priority2,
    priority3: els.p3.value.trim() || DEFAULT_CONFIG.priority3
  };
}

function hydrateSettingsForm() {
  els.p1.value = cfg.priority1;
  els.p2.value = cfg.priority2;
  els.p3.value = cfg.priority3;
}

function saveSettings() {
  cfg = normaliseConfigFromForm();
  saveConfig(cfg);
  render();
  showToast('Settings saved. Plan updated.');
}

function getAllTasks() {
  const generated = plannerItems(cfg);
  const custom = (state.customTasks || []).map((item) => ({ ...item, generated: false, category: item.category || 'Custom' }));
  return [...generated, ...custom];
}

function renderSummary(tasks) {
  els.todayLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  els.summary.textContent = `Current Focus: ${cfg.priority1} | ${cfg.priority2} | ${cfg.priority3}`;

  const completedCount = tasks.filter((item) => state.completed && state.completed[item.id]).length;
  const percent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  els.progressPercent.textContent = `${percent}%`;
  els.progressText.textContent = `${completedCount} of ${tasks.length} tasks complete`;
  els.progressFill.style.width = `${percent}%`;
}

function renderTasks() {
  const tasks = getAllTasks();
  els.tasks.innerHTML = '';

  tasks.forEach((item) => {
    const li = document.createElement('li');
    li.className = `task-item ${state.completed?.[item.id] ? 'done' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(state.completed?.[item.id]);
    checkbox.setAttribute('aria-label', `Mark ${item.title} as complete`);
    checkbox.addEventListener('change', () => toggleTask(item.id, checkbox.checked));

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = item.title;

    const meta = document.createElement('span');
    meta.className = 'task-meta';
    meta.textContent = item.category;

    li.appendChild(checkbox);
    li.appendChild(title);
    li.appendChild(meta);

    if (!item.generated) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger icon-btn';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => deleteCustomTask(item.id));
      li.appendChild(remove);
    }

    els.tasks.appendChild(li);
  });

  renderSummary(tasks);
}

function render() {
  hydrateSettingsForm();
  renderTasks();
}

function toggleTask(taskId, isDone) {
  state.completed = state.completed || {};
  if (isDone) state.completed[taskId] = true;
  else delete state.completed[taskId];
  saveDayState(state);
  renderTasks();
}

function addCustomTask(title) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;

  state.customTasks = state.customTasks || [];
  const id = `custom-${Date.now()}-${slugify(cleanTitle)}`;
  state.customTasks.push({ id, title: cleanTitle, category: 'Custom' });
  saveDayState(state);
  renderTasks();
  showToast('Custom task added.');
}

function deleteCustomTask(taskId) {
  state.customTasks = (state.customTasks || []).filter((item) => item.id !== taskId);
  if (state.completed) delete state.completed[taskId];
  saveDayState(state);
  renderTasks();
  showToast('Custom task deleted.');
}

function resetToday() {
  if (!confirm('Reset today\'s completed and custom tasks?')) return;
  clearDayState();
  state = loadDayState();
  renderTasks();
  showToast('Today has been reset.');
}

function downloadJson() {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
      cfg = loadConfig() || DEFAULT_CONFIG;
      state = loadDayState();
      render();
      showToast('Backup imported.');
    } catch (error) {
      alert(error.message || 'Could not import this file.');
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  els.saveSettingsBtn.addEventListener('click', saveSettings);
  els.resetTodayBtn.addEventListener('click', resetToday);
  els.regenerateBtn.addEventListener('click', () => {
    cfg = normaliseConfigFromForm();
    renderTasks();
    showToast('Plan regenerated from current priorities.');
  });
  els.exportDataBtn.addEventListener('click', downloadJson);
  els.importDataInput.addEventListener('change', (event) => importJson(event.target.files[0]));
  els.customTaskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addCustomTask(els.customTaskInput.value);
    els.customTaskInput.value = '';
    els.customTaskInput.focus();
  });
}

function init() {
  ['p1','p2','p3','summary','todayLabel','progressPercent','progressText','progressFill','tasks','toast',
   'saveSettingsBtn','resetTodayBtn','regenerateBtn','exportDataBtn','importDataInput','customTaskForm','customTaskInput']
    .forEach((id) => { els[id] = $(id); });

  bindEvents();
  render();
}

document.addEventListener('DOMContentLoaded', init);
