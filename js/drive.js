const T2C_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const T2C_DRIVE_FIELDS = 'id,name,modifiedTime,size,webViewLink';
let t2cDriveTokenClient = null;
let t2cDriveAccessToken = '';
let t2cDriveAutoSyncTimer = null;
let t2cDriveSyncInProgress = false;
let t2cLastAutoSyncFingerprint = '';

function driveToast(message) {
  if (typeof showToast === 'function') showToast(message);
  else console.log(message);
}

function driveCfg(db = loadDb()) {
  const c = db.config || {};
  return {
    clientId: String(c.googleDriveClientId || '').trim(),
    folderId: String(c.googleDriveFolderId || '').trim(),
    fileId: String(c.googleDriveFileId || '').trim(),
    name: String(c.googleDriveDatabaseName || 'track2crack-database.json').trim() || 'track2crack-database.json',
    autoSync: Boolean(c.googleDriveAutoSync),
    lastSyncAt: c.googleDriveLastSyncAt || '',
    lastDirection: c.googleDriveLastDirection || ''
  };
}

function isGoogleDriveConfigured(db = loadDb()) {
  return Boolean(driveCfg(db).clientId);
}

function isHttpOrigin() {
  return location.protocol === 'http:' || location.protocol === 'https:';
}

function escapeDriveQuery(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function googleDriveHelpText() {
  if (isHttpOrigin()) return '';
  return '<p class="warning-box"><strong>Google sign-in will not work from a file:// page.</strong><br>Run this app through a local server, for example by opening <code>start-local-server.bat</code>, then visit <code>http://localhost:8080</code>.</p>';
}

function waitForGoogleIdentity(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve(window.google.accounts.oauth2);
      } else if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error('Google Identity Services did not load. Check internet connection or open the app through http://localhost:8080.'));
      }
    }, 100);
  });
}

async function getGoogleDriveAccessToken(prompt = '') {
  const db = loadDb();
  const cfg = driveCfg(db);
  if (!cfg.clientId) throw new Error('Add your Google OAuth Client ID in Settings first.');
  if (!isHttpOrigin()) throw new Error('Google Drive sync cannot run from file://. Use start-local-server.bat and open http://localhost:8080.');
  const oauth2 = await waitForGoogleIdentity();
  return new Promise((resolve, reject) => {
    try {
      t2cDriveTokenClient = oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: T2C_DRIVE_SCOPE,
        prompt: prompt || '',
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          t2cDriveAccessToken = response.access_token;
          updateGoogleDriveMiniStatus(loadDb());
          resolve(t2cDriveAccessToken);
        }
      });
      t2cDriveTokenClient.requestAccessToken({ prompt: t2cDriveAccessToken ? '' : (prompt || 'consent') });
    } catch (error) {
      reject(error);
    }
  });
}

async function driveFetch(url, options = {}) {
  if (!t2cDriveAccessToken) await getGoogleDriveAccessToken('');
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${t2cDriveAccessToken}`
    }
  });
  if (!response.ok) {
    let detail = '';
    try { detail = await response.text(); } catch (_) {}
    throw new Error(`Google Drive request failed (${response.status}). ${detail}`.slice(0, 500));
  }
  return response;
}

async function findGoogleDriveDatabaseFile(db = loadDb()) {
  const cfg = driveCfg(db);
  if (cfg.fileId) {
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cfg.fileId)}?fields=${encodeURIComponent(T2C_DRIVE_FIELDS)}`);
    return await res.json();
  }
  const parts = [`name='${escapeDriveQuery(cfg.name)}'`, 'trashed=false'];
  if (cfg.folderId) parts.push(`'${escapeDriveQuery(cfg.folderId)}' in parents`);
  const q = encodeURIComponent(parts.join(' and '));
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${encodeURIComponent(`files(${T2C_DRIVE_FIELDS})`)}&pageSize=10&spaces=drive`);
  const json = await res.json();
  return (json.files || [])[0] || null;
}

function driveDbPayload(db = loadDb()) {
  const clean = normalizeDb(db);
  clean.exportedAt = new Date().toISOString();
  clean.storage = { provider: 'google-drive-json', databaseName: driveCfg(db).name };
  return clean;
}

async function createGoogleDriveDatabaseFile(db = loadDb()) {
  const cfg = driveCfg(db);
  const metadata = { name: cfg.name, mimeType: 'application/json' };
  if (cfg.folderId) metadata.parents = [cfg.folderId];
  const boundary = `t2c_${Date.now()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(driveDbPayload(db), null, 2),
    `--${boundary}--`
  ].join('\r\n');
  const res = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(T2C_DRIVE_FIELDS)}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  return await res.json();
}

