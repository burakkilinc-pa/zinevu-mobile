import { request, uploadMultipart } from '@/lib/api/client';
import type {
  ChatAttachment,
  ChatConversationDetail,
  ChatCustomer,
  ChatMessage,
  ChatOffer,
  ChatQuickReply,
  ChatStatus,
  ChatThread,
  ChatThreadView,
} from '@/features/chat/types';
import type { CapturedFile } from '@/lib/media';

type RawThread = {
  uuid?: string;
  status?: string;
  surface?: string | null;
  preview?: string | null;
  last_message_at?: string | null;
  last_message_author?: string | null;
  unread?: number;
  awaiting_reply?: boolean;
  assigned_to?: string | null;
  present?: boolean;
  city?: string | null;
  country?: string | null;
  device_type?: string | null;
  locale?: string | null;
  current_url?: string | null;
  current_step_key?: string | null;
  first_seen_at?: string | null;
};

type RawOffer = {
  ref?: string;
  offer_no?: string | null;
  status?: string | null;
  total?: number | null;
  created_at?: string | null;
  offer_sent_at?: string | null;
  offer_signed_at?: string | null;
};

type RawCustomer = {
  key?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  conversations?: RawThread[];
  offers?: RawOffer[];
  unread?: number;
  awaiting_reply?: boolean;
  present?: boolean;
  last_message_at?: string | null;
};

function mapThread(raw: RawThread): ChatThread {
  return {
    uuid: String(raw.uuid ?? ''),
    status: (raw.status === 'closed' ? 'closed' : 'open') as ChatStatus,
    surface: raw.surface ?? null,
    preview: raw.preview ?? null,
    lastMessageAt: raw.last_message_at ?? null,
    lastMessageAuthor: raw.last_message_author ?? null,
    unread: Number(raw.unread ?? 0),
    awaitingReply: !!raw.awaiting_reply,
    assignedTo: raw.assigned_to ?? null,
    present: !!raw.present,
    city: raw.city ?? null,
    country: raw.country ?? null,
    deviceType: raw.device_type ?? null,
    locale: raw.locale ?? null,
    currentUrl: raw.current_url ?? null,
    currentStepKey: raw.current_step_key ?? null,
    firstSeenAt: raw.first_seen_at ?? null,
  };
}

function mapOffer(raw: RawOffer): ChatOffer {
  return {
    ref: String(raw.ref ?? ''),
    offerNo: raw.offer_no ?? null,
    status: raw.status ?? null,
    // Null and zero mean different things: null is "you may not see money".
    total: raw.total ?? null,
    createdAt: raw.created_at ?? null,
    offerSentAt: raw.offer_sent_at ?? null,
    offerSignedAt: raw.offer_signed_at ?? null,
  };
}

function mapCustomer(raw: RawCustomer): ChatCustomer {
  return {
    key: String(raw.key ?? ''),
    name: raw.name ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    conversations: (raw.conversations ?? []).map(mapThread).filter((t) => t.uuid !== ''),
    offers: (raw.offers ?? []).map(mapOffer).filter((o) => o.ref !== ''),
    unread: Number(raw.unread ?? 0),
    awaitingReply: !!raw.awaiting_reply,
    present: !!raw.present,
    lastMessageAt: raw.last_message_at ?? null,
  };
}

export type ChatFilter = 'all' | 'awaiting' | 'open' | 'closed';

/** The inbox, one row per person. */
export async function fetchChatCustomers(filter: ChatFilter): Promise<ChatCustomer[]> {
  const d = await request<{ customers?: RawCustomer[] }>('/portal/dealer/chat/customers', {
    params: { filter },
  });

  return (d.customers ?? []).map(mapCustomer);
}

/** Who a thread is with — their other threads and their offers. */
export async function fetchThreadCustomer(uuid: string): Promise<ChatCustomer | null> {
  const d = await request<{ customer?: RawCustomer | null }>(
    `/portal/dealer/chat/conversations/${uuid}/customer`
  );

  return d.customer ? mapCustomer(d.customer) : null;
}

type RawAttachment = {
  id?: string | number;
  file_name?: string | null;
  url?: string;
  thumb_url?: string | null;
  is_image?: boolean;
};

export type RawMessage = {
  id?: string;
  client_message_id?: string | null;
  author_type?: string;
  author_name?: string | null;
  body?: string | null;
  attachments?: RawAttachment[];
  read_at?: string | null;
  created_at?: string | null;
};

