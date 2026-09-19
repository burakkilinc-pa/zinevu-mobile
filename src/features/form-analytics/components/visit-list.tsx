import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import { decayStatus } from '@/features/form-analytics/format';
import { VisitRow } from '@/features/form-analytics/components/visit-row';
import type { Visit } from '@/features/form-analytics/types';

/** How many rows show before "Show more" — a screenful, not the API's fifty. */
const PAGE = 15;

/**
 * The period's latest visits, newest activity first, each one a way into its
 * timeline.
 *
 * Paged locally: the API returns up to fifty, and fifty rows under a funnel is
 * a scroll nobody finishes. The rest are one tap away rather than gone.
 */
export function VisitList({
  visits,
  now,
  onOpen,
}: {
  visits: Visit[];
  /** The clock statuses are judged against — see decayStatus. */
  now: number;
  onOpen: (sessionId: string) => void;
}) {
  const t = useT();
  const [shown, setShown] = useState(PAGE);

  const rows = visits.slice(0, shown);

  return (
    <Card className="overflow-hidden">
      {rows.map((visit, index) => (
        <VisitRow
          key={visit.sessionId}
          visit={visit}
          status={decayStatus(visit, now)}
          divider={index > 0}
          onPress={() => onOpen(visit.sessionId)}
        />
      ))}
      {visits.length > shown ? (
        <Pressable
          onPress={() => setShown((n) => n + PAGE)}
          accessibilityRole="button"
          className="items-center border-t border-border py-3 active:bg-muted"
        >
          <Text className="text-sm font-semibold text-foreground">
            {t('formAnalytics.visits.showMore')}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
