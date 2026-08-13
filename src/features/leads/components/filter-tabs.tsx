import { Pressable, ScrollView, Text, View } from 'react-native';

import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { LEAD_TABS, type LeadTab } from '@/features/leads/types';

/**
 * The status filter, as a row of chips.
 *
 * Horizontally scrollable rather than four equal segments: the labels are words
 * in five languages, and "Niet akkoord" does not fit a quarter of a phone. A
 * scrolling row lets each chip be as wide as its own word instead of truncating
 * all four to the longest one's share.
 *
 * The count rides in the chip because it answers the question the chip raises —
 * a dealer taps "Approved" to find out how many, and reading it first saves the
 * tap.
 */
export function FilterTabs({
  value,
  onChange,
  counts,
}: {
  value: LeadTab;
  onChange: (tab: LeadTab) => void;
  counts: Record<LeadTab, number>;
}) {
  const t = useT();
  const c = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 4 }}
    >
      {LEAD_TABS.map((tab) => {
        const active = tab === value;

        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            accessibilityRole="button"
            accessibilityState={active ? { selected: true } : {}}
            className="flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{
              backgroundColor: active ? c.foreground : c.muted,
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: active ? c.background : c.foreground }}
            >
              {t(`leads.tab.${tab}` as MessageKey)}
            </Text>
            {counts[tab] > 0 ? (
              <View
                className="rounded-full px-1.5"
                style={{ backgroundColor: active ? c.background : c.card }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: active ? c.foreground : c.mutedForeground }}
                >
                  {counts[tab]}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
