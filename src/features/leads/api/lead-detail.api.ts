import { request } from '@/lib/api/client';
import type { FunnelStatus } from '@/features/leads/types';
import { mapOfferLine, type OfferLine, type OfferSettings, type RawOfferLine } from '@/features/leads/api/offer.api';

/**
 * One lead, opened.
 *
 * The list is one list, but behind it are two records: a Meta submission
 * (ref "m{id}") and an offer (ref "d{id}"), each with its own endpoint. That
 * split is a backend fact the screen should not have to know, so it is resolved
 * here — the screen asks for a ref and gets a lead.
 *
 * The offer comes with it. A dealer standing in someone's garden is exactly the
 * person who needs to change a line and send it, so the lines, the discount and
 * the send state are all part of a lead here — see offer.api.ts for the writes.
 */

export type LeadAnswer = {
  key: string;
  value: string;
  /** True when this value is a dealer correction, not the customer's answer. */
  overridden?: boolean;
};

export type LeadDetail = {
  ref: string;
  /**
   * The deal's numeric id — what every offer action is addressed by. Null for a
   * Meta submission the mapping engine has not turned into an offer yet, which
   * is the one case where there is nothing to edit or send.
   */
  dealId: number | null;
  status: FunnelStatus | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /**
   * The customer's country as ISO-2, and its dial code when the API expanded
   * one. Both exist so a national number can be dialled — see lib/phone.ts.
   */
  customerCountry: string | null;
  customerCallingCode: string | null;
  customerAddress: string | null;
  total: number | null;
  offerNo: string | null;
  createdAt: string | null;
  offerSentAt: string | null;
  offerSignedAt: string | null;
  /** The customer's own words, in full — not the list's excerpt. */
  note: string | null;
  /** What they configured, as label/value rows. */
  answers: LeadAnswer[];
  /**
   * The same configuration as the flat master-form map the 3D configurator
   * eats — corrections already applied. Rows are for reading, this is for
   * handing to the scene; see `lead3dHandoff`.
   */
  answerMap: Record<string, unknown>;
  /**
   * Which funnel it came from (carport, sliding_doors, …). Null for a Meta
   * lead, which has no form and opens the veranda flow.
   */
  formType: string | null;
  /** Last offer PDF, when one has been generated. */
  pdfUrl: string | null;
  previewImageUrl: string | null;
  /** Photos the customer attached on the form's notes step. */
  photoUrls: string[];
  /** The offer lines as they stand. Empty for a lead with no offer yet. */
  lines: OfferLine[];
  /** Discount, VAT and the concept flag — saved together with the lines. */
  offer: OfferSettings;
  /** A concept has not been sent and can still be freely re-priced. */
  isConcept: boolean;
  /**
   * Set when the dealer corrected an answer after the lines were built, i.e.
   * the offer now prices something the customer no longer asked for. Cleared by
   * a reprocess.
   */
  answersChangedAt: string | null;
};

type RawCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Record<string, unknown> | null;
};

/** The dial code the API resolved from the customer's country, if any. */
function callingCode(customer: RawCustomer | null | undefined): string | null {
  const info = customer?.address?.country_info;
  const code =
    info && typeof info === 'object' ? (info as Record<string, unknown>).calling_code : null;

  return typeof code === 'string' || typeof code === 'number' ? String(code) : null;
}

/** The customer's country as ISO-2, straight off the normalized address. */
function customerCountry(customer: RawCustomer | null | undefined): string | null {
  const country = customer?.address?.country;

  return typeof country === 'string' && country.trim() !== '' ? country.trim().toUpperCase() : null;
}

/**
 * The customer's phone number, wherever it happens to live.
 *
 * `customers` has no phone column — the funnel stores it inside the address
 * JSON, which is where the portal reads it from too. A top-level `phone` shows
 * up on Meta-shaped rows, so both are tried before giving up: without this the
 * Call and WhatsApp buttons are dead on every lead, which is most of what a
 * dealer opens this screen to do.
 */
