import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchConversation,
  fetchInbox,
  fetchUnlinked,
  markConversationRead,
  sendWhatsapp,
  type InboxFilter,
} from '@/features/inbox/api/inbox.api';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';

export const inboxKeys = {
  list: (filter: InboxFilter) => ['inbox', 'list', filter] as const,
  unlinked: () => ['inbox', 'unlinked'] as const,
  conversation: (ref: string) => ['inbox', 'conversation', ref] as const,
};

/**
 * There is no websocket on a lead's conversation — WhatsApp arrives by
 * webhook and mail by an IMAP poll, so the freshest the server itself can be
 * is already a poll behind. A push wakes a backgrounded phone; these numbers
 * only have to cover a screen somebody is looking at.
 */
const POLL = { list: 30_000, thread: 10_000 } as const;

export function useInbox(filter: InboxFilter) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: inboxKeys.list(filter),
    queryFn: () => fetchInbox(filter),
    enabled: hasPermission(user, PERMISSIONS.leadsView),
    refetchInterval: POLL.list,
    staleTime: 10_000,
  });
}

/** WhatsApp threads from numbers that are on no lead yet. */
export function useUnlinked() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: inboxKeys.unlinked(),
    queryFn: fetchUnlinked,
    enabled: hasPermission(user, PERMISSIONS.leadsView),
    refetchInterval: POLL.list,
    staleTime: 10_000,
  });
}

export function useConversation(ref: string) {
  return useQuery({
    queryKey: inboxKeys.conversation(ref),
    queryFn: () => fetchConversation(ref),
    enabled: ref !== '',
    refetchInterval: POLL.thread,
  });
}

/**
 * Send, then refetch rather than write an optimistic bubble.
 *
 * A live chat message is ours the moment we accept it. A WhatsApp message is
 * not: the server may still refuse it (a shut window, a paused number, a
 * refused template), and an optimistic bubble for a message Meta never took
 * is the one lie a dealer cannot afford here — they would walk away believing
 * the customer had been answered.
 */
export function useSendWhatsapp(ref: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => sendWhatsapp(ref, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.conversation(ref) });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'list'] });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ref: string) => markConversationRead(ref),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'list'] });
    },
  });
}
