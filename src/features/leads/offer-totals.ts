/**
 * The offer summary block, computed on the phone.
 *
 * A deliberate port of App\Services\DealTotalService::compute() — the same
 * formula the stored `deals.total`, the customer offer page and the PDF all
 * run. It lives here so the editor can show a total that MOVES as the dealer
 * types, without a round-trip per keystroke; the server still recomputes and
 * wins on save.
 *
 * The quirks are the backend's and are kept on purpose:
 *  - the subtotal is INCL VAT, and the discount comes off that (so VAT scales
 *    down with the discount);
 *  - per-line rounding happens before summing, not after;
 *  - a pinned final total wins over the discount percentage, and the discount
 *    is then derived from the gap so the block still reconciles to the cent.
 */

export type TotalsLine = {
  quantity: number;
  price: number;
  vatRate: number;
};

export type OfferTotals = {
  /** Gross, incl VAT. */
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTotals(
  lines: TotalsLine[],
  discountRate = 0,
  finalTotalOverride: number | null = null
): OfferTotals {
  let subtotalInclVat = 0;
  let vatRaw = 0;

  for (const line of lines) {
    const lineEx = (line.quantity || 0) * (line.price || 0);
    subtotalInclVat += round2(lineEx * (1 + (line.vatRate || 0) / 100));
    vatRaw += round2(lineEx * ((line.vatRate || 0) / 100));
  }

  const subtotal = round2(subtotalInclVat);

  if (finalTotalOverride !== null && subtotal > 0) {
    // The pin is a discount target, so it can never exceed the gross — the
    // backend clamps it the same way, and without that a stale pin left over
    // from a longer line list would show a negative discount.
    const total = round2(Math.min(finalTotalOverride, subtotal));
    const factor = total / subtotal;

    return {
      subtotal,
      discount: round2(subtotal - total),
      vat: round2(vatRaw * factor),
      total,
    };
  }

  const discount = round2(subtotal * (discountRate / 100));

  return {
    subtotal,
    discount,
    vat: round2(vatRaw * (1 - discountRate / 100)),
    total: round2(subtotal - discount),
  };
}
