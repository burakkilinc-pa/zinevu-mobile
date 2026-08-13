/** Cents → a plain editable amount ("1234.5" for 123450), no thousand marks. */
export function centsToInput(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2).replace(/\.00$/, '');
}

/**
 * Parses a typed amount into cents, accepting both the Turkish comma and a
 * dot as the decimal mark. Returns null when the text isn't a number.
 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Formats integer cents as a localized currency string (default EUR, tr-TR). */
export function formatMoney(cents: number, currency = 'eur'): string {
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
