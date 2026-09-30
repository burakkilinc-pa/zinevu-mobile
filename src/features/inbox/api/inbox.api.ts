import { request } from '@/lib/api/client';
import type {
  AuthorKind,
  ConversationEntry,
  ConversationView,
  InboxRow,
  UnlinkedRow,
} from '@/features/inbox/types';

/**
 * The lead-conversation half of the Messages tab.
 *
 * Every endpoint here already existed for the portal; none of it was reachable
 * from a phone, which is why an inbound WhatsApp message could sit unanswered
 * all afternoon while its notification rang in a pocket.
 */

type RawRow = {
  ref?: string;
  kind?: string;
  lead_id?: number;
  deal_id?: number;
  customer_name?: string | null;
  offer_no?: string | null;
  unread_count?: number;
  awaiting_reply?: boolean;
  last_at?: string | null;
  last_channel?: string | null;
  last_subject?: string | null;
  last_preview?: string | null;
  agent_holds?: boolean;
};

function mapRow(raw: RawRow): InboxRow {
  return {
    ref: String(raw.ref ?? ''),
    kind: raw.kind === 'meta' ? 'meta' : 'manual',
    leadId: Number(raw.lead_id ?? 0),
    dealId: Number(raw.deal_id ?? 0),
    customerName: raw.customer_name ?? null,
    offerNo: raw.offer_no ?? null,
    unread: Number(raw.unread_count ?? 0),
    awaitingReply: !!raw.awaiting_reply,
    lastAt: raw.last_at ?? null,
    lastChannel: raw.last_channel ?? null,
    lastPreview: raw.last_preview ?? null,
    lastSubject: raw.last_subject ?? null,
    agentHolds: !!raw.agent_holds,
  };
}

export type InboxFilter = 'unanswered' | 'unread' | 'all';

export async function fetchInbox(filter: InboxFilter): Promise<InboxRow[]> {
  const d = await request<{ data?: RawRow[] }>('/portal/dealer/inbox', {
    params: { filter },
  });

  return (d.data ?? []).map(mapRow).filter((r) => r.ref !== '' && r.leadId > 0);
}

type RawUnlinked = {
  key?: number | null;
  name?: string | null;
  unread_count?: number;
  last_at?: string | null;
  last_preview?: string | null;
};

export async function fetchUnlinked(): Promise<UnlinkedRow[]> {
  const d = await request<{ data?: RawUnlinked[] }>('/portal/dealer/inbox/whatsapp/unlinked');

  return (d.data ?? [])
    .filter((raw) => raw.key != null)
    .map((raw) => ({
      messageId: Number(raw.key),
      fromName: raw.name ?? null,
      preview: raw.last_preview ?? null,
      lastAt: raw.last_at ?? null,
      unread: Number(raw.unread_count ?? 0),
    }));
}

type RawEntry = {
  id?: number;
  kind?: string;
  channel?: string | null;
  direction?: string | null;
  author_kind?: string | null;
  author_name?: string | null;
  subject?: string | null;
  body_text?: string | null;
  preview?: string | null;
  template_name?: string | null;
  attachments?: { name?: string | null; mime?: string | null; size?: number | null }[];
  opened_at?: string | null;
  occurred_at?: string | null;
  delivered_at?: string | null;
  read_receipt_at?: string | null;
  failure?: string | null;
};

const AUTHOR_KINDS: AuthorKind[] = ['customer', 'member', 'agent', 'system'];

function mapEntry(raw: RawEntry): ConversationEntry {
  const author = AUTHOR_KINDS.find((k) => k === raw.author_kind) ?? null;

  return {
    id: Number(raw.id ?? 0),
    kind: String(raw.kind ?? 'message'),
    channel: raw.channel ?? null,
    direction: raw.direction ?? null,
    authorKind: author,
    authorName: raw.author_name ?? null,
    subject: raw.subject ?? null,
    bodyText: raw.body_text ?? null,
    preview: raw.preview ?? null,
    templateName: raw.template_name ?? null,
    attachments: (raw.attachments ?? [])
      .filter((a) => !!a?.name)
      .map((a) => ({ name: String(a.name), mime: a.mime ?? null, size: a.size ?? null })),
    openedAt: raw.opened_at ?? null,
    occurredAt: raw.occurred_at ?? null,
    deliveredAt: raw.delivered_at ?? null,
    readReceiptAt: raw.read_receipt_at ?? null,
    failure: raw.failure ?? null,
  };
}

/**
 * `ref` is the route key the app carries everywhere ("m12"/"d34"); the
 * endpoint wants the bare id plus a `kind`, because meta-lead ids and deal ids
 * share one namespace on that route. Split here rather than at every call site.
 */
export function splitRef(ref: string): { id: number; kind: 'meta' | 'manual' } {
  const kind = ref.startsWith('m') ? 'meta' : 'manual';

  return { id: Number(ref.slice(1)) || 0, kind };
}

export async function fetchConversation(ref: string): Promise<ConversationView> {
  const { id, kind } = splitRef(ref);

  const d = await request<{
    data?: RawEntry[];
    unread?: number;
    whatsapp?: {
      connected?: boolean;
      to?: string | null;
      window_open?: boolean;
      window_expires_at?: string | null;
      opted_out?: boolean;
    };
    agent?: { holds?: boolean; status?: string | null; handover_reason?: string | null };
  }>(`/portal/dealer/leads/${id}/conversation`, { params: { kind } });

  return {
    // The endpoint returns newest first; a thread reads oldest first.
    entries: (d.data ?? []).map(mapEntry).reverse(),
    unread: Number(d.unread ?? 0),
    whatsapp: {
      connected: !!d.whatsapp?.connected,
      to: d.whatsapp?.to ?? null,
      windowOpen: !!d.whatsapp?.window_open,
      windowExpiresAt: d.whatsapp?.window_expires_at ?? null,
      optedOut: !!d.whatsapp?.opted_out,
    },
    agent: {
      holds: !!d.agent?.holds,
      status: d.agent?.status ?? null,
      handoverReason: d.agent?.handover_reason ?? null,
    },
  };
}

/**
 * Send on WhatsApp.
 *
 * Free text only from here. Outside Meta's 24-hour window the endpoint refuses
 * rather than silently reaching for a template: picking one is a decision with
 * the dealer's own money and their own approved list behind it, and a phone
 * screen mid-conversation is the wrong place to make it. The composer says so
 * and offers the phone's own WhatsApp instead.
 */
export async function sendWhatsapp(ref: string, body: string): Promise<void> {
  const { id, kind } = splitRef(ref);

  await request(`/portal/dealer/leads/${id}/conversation/whatsapp`, {
    method: 'POST',
    body: { body, kind },
  });
}

export async function markConversationRead(ref: string): Promise<void> {
  const { id, kind } = splitRef(ref);

  await request(`/portal/dealer/leads/${id}/conversation/read`, {
    method: 'POST',
    body: { kind },
  });
}
