import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, Pressable } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useAuthStore } from '@/features/auth/store';
import { useSupportUnread } from '@/features/support/hooks/use-support';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

/**
 * "All sections" — the sheet behind the dock's last tab.
 *
 * The dock holds four side icons around the brand Z so the mark sits dead
 * centre; everything rarer than that (support, the platform back-office, the
 * settings screen itself) lives here, over a card that names who is signed in
 * and offers the way out. Mirrors the web portal's own overflow menu.
 */
export function MoreSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const c = useColors();
  const t = useT();

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const supportUnread = useSupportUnread();

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  // Navigate only after the sheet is gone: pushing under an open modal leaves
  // the destination screen behind a backdrop on iOS.
  function go(path: string) {
    onClose();
    requestAnimationFrame(() => router.push(path as never));
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-foreground">{t('more.title')}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            className="h-9 w-9 items-center justify-center rounded-full bg-muted active:opacity-70"
          >
            <Ionicons name="close" size={20} color={c.foreground} />
          </Pressable>
        </View>

        <View className="mt-4">
          {user?.isPlatformAdmin ? (
            <SheetRow
              icon="shield-checkmark-outline"
              label={t('tabs.admin')}
              onPress={() => go('/platform')}
            />
          ) : null}
          <SheetRow
            icon="help-buoy-outline"
            label={t('tabs.support')}
            badge={supportUnread.data ?? 0}
            onPress={() => go('/settings/support')}
          />
          <SheetRow
            icon="settings-outline"
            label={t('tabs.settings')}
            onPress={() => go('/settings')}
          />
        </View>

        <View className="mt-4 rounded-2xl border border-border/50 bg-muted/40 p-3">
          <View className="flex-row items-center gap-3">
            <Avatar url={user?.avatarUrl} initials={initials || '?'} size={44} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {user?.name || t('account.userFallback')}
              </Text>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={async () => {
              onClose();
              await signOut();
            }}
            accessibilityRole="button"
            className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card active:opacity-70"
          >
            <Ionicons name="log-out-outline" size={18} color={c.foreground} />
            <Text className="text-base font-semibold text-foreground">
              {t('account.signOut')}
            </Text>
          </Pressable>
        </View>
    </BottomSheet>
  );
}

function SheetRow({
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
      className="flex-row items-center gap-4 rounded-2xl px-1 py-3 active:bg-muted"
    >
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-muted">
        <Ionicons name={icon} size={20} color={c.foreground} />
      </View>
      <Text className="flex-1 text-lg text-foreground">{label}</Text>
      {badge > 0 ? (
        <View
          className="min-w-6 items-center rounded-full px-2 py-0.5"
          style={{ backgroundColor: c.destructive }}
        >
          <Text className="text-xs font-bold text-white">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
