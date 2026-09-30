import { request } from '@/lib/api/client';

/**
 * The offer, from the phone.
 *
 * Everything here hangs off one deal id under `/portal/dealer/deals/{id}`, and
 * every route is the same one the desk portal uses — no mobile-only endpoint
 * exists, and none should: the offer a dealer sends from a driveway has to be
 * the offer the office sees a minute later.
 *
 * Two things the server owns and this layer deliberately does not fake:
 *  - the offer NUMBER, minted on the first real send (so an offer that never
 *    goes out leaves no gap in the dealer's sequence);
 *  - the totals, recomputed on save. `computeTotals()` is only a live preview.
 */

export type OfferLine = {
  /** Null for a line the dealer just added — the server assigns the id. */
  id: number | null;
  /**
   * Stable identity for a line that has no id yet. The editor's inputs are
   * uncontrolled, so keying an unsaved line by its position would hand the
   * next line's text to it the moment one above is deleted. Never sent.
   */
  clientKey?: string;
  productId: number | null;
  /** Round-tripped so a Meta-mapped line keeps its link across an edit. */
  metaMappingId: number | null;
  name: string;
  description: string | null;
  quantity: number;
  /** Unit price, ex VAT. */
  price: number;
  vatRate: number;
  /** Server-computed line total incl VAT. */
  total: number;
  /** "Leave this line at the price we agreed" — survives a re-price. */
  pricePinned: boolean;
};

/** The deal-level knobs that ride along with a line save. */
export type OfferSettings = {
  discountRate: number;
  discountNote: string | null;
  /** Dealer-pinned exact grand total (incl VAT). Null when not pinned. */
  finalTotalOverride: number | null;
  isConcept: boolean;
  includeVat: boolean;
  showItemDescriptions: boolean;
};

export type RawOfferLine = {
  id?: number | null;
  product_id?: number | null;
  meta_mapping_id?: number | null;
  name?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  vat_rate?: number | string | null;
  total?: number | string | null;
  price_overridden?: boolean | number | null;
};

const num = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * One offer line.
 *
 * Money keys are ABSENT (not zero) for a crew member — DealItemResource strips
 * them — so a missing price reads as 0 here and the editor stays behind
 * `pricing.view`, which is the same gate the backend enforces.
 */
export function mapOfferLine(raw: RawOfferLine): OfferLine {
  return {
    id: raw.id === null || raw.id === undefined ? null : Number(raw.id),
    productId: raw.product_id ? Number(raw.product_id) : null,
    metaMappingId: raw.meta_mapping_id ? Number(raw.meta_mapping_id) : null,
    name: raw.name ?? '',
    description: raw.description ?? null,
    quantity: num(raw.quantity, 1),
    price: num(raw.price),
    vatRate: num(raw.vat_rate, 21),
    total: num(raw.total),
    pricePinned: !!raw.price_overridden,
  };
}

/** The shape DealItemRequest validates. Cents only — it rejects more decimals. */
function toRawLine(line: OfferLine) {
  return {
    ...(line.id ? { id: line.id } : {}),
    product_id: line.productId,
    meta_mapping_id: line.metaMappingId,
    name: line.name,
    description: line.description,
    quantity: line.quantity,
    price: line.price.toFixed(2),
    vat_rate: line.vatRate.toFixed(2),
  };
}

export async function fetchOfferLines(dealId: number): Promise<OfferLine[]> {
  const rows = await request<RawOfferLine[]>(`/portal/dealer/deals/${dealId}/items`);
  return (rows ?? []).map(mapOfferLine);
}

/**
 * Replace the whole line set in one call.
 *
 * The endpoint is a bulk REPLACE, not a merge: a line left out of `lines` is
 * deleted. So the editor always sends everything it is holding.
 */
