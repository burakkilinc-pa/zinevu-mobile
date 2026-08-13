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
import { updateProfile } from '@/features/auth/api/profile.api';

/**
 * Your display name.
 *
 * E-mail is shown but not editable: it is the login identity and the address
 * every access code and password link goes to, so changing it is account
 * recovery rather than a profile edit. The field is present anyway, because a
 * profile screen that hides your own e-mail is more confusing than one that
 * shows it greyed out.
 */
export default function ProfileScreen() {
  const t = useT();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!user) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('account.profile.nameRequired'));
      return;
    }

    setError(null);
    setSaving(true);
    try {
      setUser(await updateProfile(user, trimmed));
      toast.success(t('account.profile.updated'));
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('account.profile.updateFailed'));
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
          {t('account.editProfile')}
        </Text>
      </View>

      <KeyboardAvoidingView behavior="translate-with-padding" className="flex-1">
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 18 }}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label={t('account.profile.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">
              {t('account.profile.emailLabel')}
            </Text>
            <View className="rounded-xl border border-border bg-muted px-4 py-3">
              <Text className="text-base text-muted-foreground">{user?.email}</Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              {t('account.profile.emailLocked')}
            </Text>
          </View>

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

          <Button title={t('common.save')} loading={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
