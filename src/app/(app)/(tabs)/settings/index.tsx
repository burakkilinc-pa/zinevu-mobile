import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useDockClearance } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { CARD_SHADOW } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/features/auth/store';
import { deleteAvatar, uploadAvatar } from '@/features/auth/api/profile.api';
import {
  authenticateBiometric,
  biometricKind,
  biometricSupported,
  isBiometricEnabled,
  setBiometricEnabled,
} from '@/features/auth/biometric';
import { useSupportUnread } from '@/features/support/hooks/use-support';
import { ApiError } from '@/lib/api/client';
import { capturePhotos, PermissionDeniedError } from '@/lib/media';
import {
  useT,
  useLocaleStore,
  SUPPORTED_LOCALES,
  LOCALE_ENDONYM,
  type LocalePreference,
  type MessageKey,
} from '@/lib/i18n';
import { useColors, useThemeStore, type ThemePreference } from '@/lib/theme';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];
const LANGUAGE_OPTIONS: LocalePreference[] = ['system', ...SUPPORTED_LOCALES];

/**
 * Settings: who you are, how the app looks, and how to reach Zinevu.
 *
 * Support lives here rather than in the dock. Five icons is the most a bottom
 * bar reads cleanly at, and support is a rare, deliberate errand — but it
 * carries its unread badge up to this row so an answer is never buried.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const c = useColors();
  const t = useT();
  const bottomPad = useDockClearance();

  const user = useAuthStore((s) => s.user);
  const account = useAuthStore((s) => s.account);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const localePreference = useLocaleStore((s) => s.preference);
  const setLocalePreference = useLocaleStore((s) => s.setPreference);
  const supportUnread = useSupportUnread();

  const [signingOut, setSigningOut] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioKind, setBioKind] = useState<'face' | 'fingerprint' | 'generic'>('generic');

  useEffect(() => {
    void (async () => {
      const ok = await biometricSupported();
      setBioSupported(ok);
      if (ok) {
        setBioEnabled(await isBiometricEnabled());
        setBioKind(await biometricKind());
      }
    })();
  }, []);

  async function toggleBiometric(next: boolean) {
    // Prove the sensor works BEFORE switching the lock on. Enabling it on a
    // failing sensor would lock the user out of the app on the next launch,
    // with only "sign out" as a way back in.
    if (next) {
      const ok = await authenticateBiometric(t('auth.biometric.enablePrompt'));
      if (!ok) return;
    }
    await setBiometricEnabled(next);
    setBioEnabled(next);
  }

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  function changeAvatar() {
    Alert.alert(t('account.avatar.title'), undefined, [
      { text: t('common.camera'), onPress: () => pickAvatar('camera') },
      { text: t('common.gallery'), onPress: () => pickAvatar('library') },
      ...(user?.avatarUrl
        ? [{ text: t('common.remove'), style: 'destructive' as const, onPress: removeAvatar }]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }

  async function pickAvatar(source: 'camera' | 'library') {
    if (!user) return;

    try {
      const [file] = await capturePhotos(source, 1);
      if (!file) return;
      setAvatarBusy(true);
      setUser(await uploadAvatar(user, file));
      toast.success(t('account.avatar.updated'));
    } catch (err) {
      if (err instanceof PermissionDeniedError) toast.error(err.message);
      else if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t('account.avatar.uploadFailed'));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    if (!user) return;

    try {
      setAvatarBusy(true);
      setUser(await deleteAvatar(user));
      toast.success(t('account.avatar.removed'));
    } catch {
      toast.error(t('account.avatar.removeFailed'));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomPad }}>
        <Text className="text-2xl font-bold text-foreground">{t('account.title')}</Text>

        <View className="mt-5 items-center">
          <Pressable
            onPress={changeAvatar}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel={t('account.avatar.title')}
          >
            <Avatar url={user?.avatarUrl} initials={initials || '?'} size={96} />
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary">
              {avatarBusy ? (
                <ActivityIndicator size="small" color={c.white} />
              ) : (
                <Ionicons name="camera" size={16} color={c.white} />
              )}
            </View>
          </Pressable>

          <Text className="mt-3 text-lg font-semibold text-foreground">
            {user?.name || t('account.userFallback')}
          </Text>
          <Text className="text-base text-muted-foreground">{user?.email}</Text>

          <View className="mt-2 flex-row items-center gap-2">
            <View className="rounded-full bg-accent px-3 py-1">
              <Text className="text-sm font-medium text-accent-foreground">
                {user?.isPlatformAdmin
                  ? t('role.platformAdmin')
                  : t(`role.${user?.memberRole ?? 'admin'}` as MessageKey)}
              </Text>
            </View>
            {/* Only a real white label is named — a direct Zinevu signup has no
                Brand row, and telling them they are "a partner of Zinevu"
                would simply be untrue. */}
            {account?.branded ? (
              <Text className="text-sm text-muted-foreground">{account.name}</Text>
            ) : null}
          </View>
        </View>

        <Section title={t('account.section.profile')}>
          <Row
            icon="person-outline"
            label={t('account.editProfile')}
            onPress={() => router.push('/settings/profile')}
          />
          <Row
            icon="lock-closed-outline"
            label={t('account.changePassword')}
            onPress={() => router.push('/settings/password')}
          />
          <Row
            icon="help-buoy-outline"
            label={t('tabs.support')}
            badge={supportUnread.data ?? 0}
            onPress={() => router.push('/settings/support')}
          />
        </Section>

        {bioSupported ? (
          <Section title={t('account.section.security')}>
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <Ionicons
                name={bioKind === 'face' ? 'scan-outline' : 'finger-print'}
                size={20}
                color={c.foreground}
              />
              <Text className="flex-1 text-base text-foreground">
                {t(
                  bioKind === 'face'
                    ? 'account.security.faceId'
                    : 'account.security.fingerprint'
                )}
              </Text>
              <Switch value={bioEnabled} onValueChange={toggleBiometric} />
            </View>
          </Section>
        ) : null}

        <Section title={t('account.section.appearance')}>
          <View className="flex-row gap-2 p-3">
            {THEME_OPTIONS.map((option) => {
              const active = preference === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setPreference(option)}
                  accessibilityRole="button"
                  accessibilityState={active ? { selected: true } : {}}
                  className={
                    active
                      ? 'flex-1 items-center rounded-xl bg-primary py-2.5'
                      : 'flex-1 items-center rounded-xl border border-border py-2.5 active:bg-muted'
                  }
                >
                  <Text
                    className={
                      active
                        ? 'text-base font-semibold text-primary-foreground'
                        : 'text-base text-foreground'
                    }
                  >
                    {t(`theme.${option}` as MessageKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title={t('account.section.language')}>
          {LANGUAGE_OPTIONS.map((option, i) => {
            const active = localePreference === option;
            // Each language is named in its own words — a picker that labels
            // "Nederlands" as "Dutch" is useless to the person who needs it.
            const label = option === 'system' ? t('language.system') : LOCALE_ENDONYM[option];

            return (
              <Pressable
                key={option}
                onPress={() => setLocalePreference(option)}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
                className={
                  i > 0
                    ? 'flex-row items-center gap-3 border-t border-border px-4 py-3.5 active:bg-muted'
                    : 'flex-row items-center gap-3 px-4 py-3.5 active:bg-muted'
                }
              >
                <Text className="flex-1 text-base text-foreground">{label}</Text>
                {active ? <Ionicons name="checkmark" size={20} color={c.foreground} /> : null}
              </Pressable>
            );
          })}
        </Section>

        <View className="mt-8">
          <Button
            title={t('account.signOut')}
            variant="outline"
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              await signOut();
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </Text>
      <View
        className="overflow-hidden rounded-2xl border border-border/50 bg-card"
        style={CARD_SHADOW}
      >
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  onPress,
  badge = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 active:bg-muted"
    >
      <Ionicons name={icon} size={20} color={c.foreground} />
      <Text className="flex-1 text-base text-foreground">{label}</Text>
      {badge > 0 ? (
        <View
          className="min-w-5 items-center rounded-full px-1.5"
          style={{ backgroundColor: c.destructive }}
        >
          <Text className="text-xs font-bold text-white">{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
    </Pressable>
  );
}
