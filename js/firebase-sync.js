/* Track2Crack v1.8 Firebase Cloud Sync
   Uses Email/Password auth + Firestore. Data path: users/{uid}/app/state
*/
const T2C_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCLfrK8xDpBgApdjx8TEeIf5Yo2gUY5WAc",
  authDomain: "track2crack-5f1cf.firebaseapp.com",
  projectId: "track2crack-5f1cf",
  storageBucket: "track2crack-5f1cf.firebasestorage.app",
  messagingSenderId: "368353706837",
  appId: "1:368353706837:web:a521ee236cb0868d56a5dc"
};

const T2C_CLOUD = {
  ready: false,
  user: null,
  saving: false,
  lastError: '',
  debounceTimer: null
};

(function initFirebaseCloud() {
  try {
    if (typeof firebase === 'undefined') {
      T2C_CLOUD.lastError = 'Firebase SDK could not load. Check your internet connection.';
      return;
    }
    if (!firebase.apps.length) firebase.initializeApp(T2C_FIREBASE_CONFIG);
    T2C_CLOUD.ready = true;
    firebase.auth().onAuthStateChanged((user) => {
      T2C_CLOUD.user = user || null;
      if (user) {
        const db = loadDb();
        db.config.firebaseUserEmail = user.email || '';
        saveDbWithoutCloudEvent(db);
      }
      updateFirebaseMiniStatus(loadDb());
      if (typeof refresh === 'function' && currentRoute === 'settings') refresh('settings');
    });
  } catch (error) {
    T2C_CLOUD.lastError = error.message || String(error);
  }
})();

function saveDbWithoutCloudEvent(db) {
  window.T2C_SUPPRESS_DB_EVENT = true;
  try { saveDb(db); }
  finally { window.T2C_SUPPRESS_DB_EVENT = false; }
}

function firebaseDocRef() {
  const user = T2C_CLOUD.user || firebase.auth().currentUser;
  if (!user) throw new Error('Please sign in first.');
  return firebase.firestore().collection('users').doc(user.uid).collection('app').doc('state');
}

function stripLargeLocalFiles(db) {
  const copy = normalizeDb(JSON.parse(JSON.stringify(db || loadDb())));
  copy.lectures = copy.lectures.map((lecture) => ({
    ...lecture,
    notesDataUrl: lecture.notesDataUrl ? '' : '',
    notesLocalOnly: Boolean(lecture.notesDataUrl)
  }));
  copy.articles = copy.articles.map((article) => ({
    ...article,
    image: article.image ? '' : '',
    imageLocalOnly: Boolean(article.image)
  }));
  copy.aiUploads = copy.aiUploads.map((upload) => ({
    ...upload,
    dataUrl: upload.dataUrl ? '' : '',
    fileLocalOnly: Boolean(upload.dataUrl)
  }));
  copy.version = 8;
  copy.cloudSavedAt = new Date().toISOString();
  return copy;
}

function mergeFirebaseLocalConfig(targetDb, sourceDb) {
  const next = normalizeDb(targetDb);
  const local = sourceDb?.config || {};
  ['firebaseAutoSync','firebaseLastSyncAt','firebaseLastDirection','firebaseUserEmail'].forEach((field) => {
    if (local[field] !== undefined) next.config[field] = local[field];
  });
  return next;
}

async function firebaseRegister(email, password) {
  ensureFirebaseReady();
  if (!email || !password) throw new Error('Enter email and password.');
  const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
  await firebaseCloudSave(true);
  return result.user;
}

async function firebaseSignIn(email, password) {
  ensureFirebaseReady();
  if (!email || !password) throw new Error('Enter email and password.');
  const result = await firebase.auth().signInWithEmailAndPassword(email, password);
  return result.user;
}

async function firebaseSignOut() {
  ensureFirebaseReady();
  await firebase.auth().signOut();
  T2C_CLOUD.user = null;
  updateFirebaseMiniStatus(loadDb());
}

function ensureFirebaseReady() {
  if (!T2C_CLOUD.ready || typeof firebase === 'undefined') {
    throw new Error(T2C_CLOUD.lastError || 'Firebase is not ready yet. Check your internet connection.');
  }
}

