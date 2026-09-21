import Echo from 'laravel-echo';
import * as PusherModule from 'pusher-js/react-native';

import { config } from '@/lib/config';
import { getToken } from '@/lib/storage/secure-token';

/**
 * pusher-js's React Native build ends in `module.exports.Pusher = …` while its
 * own typings declare a default export. The two disagree, the runtime is the
 * one that has to be right, and importing the default gets you a plain object
 * that Echo then tries to call with `new` ("Object cannot be used as a
 * constructor" — silent, because a broken socket only shows up as a chat that
 * never updates).
 */
const Pusher = (PusherModule as unknown as { Pusher: typeof PusherModule.default }).Pusher;

/**
 * The app's one connection to Reverb (Laravel's websocket server).
 *
 * One socket for the whole session, opened after sign-in and closed on the way
 * out. Features subscribe to their own channels through `connectRealtime()`;
 * nothing here knows what a chat is.
 *
 * It is deliberately never load-bearing — the same rule the backend follows
 * (`ChatBroadcast::publish()` swallows publish failures). A socket that cannot
 * connect, a build with no key configured, a network that eats websockets:
 * all of them leave the feature polling instead of broken. That is what
 * `onRealtimeStatus` is for — the pollers tighten their interval when the
 * socket is down and relax it when it is up.
 */

export type RealtimeStatus = 'off' | 'connecting' | 'connected' | 'failed';

type Listener = (status: RealtimeStatus) => void;

let echo: Echo<'reverb'> | null = null;
let unbindStatus: (() => void) | null = null;
let status: RealtimeStatus = 'off';
const listeners = new Set<Listener>();

function publish(next: RealtimeStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener(status));
}

export function realtimeStatus(): RealtimeStatus {
  return status;
}

/** Subscribe to connection changes. Returns the unsubscribe. */
export function onRealtimeStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Laravel registers broadcasting auth beside the versioned API, not inside it
 * (bootstrap/app.php: prefix `api`, middleware `auth:sanctum`), so the /v1 of
 * our base URL comes off.
 */
function authEndpoint(): string {
  return `${config.apiBaseUrl.replace(/\/v\d+$/, '')}/broadcasting/auth`;
}

/**
 * Signs one channel subscription.
 *
 * Read through `getToken()` on every subscribe rather than baked into the
 * client at construction: a subscription can be signed long after the socket
 * opened — on a reconnect, or when a screen joins a new channel — and the
 * token stored then is the one that must be used.
 */
async function authorizeChannel(
  socketId: string,
  channelName: string
): Promise<{ auth: string; channel_data?: string }> {
  const token = await getToken();
  if (!token) throw new Error('no session token');

  const res = await fetch(authEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
  });

  if (!res.ok) throw new Error(`channel authorization failed (${res.status})`);

  return (await res.json()) as { auth: string; channel_data?: string };
}

/**
 * The live client, opening the socket on the first call.
 *
 * Returns null when there is nothing to connect to — no key in this build —
 * which callers read as "stay on polling", not as an error.
 */
export function connectRealtime(): Echo<'reverb'> | null {
  if (echo) return echo;
  if (!config.reverb.key) return null;

  const { key, host, port, scheme } = config.reverb;
  const tls = scheme === 'https';

  publish('connecting');

  try {
    echo = buildEcho(key, host, port, tls);
  } catch {
    // A client that cannot even be constructed is not worth a crash on a
    // screen that works without it.
    echo = null;
    publish('failed');
    return null;
  }

  unbindStatus = echo.connector.onConnectionChange((state) => {
    publish(
      state === 'connected'
        ? 'connected'
        : state === 'connecting'
          ? 'connecting'
          : state === 'failed'
            ? 'failed'
            : 'off'
    );
  });

  return echo;
}

function buildEcho(key: string, host: string, port: number, tls: boolean): Echo<'reverb'> {
  return new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: tls,
    // Only the websocket transports: the HTTP fallbacks are for browsers that
    // cannot hold a socket, and they would quietly turn this into long-polling
    // with none of the battery behaviour we expect. Derived from the scheme
    // exactly as the portal does it — a plain-http dev Reverb has no wss.
    enabledTransports: tls ? ['ws', 'wss'] : ['ws'],
    disableStats: true,
    // Echo otherwise goes looking for axios / jQuery / Vue / Turbo to decorate
    // with a socket id header. None of them exist here.
    withoutInterceptors: true,
    Pusher,
    channelAuthorization: {
      customHandler: (
        { socketId, channelName }: { socketId: string; channelName: string },
        callback: (error: Error | null, data: { auth: string; channel_data?: string } | null) => void
      ) => {
        authorizeChannel(socketId, channelName)
          .then((data) => callback(null, data))
          .catch((error: unknown) => {
            callback(error instanceof Error ? error : new Error(String(error)), null);
          });
      },
    },
  });
}

/**
 * Nudges a sleeping socket awake.
 *
 * A phone drops its connection constantly — it locks, it loses the cell, it
 * comes back on wifi — and pusher-js only retries on its own schedule. The
 * shell calls this whenever the app returns to the foreground, whenever the
 * network comes back, and on a slow timer behind both. No-op while the socket
 * is already up or on its way.
 */
export function reviveRealtime(): void {
  if (!echo) return;

  const state = echo.connector.pusher.connection.state;
  if (state === 'connected' || state === 'connecting') return;

  try {
    echo.connector.pusher.connect();
  } catch {
    // Best effort — the pollers are the floor under this.
  }
}

/** Closes the socket and forgets every channel — sign-out, or backgrounding. */
export function disconnectRealtime(): void {
  unbindStatus?.();
  unbindStatus = null;

  if (echo) {
    echo.leaveAllChannels();
    echo.disconnect();
    echo = null;
  }

  publish('off');
}