async function updateGoogleDriveDatabaseFile(fileId, db = loadDb()) {
  const res = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=${encodeURIComponent(T2C_DRIVE_FIELDS)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(driveDbPayload(db), null, 2)
  });
  return await res.json();
}

function saveGoogleDriveConfig(fields) {
  const db = loadDb();
  db.config = { ...db.config, ...fields };
  window.T2C_SUPPRESS_DB_EVENT = true;
  const saved = saveDb(db);
  window.T2C_SUPPRESS_DB_EVENT = false;
  updateGoogleDriveMiniStatus(saved);
  return saved;
}

async function syncToGoogleDrive() {
  if (t2cDriveSyncInProgress) return { message: 'Sync already running.' };
  t2cDriveSyncInProgress = true;
  try {
    await getGoogleDriveAccessToken('');
    let db = loadDb();
    let file = null;
    try { file = await findGoogleDriveDatabaseFile(db); } catch (error) { if (driveCfg(db).fileId) throw error; }
    file = file ? await updateGoogleDriveDatabaseFile(file.id, db) : await createGoogleDriveDatabaseFile(db);
    db = loadDb();
    db.config.googleDriveFileId = file.id;
    db.config.googleDriveLastSyncAt = new Date().toISOString();
    db.config.googleDriveLastDirection = 'upload';
    window.T2C_SUPPRESS_DB_EVENT = true;
    saveDb(db);
    window.T2C_SUPPRESS_DB_EVENT = false;
    updateGoogleDriveMiniStatus(loadDb());
    return { file, message: 'Database uploaded to Google Drive.' };
  } finally {
    t2cDriveSyncInProgress = false;
  }
}

async function syncFromGoogleDrive() {
  if (t2cDriveSyncInProgress) return { message: 'Sync already running.' };
  t2cDriveSyncInProgress = true;
  try {
    await getGoogleDriveAccessToken('');
    const local = loadDb();
    const file = await findGoogleDriveDatabaseFile(local);
    if (!file?.id) throw new Error('No Track2Crack database file was found in Google Drive. Create/upload it first.');
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);
    const remote = await res.json();
    if (!remote || remote.app !== 'Track2Crack') throw new Error('The Drive file is not a valid Track2Crack database.');
    const merged = mergeGoogleDriveConfig(remote, local);
    merged.config.googleDriveFileId = file.id;
    merged.config.googleDriveLastSyncAt = new Date().toISOString();
    merged.config.googleDriveLastDirection = 'download';
    window.T2C_SUPPRESS_DB_EVENT = true;
    saveDb(merged);
    window.T2C_SUPPRESS_DB_EVENT = false;
    updateGoogleDriveMiniStatus(loadDb());
    return { file, message: 'Database loaded from Google Drive.' };
  } finally {
    t2cDriveSyncInProgress = false;
  }
}

async function checkGoogleDriveDatabaseStatus() {
  await getGoogleDriveAccessToken('');
  const file = await findGoogleDriveDatabaseFile(loadDb());
  return file;
}

function googleDriveFingerprint(db) {
  const copy = normalizeDb(db);
  delete copy.config.googleDriveLastSyncAt;
  delete copy.config.googleDriveLastDirection;
  copy.generatedForSync = undefined;
  return JSON.stringify(copy);
}

