import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { toast } from '@/components/ui/toast';
import { Avatar } from '@/components/ui/avatar';
import { haptic } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { useAssignTasks, useTaskTeam } from '@/features/tasks/hooks/use-tasks';
import { useAuthStore } from '@/features/auth/store';

/**
 * Who does this — for one task or for twenty.
 *
 * One sheet for both cases because it is one call: the endpoint takes an id
 * list, so "assign this row" is the batch of one. The dealer gets the same
 * three answers either way — me, a colleague, nobody.
 *
 * "Take it" sits on top and alone, because it is the answer most often wanted
 * and the one that should not require finding your own name in a list of
 * fourteen. Unassigning sits at the bottom, away from the names, so it is never
 * the thing you hit while reaching for one.
 */
export function AssignSheet({
  taskIds,
  onClose,
  onAssigned,
}: {
  taskIds: number[];
  onClose: () => void;
  /** Fired after a successful write — the queue uses it to drop its selection. */
  onAssigned?: () => void;
}) {
  const t = useT();
  const c = useColors();

  const user = useAuthStore((s) => s.user);
  const team = useTaskTeam();
  const assign = useAssignTasks();

  const meId = user?.id ? Number(user.id) : null;
  const count = taskIds.length;

  function send(assigneeId: number | null) {
    if (count === 0) return;

    assign.mutate(
      { ids: taskIds, assigneeId },
      {
        onSuccess: (updated) => {
          haptic('success');
          toast.success(
            assigneeId === null
              ? t('tasks.assign.cleared', { count: updated })
              : t('tasks.assign.toast', { count: updated })
          );
          onAssigned?.();
          onClose();
        },
        onError: () => {
          haptic('error');
          toast.error(t('tasks.assign.failed'));
        },
      }
    );
  }

  // Your own row is the "Take it" button above; repeating your name in the list
  // would offer the same action twice.
  const colleagues = (team.data ?? []).filter((member) => member.id !== meId);

  return (
    <BottomSheet visible={count > 0} onClose={onClose}>
      <View className="gap-3 pt-3">
        <Text className="text-lg font-bold text-foreground">
          {count > 1 ? t('tasks.assign.titleMany', { count }) : t('tasks.assign.title')}
        </Text>

        <Pressable
          onPress={() => send(meId)}
          disabled={assign.isPending || meId === null}
          accessibilityRole="button"
          className="flex-row items-center gap-3 rounded-xl border border-border p-3 active:opacity-70"
          style={{ backgroundColor: c.muted }}
        >
          <Avatar
            url={user?.avatarUrl ?? null}
            initials={(user?.name ?? '?').slice(0, 1).toUpperCase()}
            size={28}
          />
          <Text className="flex-1 text-[15px] font-semibold text-foreground">
            {t('tasks.assign.me')}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={c.mutedForeground} />
        </Pressable>

        {team.isLoading ? (
          <ActivityIndicator className="py-4" color={c.mutedForeground} />
        ) : colleagues.length > 0 ? (
          <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 4 }}>
            {colleagues.map((member) => (
              <Pressable
                key={member.id}
                onPress={() => send(member.id)}
                disabled={assign.isPending}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-muted"
              >
                <Avatar
                  url={null}
                  initials={(member.name || '?').slice(0, 1).toUpperCase()}
                  size={28}
                />
                <Text className="flex-1 text-[15px] text-foreground" numberOfLines={1}>
                  {member.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Pressable
          onPress={() => send(null)}
          disabled={assign.isPending}
          accessibilityRole="button"
          className="flex-row items-center gap-2 py-2 active:opacity-60"
        >
          <Ionicons name="close-circle-outline" size={16} color={c.mutedForeground} />
          <Text className="flex-1 text-sm text-muted-foreground">{t('tasks.assign.clear')}</Text>
          {assign.isPending ? <ActivityIndicator size="small" color={c.mutedForeground} /> : null}
        </Pressable>
      </View>
    </BottomSheet>
  );
}
