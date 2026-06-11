# Track2Crack v1.8 — Firebase Cloud Sync Setup

This version uses:

- Firebase Authentication with Email/Password
- Cloud Firestore as the cloud database
- Firebase Hosting for multi-device access

Your Firebase config is already added inside `js/firebase-sync.js`.

## 1. Firebase Console checklist

Open your Firebase project: `track2crack-5f1cf`

### Enable Email/Password login

Go to:

`Build → Authentication → Sign-in method → Email/Password`

Enable **Email/Password** and save.

Do not enable passwordless email link for now.

### Create Firestore database

Go to:

`Build → Firestore Database → Create database`

Start in test mode temporarily, choose a region, and enable.

### Publish secure Firestore rules

Go to:

`Firestore Database → Rules`

Paste the rules from `firestore.rules` and publish them.

These rules allow each signed-in user to access only their own app data at:

`users/{uid}/app/state`

## 2. Run locally for a quick check

You can still open `index.html`, but Firebase Auth works best after hosting.

For local testing, you may run a local server from this folder:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## 3. Deploy to Firebase Hosting

Install Node.js first if it is not installed.

Then run:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

This folder already includes `firebase.json`, so you do not need to run `firebase init` again.

After deployment, Firebase will give a URL like:

`https://track2crack-5f1cf.web.app`

Use the same URL on your phone, office PC and home PC.

## 4. First-use workflow

On the first device:

1. Open the app.
2. Go to Settings.
3. Create an account using email/password.
4. Add lectures/settings/planner data.
5. Click **Save Local DB to Cloud**.
6. Turn on **Auto-sync local changes after sign-in**.

On another device:

1. Open the same hosted URL.
2. Go to Settings.
3. Sign in using the same email/password.
4. Click **Load Cloud DB on This Device**.
5. Turn on auto-sync.

## 5. Current limitation

v1.8 syncs structured app data: lectures, planner, current affairs, revisions, XP, settings and analytics.

Large PDFs, screenshots and image files are not uploaded to Firebase in this version because Firebase Storage is not enabled. The app stores file names and upload status, but actual files remain local until a storage layer is added later.
