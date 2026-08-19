import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Screen } from '@/components/ui/screen';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useColors } from '@/lib/theme';
import { useT, useTFallback } from '@/lib/i18n';
import { hasPermission, PERMISSIONS } from '@/lib/auth/roles';
import { useAuthStore } from '@/features/auth/store';
import { fetchLeadDetail } from '@/features/leads/api/lead-detail.api';
import { ScreenHeader } from '@/features/leads/components/screen-header';
import { offerKeys, useUpdateAnswers } from '@/features/leads/hooks/use-offer';

/**
 * Correcting what the customer configured.
 *
 * These are OVERRIDES, not edits: the submitted answers are an audit trail the
 * backend will not let anyone overwrite, so a correction layers on top and
 * clearing a field reverts it to what the customer originally said.
 *
 * Saving deliberately does NOT re-price. The lines are then older than the
 * answers they claim to price, which the detail screen surfaces as a prompt to
 * recalculate — a separate, destructive step the dealer asks for, because it
 * rebuilds every line from the price list.
 */
export default function AnswersScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const tf = useTFallback();
  const c = useColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const allowed = hasPermission(user, PERMISSIONS.offersManage);

  const detail = useQuery({
    queryKey: offerKeys.detail(String(ref)),
    queryFn: () => fetchLeadDetail(String(ref)),
    enabled: !!ref,
  });

  const lead = detail.data;
  const update = useUpdateAnswers(String(ref), lead?.dealId ?? 0);

  // Only what the dealer actually touched is sent — an untouched field must not
  // become an override that pins the customer's own answer in place.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const onSave = useCallback(() => {
    if (Object.keys(edits).length === 0) {
      router.back();
      return;
    }
    update.mutate(edits, {
      onSuccess: () => {
        toast.success(t('offer.answers.savedTitle'));
        router.back();
      },
      onError: (error) => toast.error((error as Error).message),
    });
  }, [edits, update, router, t]);

  if (!allowed) {
    return (
      <Screen padded={false} edges={['top']}>
        <ScreenHeader title={t('offer.answers.edit')} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-muted-foreground">
            {t('offer.noPermission')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top']}>
      <ScreenHeader title={t('offer.answers.edit')} />

      {detail.isLoading || !lead ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.mutedForeground} />
        </View>
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <Card className="gap-4 p-4">
              {lead.answers.map((answer) => (
                <View key={answer.key} className="gap-1">
                  <TextField
                    label={tf(`leads.answer.${answer.key}`, answer.key)}
                    defaultValue={answer.value}
                    onChangeText={(text) =>
                      setEdits((prev) => ({ ...prev, [answer.key]: text }))
                    }
                  />
                  {answer.overridden ? (
                    <Text className="text-xs text-muted-foreground">
                      {t('offer.answers.corrected')}
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          </ScrollView>

          {/* The dock is hidden on this screen (see (tabs)/_layout), so the
              footer owns the bottom edge and only has to clear the home
              indicator. */}
          <View
            className="border-t border-border/60 bg-background px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <Button
              title={update.isPending ? t('common.saving') : t('common.save')}
              loading={update.isPending}
              onPress={onSave}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
