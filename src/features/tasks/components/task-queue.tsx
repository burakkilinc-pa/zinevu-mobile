import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Placeholder } from '@/components/ui/placeholder';
import { useDockClearance } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { AssigneeChips } from '@/features/tasks/components/assignee-chips';
import { AssignSheet } from '@/features/tasks/components/assign-sheet';
import { OutcomeSheet } from '@/features/tasks/components/outcome-sheet';
import { TaskRow } from '@/features/tasks/components/task-row';
import {
  useAssigneeFilter,
  useCanAssignTasks,
  useCanCloseTasks,
  useTaskQueue,
  useTaskTeam,
} from '@/features/tasks/hooks/use-tasks';
import { TASK_BUCKETS, type TaskBucket, type TaskItem } from '@/features/tasks/types';

/**
 * The work queue: every open task, grouped by how late it is.
 *
 * Six groups in the portal board's order — Overdue · Today · Tomorrow · This
 * week · Later · No date — because this is the same list the office reads on
 * their desktop all day, and a phone that groups it differently makes them
 * translate between two mental models of their own work.
 *
 * A group with nothing in it is left out entirely rather than rendered empty.
 * The portal keeps empty columns because a board's columns are its layout; a
 * phone list has no such obligation, and six headers over four tasks reads as a
 * screen that is mostly headings.
 *
 * Long-pressing a row starts picking a batch, and the filter row turns into the
 * batch's toolbar. One sheet assigns one row or twenty — see AssignSheet.
 */
export function TaskQueue() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();

  const [assignee, setAssignee] = useAssigneeFilter();
  const queue = useTaskQueue(assignee);
  const team = useTaskTeam();
  const canClose = useCanCloseTasks();
  const canAssign = useCanAssignTasks();

  const [closing, setClosing] = useState<TaskItem | null>(null);
  const [assigning, setAssigning] = useState<number[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());

  // Switching chips changes which rows are on screen, so a selection made under
  // the old one would act on tasks the dealer can no longer see. Derived during
  // render rather than in an effect — an effect would let one frame through
  // with the stale toolbar still up.
  const [lastFilter, setLastFilter] = useState(assignee);
  if (assignee !== lastFilter) {
    setLastFilter(assignee);
    if (selected.size > 0) setSelected(new Set());
  }

  const selecting = selected.size > 0;

  function toggle(id: number) {
    haptic('selection');
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);

      return next;
    });
  }

  if (!queue.allowed) {
    return (
      <Placeholder
        icon="lock-closed-outline"
        title={t('tasks.noAccess.title')}
        subtitle={t('tasks.noAccess.body')}
      />
    );
  }

  const sections = TASK_BUCKETS.map((bucket) => ({
    bucket,
    data: queue.byBucket[bucket],
  })).filter((section) => section.data.length > 0);

  return (
    <View className="flex-1">
      {/* Same slot either way, so starting a selection does not shove the list
          down a row. */}
      {selecting ? (
        <SelectionBar
          count={selected.size}
          onCancel={() => setSelected(new Set())}
          onAssign={() => setAssigning(Array.from(selected))}
        />
      ) : (
        <AssigneeChips
          value={assignee}
          onChange={setAssignee}
          team={team.data ?? []}
          counts={queue.counts}
        />
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        stickySectionHeadersEnabled
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: bottom + 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={queue.isRefetching}
            onRefresh={() => void queue.refetch()}
            tintColor={c.mutedForeground}
          />
        }
        renderSectionHeader={({ section }) => (
          <GroupHeader bucket={section.bucket} count={section.data.length} />
        )}
        renderItem={({ item, section }) => (
          <TaskRow
            task={item}
            bucket={section.bucket}
            canClose={canClose}
            canAssign={canAssign}
            selecting={selecting}
            selected={selected.has(item.id)}
            onOpen={item.leadRef ? () => router.push(`/leads/${item.leadRef}`) : null}
            onComplete={() => setClosing(item)}
            onAssign={() => setAssigning([item.id])}
            onToggleSelect={() => toggle(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        ListEmptyComponent={
          queue.isLoading ? (
            <ActivityIndicator className="py-16" color={c.mutedForeground} />
          ) : queue.isError ? (
            <Text className="py-16 text-center text-sm text-destructive">
              {t('common.error')}
            </Text>
          ) : (
            <View className="items-center gap-2 py-16">
              <Ionicons name="checkmark-done-outline" size={28} color={c.mutedForeground} />
              <Text className="text-base font-medium text-foreground">
                {t('tasks.empty.title')}
              </Text>
              <Text className="text-sm text-muted-foreground">{t('tasks.empty.body')}</Text>
            </View>
          )
        }
      />

      <OutcomeSheet task={closing} onClose={() => setClosing(null)} />
      <AssignSheet
        taskIds={assigning}
        onClose={() => setAssigning([])}
        onAssigned={() => setSelected(new Set())}
      />
    </View>
  );
}

/**
 * A group's heading. Sticky, so scrolling deep into "Later" still says which
 * pile you are in — the rows themselves only carry a time, and "14:30" means
 * something very different under Overdue than under Later.
 */
function GroupHeader({ bucket, count }: { bucket: TaskBucket; count: number }) {
  const t = useT();
  const c = useColors();

  const tone =
    bucket === 'overdue' ? c.destructive : bucket === 'today' ? c.warning : c.mutedForeground;

  return (
    <View className="flex-row items-center gap-2 bg-background pb-1.5 pt-3">
      <Text
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: tone }}
      >
        {t(`tasks.group.${bucket}` as MessageKey)}
      </Text>
      <View className="rounded-full px-1.5" style={{ backgroundColor: c.muted }}>
        <Text className="text-[10px] font-semibold text-muted-foreground">{count}</Text>
      </View>
    </View>
  );
}

/** What the filter row becomes once a batch is being picked. */
function SelectionBar({
  count,
  onCancel,
  onAssign,
}: {
  count: number;
  onCancel: () => void;
  onAssign: () => void;
}) {
  const t = useT();
  const c = useColors();

  return (
    <View className="flex-row items-center gap-2 px-5 py-2">
      <Pressable
        onPress={onCancel}
        hitSlop={8}
        accessibilityRole="button"
        className="h-8 w-8 items-center justify-center rounded-full active:bg-muted"
        accessibilityLabel={t('common.cancel')}
      >
        <Ionicons name="close" size={20} color={c.foreground} />
      </Pressable>

      <Text className="flex-1 text-sm font-semibold text-foreground">
        {t('tasks.select.count', { count })}
      </Text>

      <Pressable
        onPress={onAssign}
        accessibilityRole="button"
        className="flex-row items-center gap-1.5 rounded-full px-4 py-2 active:opacity-70"
        style={{ backgroundColor: c.foreground }}
      >
        <Ionicons name="person-add-outline" size={14} color={c.background} />
        <Text className="text-sm font-medium" style={{ color: c.background }}>
          {t('tasks.assign.action')}
        </Text>
      </Pressable>
    </View>
  );
}