function queueGoogleDriveAutoSync(db = loadDb()) {
  const cfg = driveCfg(db);
  if (!cfg.autoSync || !cfg.clientId || !t2cDriveAccessToken) return;
  const fingerprint = googleDriveFingerprint(db);
  if (fingerprint === t2cLastAutoSyncFingerprint) return;
  t2cLastAutoSyncFingerprint = fingerprint;
  clearTimeout(t2cDriveAutoSyncTimer);
  t2cDriveAutoSyncTimer = setTimeout(async () => {
    try { await syncToGoogleDrive(); }
    catch (error) { console.warn('Track2Crack auto-sync failed:', error); updateGoogleDriveMiniStatus(loadDb()); }
  }, 2200);
}

function updateGoogleDriveMiniStatus(db = loadDb()) {
  const el = document.getElementById('cloudMiniStatus');
  if (!el) return;
  const cfg = driveCfg(db);
  let text = 'Database: Local only';
  if (cfg.clientId && !t2cDriveAccessToken) text = cfg.fileId ? 'Drive linked · sign in' : 'Drive ready · sign in';
  if (cfg.clientId && t2cDriveAccessToken) text = cfg.fileId ? 'Drive linked · signed in' : 'Drive ready · signed in';
  if (cfg.lastSyncAt) {
    const when = new Date(cfg.lastSyncAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    text += ` · ${cfg.lastDirection || 'sync'} ${when}`;
  }
  if (cfg.autoSync) text += ' · auto';
  el.textContent = text;
}

function googleDriveSettingsHtml(db = loadDb()) {
  const c = db.config || {};
  return `
    <section class="card">
      <div class="section-head">
        <div>
          <h2>Google Drive Database</h2>
          <p class="hint">v1.7 stores the Track2Crack database as one JSON file in your Google Drive folder. Local storage remains the instant working copy.</p>
        </div>
        <span class="pill">${escapeHtml(driveCfg(db).fileId ? 'Drive linked' : 'Local first')}</span>
      </div>
      ${googleDriveHelpText()}
      <form id="driveSettingsForm" class="grid">
        <label class="wide">Google OAuth Client ID
          <input id="driveClientId" value="${escapeHtml(c.googleDriveClientId || '')}" placeholder="Paste OAuth Web Client ID">
        </label>
        <label>Google Drive Folder ID
          <input id="driveFolderId" value="${escapeHtml(c.googleDriveFolderId || '')}" placeholder="Folder ID from Drive URL">
        </label>
        <label>Database File ID <span class="hint">optional</span>
          <input id="driveFileId" value="${escapeHtml(c.googleDriveFileId || '')}" placeholder="Auto-filled after first upload">
        </label>
        <label>Database File Name
          <input id="driveDbName" value="${escapeHtml(c.googleDriveDatabaseName || 'track2crack-database.json')}">
        </label>
        <label class="inline checkline"><input id="driveAutoSync" type="checkbox" ${c.googleDriveAutoSync ? 'checked' : ''}> Auto-sync after changes once signed in</label>
        <button type="submit">Save Drive Settings</button>
      </form>
      <div class="section-actions cloud-actions">
        <button id="driveSignIn" type="button" class="secondary">Sign in to Google</button>
        <button id="driveUpload" type="button">Create / Update Drive DB</button>
        <button id="driveDownload" type="button" class="secondary">Load DB from Drive</button>
        <button id="driveCheck" type="button" class="secondary">Check Drive DB</button>
      </div>
      <div id="driveStatusBox" class="detail-box">
        <strong>Status:</strong> ${escapeHtml(googleDriveStatusText(db))}
        <p class="hint">Last sync: ${escapeHtml(c.googleDriveLastSyncAt ? new Date(c.googleDriveLastSyncAt).toLocaleString() : 'Never')}</p>
      </div>
    </section>
  `;
}

function googleDriveStatusText(db = loadDb()) {
  const cfg = driveCfg(db);
  if (!cfg.clientId) return 'Not configured. Add OAuth Client ID and Folder ID.';
  if (!isHttpOrigin()) return 'Configured, but open through http://localhost:8080 for Google sign-in.';
  if (!t2cDriveAccessToken) return cfg.fileId ? 'Configured. Sign in to sync.' : 'Configured. Sign in and create Drive DB.';
  return cfg.fileId ? 'Signed in and linked to Drive database.' : 'Signed in. Drive database file not created yet.';
}

function bindGoogleDriveSettings(afterRefresh) {
  const form = document.getElementById('driveSettingsForm');
  if (!form) return;
  const statusBox = document.getElementById('driveStatusBox');
  const setStatus = (html) => { if (statusBox) statusBox.innerHTML = html; updateGoogleDriveMiniStatus(loadDb()); };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveGoogleDriveConfig({
      googleDriveClientId: document.getElementById('driveClientId').value.trim(),
      googleDriveFolderId: document.getElementById('driveFolderId').value.trim(),
      googleDriveFileId: document.getElementById('driveFileId').value.trim(),
      googleDriveDatabaseName: document.getElementById('driveDbName').value.trim() || 'track2crack-database.json',
      googleDriveAutoSync: document.getElementById('driveAutoSync').checked
    });
    driveToast('Google Drive settings saved.');
    if (afterRefresh) afterRefresh();
  });
  document.getElementById('driveSignIn')?.addEventListener('click', async () => {
    try { await getGoogleDriveAccessToken('consent'); setStatus(`<strong>Status:</strong> ${escapeHtml(googleDriveStatusText(loadDb()))}`); driveToast('Signed in to Google Drive.'); }
    catch (error) { setStatus(`<strong>Status:</strong> ${escapeHtml(error.message)}`); }
  });
  document.getElementById('driveUpload')?.addEventListener('click', async () => {
    try { setStatus('<strong>Status:</strong> Uploading local database to Google Drive...'); const result = await syncToGoogleDrive(); setStatus(`<strong>Status:</strong> ${escapeHtml(result.message)}<p class="hint">File ID: ${escapeHtml(result.file?.id || '')}</p>`); driveToast(result.message); if (afterRefresh) afterRefresh(); }
    catch (error) { setStatus(`<strong>Status:</strong> ${escapeHtml(error.message)}`); }
  });
  document.getElementById('driveDownload')?.addEventListener('click', async () => {
    const ok = confirm('Load database from Google Drive? This will replace the current local browser copy after preserving your Drive configuration.');
    if (!ok) return;
    try { setStatus('<strong>Status:</strong> Loading database from Google Drive...'); const result = await syncFromGoogleDrive(); setStatus(`<strong>Status:</strong> ${escapeHtml(result.message)}<p class="hint">File: ${escapeHtml(result.file?.name || '')}</p>`); driveToast(result.message); if (afterRefresh) afterRefresh(); }
    catch (error) { setStatus(`<strong>Status:</strong> ${escapeHtml(error.message)}`); }
  });
  document.getElementById('driveCheck')?.addEventListener('click', async () => {
    try { setStatus('<strong>Status:</strong> Checking Google Drive...'); const file = await checkGoogleDriveDatabaseStatus(); setStatus(file ? `<strong>Status:</strong> Found Drive database.<p class="hint">${escapeHtml(file.name)} · ${escapeHtml(file.id)} · modified ${escapeHtml(file.modifiedTime || '')}</p>` : '<strong>Status:</strong> No database file found. Click Create / Update Drive DB.'); }
    catch (error) { setStatus(`<strong>Status:</strong> ${escapeHtml(error.message)}`); }
  });
}

window.addEventListener('t2c:db-saved', (event) => {
  const savedDb = event.detail?.db || loadDb();
  updateGoogleDriveMiniStatus(savedDb);
  queueGoogleDriveAutoSync(savedDb);
});
window.addEventListener('DOMContentLoaded', () => updateGoogleDriveMiniStatus(loadDb()));

window.getGoogleDriveAccessToken = getGoogleDriveAccessToken;
window.syncToGoogleDrive = syncToGoogleDrive;
window.syncFromGoogleDrive = syncFromGoogleDrive;
window.googleDriveSettingsHtml = googleDriveSettingsHtml;
window.bindGoogleDriveSettings = bindGoogleDriveSettings;
window.updateGoogleDriveMiniStatus = updateGoogleDriveMiniStatus;
