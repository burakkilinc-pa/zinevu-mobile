import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui/screen';
import { CalendarPane } from '@/features/planning/components/calendar-pane';
import { ViewSwitch, type PlanningView } from '@/features/planning/components/view-switch';
import { TaskQueue } from '@/features/tasks/components/task-queue';
import { useTaskQueue } from '@/features/tasks/hooks/use-tasks';
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
 */
export default function PlanningScreen() {
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

  // Shares its query key with the queue itself, so this is the same single
  // fetch rather than a second one — and it is what makes the other face
  // discoverable: a tab that silently grew a second page is a tab nobody finds.
  const openCount = useTaskQueue('all').counts.all;

  const both = canCalendar && canTasks;
  const showing: PlanningView = both ? view : canTasks ? 'tasks' : 'calendar';

  return (
    <Screen padded={false} edges={['top']}>
      {both ? <ViewSwitch value={showing} onChange={setView} taskCount={openCount} /> : null}
      {showing === 'tasks' ? <TaskQueue /> : <CalendarPane />}
    </Screen>
  );
}