function mapAttachment(raw: RawAttachment): ChatAttachment {
  return {
    id: String(raw.id ?? ''),
    fileName: raw.file_name ?? null,
    url: String(raw.url ?? ''),
    thumbUrl: raw.thumb_url ?? null,
    isImage: !!raw.is_image,
  };
}

/**
 * One message, from the API's ChatMessageResource.
 *
 * Exported because the websocket payload carries the very same resource — the
 * backend was built that way on purpose, so a message that arrives over the
 * socket can be appended to the list this fetched without a second shape.
 */
export function mapMessage(raw: RawMessage): ChatMessage {
  return {
    id: String(raw.id ?? ''),
    clientMessageId: raw.client_message_id ?? null,
    authorType:
      raw.author_type === 'agent' || raw.author_type === 'system'
        ? raw.author_type
        : 'visitor',
    authorName: raw.author_name ?? null,
    body: raw.body ?? null,
    attachments: (raw.attachments ?? []).map(mapAttachment).filter((a) => a.url !== ''),
    readAt: raw.read_at ?? null,
    createdAt: raw.created_at ?? null,
  };
}

type RawConversation = {
  id?: string;
  status?: string;
  visitor_present?: boolean;
  visitor?: {
    name?: string | null;
    display_name?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    device_type?: string | null;
    locale?: string | null;
  };
  context?: {
    surface?: string | null;
    current_url?: string | null;
    landing_url?: string | null;
    current_step_key?: string | null;
    device_type?: string | null;
  };
  assigned_to?: { name?: string | null } | null;
  first_seen_at?: string | null;
  visitor_last_read_at?: string | null;
  messages?: RawMessage[];
};

function mapConversation(raw: RawConversation | undefined): ChatConversationDetail | null {
  if (!raw?.id) return null;

  return {
    uuid: raw.id,
    status: (raw.status === 'closed' ? 'closed' : 'open') as ChatStatus,
    present: !!raw.visitor_present,
    name: raw.visitor?.name || raw.visitor?.display_name || null,
    email: raw.visitor?.email ?? null,
    phone: raw.visitor?.phone ?? null,
    city: raw.visitor?.city ?? null,
    country: raw.visitor?.country ?? null,
    locale: raw.visitor?.locale ?? null,
    // The device is filed under context on the wire and under the visitor in
    // the reader's head; take whichever the payload carries.
    deviceType: raw.context?.device_type ?? raw.visitor?.device_type ?? null,
    surface: raw.context?.surface ?? null,
    currentUrl: raw.context?.current_url ?? null,
    landingUrl: raw.context?.landing_url ?? null,
    currentStepKey: raw.context?.current_step_key ?? null,
    firstSeenAt: raw.first_seen_at ?? null,
    assignedTo: raw.assigned_to?.name ?? null,
    visitorLastReadAt: raw.visitor_last_read_at ?? null,
  };
}

/**
 * A thread: its messages AND the context they were asked in.
 *
 * One request for both, because the context is on the same row — a second
 * call for "which page are they on" would double the cost of the screen that
 * is opened on every push tap.
 *
 * Opening it marks it read server-side — unless `since` is passed, which is
 * the polling path and must not steal the unread badge from a colleague who
 * has not looked yet.
 */
export async function fetchThread(uuid: string): Promise<ChatThreadView> {
  const d = await request<{ conversation?: RawConversation }>(
    `/portal/dealer/chat/conversations/${uuid}`
  );

  return {
    messages: (d.conversation?.messages ?? []).map(mapMessage),
    detail: mapConversation(d.conversation),
  };
}

/** Polls for new messages without claiming the thread as read. */
export async function pollThread(uuid: string, since: string): Promise<ChatThreadView> {
  const d = await request<{ conversation?: RawConversation }>(
    `/portal/dealer/chat/conversations/${uuid}`,
    { params: { since } }
  );

  return {
    messages: (d.conversation?.messages ?? []).map(mapMessage),
    detail: mapConversation(d.conversation),
  };
}

/**
 * Sends a reply, with photos when there are any.
 *
 * Two transports for one message: JSON for text, multipart over XHR for
 * anything with a file on it (Expo's fetch refuses React Native's file part —
 * see uploadMultipart). The dealer does not get to know which was used; a
 * photo of the gutter they are being asked about is the most useful thing the
 * phone can send, and until now it could not send one at all.
 */
