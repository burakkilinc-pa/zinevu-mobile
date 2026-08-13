# Shipping the app

Everything in the codebase is done. What is left needs an Apple/Google/Expo
account, so it has to be run by a person who is signed into those.

## 1. Claim an EAS project — do this first

```bash
npx eas login
npx eas init          # writes extra.eas.projectId into app.json
```

**Push does not work until this exists.** `getExpoPushTokenAsync` needs the
project id to mint a token, so without it every device registration ends in the
quiet "no EAS projectId" branch (visible as a toast in a dev build). Everything
else — the screens, the API, the notification payloads — works regardless, which
is exactly why this is easy to forget until nobody's phone has ever rung.

Commit the `app.json` change afterwards; the id is not a secret.

## 2. Credentials

```bash
npx eas credentials      # iOS: push key + distribution cert; Android: FCM v1
```

Expo talks to APNs and FCM on our behalf (see `ExpoPushService` on the API), so
this is where the platform keys are uploaded. An iOS build with no push key
installs and runs fine and silently never receives a notification.

The bundle identifiers are already set: `com.zinevu.mobile` on both platforms.

## 3. Firebase, on Android only

Android push needs `google-services.json` from a Firebase project whose package
name is `com.zinevu.mobile`. Drop it in the repo root and add to `app.json`:

```json
"android": { "googleServicesFile": "./google-services.json" }
```

iOS needs no equivalent — the push key from step 2 is enough.

## 4. Build

```bash
npx eas build --profile preview --platform all       # internal testing (APK + ad-hoc)
npx eas build --profile production --platform all    # store builds
```

The API host is baked in per profile in `eas.json` — both profiles point at
`https://api.zinevu.com`. Change it there, not in the code: `src/lib/config.ts`
only holds the local-development fallback.

## 5. TestFlight

TestFlight distributes a **store** build, not the `preview` one — so use the
`production` profile even though nobody is going to the App Store yet.

```bash
# Create the app record first; without it there is no ascAppId to submit to.
npx eas build --profile production --platform ios
npx eas submit --profile production --platform ios --latest
```

`eas submit` fills in the three `REPLACE_WITH_…` values in `eas.json` the first
time it runs interactively — commit them afterwards, they are identifiers, not
secrets. The Apple ID is an e-mail; the team ID is the ten-character string in
the Apple Developer membership page; the ASC app id is the numeric one in the
App Store Connect URL.

Two things Apple stops the build on, both of which look like nothing until they
happen:

- **Export compliance.** Already answered — `usesNonExemptEncryption: false` in
  `app.json`. HTTPS alone is exempt, and the app uses nothing beyond it.
- **A build cannot be re-uploaded under a number that already exists.** The
  `production` profile has `autoIncrement` with `appVersionSource: "remote"`, so
  EAS keeps the counter — do not also bump `buildNumber` by hand or the two
  fight.

Internal testers (up to 100, your own team) get the build as soon as it finishes
processing, with no Apple review. **External** testers do need a review pass, and
that review needs the demo account from step 6.

## 6. Store listings

Not started. Both stores need an icon (already generated — `assets/images/icon.png`),
screenshots, a description, and a privacy policy URL. The app links to
`https://zinevu.com/{locale}/legal/privacy` from the login screen; that page has
to exist and be reachable before review, or the submission is rejected.

Apple additionally requires an account they can sign in with. A demo dealer with
a few leads, a planned visit and a chat thread makes the review go faster than
an empty tenant does.

## Before you build: a checklist that has caught things

- `npm run typecheck` — clean
- `npx expo export -p ios` — bundles without error
- Sign in on a real device (not the simulator: push needs hardware)
- Check a push actually arrives, and that TAPPING it lands on the right screen —
  the payload is all strings, so a wrong key delivers a perfect-looking banner
  that opens a screen which cannot load
- Switch the language and confirm nothing renders a raw key like
  `leads.answer.something`
- Turn on Face ID, force-quit, reopen — the lock must appear and must let you
  out via "sign out instead"
