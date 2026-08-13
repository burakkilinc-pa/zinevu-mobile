import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/card';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import type { ActionSeverity, DashboardAction } from '@/features/dashboard/types';

/**
 * "Action required" — the one list a dealer should be able to work top-down
 * every morning.
 *
 * Ordering and membership are the API's call, not this component's: it already
 * knows a failed offer send outranks an unread message, and it drops zero-count
 * rows server-side so a quiet day renders nothing rather than a wall of "0".
 *
 * Severity is never colour alone — each row carries its own icon, and critical
 * rows say so in words.
 */

const SEVERITY_ICON: Record<ActionSeverity, keyof typeof Ionicons.glyphMap> = {
  critical: 'alert-circle',
  warning: 'time',
  info: 'information-circle',
};

/**
 * Where each action lands in the app.
 *
 * The API's `href` is a portal path, and most of them have no mobile screen —
 * production orders, invoicing and onboarding are desk work. Rather than open a
 * browser mid-task or navigate somewhere unrelated, an unmapped row renders as
 * a plain (non-tappable) row: it still tells you the thing is waiting.
 */
const ROUTE: Record<string, string> = {
  send_failed: '/leads?filter=new',
  needs_review: '/leads?filter=new',
  uncontacted: '/leads?filter=new',
  hot_leads: '/leads?filter=sent',
  offer_stale: '/leads?filter=sent',
  silent_leads: '/leads?filter=sent',
  signed_no_next_step: '/leads?filter=approved',
  inbox_awaiting_reply: '/chat',
  inbox_unread: '/chat',
  tasks_overdue: '/planning',
  tasks_due_today: '/planning',
};

export function ActionList({ actions }: { actions: DashboardAction[] }) {
  const t = useT();
  const c = useColors();
  const router = useRouter();

  if (actions.length === 0) {
    return (
      <Card className="items-center gap-2 p-6">
        <Ionicons name="checkmark-circle" size={26} color={c.success} />
        <Text className="text-base font-semibold text-foreground">
          {t('dash.actions.clearTitle')}
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          {t('dash.actions.clearBody')}
        </Text>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {actions.map((action, index) => {
        const route = ROUTE[action.key];
        const tint = action.severity === 'critical' ? c.destructive : c.mutedForeground;

        const row = (
          <View
            className="flex-row items-center gap-3 px-4 py-3.5"
            style={index > 0 ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}
          >
            <Ionicons name={SEVERITY_ICON[action.severity]} size={18} color={tint} />
            <View className="flex-1">
              <Text className="text-[15px] text-foreground" numberOfLines={1}>
                {/* Labels are keyed off the API's stable action key. An action
                    added server-side lands here untranslated rather than
                    missing, so a new queue is never silently invisible. */}
                {t(`dash.action.${action.key}` as MessageKey)}
              </Text>
              {action.severity === 'critical' ? (
                <Text className="text-xs" style={{ color: tint }}>
                  {t('dash.severity.critical')}
                </Text>
              ) : null}
            </View>
            <Text className="text-base font-bold text-foreground">{action.count}</Text>
            {route ? (
              <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
            ) : null}
          </View>
        );

        return route ? (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            onPress={() => router.push(route as never)}
            className="active:bg-muted"
          >
            {row}
          </Pressable>
        ) : (
          <View key={action.key}>{row}</View>
        );
      })}
    </Card>
  );
}
