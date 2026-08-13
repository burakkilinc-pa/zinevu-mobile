import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchChatCustomers,
  fetchThread,
  fetchThreadCustomer,
  sendChatMessage,
  type ChatFilter,
} from '@/features/chat/api/chat.api';
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
 * The inbox.
 *
 * Polled on an interval as well as pushed to. The push wakes a backgrounded
 * phone, but a phone sitting open on this screen would otherwise only learn
 * about a new visitor when the user pulled to refresh — and a live chat that is
 * a minute stale is not live.
 */
export function useChatCustomers(filter: ChatFilter) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: chatKeys.customers(filter),
    queryFn: () => fetchChatCustomers(filter),
    enabled: hasPermission(user, PERMISSIONS.chatView),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}

/**
 * One thread's messages.
 *
 * Polled every five seconds while it is on screen. Reverb is wired on this
 * backend and is the better answer, but a socket that drops silently leaves a
 * dealer staring at a conversation that has moved on — the poll is the floor
 * under that, and five seconds is close enough to live for typing speed.
 */
export function useThread(uuid: string) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: chatKeys.thread(uuid),
    queryFn: () => fetchThread(uuid),
    enabled: !!uuid && hasPermission(user, PERMISSIONS.chatView),
    refetchInterval: 5_000,
  });
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
