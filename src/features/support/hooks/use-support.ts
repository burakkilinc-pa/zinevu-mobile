import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTicket,
  fetchSupportUnread,
  fetchTicket,
  fetchTickets,
  replyToTicket,
  type TicketCategory,
} from '@/features/support/api/support.api';

export const supportKeys = {
  tickets: ['support', 'tickets'] as const,
  ticket: (id: number) => ['support', 'ticket', id] as const,
  unread: ['support', 'unread'] as const,
};

export function useTickets() {
  return useQuery({
    queryKey: supportKeys.tickets,
    queryFn: fetchTickets,
    staleTime: 30_000,
  });
}

export function useTicket(id: number) {
  return useQuery({
    queryKey: supportKeys.ticket(id),
    queryFn: () => fetchTicket(id),
    enabled: id > 0,
    // Opening a ticket marks it seen server-side, so the list's unread flag is
    // stale the moment this resolves.
    refetchInterval: 30_000,
  });
}

/** The badge on the Support row in Settings. */
export function useSupportUnread() {
  return useQuery({
    queryKey: supportKeys.unread,
    queryFn: fetchSupportUnread,
    staleTime: 60_000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { subject: string; category: TicketCategory; message: string }) =>
      createTicket(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.tickets });
    },
  });
}

export function useReplyToTicket(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => replyToTicket(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.ticket(id) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.tickets });
      void queryClient.invalidateQueries({ queryKey: supportKeys.unread });
    },
  });
}
