# Deploying to the real Firebase project

Development runs emulator-first against `demo-cal-caliente`. This is what has
to happen before and during the first deploy to the real `cal-caliente`
project. Nothing has been deployed yet.

The local dev loop cannot validate any of this: `make run-ios` passes
`USE_EMULATOR=true`, which selects `DemoFirebaseOptions` and never touches the
real project's keys, IAM, or rules. Every item below needs a device build
pointed at the live project to verify.

## Blocking: abuse controls

These two are the reason not to deploy yet. Auth is anonymous-only, so "signed
in" is not a meaningful barrier to anything.

**Enable App Check enforcement.** `ENFORCE_APP_CHECK` defaults to false
(`functions/src/constants.ts`), so the callables currently accept any caller
that can obtain an anonymous uid. Set `ENFORCE_APP_CHECK=true` in the functions
environment, register the apps for App Check in the Firebase console (Play
Integrity for Android, App Attest for iOS), and supply
`--dart-define=RECAPTCHA_SITE_KEY=...` if the web build ships. `main.dart`
skips web App Check when that define is empty.

**Add rate limiting to `submitEvent` and `registerSource`.** Neither has any.
`registerSource` accepts a URL that the daily `scrapeSources` job then fetches
server-side and feeds to Gemini, so unbounded registration is quota
amplification against a paid API key. A per-uid write throttle is the minimum.
API key restrictions do not help here: callables authenticate with a Firebase
ID token, not an API key.

## Verify Firebase init on the real project

Android disables the native Firebase auto-init provider
(`FirebaseInitProvider`, `tools:node="remove"` in
`android/app/src/main/AndroidManifest.xml`). Without that, `google-services.json`
pins the real project and the emulator build dies at startup with
`core/duplicate-app`, because `[DEFAULT]` cannot be re-initialized with
different options.

Consequence: Dart is now the only thing that initializes Firebase on Android.
`main.dart` passes explicit options on both paths, so the real-project path
should be unaffected, but **that path has only been reasoned about, not run.**
On the first real-project device build, confirm before anything else:

- the app reaches the UI rather than hanging on the splash
- the log line naming the project id is absent (it only prints for emulator runs)
- anonymous sign-in, a Firestore read, and one callable all succeed

If it hangs, the auto-init removal is the first thing to suspect. iOS is
unaffected: it has no equivalent provider.

## Auth

Confirm which sign-in providers are enabled, and disable Email/Password unless
it is genuinely used. The seeded admin credential is recoverable from this
repo's history, so an enabled Email/Password provider plus that account name is
a standing risk.

Grant the admin claim to a real account via the Admin SDK
(`setCustomUserClaims(uid, { admin: true })`). Do not recreate the seeded test
admin in the real project.

Google sign-in (and Apple, required for iOS release) is not wired up. The
OAuth client IDs already exist in the project, auto-created by Firebase.

## API key restrictions

Four keys live in the project. All four have API restrictions applied:

| Key | Application restriction | API restriction |
|-----|------------------------|-----------------|
| Browser (web) | none yet, needs a domain | 5 Firebase APIs |
| Android | **outstanding** | 5 Firebase APIs |
| iOS | **outstanding** | 5 Firebase APIs |
| Gemini | none, called from functions | Gemini API only |

The five allowed APIs are Identity Toolkit, Token Service, Cloud Firestore,
Firebase Installations, and Firebase App Check. Keep Token Service in the list:
without it, sign-in succeeds and then token refresh fails about an hour later,
which presents as random sign-outs.

The Gemini key is called from Cloud Functions, whose egress IPs are dynamic, so
it gets no application restriction. It is a service-account-bound key and its
value belongs only in the functions environment, never in the client.

Remaining work, deliberately deferred until there is something to restrict:

- **iOS key**: restrict to iOS apps, bundle id `com.calcaliente.calCaliente`.
- **Android key**: restrict to Android apps, package
  `com.calcaliente.cal_caliente`, with a SHA-1 for *every* signing key that
  will build the app. Debug and upload are not enough: the Play App Signing
  SHA-1 only exists after the first Play Console upload, and omitting it breaks
  authentication for every real user while working perfectly in development.
  Read a local fingerprint with:

  ```
  keytool -list -v -keystore ~/.android/debug.keystore \
    -alias androiddebugkey -storepass android -keypass android
  ```

- **Browser key**: restrict to Websites once a web domain exists. Include
  `localhost` if `flutter run -d chrome` is ever pointed at the real project.

Restrictions take up to five minutes to propagate.

## IAM

Target roles for whichever service account the functions run as, derived from
what the code actually calls:

- **Cloud Datastore User**, for all Firestore reads, writes, and transactions.
- **Firebase Authentication Admin**, for the single `getAuth().deleteUser` call
  in `adminDeleteUser`.
- **Logs Writer**, for `logger` output.

Nothing else. The functions touch no Storage, Pub/Sub, BigQuery, or Messaging.

`cal-caliente@appspot.gserviceaccount.com` already holds those three, plus
**Editor**, which is far broader than the above and should come off. Do that
after a successful deploy rather than before, so a build failure is not
confused with a permissions failure: deploy, confirm working, remove Editor,
redeploy, confirm still working.

Before narrowing, read which service account the deployed functions actually
run as. All five functions are 2nd gen (`firebase-functions/v2`), and 2nd gen
can default to the Compute Engine default service account rather than the App
Engine one. The deployed function's own configuration is the authority here.

Optionally, set `serviceAccount` in the function options to a purpose-built
account instead of depending on whatever the platform default is that year.
That puts the permission boundary in version control next to `firestore.rules`.

No service account should carry a user-managed JSON key. Deployed functions
authenticate through Application Default Credentials, which is why
`functions/src/index.ts` calls a bare `initializeApp()` with no arguments. A
downloaded JSON key bypasses every security rule and never expires, so there is
no situation in this project that justifies creating one.

## Firestore

```
firebase deploy --only firestore
```

`firestore.indexes.json` covers the two composite queries the app issues.
`firestore.rules` grants public read on `events` and `sources` by design: see
`SCHEMA.md` for the full contract and the reasoning.

## Verifying the deploy

Run a device build against the real project, not the emulator, then check:

- anonymous sign-in completes, and still works an hour later (token refresh,
  which is the Token Service API restriction above)
- `submitEvent` succeeds from the submit screen, and a duplicate is rejected
- the admin panel loads for an account holding the admin claim
- `scrapeSources` runs on schedule and writes `scrapeLogs`
- function logs appear in Cloud Logging
