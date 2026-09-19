import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/features/auth/store';

/**
 * Deleting your own account.
 *
 * A screen rather than a confirm dialog, because App Store rule 5.1.1(v) asks
 * for the whole thing to be reachable and finishable in the app — and because
 * "delete account" means something specific here that a one-line alert cannot
 * say: the person goes, the firm's leads and jobs stay. The alert is still
 * there, as the last step, since this cannot be undone.
 */
export default function DeleteAccountScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  // Somebody who only ever signs in with Apple, Google or a magic link has no
  // password to confirm with — their live session is the proof the backend
  // takes, so asking would lock them out of deleting themselves.
  const needsPassword = user?.hasPassword ?? false;

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    Alert.alert(t('account.delete.confirmTitle'), t('account.delete.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.delete.submit'), style: 'destructive', onPress: () => void run() },
    ]);
  }

  async function run() {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount(needsPassword ? password : undefined);
      // The store has already torn the session down, so the authenticated
      // shell unmounts this screen and drops us at the login route.
      toast.success(t('account.delete.done'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.delete.failed'));
      setBusy(false);
    }
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
          {t('account.delete.title')}
        </Text>
      </View>

      <KeyboardAvoidingView behavior="translate-with-padding" className="flex-1">
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-base text-foreground">{t('account.delete.intro')}</Text>

          <Block title={t('account.delete.removedTitle')} tone="destructive">
            <Bullet icon="close-circle-outline" text={t('account.delete.removedProfile')} />
            <Bullet icon="close-circle-outline" text={t('account.delete.removedAccess')} />
            <Bullet icon="close-circle-outline" text={t('account.delete.removedPush')} />
          </Block>

          <Block title={t('account.delete.keptTitle')}>
            <Bullet icon="business-outline" text={t('account.delete.keptCompany')} />
            {/* Said to everyone rather than only to the sole owner: the app
                cannot know how many colleagues are left, and the one person
                it matters most to is the one who would be surprised. */}
            <Bullet icon="lock-closed-outline" text={t('account.delete.keptSolo')} />
          </Block>

          {needsPassword ? (
            <TextField
              label={t('account.delete.passwordLabel')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />
          ) : null}

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button
            title={t('account.delete.submit')}
            variant="destructive"
            loading={busy}
            disabled={needsPassword && password.length === 0}
            onPress={confirm}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Block({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'destructive';
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text
        className={
          tone === 'destructive'
            ? 'text-xs font-semibold uppercase text-destructive'
            : 'text-xs font-semibold uppercase text-muted-foreground'
        }
      >
        {title}
      </Text>
      <View className="gap-2 rounded-2xl border border-border/50 bg-card p-4">{children}</View>
    </View>
  );
}

function Bullet({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const c = useColors();

  return (
    <View className="flex-row items-start gap-3">
      <Ionicons name={icon} size={18} color={c.mutedForeground} style={{ marginTop: 2 }} />
      <Text className="flex-1 text-base text-foreground">{text}</Text>
    </View>
  );
}
