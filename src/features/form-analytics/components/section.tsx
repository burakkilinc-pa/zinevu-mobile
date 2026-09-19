import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n';
import { useColors } from '@/lib/theme';

/**
 * One block of the analytics screen: a heading, an optional line saying what
 * the numbers under it count, and the block itself.
 */
export function Section({
  title,
  note,
  right,
  children,
}: {
  title: string;
  note?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-base font-semibold text-foreground">{title}</Text>
        {right}
      </View>
      {note ? <Text className="-mt-1 text-xs text-muted-foreground">{note}</Text> : null}
      {children}
    </View>
  );
}

/**
 * What a block shows instead of its content: still loading, failed, or
 * genuinely empty.
 *
 * Every block has all three on purpose. The sections load from different
 * requests (the funnel is its own), so one can fail while the rest render —
 * and a block that silently shows nothing reads as "no visits", which is a
 * claim about the dealer's business, not about the network.
 */
export function SectionState({
  kind,
  message,
  hint,
  onRetry,
}: {
  kind: 'loading' | 'error' | 'empty';
  message?: string;
  /** A second, quieter line under an empty message. */
  hint?: string;
  onRetry?: () => void;
}) {
  const t = useT();
  const c = useColors();

  return (
    <Card className="items-center gap-2 px-5 py-6">
      {kind === 'loading' ? (
        <ActivityIndicator color={c.mutedForeground} />
      ) : (
        <>
          <Text
            className={
              kind === 'error'
                ? 'text-center text-sm text-destructive'
                : 'text-center text-sm font-medium text-foreground'
            }
          >
            {message}
          </Text>
          {hint ? (
            <Text className="text-center text-xs text-muted-foreground">{hint}</Text>
          ) : null}
          {kind === 'error' && onRetry ? (
            <Button
              title={t('common.retry')}
              variant="outline"
              icon="refresh"
              onPress={onRetry}
              className="mt-1 h-10"
            />
          ) : null}
        </>
      )}
    </Card>
  );
}
