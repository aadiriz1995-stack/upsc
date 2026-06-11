Track2Crack Mission Control Release

Storage model:
- This build is a static browser app.
- All data is stored in localStorage under t2c_database_v5.
- Export Data creates a JSON backup.
- Import Data restores the exported JSON.

Implemented modules:
1. Mission Control Dashboard
2. Lectures Module with dynamic weighted progress
3. Intelligent Planner Engine with priority lecture selection
4. Current Affairs Management System
5. Revision Engine with spaced repetition
6. AI Mentor workspace and future AI placeholders
7. Analytics Dashboard
8. Gamification System
9. Settings Engine

AI Mentor limitation:
- The offline app stores PDFs, screenshots, notes, and articles.
- Pasted text can be summarized with a lightweight local heuristic.
- True PDF/image analysis, high-quality MCQ generation, and conversational AI require an API/backend integration later.

Future cloud storage:
- Google Drive/Firebase/Supabase can replace or extend js/storage.js.
- The rest of the app uses the same lecture/article/revision/planner data model.
