# Android release pipeline — setup

`.github/workflows/android-release.yml` builds a signed `.aab` on every push
to `main` and uploads it to the Play Console's **internal testing** track
automatically (safe — no Google review, only visible to testers you've
explicitly added). Uploading to `alpha`/`beta`/`production` is manual only:
Actions tab → **Android Release** → **Run workflow** → pick the track.

One-time setup, in order:

## 1. Generate the upload keystore

This is the key that signs every build this pipeline produces — **back it
up somewhere safe outside this repo** (a password manager, etc.). Losing it
means you can never publish an update under this app again; Play Store's
own "Play App Signing" re-signs your upload with Google's managed key
afterward, but Google still needs to verify each upload against *this* key
first.

```bash
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for a keystore password and a key password (can be the
same value) — remember both, they're needed below.

## 2. Base64-encode it for GitHub Secrets

```bash
base64 -w0 upload-keystore.jks > upload-keystore.b64   # Linux/macOS/WSL
# Windows PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks")) | Out-File upload-keystore.b64 -Encoding ascii
```

## 3. Set GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | contents of `upload-keystore.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password from step 1 |
| `ANDROID_KEY_ALIAS` | `upload` (or whatever `-alias` you used) |
| `ANDROID_KEY_PASSWORD` | the key password from step 1 |
| `PLAY_SERVICE_ACCOUNT_JSON` | see step 4 |
| `GOOGLE_SERVICES_JSON` | optional — see `supabase/PUSH_NOTIFICATIONS.md`; only needed for push notifications, the release build works fine without it |

## 4. Create a Play Console service account (lets CI publish on your behalf)

1. [Google Play Console](https://play.google.com/console) → **Setup → API access**.
2. If no Cloud project is linked yet, click **Choose a project** / **Create
   new project** and link it (it can be the same Firebase project from
   `supabase/PUSH_NOTIFICATIONS.md`, or a separate one — either works).
3. **Create new service account** — this hands off to Google Cloud Console;
   create it there (any name, e.g. "play-publisher"), no roles needed at
   the Cloud IAM level.
4. Back in Play Console's API access page, find that service account under
   **Service accounts**, click **Grant access**, and give it at least:
   **Release manager** access to this app (specifically the "Release to
   testing tracks" and "Release to production" permissions, under Releases).
5. In Google Cloud Console, open that service account → **Keys → Add key →
   JSON** → downloads a JSON file. Its *entire contents* (plain JSON, not
   base64) is the `PLAY_SERVICE_ACCOUNT_JSON` secret above.

## 5. One manual upload first (unavoidable Google API limitation)

The Play Developer API refuses to accept the **very first** release of an
app — every app needs at least one release created by hand through the Play
Console web UI before the API can take over. Since you said the app already
exists in Play Console, check whether it already has at least one release
(even a draft/internal one) under any track:

- **If yes** — nothing else to do, push to `main` and the workflow should
  upload successfully.
- **If no** — build one .aab locally once
  (`cd fables && npm run build && npx cap sync android && cd android &&
  ANDROID_KEYSTORE_PATH=... ANDROID_KEYSTORE_PASSWORD=... ANDROID_KEY_ALIAS=...
  ANDROID_KEY_PASSWORD=... ./gradlew bundleRelease`) and upload it by hand
  to the internal testing track once. Every push after that goes through
  the automated pipeline.

## Versioning

`versionCode` (Play Store's internal, ever-increasing build number) is set
automatically to the GitHub Actions run number — guaranteed to only ever go
up, so uploads can never collide or go backwards. `versionName` (the
human-readable "1.0.42" string users see) mirrors that unless you want to
hand-pick something more meaningful — see the workflow file's
`ANDROID_VERSION_NAME` line.
