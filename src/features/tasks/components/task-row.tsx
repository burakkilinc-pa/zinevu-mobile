import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { clockTime, shortDate } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import { followUpIcon } from '@/features/planning/icons';
import { followUpTypeLabel } from '@/features/planning/type-label';
import type { TaskBucket, TaskItem } from '@/features/tasks/types';

/**
 * One task in the queue.
 *
 * The circle on the left is the whole point of the screen: the office works
 * through this list by closing things, and a list that makes you open a detail
 * screen to tick one off is a list nobody keeps up to date. Pressing it opens
 * the outcome sheet rather than closing the task outright — the dealer's
 * reporting runs on what happened, not on the fact that something happened.
 *
 * Pressing the row itself opens the lead, which is where the customer, the
 * offer and the configuration are. A standalone visit has no fuller place to
 * go, so it carries its own contact and stays put.
 *
 * Address and phone each get a tap of their own. Standing in a doorway, the
 * thing you want from a task is not a detail screen, it is directions or a
 * dial tone.
 */
export function TaskRow({
  task,
  bucket,
  canClose,
  onComplete,
  onOpenLead,
}: {
  task: TaskItem;
  bucket: TaskBucket;
  canClose: boolean;
  onComplete: () => void;
  onOpenLead: (() => void) | null;
}) {
  const t = useT();
  const c = useColors();

  const rail = task.type?.colorHex ?? c.mutedForeground;
  const typeLabel = followUpTypeLabel(t, task.type);

  // Overdue shouts, today warns, the rest is just information. Anything further
  // out than tomorrow carries its date too, because "14:30" with no day on a
  // card three columns down reads as today and gets worked in the wrong order.
  const dueTone =
    bucket === 'overdue' ? c.destructive : bucket === 'today' ? c.warning : c.mutedForeground;
  const withDate = bucket !== 'today' && bucket !== 'tomorrow';

  // "Op locatie" / "bezig" — crew progress, which outranks the plain status
  // because it is the more recent, more specific truth about the same visit.
  const progress = task.workStartedAt
    ? t('planning.progress.working')
    : task.onSiteAt
      ? t('planning.progress.onSite')
      : null;

  return (
    <View className="flex-row items-start gap-3 py-2.5">
      {canClose ? (
        <Pressable
          onPress={() => {
            haptic('light');
            onComplete();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('tasks.complete')}
          className="mt-0.5 h-7 w-7 items-center justify-center rounded-full border-2 active:opacity-60"
          style={{ borderColor: rail }}
        />
      ) : (
        <View
          className="mt-1.5 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: rail }}
        />
      )}

      <Pressable
        onPress={onOpenLead ?? undefined}
        disabled={!onOpenLead}
        accessibilityRole={onOpenLead ? 'button' : undefined}
        className="flex-1 gap-1 active:opacity-70"
      >
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-[15px] font-medium text-foreground" numberOfLines={2}>
            {task.title || typeLabel || t('planning.untitled')}
          </Text>

          {task.dueAt ? (
            <View className="items-end">
              {withDate ? (
                <Text className="text-[11px]" style={{ color: dueTone }}>
                  {shortDate(task.dueAt)}
                </Text>
              ) : null}
              <Text className="text-xs font-semibold" style={{ color: dueTone }}>
                {clockTime(task.dueAt)}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1.5">
          <Ionicons
            name={followUpIcon(task.typeIconKey, task.type?.behavior ?? 'reminder')}
            size={13}
            color={rail}
          />
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {[typeLabel, task.customerName].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {task.locationAddress ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={6}
            onPress={() =>
              Linking.openURL(
                // The OS picks the map app the user actually uses.
                `https://maps.apple.com/?daddr=${encodeURIComponent(task.locationAddress!)}`
              )
            }
            className="flex-row items-center gap-1"
          >
            <Ionicons name="navigate-outline" size={12} color={c.mutedForeground} />
            <Text className="flex-1 text-xs text-muted-foreground underline" numberOfLines={1}>
              {task.locationAddress}
            </Text>
          </Pressable>
        ) : null}

        {task.contactPhone ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={6}
            onPress={() => Linking.openURL(`tel:${task.contactPhone}`)}
            className="flex-row items-center gap-1"
          >
            <Ionicons name="call-outline" size={12} color={c.mutedForeground} />
            <Text className="text-xs text-muted-foreground underline">{task.contactPhone}</Text>
          </Pressable>
        ) : null}

        <View className="flex-row items-center gap-2">
          {progress ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="ellipse" size={7} color={c.warning} />
              <Text className="text-[11px]" style={{ color: c.warning }}>
                {progress}
              </Text>
            </View>
          ) : null}

          {task.offerNo ? (
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: c.muted }}>
              <Text className="text-[10px] font-medium text-muted-foreground">
                {task.offerNo}
              </Text>
            </View>
          ) : null}

          {task.attachmentCount > 0 ? (
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="attach-outline" size={12} color={c.mutedForeground} />
              <Text className="text-[11px] text-muted-foreground">{task.attachmentCount}</Text>
            </View>
          ) : null}

          {/* Who owns it. Last, and quiet: inside the "Mine" chip it is noise,
              and in "Everyone" it is the one thing that decides whether the row
              is yours to act on. */}
          <Text className="flex-1 text-right text-[11px] text-muted-foreground" numberOfLines={1}>
            {task.assignee?.name ?? t('tasks.unassigned')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
