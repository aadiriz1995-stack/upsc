# Firebase Spark Deploy Fix

Firebase Spark blocks executable files during Hosting deployment. This clean package removes the local-server launcher files:

- start-local-server.bat
- start-local-server.command

Deploy from inside this folder:

```bash
firebase deploy --only hosting
```

Do not deploy from a folder that contains .bat, .command, .exe, .dll, .sh, .cmd, .msi, .apk, or other executable files.
