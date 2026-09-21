import { Pressable, ScrollView, Text } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useT } from '@/lib/i18n';
import type { ChatQuickReply } from '@/features/chat/types';

/**
 * The team's canned answers, on the phone.
 *
 * They are written on the web (settings live where a keyboard does) and only
 * picked here. Picking PASTES into the composer rather than sending: the
 * answer almost always wants a name or a date in front of it, and the one
 * thing worse than retyping the delivery time is sending it to the wrong
 * person by a mistap.
 */
export function QuickReplySheet({
  visible,
  replies,
  onClose,
  onPick,
}: {
  visible: boolean;
  replies: ChatQuickReply[];
  onClose: () => void;
  onPick: (reply: ChatQuickReply) => void;
}) {
  const t = useT();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mt-4 text-xl font-bold text-foreground">
        {t('chat.quickReplies.title')}
      </Text>
      <Text className="mt-0.5 text-sm text-muted-foreground">
        {t('chat.quickReplies.subtitle')}
      </Text>

      <ScrollView className="mt-3 max-h-96">
        {replies.length === 0 ? (
          <Text className="py-6 text-center text-sm text-muted-foreground">
            {t('chat.quickReplies.empty')}
          </Text>
        ) : null}

        {replies.map((reply) => (
          <Pressable
            key={reply.id}
            onPress={() => onPick(reply)}
            accessibilityRole="button"
            className="gap-0.5 border-b border-border py-3 active:opacity-60"
          >
            <Text className="text-base font-semibold text-foreground">{reply.title}</Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={2}>
              {reply.body}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