async function firebaseCloudSave(manual = false) {
  ensureFirebaseReady();
  if (!T2C_CLOUD.user && !firebase.auth().currentUser) throw new Error('Please sign in first.');
  if (T2C_CLOUD.saving) return;
  T2C_CLOUD.saving = true;
  try {
    const local = loadDb();
    const payload = stripLargeLocalFiles(local);
    await firebaseDocRef().set({
      app: 'Track2Crack',
      schemaVersion: 8,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
      payload
    }, { merge: true });
    local.config.firebaseLastSyncAt = new Date().toISOString();
    local.config.firebaseLastDirection = 'Saved local data to Firebase';
    local.config.firebaseUserEmail = (T2C_CLOUD.user || firebase.auth().currentUser)?.email || '';
    saveDbWithoutCloudEvent(local);
    updateFirebaseMiniStatus(local);
    if (manual && typeof showToast === 'function') showToast('Cloud database saved to Firebase.');
  } finally {
    T2C_CLOUD.saving = false;
  }
}

async function firebaseCloudLoad() {
  ensureFirebaseReady();
  if (!T2C_CLOUD.user && !firebase.auth().currentUser) throw new Error('Please sign in first.');
  const snap = await firebaseDocRef().get();
  if (!snap.exists) throw new Error('No cloud database found yet. Save local data to cloud first.');
  const cloudPayload = snap.data()?.payload;
  if (!cloudPayload || cloudPayload.app !== 'Track2Crack') throw new Error('Cloud database is not a valid Track2Crack state.');
  const localBefore = loadDb();
  const merged = mergeFirebaseLocalConfig(cloudPayload, localBefore);
  merged.config.firebaseLastSyncAt = new Date().toISOString();
  merged.config.firebaseLastDirection = 'Loaded Firebase data to this device';
  merged.config.firebaseUserEmail = (T2C_CLOUD.user || firebase.auth().currentUser)?.email || '';
  saveDbWithoutCloudEvent(merged);
  updateFirebaseMiniStatus(merged);
  if (typeof showToast === 'function') showToast('Cloud database loaded from Firebase.');
  return merged;
}

async function firebaseCheckCloud() {
  ensureFirebaseReady();
  const snap = await firebaseDocRef().get();
  if (!snap.exists) return { exists: false };
  const data = snap.data() || {};
  return { exists: true, updatedAtIso: data.updatedAtIso || '', schemaVersion: data.schemaVersion || '' };
}

function queueFirebaseAutoSave(db) {
  const cfg = db?.config || loadDb().config || {};
  if (!cfg.firebaseAutoSync) return;
  if (!T2C_CLOUD.ready || !T2C_CLOUD.user) return;
  clearTimeout(T2C_CLOUD.debounceTimer);
  T2C_CLOUD.debounceTimer = setTimeout(() => {
    firebaseCloudSave(false).catch((error) => {
      T2C_CLOUD.lastError = error.message || String(error);
      updateFirebaseMiniStatus(loadDb());
      console.warn('Track2Crack Firebase auto-sync failed:', error);
    });
  }, 1200);
}

window.addEventListener('t2c:db-saved', (event) => queueFirebaseAutoSave(event.detail?.db));

