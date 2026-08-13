/**
 * Live chat, from the dealer's side.
 *
 * The mobile inbox is grouped by PERSON, not by thread — see the backend's
 * ChatCustomerGrouper. Somebody who asked twice from two devices is one person
 * with two conversations, and three rows for one person is three chances to
 * reply without knowing what was already said.
 */

export type ChatStatus = 'open' | 'closed';

export type ChatThread = {
  uuid: string;
  status: ChatStatus;
  /** Which surface they were on: the form, the 3D configurator, an offer. */
  surface: string | null;
  preview: string | null;
  lastMessageAt: string | null;
  /** Who spoke last — 'visitor' means it is our turn. */
  lastMessageAuthor: string | null;
  unread: number;
  awaitingReply: boolean;
  assignedTo: string | null;
};

/** An offer belonging to the person in the chat. */
export type ChatOffer = {
  ref: string;
  offerNo: string | null;
  status: string | null;
  /** Null for a member who may not see money — not zero. */
  total: number | null;
  createdAt: string | null;
  offerSentAt: string | null;
  offerSignedAt: string | null;
};

export type ChatCustomer = {
  /** Stable identity of the person-group; not a database id. */
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  conversations: ChatThread[];
  /** Every quote this person has — the answer to "which one do they mean". */
  offers: ChatOffer[];
  unread: number;
  awaitingReply: boolean;
  lastMessageAt: string | null;
};

export type ChatAttachment = {
  id: string;
  fileName: string | null;
  url: string;
  thumbUrl: string | null;
  isImage: boolean;
};

export type ChatMessage = {
  id: string;
  /** Set by us on an optimistic send, so the echo can replace it. */
  clientMessageId: string | null;
  authorType: 'visitor' | 'agent' | 'system';
  authorName: string | null;
  body: string | null;
  attachments: ChatAttachment[];
  createdAt: string | null;
  /** True while an optimistic message has not been acknowledged. */
  pending?: boolean;
  failed?: boolean;
};
