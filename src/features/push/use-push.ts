import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/store';
import { registerDevice, unregisterDevice } from '@/features/push/push.api';
import { notifications } from '@/features/push/notifications';
import { toast } from '@/components/ui/toast';

const DEVICE_ID_KEY = 'zinevu.push.device-id';

/** Conversation the user is currently looking at — its pushes stay silent. */
let activeConversationId: string | null = null;
export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

/**
 * The payload the backend attaches to every push. `type` names what happened
 * and the id fields say what to open; a push carries whichever ids its type
 * needs. Keep in step with the notification classes on the API side.
 */
type PushData = {
  type?:
    | 'lead.new'
    | 'lead.approved'
    | 'chat.message'
    | 'chat.opened'
    | 'planning.changed'
    | 'support.reply';
  /** Chat conversation uuid. */
  conversation_id?: string;
  /**
   * The lead's unified routing key — "m{id}" for a Meta request, "d{id}" for
   * an offer. NOT the raw deal id: the leads screen resolves the two through
   * different endpoints, so the wrong one opens a screen that fails to load.
   */
  lead_ref?: string;
  /** Y-m-d — opens Planning on that day. */
  date?: string;
  /** Support ticket id. */
  ticket_id?: string;
};

/**
 * Registers this device for push and routes taps.
 *
 * Mounted once in the authenticated shell. Everything is best-effort: no
 * permission, no native module, or no EAS project id all end in a quiet
 * return — the app must never fail to start because push isn't set up.
 */
export function usePush(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const registeredFor = useRef<string | null>(null);
  const inFlight = useRef(false);

  // --- Registration -------------------------------------------------------
  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;

    const uid = userId;

    // Surface WHY registration failed. In dev the reason pops on-screen (no
    // hunting Metro logs); in prod it's a quiet console line. The marker ref is
    // NOT set on failure, so the next trigger (re-focus, relaunch) retries —
    // the old code set it up front and never retried a transient failure.
    const fail = (reason: string, err?: unknown) => {
      console.warn('[push]', reason, err ?? '');
      if (__DEV__) toast.error(`Push off: ${reason}`);
    };

    async function register(): Promise<void> {
      if (registeredFor.current === uid || inFlight.current) return;
      inFlight.current = true;
      try {
        const api = notifications();
        if (!api) return fail('native module missing (rebuild the app)');
        if (!Device.isDevice) return fail('simulator — push needs a real device');

        if (Platform.OS === 'android') {
          await api.setNotificationChannelAsync('default', {
            name: 'Zinevu',
            importance: api.AndroidImportance.DEFAULT,
            // Brand chime — bundled via the expo-notifications `sounds` plugin.
            sound: 'zinevu.wav',
          });
        }

        const existing = await api.getPermissionsAsync();
        const granted =
          existing.granted || (await api.requestPermissionsAsync()).granted;
        if (!granted) return fail('notifications not allowed (enable in Settings)');

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        if (!projectId) return fail('no EAS projectId');

        // Do NOT force the APNs environment from __DEV__. __DEV__ reflects the
        // JS bundle (Metro = true), NOT the native `aps-environment` entitlement
        // the build was signed with. When the two disagree — a Metro session on
        // a production-signed build — forcing `development: true` mints a
        // sandbox token that APNs rejects on the production gateway with
        // `BadDeviceToken`, and no push ever arrives. Omitting `development`
        // lets expo-notifications read the real entitlement (the native truth),
        // so the token matches the gateway for dev, TestFlight and prod alike.
        const { data: token } = await api.getExpoPushTokenAsync({ projectId });
        const device = await registerDevice({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          appVersion: Constants.expoConfig?.version ?? null,
          deviceName: Device.deviceName ?? null,
        });
        await AsyncStorage.setItem(DEVICE_ID_KEY, device.id);
        registeredFor.current = uid; // success — stop retrying
        console.log('[push] device registered', device.id, token);
        if (__DEV__) toast.success('Push registered ✓');
      } catch (err) {
        fail('registration failed', err);
      } finally {
        inFlight.current = false;
      }
    }

    void register();

    // Retry when the app returns to the foreground — covers the common case
    // where the user grants the permission in Settings and comes back, or a
    // transient token/network error cleared. No-op once registered.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void register();
    });
    return () => sub.remove();
  }, [status, userId]);

  // Forget the registration marker on sign-out so the next user re-registers.
  useEffect(() => {
    if (status === 'unauthenticated') registeredFor.current = null;
  }, [status]);

  // --- Foreground behaviour + taps ---------------------------------------
  useEffect(() => {
    const api = notifications();
    if (!api) return;

    api.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = (notification.request.content.data ?? {}) as PushData;
        // The thread on screen already shows the message in realtime; a
        // banner over it would be noise.
        const silent =
          !!data.conversation_id &&
          data.conversation_id === activeConversationId;

        return {
          shouldShowBanner: !silent,
          shouldShowList: true,
          shouldPlaySound: !silent,
          shouldSetBadge: true,
        };
      },
    });

    function open(data: PushData) {
      // Anything push-worthy changed data behind the screen we're about to
      // land on, so drop the whole cache rather than guessing which key.
      void queryClient.invalidateQueries();

      if (data.conversation_id) {
        router.push(`/chat/${data.conversation_id}`);
        return;
      }
      if (data.lead_ref) {
        router.push(`/leads/${data.lead_ref}`);
        return;
      }
      if (data.ticket_id) {
        router.push(`/settings/support/${data.ticket_id}`);
        return;
      }
      if (data.date) {
        router.push(`/planning?date=${data.date}`);
        return;
      }
      // A push whose type we understand but whose target we don't still lands
      // somewhere sensible rather than nowhere at all.
      if (data.type === 'planning.changed') {
        router.push('/planning');
      }
    }

    function handleResponse(response: {
      notification: { request: { content: { data?: unknown } } };
    }) {
      open((response.notification.request.content.data ?? {}) as PushData);
    }

    const subscription = api.addNotificationResponseReceivedListener(
      (response) => handleResponse(response as Parameters<typeof handleResponse>[0])
    );

    // Cold start: the app was launched by tapping a notification (or its reply).
    void api
      .getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleResponse(response as Parameters<typeof handleResponse>[0]);
        }
      })
      .catch(() => {});

    return () => subscription.remove();
  }, [router, queryClient]);
}

/**
 * Revokes this device server-side. Called on sign-out so a shared phone stops
 * receiving the previous user's messages.
 */
export async function revokePushDevice(): Promise<void> {
  try {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) return;
    await unregisterDevice(deviceId);
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    // Sign-out must not fail because the device couldn't be revoked.
  }
}

/**
 * Drops this phone's device id without calling the server. For account
 * deletion, where the row is already gone with everything else and the token
 * that would authorize the call has been destroyed — but the local id must
 * still go, or the next sign-in would re-register against a device that no
 * longer exists.
 */
export async function forgetPushDevice(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    // Nothing to do — a stale id is re-created on the next registration.
  }
}
