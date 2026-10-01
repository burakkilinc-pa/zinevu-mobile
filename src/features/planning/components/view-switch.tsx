import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';

/**
 * The planning tab's two faces: the month, and the queue.
 *
 * They are one tab rather than two because they are one record — `lead_tasks` —
 * asked two different questions: "what is my week shaped like" and "what have I
 * not done yet". The dock has four side slots around the brand mark and no
 * fifth, so the choice was this control or burying a screen the office works
 * out of all day inside the More sheet.
 *
 * The calendar stays the default. It is what the tab has always opened on, and
 * a tab that opens somewhere new because a feature shipped is a tab that feels
 * broken to the person who used it yesterday.
 */
export type PlanningView = 'calendar' | 'tasks';

const ICONS: Record<PlanningView, keyof typeof Ionicons.glyphMap> = {
  calendar: 'calendar-outline',
  tasks: 'checkbox-outline',
};

export function ViewSwitch({
  value,
  onChange,
  taskCount,
}: {
  value: PlanningView;
  onChange: (next: PlanningView) => void;
  /** Open tasks, so the chip can say what is waiting on the other side. */
  taskCount?: number;
}) {
  const t = useT();
  const c = useColors();

  return (
    <View className="px-5 pb-1 pt-2">
      <View className="flex-row rounded-full p-1" style={{ backgroundColor: c.muted }}>
        {(['calendar', 'tasks'] as PlanningView[]).map((view) => {
          const active = view === value;

          return (
            <Pressable
              key={view}
              onPress={() => onChange(view)}
              accessibilityRole="button"
              accessibilityState={active ? { selected: true } : {}}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2"
              style={{ backgroundColor: active ? c.background : 'transparent' }}
            >
              <Ionicons
                name={ICONS[view]}
                size={15}
                color={active ? c.foreground : c.mutedForeground}
              />
              <Text
                className="text-sm font-medium"
                style={{ color: active ? c.foreground : c.mutedForeground }}
              >
                {t(view === 'calendar' ? 'tasks.viewCalendar' : 'tasks.viewTasks')}
              </Text>
              {view === 'tasks' && taskCount ? (
                <View className="rounded-full px-1.5" style={{ backgroundColor: c.foreground }}>
                  <Text className="text-[10px] font-semibold" style={{ color: c.background }}>
                    {taskCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