export async function saveOffer(
  dealId: number,
  lines: OfferLine[],
  settings: OfferSettings
): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/items`, {
    method: 'POST',
    body: {
      items: lines.map(toRawLine),
      discount_rate: settings.discountRate,
      discount_note: settings.discountNote,
      final_total_override: settings.finalTotalOverride,
      is_concept: settings.isConcept,
      include_vat: settings.includeVat,
      show_item_descriptions: settings.showItemDescriptions,
    },
  });
}

export async function deleteOfferLine(dealId: number, itemId: number): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/items/${itemId}`, { method: 'DELETE' });
}

/** What the price list would charge for each engine line today. */
export type PriceCheckLine = {
  itemId: number;
  name: string;
  price: number;
  /** Null when the engine no longer produces this line, or couldn't price it. */
  listPrice: number | null;
  delta: number | null;
  pinned: boolean;
};

export async function fetchPriceCheck(dealId: number): Promise<PriceCheckLine[]> {
  const data = await request<{
    lines?: {
      item_id: number;
      name: string;
      price: number;
      list_price: number | null;
      delta: number | null;
      price_overridden: boolean;
    }[];
  }>(`/portal/dealer/deals/${dealId}/price-check`);

  return (data?.lines ?? []).map((l) => ({
    itemId: l.item_id,
    name: l.name,
    price: num(l.price),
    listPrice: l.list_price === null ? null : num(l.list_price),
    delta: l.delta === null ? null : num(l.delta),
    pinned: !!l.price_overridden,
  }));
}

/**
 * Pin (or release) the agreed price on named lines.
 *
 * Lines are addressed by NAME, not by id — that is the backend's contract, and
 * it is what lets a renamed template still be matched.
 */
export async function pinPrices(
  dealId: number,
  lines: { name: string; pinned: boolean; price?: number }[]
): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/pin-prices`, {
    method: 'POST',
    body: { lines },
  });
}

/**
 * Send the offer to the customer, for real.
 *
 * Refusals worth expecting, all of which arrive as an ApiError carrying the
 * backend's own localized sentence: live delivery switched off on the dealer
 * profile (403), an unfinished onboarding step (the onboarding gate), and a
 * plan quota that has run out. None of them are worth restating here — the
 * server's message is the accurate one.
 */
export async function sendOffer(dealId: number): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/send-email`, { method: 'POST' });
}

