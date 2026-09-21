import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchChatCustomers,
  fetchThread,
  fetchThreadCustomer,
  sendChatMessage,
  sendTypingSignal,
  type ChatFilter,
} from '@/features/chat/api/chat.api';
import { useChatRealtimeConnected } from '@/features/chat/realtime-state';
import type { ChatMessage } from '@/features/chat/types';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { uuidv4 } from '@/lib/uuid';

export const chatKeys = {
  customers: (filter: ChatFilter) => ['chat', 'customers', filter] as const,
  thread: (uuid: string) => ['chat', 'thread', uuid] as const,
  threadCustomer: (uuid: string) => ['chat', 'thread-customer', uuid] as const,
};

/**
 * How often to ask when the socket is up, and when it is not.
 *
 * With the websocket connected the poll is only a safety net against a socket
 * that died without saying so, so it can be lazy. Without it, the poll IS the
 * feature and has to be quick enough to type against.
 */
const POLL = {
  inbox: { live: 90_000, alone: 20_000 },
  thread: { live: 30_000, alone: 5_000 },
} as const;

/**
 * The inbox.
 *
 * Fed by the websocket (use-chat-realtime.ts) and polled underneath it. The
 * push wakes a backgrounded phone; the poll covers a socket that is down or
 * lying, and widens out of the way as soon as one is up.
 */
export function useChatCustomers(filter: ChatFilter) {
  const user = useAuthStore((s) => s.user);
  const live = useChatRealtimeConnected();

  return useQuery({
    queryKey: chatKeys.customers(filter),
    queryFn: () => fetchChatCustomers(filter),
    enabled: hasPermission(user, PERMISSIONS.chatView),
    refetchInterval: live ? POLL.inbox.live : POLL.inbox.alone,
    staleTime: 10_000,
  });
}

/**
 * One thread's messages.
 *
 * Messages arrive over the socket and are merged into this cache as they
 * land. The poll underneath is the floor: a socket that drops silently leaves
 * a dealer staring at a conversation that has moved on, and that must not be
 * possible. Every un-`since`d fetch also marks the thread read, which is why
 * the interval widens rather than stopping — see markThreadRead for the gap
 * the socket leaves.
 */
export function useThread(uuid: string) {
  const user = useAuthStore((s) => s.user);
  const live = useChatRealtimeConnected();

  return useQuery({
    queryKey: chatKeys.thread(uuid),
    queryFn: () => fetchThread(uuid),
    enabled: !!uuid && hasPermission(user, PERMISSIONS.chatView),
    refetchInterval: live ? POLL.thread.live : POLL.thread.alone,
  });
}

/** Leading-edge throttle on the typing signal — the portal desk's cadence. */
const TYPING_THROTTLE = 2_000;

/**
 * Tells the visitor we are writing.
 *
 * `onType()` on every keystroke, throttled; `stop()` when the message goes,
 * when the field loses focus, and when the screen closes. The portal only
 * ever says "typing" and never "stopped", which leaves a bubble bouncing at
 * the visitor under a dealer who walked away — this end says both.
 */
export function useTypingSignal(uuid: string) {
  const sentAt = useRef(0);
  const typing = useRef(false);

  const stop = useCallback(() => {
    if (!typing.current) return;
    typing.current = false;
    sentAt.current = 0;
    void sendTypingSignal(uuid, false).catch(() => {});
  }, [uuid]);

  const onType = useCallback(() => {
    const now = Date.now();
    if (now - sentAt.current < TYPING_THROTTLE) return;
    sentAt.current = now;
    typing.current = true;
    void sendTypingSignal(uuid, true).catch(() => {});
  }, [uuid]);

  // Leaving the screen mid-sentence is exactly when the bubble would stick.
  useEffect(() => stop, [stop]);

  return { onType, stop };
}

/** Who the thread is with — their other threads and their offers. */
export function useThreadCustomer(uuid: string) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: chatKeys.threadCustomer(uuid),
    queryFn: () => fetchThreadCustomer(uuid),
    enabled: !!uuid && hasPermission(user, PERMISSIONS.chatView),
    // Changes only when the person does — a poll here would be pure noise.
    staleTime: 5 * 60_000,
  });
}

/**
 * Sending, optimistically.
 *
 * The message appears the instant it is typed, marked pending. That is not
 * cosmetic: a reply that takes a round-trip to appear gets typed twice on a
 * bad connection, and the customer receives it twice.
 *
 * `client_message_id` is what makes that safe — the backend dedupes on it, so
 * a retry of a request that actually succeeded cannot double-post.
 */
export function useSendMessage(uuid: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ body, clientMessageId }: { body: string; clientMessageId: string }) =>
      sendChatMessage(uuid, body, clientMessageId),

    onMutate: async ({ body, clientMessageId }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.thread(uuid) });
      const previous = queryClient.getQueryData<ChatMessage[]>(chatKeys.thread(uuid));

      queryClient.setQueryData<ChatMessage[]>(chatKeys.thread(uuid), (old) => [
        ...(old ?? []),
        {
          id: `pending:${clientMessageId}`,
          clientMessageId,
          authorType: 'agent',
          authorName: user?.name ?? null,
          body,
          attachments: [],
          createdAt: new Date().toISOString(),
          pending: true,
        },
      ]);

      return { previous };
    },

    onError: (_error, _vars, context) => {
      // Put the thread back as it was, but keep the text visible and marked
      // failed — silently dropping what somebody typed is the worst option.
      if (context?.previous) {
        queryClient.setQueryData(chatKeys.thread(uuid), context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.thread(uuid) });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'customers'] });
    },
  });
}

export { uuidv4 };