function customerPhone(customer: RawCustomer | null | undefined): string | null {
  if (!customer) return null;

  const nested = customer.address?.phone;
  const raw = customer.phone ?? (typeof nested === 'string' ? nested : null);

  return raw?.trim() || null;
}

type RawDeal = {
  id?: number | string;
  offer_no?: string | null;
  total?: number | string | null;
  created_at?: string | null;
  offer_sent_at?: string | null;
  offer_signed_at?: string | null;
  status?: string | null;
  wizard_answers?: Record<string, unknown> | null;
  customer?: RawCustomer | null;
  pdf?: { url?: string | null; original_url?: string | null } | null;
  preview_image_url?: string | null;
  items?: RawOfferLine[] | null;
  discount_rate?: number | string | null;
  discount_note?: string | null;
  final_total_override?: number | string | null;
  is_concept?: boolean | number | null;
  include_vat?: boolean | number | null;
  show_item_descriptions?: boolean | number | null;
  answers_changed_at?: string | null;
  garden_photos?: { url?: string | null }[] | null;
};

/** "Hoofdstraat 12, 1234 AB Amersfoort" from the customer's address JSON. */
function addressLine(address: Record<string, unknown> | null | undefined): string | null {
  if (!address) return null;

  const str = (k: string) => {
    const v = address[k];
    return typeof v === 'string' ? v.trim() : '';
  };

  const street = str('street') || str('address');
  const number = str('house_number') + str('house_number_addition');
  // The street already carries the number on form-shaped rows; appending it
  // again would read "Hoofdstraat 12 12".
  const line = number && !/\d/.test(street) ? `${street} ${number}`.trim() : street;
  const tail = `${str('postal_code') || str('postcode')} ${str('city')}`.trim();

  const parts = [line, tail].filter((p) => p !== '');

  return parts.length ? parts.join(', ') : null;
}

/**
 * The configuration, as rows.
 *
 * Keys are shown as-is when the app has no word for them: these come from the
 * dealer's own master form, which they can extend, so an unknown key is normal
 * rather than a bug — and the raw key still tells a dealer what it is.
 */
function mapAnswers(wizard: Record<string, unknown> | null | undefined): LeadAnswer[] {
  if (!wizard) return [];

  const source = (wizard.answers ?? wizard) as Record<string, unknown>;
  if (typeof source !== 'object' || source === null) return [];

  // A dealer correction never replaces what the customer submitted — the two
  // are stored side by side, and the override is what the offer is priced on.
  const overrides = (wizard.overrides ?? {}) as Record<string, unknown>;
  const hasOverride = (key: string) =>
    typeof overrides === 'object' &&
    overrides !== null &&
    Object.prototype.hasOwnProperty.call(overrides, key);

  const rows: LeadAnswer[] = [];

  for (const [key, submitted] of Object.entries(source)) {
    // Bookkeeping the customer never answered, and free text that has its own
    // place on the screen.
    if (
      ['notes', 'source', 'answers', 'overrides', 'summary', 'attribution', 'consent_ip'].includes(
        key
      )
    ) {
      continue;
    }

    const overridden = hasOverride(key);
    const value = overridden ? overrides[key] : submitted;

    if (value === null || value === undefined || value === '' || typeof value === 'object') {
      continue;
    }
    rows.push({ key, value: String(value), overridden });
  }

  return rows;
}

/**
 * The answers as one flat map, corrections applied.
 *
 * The 3D configurator is mounted from the master-form answers, not from the
 * offer lines, so it wants the raw values — including the ones `mapAnswers`
 * drops for display (bookkeeping, free text) — with each dealer override
 * standing in for what the customer originally said, exactly as the portal
 * builds its own handoff.
 */
function flatAnswers(wizard: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!wizard) return {};

  const source = (wizard.answers ?? wizard) as Record<string, unknown>;
  if (typeof source !== 'object' || source === null) return {};

  const overrides = wizard.overrides;
  const merged: Record<string, unknown> = { ...source };

  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    Object.assign(merged, overrides);
  }

  for (const key of ['answers', 'overrides', 'summary', 'attribution', 'consent_ip']) {
    delete merged[key];
  }

  return merged;
}