/** The same mail, to the dealer's own address. Never touches the customer. */
export async function sendTestOffer(dealId: number): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/send-test-email`, { method: 'POST' });
}

/**
 * The current offer PDF, rendered if it doesn't exist yet.
 *
 * Returns the signed document instead once the customer has signed — same
 * endpoint, different payload, which is why both shapes are read here.
 */
export async function fetchOfferPdfUrl(dealId: number): Promise<string | null> {
  const data = await request<{
    url?: string | null;
    original_url?: string | null;
    offer_pdf?: { url?: string | null; original_url?: string | null } | null;
  }>(`/portal/dealer/deals/${dealId}/offer-pdf`);

  return (
    data?.original_url ??
    data?.url ??
    data?.offer_pdf?.original_url ??
    data?.offer_pdf?.url ??
    null
  );
}

/** How far the customer got: opened, viewed, downloaded, signed. */
export type OfferEngagement = {
  emailsSent: number;
  /** Prefetch-filtered — mail providers open the pixel on delivery. */
  emailOpens: number;
  firstOpenedAt: string | null;
  offerViews: number;
  lastViewedAt: string | null;
  pdfDownloads: number;
  signedAt: string | null;
};

export async function fetchEngagement(dealId: number): Promise<OfferEngagement> {
  const data = await request<{
    emails_sent?: number;
    email_opens_real?: number;
    email_opens_total?: number;
    email_first_opened_at?: string | null;
    offer_views_total?: number;
    offer_last_viewed_at?: string | null;
    pdf_downloads_total?: number;
    signed_at?: string | null;
  }>(`/portal/dealer/deals/${dealId}/engagement`);

  return {
    emailsSent: num(data?.emails_sent),
    emailOpens: num(data?.email_opens_real ?? data?.email_opens_total),
    firstOpenedAt: data?.email_first_opened_at ?? null,
    offerViews: num(data?.offer_views_total),
    lastViewedAt: data?.offer_last_viewed_at ?? null,
    pdfDownloads: num(data?.pdf_downloads_total),
    signedAt: data?.signed_at ?? null,
  };
}

export type CustomerToken = {
  id: number;
  expiresAt: string | null;
  usedAt: string | null;
  lastSeenAt: string | null;
  viewCount: number;
  isActive: boolean;
};

export async function fetchCustomerTokens(dealId: number): Promise<CustomerToken[]> {
  const rows = await request<
    {
      id: number;
      expires_at: string | null;
      used_at: string | null;
      last_seen_at: string | null;
      view_count: number;
      is_active: boolean;
    }[]
  >(`/portal/dealer/deals/${dealId}/customer-tokens`);

  return (rows ?? []).map((t) => ({
    id: t.id,
    expiresAt: t.expires_at,
    usedAt: t.used_at,
    lastSeenAt: t.last_seen_at,
    viewCount: num(t.view_count),
    isActive: !!t.is_active,
  }));
}

/** Which pipe an offer takes to WhatsApp. See sendOfferWhatsapp. */
export type WhatsappTransport = 'auto' | 'cloud' | 'link';

export type WhatsappAttachment = {
  url: string;
  fileName: string;
  mime: string;
  size: number | null;
};

export type WhatsappSendResult = {
  transport: 'cloud' | 'link';
  /** The chat to open. Always null on a cloud send — it already went. */
  url: string | null;
  appUrl: string | null;
  text: string;
  offerUrl: string;
  offerNo: string;
  phone: string;
  /** True once the deal is really booked as sent. */
  confirmed: boolean;
  /** Why `auto` came back as a hand-off, when it did. */
  fallbackReason: string | null;
  attachment: WhatsappAttachment | null;
};

function toAttachment(raw: unknown): WhatsappAttachment | null {
  const a = raw as Record<string, unknown> | null | undefined;
  if (!a || typeof a.url !== 'string') return null;

  return {
    url: a.url,
    fileName: typeof a.file_name === 'string' ? a.file_name : 'offerte.pdf',
    mime: typeof a.mime === 'string' ? a.mime : 'application/pdf',
    size: typeof a.size === 'number' ? a.size : null,
  };
}

/**
 * Send the offer to the customer over WhatsApp.
 *
 * Two pipes, and the server picks. With a connected WhatsApp Business number
 * and Meta's 24-hour service window open, it goes out from the server with the
 * PDF attached as a real document and comes back `confirmed` — there is
 * nothing left to do. Otherwise it comes back as a hand-off: a chat address to
 * open, the message text, and the PDF for the app to attach itself. Only after
 * the dealer says that chat really left do we call this again with
 * `confirm: true`, which is what books the offer as sent.
 *
 * Preparing is free and repeatable; the same customer link comes back each
 * time.
 */
export async function sendOfferWhatsapp(
  dealId: number,
  opts: { transport?: WhatsappTransport; confirm?: boolean } = {}
): Promise<WhatsappSendResult> {
  const data = await request<Record<string, unknown>>(
    `/portal/dealer/deals/${dealId}/send-whatsapp`,
    {
      method: 'POST',
      body: {
        transport: opts.transport ?? 'auto',
        ...(opts.confirm ? { confirm: true } : {}),
      },
    }
  );

  return {
    transport: data.transport === 'cloud' ? 'cloud' : 'link',
    url: typeof data.url === 'string' ? data.url : null,
    appUrl: typeof data.app_url === 'string' ? data.app_url : null,
    text: typeof data.text === 'string' ? data.text : '',
    offerUrl: typeof data.offer_url === 'string' ? data.offer_url : '',
    offerNo: typeof data.offer_no === 'string' ? data.offer_no : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    confirmed: data.confirmed === true,
    fallbackReason: typeof data.fallback_reason === 'string' ? data.fallback_reason : null,
    attachment: toAttachment(data.attachment),
  };
}

export type WhatsappCapability = {
  phone: string | null;
  connected: boolean;
  needsReconnect: boolean;
  windowOpen: boolean;
  /** 'cloud', 'link', or null when neither is possible. */
  recommended: WhatsappTransport | null;
  /** Why the recommended one is what it is — a closed vocabulary. */
  reason: string | null;
  /**
   * Whether the plan still has an offer send in it. Separate from `recommended`
   * being null, because the two are different sentences to a dealer: "this
   * customer has no number" is about the lead, "your sends are used up" is
   * about the account, and only one of them is fixed by editing the lead.
   */
  quotaAllowed: boolean;
};

/**
 * Whether this offer can go by WhatsApp at all, and how.
 *
 * Safe to fetch on screen open: it mints no offer number, renders no PDF and
 * spends no quota. The answer moves on its own, because it follows the
 * customer's newest inbound message.
 */
export async function fetchWhatsappCapability(dealId: number): Promise<WhatsappCapability> {
  const data = await request<Record<string, any>>(
    `/portal/dealer/deals/${dealId}/whatsapp-capability`
  );

  const recommended = data?.recommended;

  return {
    phone: typeof data?.phone === 'string' ? data.phone : null,
    connected: data?.connected === true,
    needsReconnect: data?.needs_reconnect === true,
    windowOpen: data?.window_open === true,
    recommended: recommended === 'cloud' || recommended === 'link' ? recommended : null,
    reason: data?.transports?.link?.reason ?? data?.transports?.cloud?.reason ?? null,
    // Absent means "the endpoint did not say no" — the send itself still
    // pre-flights the quota, so a missing key must not disable the button.
    quotaAllowed: data?.quota?.allowed !== false,
  };
}

/**
 * Mint a customer-facing signing link.
 *
 * The raw URL comes back EXACTLY once — the token is stored hashed — so the
 * caller must hand it to the dealer (share sheet / clipboard) there and then.
 * Issuing also auto-revokes the previous live link for this deal.
 */
export async function issueCustomerToken(dealId: number): Promise<{ url: string; expiresAt: string }> {
  const data = await request<{ url: string; expires_at: string }>(
    `/portal/dealer/deals/${dealId}/customer-tokens`,
    { method: 'POST' }
  );

  return { url: data.url, expiresAt: data.expires_at };
}

export async function revokeCustomerToken(dealId: number, tokenId: number): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/customer-tokens/${tokenId}`, {
    method: 'DELETE',
  });
}

