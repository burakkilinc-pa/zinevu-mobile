import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useColors } from '@/lib/theme';
import { useT, type MessageKey } from '@/lib/i18n';
import { ApiError } from '@/lib/api/client';
import { useCreateTicket } from '@/features/support/hooks/use-support';
import { TICKET_CATEGORIES, type TicketCategory } from '@/features/support/api/support.api';

/**
 * A new ticket: a subject, a category, and what happened.
 *
 * No priority field. The portal has one, but a form where every reporter picks
 * their own urgency ends up with everything marked urgent — and Zinevu can read
 * the priority off the category and the words better than a dropdown can.
 */
export default function NewTicketScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const create = useCreateTicket();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('technical');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!subject.trim() || !message.trim()) {
      setError(t('support.new.incomplete'));
      return;
    }

    setError(null);
    create.mutate(
      { subject: subject.trim(), category, message: message.trim() },
      {
        onSuccess: (id) => {
          // replace, not push: coming back from the ticket should land on the
          // list, not on a form that has already been submitted.
          if (id > 0) router.replace(`/settings/support/${id}`);
          else router.back();
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
          className="h-9 w-9 items-center justify-center rounded-full active:bg-muted"
        >
          <Ionicons name="chevron-back" size={24} color={c.foreground} />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-foreground">
          {t('support.new.title')}
        </Text>
      </View>

      <KeyboardAvoidingView behavior="translate-with-padding" className="flex-1">
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label={t('support.new.subject')}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('support.new.subjectPlaceholder')}
          />

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">
              {t('support.new.category')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TICKET_CATEGORIES.map((option) => {
                const active = option === category;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    accessibilityRole="button"
                    accessibilityState={active ? { selected: true } : {}}
                    className="rounded-full px-3.5 py-2"
                    style={{ backgroundColor: active ? c.foreground : c.muted }}
                  >
                    <Text
                      className="text-sm"
                      style={{ color: active ? c.background : c.foreground }}
                    >
                      {t(`support.category.${option}` as MessageKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">
              {t('support.new.message')}
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={t('support.new.messagePlaceholder')}
              placeholderTextColor={c.mutedForeground}
              multiline
              textAlignVertical="top"
              className="min-h-36 rounded-xl border border-border bg-card p-3.5 text-base text-foreground"
            />
          </View>

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button
            title={t('support.new.submit')}
            loading={create.isPending}
            onPress={submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
