/**
 * A customer's own conversation with the dealer — WhatsApp on the dealer's
 * business number, and replies to the mails we sent.
 *
 * Deliberately NOT the live chat (src/features/chat). That one is an
 * anonymous visitor standing on a page who will leave in a minute; this is a
 * named customer on a thread that keeps, against a request with a reference
 * number. They share a tab because a dealer looking for "a message" does not
 * care which pipe carried it — they do not share a data model, because almost
 * nothing about them is the same.
 */

/** Who said a line. Mirrors LeadConversationController::authorKind(). */
export type AuthorKind = 'customer' | 'member' | 'agent' | 'system';

export type InboxRow = {
  /** Route key for /leads/{ref} — "m{id}" for a Meta request, "d{id}" else. */
  ref: string;
  /** What the conversation endpoints want beside `leadId`. */
  kind: 'meta' | 'manual';
  leadId: number;
  dealId: number;
  customerName: string | null;
  offerNo: string | null;
  unread: number;
  awaitingReply: boolean;
  lastAt: string | null;
  lastChannel: string | null;
  lastPreview: string | null;
  /**
   * The assistant is running this one, so nobody has to open it. False the
   * moment a colleague writes, even while the run is still active — see the
   * backend's InboxController::agentHolds().
   */
  agentHolds: boolean;
};

/** A WhatsApp thread from a number that is on no lead yet. */
export type UnlinkedRow = {
  /** The thread is addressed by a MESSAGE id, never by the phone number. */
  messageId: number;
  fromName: string | null;
  preview: string | null;
  lastAt: string | null;
  unread: number;
};

export type ConversationEntry = {
  id: number;
  kind: string;
  channel: string | null;
  direction: string | null;
  authorKind: AuthorKind | null;
  authorName: string | null;
  subject: string | null;
  bodyText: string | null;
  occurredAt: string | null;
  deliveredAt: string | null;
  readReceiptAt: string | null;
  failure: string | null;
};

export type WhatsAppState = {
  connected: boolean;
  to: string | null;
  windowOpen: boolean;
  windowExpiresAt: string | null;
};

export type AgentState = {
  holds: boolean;
  status: string | null;
  handoverReason: string | null;
};

export type ConversationView = {
  entries: ConversationEntry[];
  unread: number;
  whatsapp: WhatsAppState;
  agent: AgentState;
};