/**
 * Correct the customer's answers.
 *
 * Corrections are OVERRIDES, never edits: the answers the customer actually
 * submitted are an audit trail the backend refuses to overwrite, so a dealer
 * fix layers on top and an empty value reverts that field to the original.
 * Saving stamps `answers_changed_at`, which is the portal's "these lines now
 * predate their answers — reprocess" flag.
 */
export async function updateWizardAnswers(
  dealId: number,
  overrides: Record<string, string>
): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/wizard-answers`, {
    method: 'PUT',
    body: { overrides },
  });
}

/**
 * Rebuild the lines from the (corrected) answers.
 *
 * Separate from the save above because re-pricing throws away hand-negotiated
 * figures — the dealer asks for it. Refused with a 409 on an offer that is no
 * longer a concept or has already gone out, unless `force` is passed.
 */
export async function reprocessWizard(dealId: number, force = false): Promise<void> {
  await request(`/portal/dealer/deals/${dealId}/wizard-reprocess`, {
    method: 'POST',
    body: { force },
  });
}

/** Clone this offer into a fresh draft for the same customer. */
export async function duplicateDeal(dealId: number): Promise<number | null> {
  const data = await request<{ id?: number }>(`/portal/dealer/deals/${dealId}/duplicate`, {
    method: 'POST',
  });

  return data?.id ?? null;
}
