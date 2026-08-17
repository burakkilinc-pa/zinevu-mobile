import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useDockClearance } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useColors } from '@/lib/theme';
import { useT, type TFunction } from '@/lib/i18n';
import { ApiError } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { dayLabel, clockTime } from '@/lib/time';
import { dateKey } from '@/features/planning/calendar';
import { useCreateVisit, useFollowUpTypes } from '@/features/planning/hooks/use-planning';
import { followUpIcon } from '@/features/planning/icons';

/**
 * Booking one visit — a measurement, a montage, a delivery, a call.
 *
 * A screen rather than a modal on top of the calendar, because the field list is
 * long enough to need the keyboard and a keyboard over a sheet over a grid is
 * three layers deep. The type arrives already chosen from the picker, and it is
 * shown but not editable here: changing "montage" to "call" changes which fields
 * matter, so that is a decision to make in the sheet, not halfway down a form.
 *
 * There is deliberately no lead field. A visit that belongs to a lead gets booked
 * from that lead, where the customer and the address are already known; this
 * screen is the other case — the standalone appointment the dealer takes over
 * the phone — so it asks for a contact instead. That is also what the backend
 * requires when there is no `deal_id`.
 *
 * Duration is offered as blocks, not a number pad. Nobody books 47 minutes, and
 * the type's own default is pre-selected so the common case is zero taps.
 */

/** The blocks a visit actually gets booked in. */
const DURATIONS = [30, 60, 90, 120, 240, 480];

