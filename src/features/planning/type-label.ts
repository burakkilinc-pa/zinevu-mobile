import type { FollowUpType } from '@/features/planning/types';
import type { useT } from '@/lib/i18n';

/**
 * The dealer's follow-up catalogue is DATA, not UI: the backend seeds every new
 * dealer with a Dutch list ("Bellen", "Showroombezoek", "Productie / Inkoop")
 * and the app renders whatever the row says. A Turkish or German dealer would
 * therefore read a Dutch picker inside an otherwise translated screen.
 *
 * The seeded rows carry a stable slug, so those we can translate. A row the
 * dealer typed themselves has no slug we know, and a row they RENAMED is their
 * own wording — both must survive untouched. That is what the name check is
 * for: only a type still carrying its seeded Dutch default is treated as a
 * label the backend chose rather than the dealer.
 */
const SEEDED: Record<string, string> = {
  call: 'Bellen',
  email: 'E-mail',
  showroom_visit: 'Showroombezoek',
  measurement: 'Inmeten op locatie',
  installation: 'Montage',
  service: 'Service',
  pickup: 'Afhalen',
  delivery: 'Bezorgen',
  other: 'Overig',
  production: 'Productie / Inkoop',
  purchase: 'Inkoop',
};

export function followUpTypeLabel(
  t: ReturnType<typeof useT>,
  type: Pick<FollowUpType, 'name' | 'slug'> | null | undefined
): string {
  const name = type?.name?.trim() ?? '';
  const slug = type?.slug ?? '';
  if (!slug || SEEDED[slug] !== name) return name;

  return t(`planning.type.${slug}` as Parameters<typeof t>[0]);
}
