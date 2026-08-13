import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

export function Avatar({
  url,
  initials,
  size = 48,
  className,
  contain = false,
}: {
  url?: string | null;
  initials: string;
  size?: number;
  className?: string;
  /**
   * Fit the whole image inside the circle instead of cropping it. Business
   * logos are wide/rectangular, so `cover` chops their sides off — `contain`
   * letterboxes them on a neutral disc, mirroring the web app.
   */
  contain?: boolean;
}) {
  if (url) {
    if (contain) {
      const pad = Math.round(size * 0.1);
      return (
        <View
          style={{ width: size, height: size, borderRadius: size / 2, padding: pad }}
          className={cn(
            'items-center justify-center overflow-hidden bg-secondary',
            className
          )}
        >
          <Image
            source={{ uri: url }}
            style={{ width: size - pad * 2, height: size - pad * 2 }}
            contentFit="contain"
            transition={150}
          />
        </View>
      );
    }
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className={cn('items-center justify-center bg-secondary', className)}
    >
      <Text
        style={{ fontSize: size * 0.4 }}
        className="font-semibold text-secondary-foreground"
      >
        {initials}
      </Text>
    </View>
  );
}
