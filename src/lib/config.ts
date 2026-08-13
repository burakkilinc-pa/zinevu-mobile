/**
 * Runtime configuration. Values come from EXPO_PUBLIC_* env vars (baked at
 * build time by Expo) so they can differ per environment without code changes.
 *
 * API_BASE_URL must point at the Laravel v1 API. Unlike the web frontend, the
 * mobile app talks to Laravel DIRECTLY (no Next BFF hop) using a Sanctum bearer
 * token — see src/lib/api/client.ts.
 *
 * Local dev note: a simulator/emulator cannot reach the host's "127.0.0.1".
 *   - iOS simulator: http://127.0.0.1:8001/api/v1 works.
 *   - Android emulator: use http://10.0.2.2:8001/api/v1.
 *   - Physical device: use your machine's LAN IP, e.g. http://192.168.x.x:8001/api/v1.
 */
export const config = {
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ??
    'http://127.0.0.1:8001/api/v1',
  // Reverb (websocket) — used by the messaging realtime layer in a later phase.
  reverb: {
    key: process.env.EXPO_PUBLIC_REVERB_KEY ?? '',
    host: process.env.EXPO_PUBLIC_REVERB_HOST ?? '127.0.0.1',
    port: Number(process.env.EXPO_PUBLIC_REVERB_PORT ?? 8080),
    scheme: process.env.EXPO_PUBLIC_REVERB_SCHEME ?? 'http',
  },
  // Fallback UI language. The live value comes from the locale store
  // (src/lib/i18n) — which follows the device language — and is sent to the
  // backend via Accept-Language. This constant is only the last-resort default.
  defaultLocale: 'en',
} as const;
