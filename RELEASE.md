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

Live on Apple in English and Dutch since 1.1.0, and section 7 is how they are
edited now. Both stores need an icon (generated — `assets/images/icon.png`),
screenshots, a description, and a privacy policy URL. The app links to
`https://zinevu.com/{locale}/mobile-app-privacy` from the login screen; that page
has to exist and be reachable before review, or the submission is rejected. Only
nl/de/fr/en are published there — the login screen sends Turkish to the English
page on purpose, so do not "fix" that into a 404.

Apple additionally requires an account they can sign in with — sign-up is closed
in the app, so without one a reviewer cannot get past the login screen at all.
That account exists:

```
demo@zinevu.com / DemoVeranda2026!
```

It is the "DEMO Veranda" dealer (account 27) on `api.zinevu.com`: 36 deals across
the board's four columns, three website chat threads, 25 WhatsApp/mail
conversations, a four-person team and an answered support ticket.

`ZinevuDemoSeeder` in the API repo keeps it current, and **it has to be run again
before every submission**:

```bash
ssh root@91.99.181.231 "cd /var/www/api.zinevu.com/public && \
  php artisan db:seed --class=ZinevuDemoSeeder --force"
```

Everything it touches is dated relative to `now()`, so what it tops up is exactly
what goes stale between one release and the next: six weeks of planned visits
(+40 days, far enough to put dots in the following month), five existing wins
walked into the dashboard's 30-day window, and the support thread. It changes
dates, never amounts — the revenue a reviewer sees is revenue this tenant
already had. Keyed throughout, so running it twice books nothing twice.

Skip it and the app does not break, it empties: a Planning tab with no visits, a
dashboard reading "0 won · €0" under a board holding thirteen approved deals.
That is the 2.1 this seeder exists to stop.

Those credentials are already in `store.config.json` (`apple.review`), which is
what puts them in App Review notes on Apple's side. Say there as well that
accounts are provisioned by the dealer's own firm — Apple occasionally reads a
closed B2B sign-in as grounds to push an app to custom distribution under 4.2.3,
and the sentence usually settles it.

Tell them to sign in with the **password**, not the Apple or Google buttons: a
reviewer's own Apple ID is an identity we have never seen, and with sign-up
closed the backend correctly turns it away.

## 7. The store listing itself

`store.config.json` holds everything App Store Connect will take over an API —
titles, descriptions, keywords, release notes, the review notes with the demo
account, and the App Clip experience. It is pulled from the live listing, so it
is never written from scratch:

```bash
npx eas metadata:pull --profile production   # live listing -> store.config.json
# edit store.config.json
npx eas metadata:lint --profile production   # catches a length or shape error
npx eas metadata:push --profile production   # back to App Store Connect
```

Bump `apple.version` to the version being shipped before pushing, or the notes
land on the previous version record. Screenshots point at `store/appstore/`,
which is what `scripts/gen-store-screenshots.mjs` writes — a pull would
otherwise drop Apple's own re-encoded copies beside them as a second set.

### App Privacy — the one part no API will fill

The data-collection questionnaire lives only in the App Store Connect web UI
(App Store Connect → the app → App Privacy → Edit). It has to agree with
`ios.privacyManifests` in `app.json`, and Apple does compare them.

Answer "Yes" to data collection, then declare exactly these seven, and nothing
else:

| App Privacy category | Data type           | Linked to user | Tracking | Purpose          |
| -------------------- | ------------------- | -------------- | -------- | ---------------- |
| Contact Info         | Name                | Yes            | No       | App Functionality |
| Contact Info         | Email Address       | Yes            | No       | App Functionality |
| Contact Info         | Phone Number        | Yes            | No       | App Functionality |
| Contact Info         | Physical Address    | Yes            | No       | App Functionality |
| User Content         | Photos or Videos    | Yes            | No       | App Functionality |
| User Content         | Other User Content  | Yes            | No       | App Functionality |
| Identifiers          | Device ID           | Yes            | No       | App Functionality |

Nothing else is collected and the list is short for a reason worth knowing: the
app carries no analytics, crash or attribution SDK at all, and asks for no
location. "Other User Content" is the messages and notes a dealer writes;
"Device ID" is the Expo push token. Tracking is No everywhere, which is what
lets `NSPrivacyTracking: false` stand and is why the app needs no App Tracking
Transparency prompt.

Two neighbouring answers that are deliberate, not oversights:

- **Age rating → "Messaging and Chat": No.** The Messages tab is a dealer
  talking to their own customers, who are not users of this app. There is no
  user-to-user channel, no discovery and nothing public, which is the same
  reading every other CRM with a customer inbox is rated on. Revisit it the day
  two Zinevu users can message each other.
- **"User Generated Content": No**, for the same reason — nothing a dealer or a
  customer writes is published to anyone else.

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
