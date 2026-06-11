Track2Crack v1.7 data notes

The application uses browser localStorage as the instant working database.

v1.7 adds Google Drive database sync:
- Configure it in Settings > Google Drive Database.
- The Drive database is one JSON file, usually track2crack-database.json.
- Run the app through http://localhost:8080 for Google sign-in; opening index.html directly as file:// will not allow OAuth.
- See GOOGLE_DRIVE_SETUP.md for setup steps.

Manual JSON Export/Import remains available from the sidebar and Settings.
