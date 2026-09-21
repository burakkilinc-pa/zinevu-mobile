import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';

import {
  connectRealtime,
  disconnectRealtime,
  onRealtimeStatus,
  realtimeStatus,
  reviveRealtime,
  type RealtimeStatus,
} from '@/lib/realtime/echo';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { chatKeys } from '@/features/chat/hooks/use-chat';
import { setRealtimeConnected, setVisitorTyping } from '@/features/chat/realtime-state';
import { mapMessage, type RawMessage } from '@/features/chat/api/chat.api';
import type { ChatMessage } from '@/features/chat/types';

/**
 * Live chat over the websocket.
 *
 * One subscription for the whole session — `private-chat.dealer.{id}`, the
 * channel the backend fans every one of this dealer's conversations out on
 * (routes/channels.php). The phone does not subscribe per thread: a dealer
 * with the app open needs to hear about the conversation they are NOT looking
 * at just as much as the one they are.
 *
 * The socket is an accelerator, never the source of truth. Polling stays on
 * underneath it (see use-chat.ts, which widens its interval while this is
 * connected), because a socket can die without saying so and a dealer staring
 * at a stale conversation is the failure everyone notices.
 */

/** Backstop for the wake-ups, in case neither AppState nor NetInfo fires. */
const REVIVE_EVERY = 30_000;

/**
 * Merges one message into a thread already on screen.
 *
 * `client_message_id` is the seam: our own optimistic bubble carries it, and
 * so does the copy the server broadcasts back, so the two collapse into one
 * instead of the reply appearing twice. Ported from the visitor widget, which
 * is the side of this that got it right.
 */
function mergeMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const index = list.findIndex(
    (message) =>
      (incoming.clientMessageId && message.clientMessageId === incoming.clientMessageId) ||
      message.id === incoming.id
  );

  if (index === -1) return [...list, incoming];

  const next = [...list];
  next[index] = { ...next[index], ...incoming, pending: false, failed: false };
  return next;
}

type MessagePayload = {
  conversation_id?: string;
  message?: RawMessage;
};

type ConversationPayload = {
  conversation_id?: string;
};

type TypingPayload = {
  conversation_id?: string;
  author?: string;
  typing?: boolean;
};

/**
 * Mounted once in the authenticated shell, beside push.
 *
 * Nothing else in the app subscribes to this channel — one subscriber means
 * leaving it on unmount cannot cut anybody else off, which is a live bug on
 * the portal where the shell and the desk share one channel.
 */
export function useChatRealtime(): void {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  // The dealer row behind the member — the channel is per company, and an
  // assembler has no chat inbox of their own to listen to.
  const dealerId = user?.portalType === 'dealer' ? (user.company?.id ?? null) : null;
  const allowed = hasPermission(user, PERMISSIONS.chatView);
  const live = status === 'authenticated' && allowed && !!dealerId;

  // Whether we have been connected once already. The first connection is not
  // a reconnection: only a RE-connection means something may have happened
  // while we were deaf, and only then is a full refetch worth its round-trip.
  const everConnected = useRef(false);

  // --- Connection state ---------------------------------------------------
  useEffect(() => {
    const apply = (next: RealtimeStatus) => {
      const connected = next === 'connected';
      setRealtimeConnected(connected);

      if (!connected) return;

      if (everConnected.current) {
        void queryClient.invalidateQueries({ queryKey: ['chat'] });
      }
      everConnected.current = true;
    };

    apply(realtimeStatus());
    return onRealtimeStatus(apply);
  }, [queryClient]);

  // --- The subscription ---------------------------------------------------
  useEffect(() => {
    if (!live || !dealerId) return;

    const echo = connectRealtime();
    if (!echo) return; // no key in this build — polling carries the feature

    const name = `chat.dealer.${dealerId}`;

    echo
      .private(name)
      .listen('.chat.message', (payload: MessagePayload) => {
        const uuid = payload.conversation_id;
        if (!uuid || !payload.message) return;

        const incoming = mapMessage(payload.message);

        // Patch the open thread in place — that is where the wait is felt.
        // A thread nobody has opened has no cache to patch and needs none.
        queryClient.setQueryData<ChatMessage[]>(chatKeys.thread(uuid), (old) =>
          old ? mergeMessage(old, incoming) : old
        );

        // The inbox is grouped by person, re-sorted and re-badged server-side;
        // rebuilding that here from one message is how the counts start
        // lying. One request per message is the cheaper mistake.
        void queryClient.invalidateQueries({ queryKey: ['chat', 'customers'] });

        // A message ends the typing bubble it was being typed into.
        setVisitorTyping(uuid, false);
      })
      .listen('.chat.conversation', (payload: ConversationPayload) => {
        // Claimed, closed, renamed, read by a colleague — all of it changes
        // the row, none of it is worth its own handler.
        void queryClient.invalidateQueries({ queryKey: ['chat', 'customers'] });
        if (payload.conversation_id) {
          void queryClient.invalidateQueries({
            queryKey: chatKeys.threadCustomer(payload.conversation_id),
          });
        }
      })
      .listen('.chat.typing', (payload: TypingPayload) => {
        // The agent side of this event goes to the visitor's own channel, so
        // anything arriving here is the visitor — but say so anyway, because
        // a colleague's typing is not something to attribute to a customer.
        if (!payload.conversation_id || payload.author !== 'visitor') return;
        setVisitorTyping(payload.conversation_id, !!payload.typing);
      });

    return () => {
      echo.leave(name);
    };
  }, [live, dealerId, queryClient]);

  // --- Waking the socket up ----------------------------------------------
  useEffect(() => {
    if (!live) return;

    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') reviveRealtime();
    });
    const net = NetInfo.addEventListener((state) => {
      if (state.isConnected !== false) reviveRealtime();
    });
    const timer = setInterval(reviveRealtime, REVIVE_EVERY);

    return () => {
      app.remove();
      net();
      clearInterval(timer);
    };
  }, [live]);

  // --- End of session -----------------------------------------------------
  // The shell unmounts only on sign-out, and the next person to sign in must
  // not inherit this one's socket.
  useEffect(() => disconnectRealtime, []);
}
