import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui/screen';
import { SearchField } from '@/components/ui/search-field';
import { useColors } from '@/lib/theme';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { useT } from '@/lib/i18n';
import { CalendarPane } from '@/features/planning/components/calendar-pane';
import { ViewSwitch, type PlanningView } from '@/features/planning/components/view-switch';
import { TaskQueue } from '@/features/tasks/components/task-queue';
import { useTaskQueue, useTaskSearch } from '@/features/tasks/hooks/use-tasks';
import { useAuthStore } from '@/features/auth/store';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';

/**
 * The planning tab — one screen with two faces over the same records.
 *
 *  - the MONTH, with the selected day's agenda under it (CalendarPane)
 *  - the QUEUE: every open task grouped by how late it is (features/tasks)
 *
 * Both read `lead_tasks`, and neither can do the other's job. A calendar cannot
 * show an undated task at all, and the undated backlog is where the office
 * actually works from; a queue cannot show how a week is shaped. So they share a
 * tab rather than competing for one of the dock's four side slots.
 *
 * Two routes would have been the other option, and would have cost the dock a
 * slot it does not have — the brand mark only reads as the hero dead centre,
 * which is what fixes the side count at an even number (see (tabs)/_layout).
 *
 * SEARCH SITS ABOVE BOTH, and takes over from whichever face is showing. It is
 * one field because it is one question — "where is the thing for this customer"
 * — and the answer is the same list of tasks whether you were looking at a
 * month or at a queue when you asked. Typing in it is also the only way to
 * reach a FINISHED task from this screen: the queue is open work by definition
 * and the calendar only knows the month you are standing in.
 *
 * It is a BUTTON until it is used, though, sharing the switch's row. Standing
 * open it cost a 48pt band of its own, and on the calendar face this screen is
 * already four stacked controls deep — switch, month header, lane chips, grid —
 * before the agenda gets a pixel. Search is also the rarest of the four: the
 * month is what the tab is opened for. So it waits as a magnifier beside the
 * switch, and takes the row when asked.
 */
export default function PlanningScreen() {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const { date, view: viewParam } = useLocalSearchParams<{ date?: string; view?: string }>();

  const canCalendar = hasPermission(user, PERMISSIONS.calendarView);
  const canTasks = hasPermission(user, PERMISSIONS.tasksView);

  // Someone holding only one of the two never sees a switch, and lands on the
  // one they hold — the other face would be a permission placeholder, which is
  // not a thing to offer a person as a choice.
  const [view, setView] = useState<PlanningView>(() =>
    viewParam === 'tasks' || (!canCalendar && canTasks) ? 'tasks' : 'calendar'
  );

  // Deep links win over whatever the screen last showed: a push about a day is
  // about the calendar, and ?view=tasks is about the queue.
  //
  // Derived during render rather than in an effect. A second push arriving while
  // the tab is already mounted has to move it, and an effect doing that renders
  // the wrong face first and corrects it — a visible flip on the screen the push
  // just opened.
  const link = `${date ?? ''}|${viewParam ?? ''}`;
  const [lastLink, setLastLink] = useState(link);
  if (link !== lastLink) {
    setLastLink(link);
    if (date) setView('calendar');
    else if (viewParam === 'tasks') setView('tasks');
  }

  // The field moves on every keystroke; the request waits for the typing to
  // settle, so a surname costs one round trip instead of seven.
  const [typed, setTyped] = useState('');
  const settled = useDebounced(typed);
  const searching = typed.trim().length > 0;

  // Open is its own state rather than `typed.length > 0`: a field that vanished
  // the moment it was emptied would take the keyboard and the caret with it
  // halfway through a correction.
  const [searchOpen, setSearchOpen] = useState(false);

  // Same query key the results list uses, so this is the one request rather
  // than a second — it is here only to tell the field when it is behind.
  const search = useTaskSearch(settled);

  // Shares its query key with the queue itself, so this is the same single
  // fetch rather than a second one — and it is what makes the other face
  // discoverable: a tab that silently grew a second page is a tab nobody finds.
  const openCount = useTaskQueue('all').counts.all;

  const both = canCalendar && canTasks;
  const showing: PlanningView = both ? view : canTasks ? 'tasks' : 'calendar';

  return (
    <Screen padded={false} edges={['top']}>
      {searchOpen ? (
        <SearchField
          value={typed}
          onChange={setTyped}
          placeholder={t('tasks.search.placeholder')}
          busy={searching && (search.isFetching || typed !== settled)}
          autoFocus
          onDismiss={() => setSearchOpen(false)}
        />
      ) : both || canTasks ? (
        <View className="flex-row items-center gap-2 px-5 pb-1.5 pt-2">
          {both ? (
            <ViewSwitch value={showing} onChange={setView} taskCount={openCount} />
          ) : (
            <View className="flex-1" />
          )}
          {canTasks ? <SearchButton onPress={() => setSearchOpen(true)} /> : null}
        </View>
      ) : null}

      {searching ? (
        <TaskQueue term={settled} />
      ) : showing === 'tasks' ? (
        <TaskQueue />
      ) : (
        <CalendarPane />
      )}
    </Screen>
  );
}

/**
 * Search, folded up.
 *
 * The same white face and hairline the open field wears, so the row reads as
 * one material rather than as a control with an ornament bolted to its end.
 */
function SearchButton({ onPress }: { onPress: () => void }) {
  const t = useT();
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('common.search')}
      className="items-center justify-center rounded-full active:opacity-70"
      style={{
        width: 42,
        height: 42,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Ionicons name="search-outline" size={18} color={c.foreground} />
    </Pressable>
  );
}
