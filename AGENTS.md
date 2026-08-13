# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Zinevu API

This app talks to `api.veranduo` (Laravel). Its response envelope is
`{ meta, data }` — NOT the `{ success, error }` shape other Laravel apps use.
See `src/lib/api/client.ts`. Sign-in is `POST /v1/portal/auth/login` (the
PortalUser identity); the `/v1/auth` routes belong to the old back-office `User`
and issue a token with no portal ability.

# i18n

Five locales (nl, en, de, fr, tr). Edit `src/lib/i18n/catalog/*.json`, then run
`node scripts/gen-i18n.mjs`. Never edit `src/lib/i18n/messages/*.ts` by hand.
