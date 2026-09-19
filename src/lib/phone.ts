import type { Locale } from '@/lib/i18n';

/**
 * Turning a stored phone number into one you can dial.
 *
 * Numbers arrive exactly as the customer typed them into the funnel, which in
 * practice means national notation: "0612345678", "06 12 34 56 78",
 * "(06) 1234-5678". That is fine for a human and useless to `tel:` from
 * abroad — and fatal for wa.me, which only ever accepts a full international
 * number and answers "isn't on WhatsApp" for anything else, no matter how real
 * the number is. That error message is what sent us here.
 *
 * So the trunk prefix has to be swapped for a country code. Which country is
 * not guessable from the digits: 0612345678 is a Dutch mobile and an equally
 * plausible Belgian landline. It comes from the customer's own address, and
 * only when that says nothing does the app fall back to the locale it is
 * running in — a dealer working in Dutch is calling Dutch numbers.
 */

/** Dial codes for the markets Zinevu sells in, plus the neighbours it borders. */
const DIAL_CODE: Record<string, string> = {
  NL: '31',
  BE: '32',
  DE: '49',
  FR: '33',
  TR: '90',
  LU: '352',
  GB: '44',
  AT: '43',
  CH: '41',
  ES: '34',
  IT: '39',
  PL: '48',
  DK: '45',
  SE: '46',
  NO: '47',
  IE: '353',
  PT: '351',
};

/** Where a locale is spoken, for the case where the lead carries no country. */
const LOCALE_COUNTRY: Record<Locale, string> = {
  nl: 'NL',
  en: 'NL',
  de: 'DE',
  fr: 'FR',
  tr: 'TR',
};

/**
 * The dial code to assume for a national number.
 *
 * `callingCode` is what the API already resolved from the customer's country
 * (`address.country_info.calling_code`); the ISO code is the same fact one step
 * earlier, for rows whose country never got expanded.
 */
export function dialCode(
  callingCode: string | null | undefined,
  country: string | null | undefined,
  locale: Locale
): string {
  const explicit = callingCode?.replace(/\D/g, '');
  if (explicit) return explicit;

  const iso = country?.trim().toUpperCase();
  if (iso && DIAL_CODE[iso]) return DIAL_CODE[iso];

  return DIAL_CODE[LOCALE_COUNTRY[locale]];
}

/**
 * The number in E.164, digits only — the form both `tel:` and wa.me want.
 *
 * Null for anything too short to be a phone number, so a half-filled field
 * leaves the buttons dead rather than opening WhatsApp on nonsense.
 */
export function toE164(
  raw: string | null | undefined,
  code: string
): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  // Only a leading + counts as "already international". A + anywhere else is
  // punctuation in a number someone typed by hand.
  const international = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) return null;

  if (!international) {
    if (digits.startsWith('00')) {
      // 0031 6… — the written-out international prefix.
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      // The national trunk prefix: it exists so you can omit the country code,
      // and it is dropped when you put the country code back.
      digits = code + digits.replace(/^0+/, '');
    } else if (!digits.startsWith(code)) {
      // No prefix at all ("612345678"). Already starting with the country code
      // is left alone — re-prefixing would give 3131….
      digits = code + digits;
    }
  }

  // Shortest real E.164 subscriber numbers run to about eight digits with the
  // country code; below that it is a typo, not a number.
  return digits.length >= 8 ? digits : null;
}
