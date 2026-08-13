import { request } from '@/lib/api/client';

/**
 * Support: the dealer talking to Zinevu.
 *
 * Note what it is NOT — the live chat is the dealer talking to their own
 * customers. Two different conversations with two different other sides, which
 * is why they are two screens rather than one inbox with a filter.
 *
 * No permission gates these: asking for help is not a capability, and every
 * active member may open and read their organisation's tickets.
 */

export type TicketStatus = 'open' | 'answered' | 'resolved' | 'closed';

export type TicketCategory =
  | 'technical'
  | 'billing'
  | 'feature_request'
  | 'feedback'
  | 'account'
  | 'other';

export const TICKET_CATEGORIES: TicketCategory[] = [
  'technical',
  'billing',
  'feature_request',
  'feedback',
  'account',
  'other',
];

export type Ticket = {
  id: number;
  referenceNo: string | null;
  subject: string;
  category: TicketCategory | null;
  status: TicketStatus;
  lastMessageAt: string | null;
  /** 'admin' means Zinevu spoke last — i.e. there is an answer to read. */
  lastMessageAuthor: string | null;
  /** True when Zinevu's answer is newer than the last time we looked. */
  unread: boolean;
  createdAt: string | null;
};

export type TicketMessage = {
  id: number;
  authorType: 'dealer' | 'admin';
  authorName: string | null;
  body: string | null;
  attachments: { id: string; fileName: string | null; url: string }[];
  createdAt: string | null;
};

type RawTicket = {
  id?: number;
  reference_no?: string | null;
  subject?: string;
  category?: string | null;
  status?: string;
  last_message_at?: string | null;
  last_message_author?: string | null;
  dealer_last_seen_at?: string | null;
  created_at?: string | null;
};

const STATUSES: TicketStatus[] = ['open', 'answered', 'resolved', 'closed'];

function mapTicket(raw: RawTicket): Ticket {
  // "Unread" is derived, not stored: Zinevu spoke last AND we have not looked
  // since. Both halves matter — an answer we already read is not news.
  const answered = raw.last_message_author === 'admin';
  const seen = raw.dealer_last_seen_at;
  const at = raw.last_message_at;
  const unread = answered && (!seen || (at !== null && at !== undefined && seen < at));

  return {
    id: Number(raw.id ?? 0),
    referenceNo: raw.reference_no ?? null,
    subject: raw.subject ?? '',
    category: (raw.category as TicketCategory) ?? null,
    status: STATUSES.includes(raw.status as TicketStatus)
      ? (raw.status as TicketStatus)
      : 'open',
    lastMessageAt: at ?? null,
    lastMessageAuthor: raw.last_message_author ?? null,
    unread,
    createdAt: raw.created_at ?? null,
  };
}

export async function fetchTickets(): Promise<Ticket[]> {
  const d = await request<{ tickets?: RawTicket[] }>('/portal/dealer/support/tickets', {
    params: { per_page: 50 },
  });

  return (d.tickets ?? []).map(mapTicket).filter((ticket) => ticket.id !== 0);
}

type RawMessage = {
  id?: number;
  author_type?: string;
  author_name?: string | null;
  body?: string | null;
  is_internal?: boolean;
  attachments?: { id?: number | string; file_name?: string | null; url?: string }[];
  created_at?: string | null;
};

export async function fetchTicket(
  id: number
): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  const d = await request<RawTicket & { messages?: RawMessage[] }>(
    `/portal/dealer/support/tickets/${id}`
  );

  return {
    ticket: mapTicket(d),
    messages: (d.messages ?? [])
      // Internal notes are Zinevu staff talking among themselves. The API
      // should never send them here, but a client that renders whatever it is
      // given would leak them the day it does.
      .filter((m) => !m.is_internal)
      .map((m) => ({
        id: Number(m.id ?? 0),
        authorType: m.author_type === 'admin' ? 'admin' : 'dealer',
        authorName: m.author_name ?? null,
        body: m.body ?? null,
        attachments: (m.attachments ?? [])
          .map((a) => ({
            id: String(a.id ?? ''),
            fileName: a.file_name ?? null,
            url: String(a.url ?? ''),
          }))
          .filter((a) => a.url !== ''),
        createdAt: m.created_at ?? null,
      })),
  };
}

export async function createTicket(input: {
  subject: string;
  category: TicketCategory;
  message: string;
}): Promise<number> {
  const d = await request<{ id?: number }>('/portal/dealer/support/tickets', {
    method: 'POST',
    body: {
      subject: input.subject,
      category: input.category,
      message: input.message,
    },
  });

  return Number(d.id ?? 0);
}

export async function replyToTicket(id: number, body: string): Promise<void> {
  await request(`/portal/dealer/support/tickets/${id}/messages`, {
    method: 'POST',
    body: { body },
  });
}

/** How many answers are waiting — drives the badge in Settings. */
export async function fetchSupportUnread(): Promise<number> {
  const d = await request<{ unread_count?: number }>('/portal/dealer/support/tickets/meta');

  return Number(d.unread_count ?? 0);
}
