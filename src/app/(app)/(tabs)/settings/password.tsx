import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
import { changePassword, sendOwnAccessCode } from '@/features/auth/api/auth.api';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/schemas';

/**
 * Changing your password.
 *
 * Two ways to prove it is you, because there are two ways to get here. Somebody
 * who knows their password types it. Somebody who was invited and never set one
 * — or has forgotten it while still signed in — asks for a code by e-mail. The
 * backend accepts either, so the screen offers both rather than sending the
 * second group out to the forgot-password flow and back through a login.
 */
export default function PasswordScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  // Somebody who never set a password has nothing to type in "current", so
  // the code route is where they start.
  const [useCode, setUseCode] = useState(!user?.hasPassword);
  const [current, setCurrent] = useState('');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setSendingCode(true);
    try {
      await sendOwnAccessCode();
      setUseCode(true);
      toast.success(t('account.password.forgotSent'));
    } catch {
      toast.error(t('account.password.forgotFailed'));
    } finally {
      setSendingCode(false);
    }
  }

  async function save() {
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(t('account.password.tooShort', { n: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (next !== confirm) {
      setError(t('account.password.mismatch'));
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await changePassword({
        password: next,
        currentPassword: useCode ? undefined : current,
        code: useCode ? code : undefined,
      });
      toast.success(t('account.password.updated'));
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.password.updateFailed'));
    } finally {
      setSaving(false);
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
          {t('account.changePassword')}
        </Text>
      </View>

      <KeyboardAvoidingView behavior="translate-with-padding" className="flex-1">
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          {useCode ? (
            <TextField
              label={t('account.password.codeLabel')}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoCapitalize="none"
            />
          ) : (
            <TextField
              label={t('account.password.current')}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoComplete="current-password"
            />
          )}

          <TextField
            label={t('account.password.new')}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoComplete="new-password"
          />
          <TextField
            label={t('account.password.confirm')}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
          />

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button title={t('account.password.submit')} loading={saving} onPress={save} />

          <Button
            title={
              useCode ? t('account.password.useCurrent') : t('account.password.forgot')
            }
            variant="ghost"
            loading={sendingCode}
            onPress={() => {
              if (useCode) {
                setUseCode(false);
                setCode('');
                return;
              }
              void requestCode();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
