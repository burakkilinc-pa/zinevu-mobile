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
  MIN_SEARCH,
  useAssigneeFilter,
  useCanAssignTasks,
  useCanCloseTasks,
  useTaskQueue,
  useTaskSearch,
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
 *
 * Given a `term` it shows a LOOKUP instead: the same rows, the same gestures,
 * but over everything the dealer has rather than over what is still open. The
 * screen is the same one on purpose — finding a task and then closing it or
 * handing it on is one errand, and a results list you can only read would send
 * them back to the queue to do the thing they came for.
 */
export function TaskQueue({ term = '' }: { term?: string }) {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const bottom = useDockClearance();

  const [assignee, setAssignee] = useAssigneeFilter();
  const queue = useTaskQueue(assignee);
  const search = useTaskSearch(term);
  const team = useTaskTeam();

  const typed = term.trim();
  const searching = typed.length > 0;
  const tooShort = searching && typed.length < MIN_SEARCH;
  const canClose = useCanCloseTasks();
  const canAssign = useCanAssignTasks();

  // Driven by the PULL alone, never by `isRefetching`.
  //
  // A background refetch — the one TanStack runs when this screen remounts on
  // stale data — would otherwise raise the pull spinner with nobody pulling,
  // and iOS leaves that indicator stranded until the list is touched again. It
  // is also the wrong thing to say: a refresh the dealer did not ask for should
  // not look like one they did.
  const [pulling, setPulling] = useState(false);

  async function pullToRefresh() {
    setPulling(true);
    try {
      await (searching ? search.refetch() : queue.refetch());
    } finally {
      setPulling(false);
    }
  }

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

  // Results and queue are different sets, so a selection made in one must not
  // survive into the other.
  const [lastTerm, setLastTerm] = useState(typed);
  if (typed !== lastTerm) {
    setLastTerm(typed);
    if (selected.size > 0) setSelected(new Set());
  }

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

  const byBucket = searching ? search.byBucket : queue.byBucket;
  const sections = TASK_BUCKETS.map((bucket) => ({
    bucket,
    data: byBucket[bucket],
  })).filter((section) => section.data.length > 0);

  const loading = searching ? search.isLoading : queue.isLoading;
  const failed = searching ? search.isError : queue.isError;

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
      ) : searching ? (
        // What the term found, in place of the chips it replaced. The chips
        // filter the queue and have no meaning over a lookup that already spans
        // everybody's work.
        <View className="px-5 py-2.5">
          <Text className="text-xs text-muted-foreground">
            {tooShort
              ? t('tasks.search.short', { n: MIN_SEARCH })
              : search.isLoading
                ? t('common.loading')
                : t('tasks.search.results', { count: search.total })}
          </Text>
        </View>
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
        // Cards, not rows: the swipe panel is as tall as the card it comes out
        // from, so the gap has to sit outside both.
        SectionSeparatorComponent={() => <View className="h-1.5" />}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={() => void pullToRefresh()}
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
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator className="py-16" color={c.mutedForeground} />
          ) : failed ? (
            <Text className="py-16 text-center text-sm text-destructive">
              {t('common.error')}
            </Text>
          ) : searching ? (
            <View className="items-center gap-2 py-16">
              <Ionicons name="search-outline" size={28} color={c.mutedForeground} />
              <Text className="text-base font-medium text-foreground">
                {tooShort ? t('tasks.search.short', { n: MIN_SEARCH }) : t('tasks.search.none')}
              </Text>
              <Text className="text-sm text-muted-foreground">{t('tasks.search.hint')}</Text>
            </View>
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
    <View className="flex-row items-center gap-2 bg-background pb-2 pt-3">
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