export default function NewVisitScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dock = useDockClearance();
  const create = useCreateVisit();

  const { typeId, date } = useLocalSearchParams<{ typeId?: string; date?: string }>();
  const types = useFollowUpTypes();
  const type = useMemo(
    () => (types.data ?? []).find((option) => option.id === Number(typeId)) ?? null,
    [types.data, typeId]
  );

  // Opens on the day the calendar was showing, at the next whole hour — the two
  // things the dealer would otherwise have to dial in every single time.
  const [due, setDue] = useState(() => {
    const base = date ? new Date(`${date}T12:00:00`) : new Date();
    const start = Number.isNaN(base.getTime()) ? new Date() : base;
    // Clamped, not rolled over: setHours(24) would silently move the booking to
    // the next day, which is the one thing this default must not do.
    const hour = Math.min(new Date().getHours() + 1, 23);
    start.setHours(hour, 0, 0, 0);

    return start;
  });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  const [title, setTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A field visit gets a block; a reminder is a moment, so it gets no duration
  // row at all rather than a row that means nothing.
  const isVisit = type?.behavior === 'field_visit';
  const [duration, setDuration] = useState<number | null>(null);
  const effectiveDuration = isVisit ? (duration ?? type?.defaultDurationMinutes ?? 60) : null;

  const needsAddress = type?.requiresLocation === true;

  function submit() {
    if (!type) return;

    if (!contactName.trim()) {
      setError(t('planning.new.contactRequired'));
      return;
    }
    if (needsAddress && !(postalCode.trim() && houseNumber.trim())) {
      setError(t('planning.new.addressRequired'));
      return;
    }

    setError(null);

    const hasAddress = [street, houseNumber, postalCode, city].some((v) => v.trim() !== '');

    create.mutate(
      {
        followUpTypeId: type.id,
        // The type's name is the honest default title: it is what the row will
        // read as on the grid, and it beats forcing a sentence out of somebody
        // standing in a driveway.
        title: title.trim() || type.name,
        // Naive wall-clock, read in the portal's timezone server-side.
        dueAt: `${dateKey(due)} ${String(due.getHours()).padStart(2, '0')}:${String(
          due.getMinutes()
        ).padStart(2, '0')}`,
        durationMinutes: effectiveDuration,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim() || null,
        locationAddress: hasAddress
          ? {
              street: street.trim(),
              houseNumber: houseNumber.trim(),
              postalCode: postalCode.trim(),
              city: city.trim(),
            }
          : null,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(t('planning.new.created'));
          // Back to the calendar, on the day it was booked for.
          router.replace({ pathname: '/planning', params: { date: dateKey(due) } });
        },
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : t('common.error')),
      }
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-foreground">
          {t('planning.new.title')}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          // The dock stays up over nested tab routes, so the last field has to
          // clear it — otherwise "Book it" sits under the brand Z.
          contentContainerStyle={{ padding: 20, paddingBottom: dock + 24, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* What is being booked, in the dealer's own words and colour. */}
          {type ? (
            <View
              className="flex-row items-center gap-3 rounded-xl border border-border p-3"
              style={{ backgroundColor: `${type.colorHex ?? '#64748b'}12` }}
            >
              <Ionicons
                name={followUpIcon(type.iconKey, type.behavior)}
                size={20}
                color={type.colorHex ?? c.foreground}
              />
              <Text className="flex-1 text-base font-medium text-foreground">{type.name}</Text>
            </View>
          ) : (
            <Text className="text-sm text-muted-foreground">
              {types.isLoading ? t('common.loading') : t('planning.new.noTypes')}
            </Text>
          )}

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">
              {t('planning.new.when')}
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
          </View>

          {picker ? (
            <DateTimePicker
              value={due}
              mode={picker}
              // Spinner on iOS: the inline calendar inside a scrolling form
              // fights the scroll view for the same vertical drags.
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, picked) => {
                // Android fires the dialog's dismissal through the same handler.
                if (Platform.OS !== 'ios' || event.type === 'dismissed') setPicker(null);
                if (picked) setDue(picked);
              }}
            />
          ) : null}

          {isVisit ? (
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">
                {t('planning.new.duration')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {DURATIONS.map((minutes) => {
                  const active = effectiveDuration === minutes;

                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => setDuration(minutes)}
                      accessibilityRole="button"
                      accessibilityState={active ? { selected: true } : {}}
                      className="rounded-full px-4 py-2"
                      style={{ backgroundColor: active ? c.foreground : c.muted }}
                    >
                      <Text
                        className="text-sm font-medium"
                        style={{ color: active ? c.background : c.foreground }}
                      >
                        {durationLabel(minutes, t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <TextField
            label={t('planning.new.contactName')}
            value={contactName}
            onChangeText={setContactName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <TextField
            label={t('planning.new.contactPhone')}
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />

          <TextField
            label={t('planning.new.subject')}
            placeholder={type?.name ?? ''}
            value={title}
            onChangeText={setTitle}
          />

          {/* The address block is shown whenever the type is a drive; it is only
              REQUIRED when the dealer marked the type as needing a location. */}
          {isVisit ? (
            <View className="gap-3">
              <Text className="text-sm font-medium text-foreground">
                {t('planning.new.address')}
              </Text>

              <View className="flex-row gap-3">
                <TextField
                  containerClassName="flex-1"
                  placeholder={t('planning.new.postalCode')}
                  value={postalCode}
                  onChangeText={setPostalCode}
                  autoCapitalize="characters"
                />
                <TextField
                  containerClassName="w-28"
                  placeholder={t('planning.new.houseNumber')}
                  value={houseNumber}
                  onChangeText={setHouseNumber}
                />
              </View>

              <TextField
                placeholder={t('planning.new.street')}
                value={street}
                onChangeText={setStreet}
                autoCapitalize="words"
              />
              <TextField
                placeholder={t('planning.new.city')}
                value={city}
                onChangeText={setCity}
                autoCapitalize="words"
              />
            </View>
          ) : null}

          <TextField
            label={t('planning.new.note')}
            value={note}
            onChangeText={setNote}
            multiline
            className="h-24 py-3"
            style={{ textAlignVertical: 'top' }}
          />

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button
            title={t('planning.new.submit')}
            onPress={submit}
            loading={create.isPending}
            disabled={!type || create.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** "3 hrs" rather than "180m" — the way a block is actually spoken about. */
function durationLabel(minutes: number, t: TFunction): string {
  if (minutes < 60) return t('planning.new.minutes', { n: minutes });
  const hours = minutes / 60;

  return t('planning.new.hours', { n: Number.isInteger(hours) ? hours : hours.toFixed(1) });
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
      className="h-12 flex-1 flex-row items-center gap-2 rounded-md border border-border bg-card px-4 active:bg-muted"
    >
      <Ionicons name={icon} size={16} color={c.mutedForeground} />
      <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
