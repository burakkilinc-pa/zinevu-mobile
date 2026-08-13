import { request } from '@/lib/api/client';
import type { FunnelStatus } from '@/features/leads/types';

/**
 * One lead, opened.
 *
 * The list is one list, but behind it are two records: a Meta submission
 * (ref "m{id}") and an offer (ref "d{id}"), each with its own endpoint. That
 * split is a backend fact the screen should not have to know, so it is resolved
 * here — the screen asks for a ref and gets a lead.
 *
 * Only what a phone can act on is mapped. The desk detail page carries the
 * offer lines, the mail history, the pricing breakdown and the answer editor;
 * none of that is a thing anyone does standing up.
 */

export type LeadAnswer = {
  key: string;
  value: string;
};

export type LeadDetail = {
  ref: string;
  status: FunnelStatus | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
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
  /** Last offer PDF, when one has been generated. */
  pdfUrl: string | null;
  previewImageUrl: string | null;
};

type RawCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Record<string, unknown> | null;
};

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

  const rows: LeadAnswer[] = [];

  for (const [key, value] of Object.entries(source)) {
    // Bookkeeping the customer never answered, and free text that has its own
    // place on the screen.
    if (['notes', 'source', 'answers', 'summary', 'attribution', 'consent_ip'].includes(key)) {
      continue;
    }
    if (value === null || value === undefined || value === '' || typeof value === 'object') {
      continue;
    }
    rows.push({ key, value: String(value) });
  }

  return rows;
}

function mapDeal(ref: string, d: RawDeal): LeadDetail {
  const wizard = d.wizard_answers ?? null;
  const note =
    (typeof wizard?.notes === 'string' ? wizard.notes : null) ??
    (typeof (wizard?.answers as Record<string, unknown>)?.notes === 'string'
      ? ((wizard?.answers as Record<string, unknown>).notes as string)
      : null);

  return {
    ref,
    status: null,
    customerName: d.customer?.name ?? null,
    customerEmail: d.customer?.email ?? null,
    customerPhone: d.customer?.phone ?? null,
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
    pdfUrl: d.pdf?.original_url ?? d.pdf?.url ?? null,
    previewImageUrl: d.preview_image_url ?? null,
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
    customerName: detail.customerName ?? raw.customer?.name ?? null,
    customerEmail: detail.customerEmail ?? raw.customer?.email ?? null,
    customerPhone: detail.customerPhone ?? raw.customer?.phone ?? null,
  };
}