function mapDeal(ref: string, d: RawDeal): LeadDetail {
  const wizard = d.wizard_answers ?? null;
  const note =
    (typeof wizard?.notes === 'string' ? wizard.notes : null) ??
    (typeof (wizard?.answers as Record<string, unknown>)?.notes === 'string'
      ? ((wizard?.answers as Record<string, unknown>).notes as string)
      : null);

  const bool = (v: unknown, fallback = false) =>
    v === null || v === undefined ? fallback : !!v;
  const numOrNull = (v: unknown) =>
    v === null || v === undefined || v === '' ? null : Number(v);

  return {
    ref,
    dealId: d.id === null || d.id === undefined ? null : Number(d.id),
    status: null,
    customerName: d.customer?.name ?? null,
    customerEmail: d.customer?.email ?? null,
    customerPhone: customerPhone(d.customer),
    customerCountry: customerCountry(d.customer),
    customerCallingCode: callingCode(d.customer),
    customerAddress: addressLine(d.customer?.address),
    // Absent (not zero) for a member who may not see money — the API strips
    // the key entirely rather than sending 0.
    total: d.total === null || d.total === undefined ? null : Number(d.total),
    offerNo: d.offer_no ?? null,
    createdAt: d.created_at ?? null,
    offerSentAt: d.offer_sent_at ?? null,
    offerSignedAt: d.offer_signed_at ?? null,
    note: note?.trim() || null,
    answers: mapAnswers(wizard),
    answerMap: flatAnswers(wizard),
    formType: typeof wizard?.form_type === 'string' ? wizard.form_type : null,
    pdfUrl: d.pdf?.original_url ?? d.pdf?.url ?? null,
    previewImageUrl: d.preview_image_url ?? null,
    photoUrls: (d.garden_photos ?? [])
      .map((p) => p?.url)
      .filter((u): u is string => typeof u === 'string' && u !== ''),
    lines: (d.items ?? []).map(mapOfferLine),
    offer: {
      discountRate: Number(d.discount_rate ?? 0) || 0,
      discountNote: d.discount_note ?? null,
      finalTotalOverride: numOrNull(d.final_total_override),
      isConcept: bool(d.is_concept, true),
      includeVat: bool(d.include_vat, true),
      showItemDescriptions: bool(d.show_item_descriptions, true),
    },
    isConcept: bool(d.is_concept, true),
    answersChangedAt: d.answers_changed_at ?? null,
  };
}

export async function fetchLeadDetail(ref: string): Promise<LeadDetail> {
  const kind = ref.charAt(0);
  const id = ref.slice(1);

  if (kind === 'd') {
    const d = await request<RawDeal>(`/portal/dealer/deals/${id}`);
    return mapDeal(ref, d);
  }

  // A Meta lead's endpoint nests the offer it produced under `deal`, and its
  // own answers under the flattened meta payload. Where both exist the deal is
  // the fuller record, so it wins.
  const raw = await request<{ deal?: RawDeal; customer?: RawCustomer } & RawDeal>(
    `/portal/dealer/leads/${id}`
  );

  const detail = mapDeal(ref, raw.deal ?? raw);

  return {
    ...detail,
    // Without an offer behind it there is nothing to price or send, and the
    // fallback record's `id` is the SUBMISSION's — addressing a deal with it
    // would edit somebody else's offer.
    dealId: raw.deal?.id === null || raw.deal?.id === undefined ? null : Number(raw.deal.id),
    customerName: detail.customerName ?? raw.customer?.name ?? null,
    customerEmail: detail.customerEmail ?? raw.customer?.email ?? null,
    customerPhone: detail.customerPhone ?? customerPhone(raw.customer),
    customerCountry: detail.customerCountry ?? customerCountry(raw.customer),
    customerCallingCode: detail.customerCallingCode ?? callingCode(raw.customer),
  };
}
