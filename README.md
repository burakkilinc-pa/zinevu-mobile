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
      envelope, portal auth, role resolution, the role-aware tab dock, and a
      placeholder screen per menu.
- [ ] **1 — Backend.** Expo device tokens + push service, customer-grouped chat,
      the dashboard counters the app needs.
- [ ] **2 — Dashboard.** Leads today, offers sent, action required, visitors,
      page views, recent visitors.
- [ ] **3 — Leads.** Status filter tabs, cards with the 3D preview, detail, and
      a new lead from the configurator.
- [ ] **4 — Planning.** A calendar at native Google/iOS quality.
- [ ] **5 — Live chat.** Per customer, with their offers above the thread.
- [ ] **6 — Support + Settings.** Language, appearance, Face ID, password,
      profile photo.
- [ ] **7 — Push + release.** Wire every notification, then EAS build.
