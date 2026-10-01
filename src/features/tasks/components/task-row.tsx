import { useRef } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
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
 * Three gestures, each with one meaning, because the row has three jobs and a
 * row where a tap might do any of them is a row nobody trusts:
 *
 *  - TAP          opens the lead — the offer, the customer, the configuration.
 *  - SWIPE RIGHT  closes it: reveals a green Done and opens the outcome sheet.
 *  - SWIPE LEFT   hands it to somebody.
 *  - LONG-PRESS   starts picking several, for assigning a batch at once.
 *
 * Nothing is written by the gesture itself. Both swipes open a sheet, so a
 * pocket swipe costs a dismissal, not a closed task on a real customer.
 *
 * Address and phone each keep a tap of their own. Standing in a doorway, the
 * thing you want from a task is not a detail screen, it is directions or a
 * dial tone.
 */
export function TaskRow({
  task,
  bucket,
  canClose,
  canAssign,
  selecting,
  selected,
  onOpen,
  onComplete,
  onAssign,
  onToggleSelect,
}: {
  task: TaskItem;
  bucket: TaskBucket;
  canClose: boolean;
  canAssign: boolean;
  selecting: boolean;
  selected: boolean;
  /** Null on a standalone visit, which has no lead to open. */
  onOpen: (() => void) | null;
  onComplete: () => void;
  onAssign: () => void;
  onToggleSelect: () => void;
}) {
  const t = useT();
  const c = useColors();
  const swipe = useRef<SwipeableMethods>(null);

  const rail = task.type?.colorHex ?? c.mutedForeground;
  const typeLabel = followUpTypeLabel(t, task.type);

  // Overdue shouts, today warns, the rest is just information. Anything further
  // out than tomorrow carries its date too, because "14:30" with no day on a
  // row three groups down reads as today and gets worked in the wrong order.
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
    <ReanimatedSwipeable
      ref={swipe}
      // While picking a batch the row is a checkbox, not a swipe target: a
      // sheet opening mid-selection would throw away what was picked.
      enabled={!selecting && (canClose || canAssign)}
      friction={2}
      leftThreshold={48}
      rightThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        canClose
          ? () => <SwipeAction icon="checkmark" label={t('tasks.complete')} color={c.success} />
          : undefined
      }
      renderRightActions={
        canAssign
          ? () => (
              <SwipeAction
                icon="person-add-outline"
                label={t('tasks.assign.action')}
                color={c.foreground}
                align="right"
              />
            )
          : undefined
      }
      onSwipeableOpen={(direction) => {
        // Snap shut straight away: the sheet is the feedback, and a row left
        // hanging open behind it is a row the dealer has to tidy up after.
        swipe.current?.close();
        haptic('light');
        if (direction === SwipeDirection.RIGHT) onComplete();
        else onAssign();
      }}
    >
      <Pressable
        onPress={selecting ? onToggleSelect : (onOpen ?? undefined)}
        onLongPress={canAssign ? onToggleSelect : undefined}
        delayLongPress={300}
        accessibilityRole={selecting || onOpen ? 'button' : undefined}
        accessibilityState={selecting ? { selected } : {}}
        // Opaque: the swipe panels sit behind this, and a transparent row would
        // let the green through while it is being dragged over.
        className="flex-row items-start gap-3 bg-background py-2.5 active:opacity-70"
      >
        {selecting ? (
          <View
            className="mt-0.5 h-6 w-6 items-center justify-center rounded-full border-2"
            style={{
              borderColor: selected ? c.foreground : c.border,
              backgroundColor: selected ? c.foreground : 'transparent',
            }}
          >
            {selected ? <Ionicons name="checkmark" size={14} color={c.background} /> : null}
          </View>
        ) : (
          <View className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rail }} />
        )}

        <View className="flex-1 gap-1">
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
              disabled={selecting}
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
              disabled={selecting}
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

            {/* Who owns it, and the way to change that for this one row. Inside
                the "Mine" chip it is noise; in "Everyone" it is the one thing
                that decides whether the row is yours to act on — and an
                "Unassigned" nobody can tap is a dead end. */}
            <Pressable
              onPress={canAssign && !selecting ? onAssign : undefined}
              disabled={!canAssign || selecting}
              hitSlop={8}
              accessibilityRole={canAssign ? 'button' : undefined}
              className="flex-1 flex-row items-center justify-end gap-1"
            >
              <Text
                className="text-[11px]"
                numberOfLines={1}
                style={{
                  color: task.assignee ? c.mutedForeground : c.foreground,
                  textDecorationLine: canAssign ? 'underline' : 'none',
                }}
              >
                {task.assignee?.name ?? t('tasks.unassigned')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** The coloured panel a swipe pulls out from under the row. */
function SwipeAction({
  icon,
  label,
  color,
  align = 'left',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  align?: 'left' | 'right';
}) {
  const c = useColors();

  return (
    <View
      className="my-1 justify-center rounded-xl px-4"
      style={{ backgroundColor: color, alignItems: align === 'left' ? 'flex-start' : 'flex-end' }}
    >
      <View className="items-center gap-0.5">
        <Ionicons name={icon} size={18} color={c.background} />
        <Text className="text-[11px] font-semibold" style={{ color: c.background }}>
          {label}
        </Text>
      </View>
    </View>
  );
}
