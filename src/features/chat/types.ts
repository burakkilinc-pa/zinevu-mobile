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

  /**
   * Where they are standing while they type. The desk has shown all of this
   * since day one; the phone showed a name and nothing else, so a dealer
   * answering from the road could not tell which page the question was about.
   */
  present: boolean;
  city: string | null;
  country: string | null;
  deviceType: string | null;
  locale: string | null;
  currentUrl: string | null;
  currentStepKey: string | null;
  firstSeenAt: string | null;
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
  /** On the site in any of their threads right now. */
  present: boolean;
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
  /**
   * When the other side read it. One tick is stored, two green ticks are
   * read — the same vocabulary the visitor's own widget uses, so both ends of
   * the conversation mean the same thing by a tick.
   */
  readAt: string | null;
  /** True while an optimistic message has not been acknowledged. */
  pending?: boolean;
  failed?: boolean;
};

/** A canned answer, written by the team on the web and picked here. */
export type ChatQuickReply = {
  id: number;
  title: string;
  body: string;
  locale: string | null;
};

/**
 * One open conversation, as the thread screen needs it.
 *
 * The messages are the content; this is the context the desk has always had
 * on its visitor card and the phone never showed — who, from where, on which
 * page, and whether they are still standing on it.
 */
export type ChatConversationDetail = {
  uuid: string;
  status: ChatStatus;
  present: boolean;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  locale: string | null;
  deviceType: string | null;
  surface: string | null;
  currentUrl: string | null;
  landingUrl: string | null;
  currentStepKey: string | null;
  firstSeenAt: string | null;
  assignedTo: string | null;
  /** When the visitor last read our side — what turns our ticks green. */
  visitorLastReadAt: string | null;
};

/** Messages plus their context, from one request. */
export type ChatThreadView = {
  messages: ChatMessage[];
  detail: ChatConversationDetail | null;
};
