import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';

/**
 * The search box above a list.
 *
 * A pill on the muted surface rather than a bordered form field: this is not
 * part of a form being filled in, it is the list's own control, and every phone
 * draws that one the same way. It stays put while the list under it changes.
 *
 * The spinner replaces the clear button while a query is in flight, so the field
 * itself says the list is catching up — the rows below keep the previous answer
 * rather than blinking to a loader.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  busy = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** What this list is searched by, in the dealer's language. */
  placeholder: string;
  busy?: boolean;
}) {
  const t = useT();
  const c = useColors();

  return (
    <View
      className="mx-5 mb-1 flex-row items-center gap-2 rounded-full px-4"
      style={{ height: 44, backgroundColor: c.muted }}
    >
      <Ionicons name="search-outline" size={17} color={c.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        // A term is a name, a postcode or a phone number — none of them want a
        // capital first letter or an autocorrect guess.
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="search"
        // fontSize via style, not `text-base`: that class also sets a 24pt line
        // height, which pushes a single-line input's text off centre on iOS.
        className="flex-1 text-foreground"
        style={{ fontSize: 15 }}
        accessibilityLabel={placeholder}
      />
      {busy ? (
        <ActivityIndicator size="small" color={c.mutedForeground} />
      ) : value.length > 0 ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}
        >
          <Ionicons name="close-circle" size={18} color={c.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}
