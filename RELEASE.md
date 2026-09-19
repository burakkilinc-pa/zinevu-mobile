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
name is `com.zinevu.mobile`. **This is the one thing still missing.** Get it
from the Firebase console — add an Android app to the same Google Cloud project
that already holds our OAuth clients (project number `937185871682`, so the
sign-in and the push live together) — and drop it in the repo root.

Nothing else to wire: `app.config.js` picks the file up from there on its own,
and falls back to a `GOOGLE_SERVICES_JSON` file-type EAS variable if you would
rather not commit it. When neither exists the key is left off entirely, which is
why the app builds today and simply never rings on Android.

While you are in that console: Google sign-in on Android also needs an **Android
OAuth client** carrying the SHA-1 of the EAS upload key (`eas credentials` →
Android → keystore shows it). Without it the Google button opens and fails; iOS
is unaffected, since its client id is already in `eas.json`.

iOS needs no `google-services.json` equivalent — the push key from step 2 is enough.

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

Apple additionally requires an account they can sign in with — sign-up is closed
in the app, so without one a reviewer cannot get past the login screen at all.
That account exists:

```
demo@zinevu.com / DemoVeranda2026!
```

It is the "DEMO Veranda" dealer (account 27) on `api.zinevu.com`: 29 deals
across the board's four tabs, three chat threads, and a fortnight of planned
visits. `ZinevuDemoSeeder` in the API repo owns it — re-run it before submitting
if the agenda has aged out, since it books everything relative to `now()` and a
review six weeks after the build would otherwise open onto an empty Planning tab.

Put those credentials in App Review notes on both stores, and say there that
accounts are provisioned by the dealer's own firm — Apple occasionally reads a
closed B2B sign-in as grounds to push an app to custom distribution under 4.2.3,
and the sentence usually settles it.

Tell them to sign in with the **password**, not the Apple or Google buttons: a
reviewer's own Apple ID is an identity we have never seen, and with sign-up
closed the backend correctly turns it away.

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
