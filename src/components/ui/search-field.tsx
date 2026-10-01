import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/lib/theme';
import { useT } from '@/lib/i18n';

/**
 * The search box above a list.
 *
 * A white slab on the dotted paper, edged in ink — the shape zinevu.com gives
 * everything you can act on. It was a muted pill, which on a paper ground put
 * it in the same tone as the view switch directly above it: two controls, one
 * colour, neither reading as a separate thing. The white face is what tells you
 * this one is a field you type into.
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
      style={{ height: 44, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.ink }}
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
