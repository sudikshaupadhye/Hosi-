# Hoshi for Android: get your APK with no installs (GitHub builds it for free)

1. Make a free account at https://github.com and click New repository. Name it `hoshi`, then Create.
2. Unzip this folder. On the new repo page click "uploading an existing file" and drag EVERYTHING in, including the hidden `.github` folder.
   If `.github` did not upload (hidden folders are skipped on some computers): click Add file > Create new file, type the name
   `.github/workflows/build-apk.yml`, paste in the contents of that file from this folder, and Commit.
3. Open the Actions tab. The "Build Hoshi APK" job starts by itself (or click it, then Run workflow). It takes about 5 to 10 minutes.
4. When it shows a green tick, open the run, scroll to Artifacts, download **Hoshi-APK**, unzip it: inside is `app-debug.apk`.
5. Send `app-debug.apk` to anyone. On their Android phone they open it and allow "Install unknown apps" when asked.

If the job shows a red cross, open the failed step and copy the last lines of the log to me.

Notes
- This is a debug-signed APK: perfect for sharing with friends. Google Play needs a signed release build (a later step).
- Cloud sign-in works the same as the web app. If you left "Confirm email" on in Supabase, people must tap the email link on their phone's browser, then sign in inside the app.
