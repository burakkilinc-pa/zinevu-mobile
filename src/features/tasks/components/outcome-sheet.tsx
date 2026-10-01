import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { haptic } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { clockTime, dayLabel } from '@/lib/time';
import { useCompleteTask, useTaskOutcomes } from '@/features/tasks/hooks/use-tasks';
import type { TaskItem, TaskOutcome } from '@/features/tasks/types';

/**
 * Closing a task: what happened, and — when the dealer configured it that way —
 * when the next attempt is.
 *
 * There is no "just mark it done" here, and that is the portal's rule, not a
 * simplification: the outcome is what their own reporting counts, so a close
 * without one would quietly hollow out the numbers they manage the team by.
 *
 * The second step only exists for an outcome the dealer flagged as chaining
 * ("Niet bereikbaar" → call again). The backend will book that follow-up with
 * or without us, so the step is not there to collect data — it is there so the
 * dealer SEES the appointment that is about to appear on someone's calendar,
 * and can move it before it does.
 */
export function OutcomeSheet({
  task,
  onClose,
}: {
  task: TaskItem | null;
  onClose: () => void;
}) {
  const t = useT();
  const c = useColors();

  const outcomes = useTaskOutcomes(!!task);
  const complete = useCompleteTask();

  const [step, setStep] = useState<'pick' | 'followup'>('pick');
  const [picked, setPicked] = useState<TaskOutcome | null>(null);
  const [note, setNote] = useState('');
  const [due, setDue] = useState(() => new Date());
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  // Reset on the way IN rather than on the way out, and on every opening rather
  // than on a change of task.
  //
  // On the way out would blank the step the dealer is still looking at: the card
  // takes 200ms to leave. On a change of task would miss the case that actually
  // happens — backing out of the follow-up step and pressing the same task
  // again, which would otherwise reopen halfway through the last attempt.
  const open = !!task;
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('pick');
      setPicked(null);
      setNote('');
      setPicker(null);
    }
  }

  function close() {
    setPicker(null);
    onClose();
  }

  function send(outcome: TaskOutcome, followUp: { dueAt: string } | null) {
    if (!task) return;

    complete.mutate(
      { id: task.id, outcomeId: outcome.id, note: note.trim() || null, followUp },
      {
        onSuccess: ({ chainedDueAt }) => {
          haptic('success');
          toast.success(
            chainedDueAt
              ? t('tasks.toast.doneWithNext', { when: dayLabel(chainedDueAt) })
              : t('tasks.toast.done')
          );
          close();
        },
        onError: () => {
          haptic('error');
          toast.error(t('tasks.toast.failed'));
        },
      }
    );
  }

  function choose(outcome: TaskOutcome) {
    setPicked(outcome);

    if (!outcome.autoFollowUp) {
      send(outcome, null);

      return;
    }

    // Prefill exactly what the server would have picked on its own — the
    // outcome's offset — at a working-hours time, so confirming without
    // touching anything changes nothing.
    const target = new Date();
    target.setDate(target.getDate() + outcome.followUpOffsetDays);
    target.setHours(10, 0, 0, 0);
    setDue(target);
    setStep('followup');
  }

  const rows = outcomes.data ?? [];

  return (
    <BottomSheet visible={open} onClose={close}>
      <View className="gap-3 pt-3">
        <View className="flex-row items-center gap-2">
          {step === 'followup' ? (
            <Pressable
              onPress={() => setStep('pick')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              className="h-8 w-8 items-center justify-center rounded-full active:bg-muted"
            >
              <Ionicons name="chevron-back" size={20} color={c.foreground} />
            </Pressable>
          ) : null}
          <Text className="flex-1 text-lg font-bold text-foreground">
            {step === 'pick' ? t('tasks.outcome.title') : t('tasks.outcome.nextTitle')}
          </Text>
        </View>

        {task ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {[task.title, task.customerName].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {step === 'pick' ? (
          <>
            {outcomes.isLoading ? (
              <ActivityIndicator className="py-6" color={c.mutedForeground} />
            ) : rows.length === 0 ? (
              <Text className="py-6 text-center text-sm text-muted-foreground">
                {t('tasks.outcome.none')}
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
                {rows.map((outcome) => (
                  <OutcomeButton
                    key={outcome.id}
                    outcome={outcome}
                    busy={complete.isPending && picked?.id === outcome.id}
                    disabled={complete.isPending}
                    onPress={() => choose(outcome)}
                  />
                ))}
              </ScrollView>
            )}

            {/* Optional, and last: a note is worth having but asking for one
                before the tag would put a keyboard between the dealer and the
                tap that closes the task. */}
            <TextField
              label={t('tasks.outcome.note')}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={2}
              editable={!complete.isPending}
            />
          </>
        ) : (
          <View className="gap-3">
            <Text className="text-sm text-muted-foreground">
              {t('tasks.outcome.nextBody')}
            </Text>

            <View className="flex-row gap-2">
              <SlotButton
                icon="calendar-outline"
                label={dayLabel(due.toISOString())}
                onPress={() => setPicker('date')}
              />
              <SlotButton
                icon="time-outline"
                label={clockTime(due.toISOString())}
                onPress={() => setPicker('time')}
              />
            </View>

            {picker ? (
              <DateTimePicker
                value={due}
                mode={picker}
                // Spinner on iOS: an inline calendar inside a sheet fights the
                // sheet for the same vertical drags.
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, next) => {
                  // Android reports the dialog's dismissal through the same handler.
                  if (Platform.OS !== 'ios' || event.type === 'dismissed') setPicker(null);
                  if (next) setDue(next);
                }}
              />
            ) : null}

            <Button
              title={t('tasks.outcome.confirmNext')}
              loading={complete.isPending}
              onPress={() => {
                if (!picked) return;
                // Naive "Y-m-d H:i" on purpose: an ISO instant with a Z would be
                // re-read in the portal's timezone and shift the appointment by
                // the offset. The wall-clock time the dealer picked is the thing
                // to preserve.
                const pad = (n: number) => String(n).padStart(2, '0');
                const dueAt =
                  `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())} ` +
                  `${pad(due.getHours())}:${pad(due.getMinutes())}`;
                send(picked, { dueAt });
              }}
            />
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

/**
 * One outcome, in the dealer's own colour.
 *
 * The disposition is the fallback tint rather than the primary one: a dealer who
 * bothered to pick a colour gets their colour, and one who did not still gets
 * green for a win and red for a loss, which is what makes the list readable at
 * a glance instead of a column of identical grey buttons.
 */
function OutcomeButton({
  outcome,
  busy,
  disabled,
  onPress,
}: {
  outcome: TaskOutcome;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const c = useColors();

  const tint =
    outcome.colorHex ??
    (outcome.disposition === 'positive'
      ? c.success
      : outcome.disposition === 'negative'
        ? c.destructive
        : c.mutedForeground);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-xl border p-3 active:opacity-70"
      style={{ borderColor: tint, backgroundColor: `${tint}14`, opacity: disabled && !busy ? 0.5 : 1 }}
    >
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tint }} />
      <Text className="flex-1 text-[15px] font-medium text-foreground">{outcome.name}</Text>

      {/* Say it before the tap, not after: this outcome books another task. */}
      {outcome.autoFollowUp ? (
        <View className="flex-row items-center gap-1">
          <Ionicons name="repeat-outline" size={13} color={c.mutedForeground} />
          <Text className="text-[11px] text-muted-foreground">
            {t('tasks.outcome.chains', { days: outcome.followUpOffsetDays })}
          </Text>
        </View>
      ) : null}

      {busy ? <ActivityIndicator size="small" color={c.mutedForeground} /> : null}
    </Pressable>
  );
}

function SlotButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 flex-row items-center gap-2 rounded-xl border border-border px-3 py-3 active:opacity-70"
    >
      <Ionicons name={icon} size={16} color={c.mutedForeground} />
      <Text className="text-sm font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}
