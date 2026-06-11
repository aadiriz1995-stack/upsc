const T2C_KEYS = {
  config: 't2c_config_v2',
  dayStatePrefix: 't2c_day_state_',
  archive: 't2c_archive_v2'
};

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Track2Crack: invalid saved JSON, using fallback.', error);
    return fallback;
  }
}

function loadConfig() {
  return safeJsonParse(localStorage.getItem(T2C_KEYS.config), null);
}

function saveConfig(cfg) {
  localStorage.setItem(T2C_KEYS.config, JSON.stringify(cfg));
}

function loadDayState(dateKey = todayKey()) {
  return safeJsonParse(localStorage.getItem(T2C_KEYS.dayStatePrefix + dateKey), {
    completed: {},
    customTasks: []
  });
}

function saveDayState(state, dateKey = todayKey()) {
  localStorage.setItem(T2C_KEYS.dayStatePrefix + dateKey, JSON.stringify(state));
}

function clearDayState(dateKey = todayKey()) {
  localStorage.removeItem(T2C_KEYS.dayStatePrefix + dateKey);
}

function exportAllData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Track2Crack',
    config: loadConfig(),
    dayStates: {}
  };

  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(T2C_KEYS.dayStatePrefix)) {
      const date = key.replace(T2C_KEYS.dayStatePrefix, '');
      payload.dayStates[date] = safeJsonParse(localStorage.getItem(key), null);
    }
  });

  return payload;
}

function importAllData(payload) {
  if (!payload || payload.app !== 'Track2Crack') {
    throw new Error('This file is not a valid Track2Crack export.');
  }

  if (payload.config) saveConfig(payload.config);
  if (payload.dayStates && typeof payload.dayStates === 'object') {
    Object.entries(payload.dayStates).forEach(([date, state]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) saveDayState(state, date);
    });
  }
}