function firebaseCloudSettingsHtml(db) {
  const cfg = db.config || {};
  const user = T2C_CLOUD.user;
  const status = user ? `Signed in as ${escapeHtml(user.email || 'Firebase user')}` : 'Not signed in';
  const lastSync = cfg.firebaseLastSyncAt ? `${escapeHtml(new Date(cfg.firebaseLastSyncAt).toLocaleString())} · ${escapeHtml(cfg.firebaseLastDirection || '')}` : 'No Firebase sync yet';
  const error = T2C_CLOUD.lastError ? `<p class="warning">${escapeHtml(T2C_CLOUD.lastError)}</p>` : '';
  return `
    <section class="card cloud-card">
      <div class="section-head">
        <div>
          <h2>Firebase Cloud Sync</h2>
          <p class="hint">Use the same email/password on phone, office PC and home PC. Firestore path: <code>users/{uid}/app/state</code>.</p>
        </div>
        <span class="pill">${status}</span>
      </div>
      ${error}
      <div class="grid">
        <label>Email<input id="fbEmail" type="email" autocomplete="email" placeholder="your email" value="${escapeHtml(cfg.firebaseUserEmail || '')}"></label>
        <label>Password<input id="fbPassword" type="password" autocomplete="current-password" placeholder="minimum 6 characters"></label>
      </div>
      <div class="section-actions">
        <button type="button" id="fbSignIn">Sign In</button>
        <button type="button" id="fbRegister" class="secondary">Create Account</button>
        <button type="button" id="fbSignOut" class="secondary">Sign Out</button>
      </div>
      <hr>
      <div class="section-actions">
        <button type="button" id="fbSaveCloud">Save Local DB to Cloud</button>
        <button type="button" id="fbLoadCloud" class="secondary">Load Cloud DB on This Device</button>
        <button type="button" id="fbCheckCloud" class="secondary">Check Cloud DB</button>
      </div>
      <label class="inline-check"><input id="fbAutoSync" type="checkbox" ${cfg.firebaseAutoSync ? 'checked' : ''}> Auto-sync local changes after sign-in</label>
      <p class="hint">Last sync: ${lastSync}</p>
      <p class="hint">Large PDFs, screenshots and image data are not uploaded in v1.8. The structured records sync; file storage can be added later.</p>
    </section>
  `;
}

function bindFirebaseCloudSettings(refreshCb) {
  const emailEl = document.getElementById('fbEmail');
  const passwordEl = document.getElementById('fbPassword');
  const autoEl = document.getElementById('fbAutoSync');
  const handle = async (fn, success) => {
    try {
      await fn();
      if (success && typeof showToast === 'function') showToast(success);
      if (refreshCb) refreshCb();
    } catch (error) {
      alert(error.message || String(error));
    }
  };
  document.getElementById('fbSignIn')?.addEventListener('click', () => handle(() => firebaseSignIn(emailEl.value.trim(), passwordEl.value), 'Signed in. Use Load Cloud DB if this is a second device.'));
  document.getElementById('fbRegister')?.addEventListener('click', () => handle(() => firebaseRegister(emailEl.value.trim(), passwordEl.value), 'Account created and local database saved to cloud.'));
  document.getElementById('fbSignOut')?.addEventListener('click', () => handle(() => firebaseSignOut(), 'Signed out.'));
  document.getElementById('fbSaveCloud')?.addEventListener('click', () => handle(() => firebaseCloudSave(true)));
  document.getElementById('fbLoadCloud')?.addEventListener('click', () => handle(async () => { await firebaseCloudLoad(); if (typeof refresh === 'function') refresh(currentRoute); }));
  document.getElementById('fbCheckCloud')?.addEventListener('click', () => handle(async () => {
    const info = await firebaseCheckCloud();
    alert(info.exists ? `Cloud DB found. Last updated: ${info.updatedAtIso || 'unknown'}` : 'No cloud database found yet.');
  }));
  autoEl?.addEventListener('change', () => {
    const db = loadDb();
    db.config.firebaseAutoSync = Boolean(autoEl.checked);
    db.config.firebaseUserEmail = emailEl?.value.trim() || db.config.firebaseUserEmail || '';
    saveDb(db);
    if (typeof showToast === 'function') showToast(db.config.firebaseAutoSync ? 'Firebase auto-sync enabled.' : 'Firebase auto-sync disabled.');
    if (refreshCb) refreshCb();
  });
}

function updateFirebaseMiniStatus(db) {
  const el = document.getElementById('firebaseStatus');
  if (!el) return;
  const cfg = db?.config || {};
  if (!T2C_CLOUD.ready) {
    el.textContent = 'Cloud: Firebase SDK not loaded';
    el.className = 'cloud-status error';
    return;
  }
  if (T2C_CLOUD.user) {
    el.textContent = `Cloud: signed in${cfg.firebaseAutoSync ? ' · auto-sync on' : ''}`;
    el.className = 'cloud-status ok';
  } else {
    el.textContent = 'Cloud: not signed in';
    el.className = 'cloud-status';
  }
}
