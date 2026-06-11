# Track2Crack v1.7 — Google Drive Database Setup

v1.7 uses Google Drive as a cloud database by saving one JSON file named `track2crack-database.json` in your Drive folder.

The app still works instantly with browser localStorage. Google Drive sync adds backup and multi-device transfer, but it needs Google OAuth because a webpage cannot write to your Drive without permission.

## What you create manually

### 1. Google Drive folder
1. Open Google Drive.
2. Create a folder, for example: `Track2Crack Database`.
3. Open the folder.
4. Copy the folder ID from the URL.
   - In a URL like `https://drive.google.com/drive/folders/ABC123XYZ`, the folder ID is `ABC123XYZ`.

### 2. Google Cloud OAuth Client ID
1. Open Google Cloud Console.
2. Create or select a project.
3. Enable **Google Drive API**.
4. Configure the OAuth consent screen.
5. Create Credentials → OAuth Client ID → Web application.
6. Add these Authorized JavaScript origins:
   - `http://localhost:8080`
   - `http://127.0.0.1:8080`
7. Copy the OAuth Client ID.

## How to run the app

Google sign-in does not work from `file://` pages. Run the local server.

### Windows
Double-click:

`start-local-server.bat`

Then open:

`http://localhost:8080`

### Mac/Linux
Run:

`./start-local-server.command`

Then open:

`http://localhost:8080`

## Inside Track2Crack

1. Go to **Settings**.
2. Scroll to **Google Drive Database**.
3. Paste:
   - OAuth Client ID
   - Google Drive Folder ID
4. Click **Save Drive Settings**.
5. Click **Sign in to Google**.
6. Click **Create / Update Drive DB**.
7. Optional: enable **Auto-sync after changes once signed in**.

## Important notes

- The app uses Google Drive API scope: `drive.file`.
- It creates/updates only the app database file it owns.
- Local storage remains the working copy for speed.
- Use **Load DB from Drive** carefully because it replaces the current browser copy after preserving Drive settings.
