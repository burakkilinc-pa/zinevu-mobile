# Zinevu mobile

The Zinevu dealer app (Expo / React Native), talking straight to the Laravel API
in `api.veranduo` — no Next BFF hop, a Sanctum bearer token from
`POST /v1/portal/auth/login`.

## Three layers

Everyone who signs in is a `PortalUser`. Two independent axes decide the
surface, and conflating them is the classic bug (see `src/lib/auth/roles.ts`):

| Layer | Who | How it's resolved |
| --- | --- | --- |
| **Platform admin** | Zinevu staff | `is_platform_admin` — set by hand in the DB |
| **Dealer** | the tenant's office (e.g. Valk Veranda) | `role: 'dealer'` |
| **Installer** | the montage crew | `role: 'assembler'`, **or** a dealer seat with `member_role: 'montage'` |

Neither axis authorizes anything. `permissions` (from
`App\Support\PortalPermissions`) is the gate, and every write is re-checked
server-side by the `portal_can` middleware whatever this client believes.

## Getting started

```bash
npm install
npm start          # Metro; needs a dev client, not Expo Go (native modules)
npm run typecheck
node scripts/gen-i18n.mjs   # after editing src/lib/i18n/catalog/*.json
```

`EXPO_PUBLIC_API_URL` points Metro at an API (defaults to
`http://127.0.0.1:8001/api/v1`). An emulator can't reach the host's loopback —
use `10.0.2.2` on Android, or your LAN IP on a real phone. The EAS build
profiles in `eas.json` bake in the production host.

## Language

Five locales — nl, en, de, fr, tr — matching what the portal itself ships
(`api.veranduo/lang`, `app.veranduo/messages`). The JSON files in
`src/lib/i18n/catalog/` are the source of truth; `scripts/gen-i18n.mjs`
generates the typed catalogs, and English is canonical, so a key missing from
any language is a compile error.

## Brand

Tokens mirror the dealer portal: ink `#082D36`, lime `#E7FFA4`, cloud `#F6F7F9`,
Sora as the only typeface. `global.css`, `tailwind.config.js` and
`src/lib/theme.ts` hold the same palette three ways (CSS vars, Tailwind classes,
raw hex for props that only take a colour) — change all three together.
`scripts/make-brand-assets.sh` regenerates every launcher/splash bitmap from
`assets/brand/primary-icon.svg`.

## Build phases

- [x] **0 — Shell.** Brand, theme, i18n, API client on Zinevu's `{ meta, data }`
      envelope, portal auth, role resolution, the role-aware tab dock.
- [x] **1 — Backend push.** Expo device tokens, a send path that fans out to
      browser *and* phone, and the events wired to it.
- [x] **2 — Dashboard.** Leads today, offers sent, action required, visitors,
      and who is on the site right now.
- [x] **3 — Leads.** Status filter tabs, cards carrying a render of what the
      customer configured, detail, and a new lead through the real configurator.
- [x] **4 — Planning.** Month grid over the day's agenda, on the unified
      follow-up record (field visits + reminders).
- [x] **5 — Live chat.** Grouped per person rather than per thread, with their
      offers and their other conversations above the messages.
- [x] **6 — Support + Settings.** Tickets with Zinevu; language, appearance,
      Face ID, password, profile photo.
- [x] **7 — Push wiring.** Every notification carries a payload the app can
      route on, and a body that respects who may read a customer's name.

**Shipping** needs an Expo/Apple/Google account — see [RELEASE.md](RELEASE.md).
The one thing that blocks push entirely is `eas init`, which has never been run.

## Not built, on purpose

- **Montage job planning.** Production jobs sit on their own slot grid, which is
  a desk tool. Planning covers the visits somebody drives to.
- **Editing an offer.** The lead detail is for deciding whether to call, and
  then calling. The offer editor stays where there is a keyboard.
- **Attachments in chat.** Reading them works; sending one does not yet.
