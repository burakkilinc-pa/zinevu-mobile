import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { Membership } from '@/features/auth/types';
import { useCompanySwitch, useMemberships } from '@/features/companies/use-company-switch';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

/**
 * One login, several companies — the phone's half of the portal's switcher.
 *
 * Shown only to people who HAVE more than one: for everybody else it would be
 * a permanent row saying the one thing they already know. Whoever opens it is
 * usually answering a question they were asked by a notification from the
 * other company, so each row carries the one number that crosses the boundary
 * — how many visitors are waiting there — and nothing else about it.
 */
export function CompanySwitcherSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const c = useColors();
  const { data, isLoading } = useMemberships({ enabled: visible, live: visible });
  const { switchTo, switchingTo } = useCompanySwitch();

  const memberships = data ?? [];

  const choose = async (membership: Membership) => {
    if (membership.current) {
      onClose();
      return;
    }
    // Closed first: the switch clears every cache behind this sheet, and a
    // sheet still standing over a screen that is being rebuilt looks stuck.
    onClose();
    await switchTo(membership);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="px-5 pb-1 pt-1 text-xl font-bold text-foreground">
        {t('companies.title')}
      </Text>
      <Text className="px-5 pb-3 text-sm text-muted-foreground">{t('companies.subtitle')}</Text>

      {isLoading && memberships.length === 0 ? (
        <View className="py-10">
          <ActivityIndicator color={c.mutedForeground} />
        </View>
      ) : (
        memberships.map((membership) => (
          <CompanyRow
            key={membership.id}
            membership={membership}
            busy={switchingTo === membership.id}
            onPress={() => void choose(membership)}
          />
        ))
      )}
    </BottomSheet>
  );
}

function CompanyRow({
  membership,
  busy,
  onPress,
}: {
  membership: Membership;
  busy: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const c = useColors();
  const disabled = busy || !membership.available;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: membership.current, disabled }}
      className="flex-row items-center gap-3 px-5 py-3.5 active:bg-muted"
      style={disabled && !busy ? { opacity: 0.45 } : undefined}
    >
      <CompanyMark membership={membership} />

      <View className="flex-1">
        <Text className="text-base font-medium text-foreground" numberOfLines={1}>
          {membership.name || t('companies.unnamed')}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          {membership.current
            ? t('companies.current')
            : membership.pending
              ? t('companies.pending')
              : t(`companies.role.${membership.kind}` as 'companies.role.dealer')}
        </Text>
      </View>

      {/* The count only ever appears on a company you are NOT in: in this one
          the inbox itself is one tap away and already says so. */}
      {!membership.current && membership.waiting > 0 ? (
        <View
          className="min-w-6 items-center rounded-full px-2 py-0.5"
          style={{ backgroundColor: c.destructive }}
        >
          <Text className="text-xs font-bold text-white">
            {membership.waiting > 9 ? '9+' : membership.waiting}
          </Text>
        </View>
      ) : null}

      {busy ? (
        <ActivityIndicator color={c.mutedForeground} />
      ) : membership.current ? (
        <Ionicons name="checkmark" size={20} color={c.foreground} />
      ) : null}
    </Pressable>
  );
}

/** The company's logo, or its initial — never an empty square. */
function CompanyMark({ membership }: { membership: Membership }) {
  const c = useColors();

  if (membership.logoUrl) {
    return (
      <Image
        source={{ uri: membership.logoUrl }}
        resizeMode="contain"
        className="h-10 w-10 rounded-md"
        style={{ backgroundColor: c.muted }}
      />
    );
  }

  return (
    <View
      className="h-10 w-10 items-center justify-center rounded-md"
      style={{ backgroundColor: c.muted }}
    >
      <Text className="text-base font-bold" style={{ color: c.mutedForeground }}>
        {(membership.name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