export async function sendChatMessage(
  uuid: string,
  body: string,
  clientMessageId: string,
  files: CapturedFile[] = [],
  quickReplyId: number | null = null
): Promise<ChatMessage | null> {
  const path = `/portal/dealer/chat/conversations/${uuid}/messages`;

  if (files.length === 0) {
    const d = await request<{ message?: RawMessage }>(path, {
      method: 'POST',
      body: {
        body,
        client_message_id: clientMessageId,
        quick_reply_id: quickReplyId ?? undefined,
      },
    });
    return d.message ? mapMessage(d.message) : null;
  }

  const form = new FormData();
  if (body) form.append('body', body);
  form.append('client_message_id', clientMessageId);
  if (quickReplyId) form.append('quick_reply_id', String(quickReplyId));
  for (const file of files) {
    // React Native's classic file part; XHR streams it from the uri.
    form.append('attachments[]', file as unknown as Blob);
  }

  const d = await uploadMultipart<{ message?: RawMessage }>(path, form);
  return d.message ? mapMessage(d.message) : null;
}

/**
 * The team's canned answers, narrowed to the language this conversation is
 * being held in. Written on the web — the phone picks, it does not curate:
 * nobody composes the company's standard answer on a phone keyboard between
 * two montages.
 */
export async function fetchQuickReplies(locale?: string | null): Promise<ChatQuickReply[]> {
  type RawQuickReply = {
    id?: number;
    title?: string;
    body?: string;
    locale?: string | null;
  };

  const d = await request<{ quick_replies?: RawQuickReply[] }>('/portal/dealer/chat/quick-replies', {
    params: locale ? { locale } : undefined,
  });

  return (d.quick_replies ?? [])
    .filter((raw) => !!raw.id && !!raw.title)
    .map((raw) => ({
      id: Number(raw.id),
      title: String(raw.title),
      body: String(raw.body ?? ''),
      locale: raw.locale ?? null,
    }));
}

/**
 * Marks the thread read for the whole dealer team.
 *
 * Opening a thread does this server-side, but a message that lands over the
 * socket while the thread is already open does not — without this the badge
 * would sit there until the next full fetch.
 */
export async function markThreadRead(uuid: string): Promise<void> {
  await request(`/portal/dealer/chat/conversations/${uuid}/read`, { method: 'POST' });
}

/**
 * Tells the visitor we are writing (or have stopped).
 *
 * Fire-and-forget: a typing bubble that fails to arrive is not worth an error
 * on screen, and the state expires on the other side by itself.
 */
export async function sendTypingSignal(uuid: string, typing: boolean): Promise<void> {
  await request(`/portal/dealer/chat/conversations/${uuid}/typing`, {
    method: 'POST',
    body: { typing },
  });
}

/** Takes ownership of a thread — "I am on this". */
export async function claimThread(uuid: string): Promise<void> {
  await request(`/portal/dealer/chat/conversations/${uuid}/claim`, { method: 'POST' });
}

export async function closeThread(uuid: string): Promise<void> {
  await request(`/portal/dealer/chat/conversations/${uuid}/close`, { method: 'POST' });
}

/**
 * Whether anyone is reachable, and whether it is US.
 *
 * Two different facts in one read, and the screen needs both: `online` is the
 * whole dealer (a colleague at the desk counts), `availableUntil` is this
 * person's own standing claim, which is what the switch reflects. The phone
 * cannot be the record of its own state — it gets closed, and the claim
 * expires on the server without asking it.
 */
export type ChatAvailability = { online: boolean; availableUntil: string | null };

type RawAvailability = { online?: boolean; available_until?: string | null };

function mapAvailability(raw: RawAvailability | null | undefined): ChatAvailability {
  return {
    online: !!raw?.online,
    availableUntil: raw?.available_until ?? null,
  };
}

export async function fetchChatAvailability(): Promise<ChatAvailability> {
  return mapAvailability(await request<RawAvailability>('/portal/dealer/chat/meta'));
}

/**
 * Say it, or take it back.
 *
 * The server decides how long a claim lasts (hours, bounded), so nothing here
 * sends a duration: a phone that picked its own would be making a promise the
 * escalation ladder is the judge of.
 */
export async function setChatAvailability(available: boolean): Promise<ChatAvailability> {
  return mapAvailability(
    await request<RawAvailability>('/portal/dealer/chat/availability', {
      method: 'POST',
      body: { available },
    })
  );
}
