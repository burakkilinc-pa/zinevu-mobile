import { useState } from 'react';
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
   * letterboxes them instead.
   *
   * The disc is WHITE, in both schemes. A logo is artwork drawn for white
   * paper: on the deep teal this used it disappeared, because most dealers'
   * marks are dark. White is the ground they were made for, and the hairline
   * is what keeps the disc itself readable on the app's own paper.
   */
  contain?: boolean;
}) {
  /**
   * A URL is not a picture.
   *
   * The portal serves company logos off a PRIVATE disk, so a plain `logo_url`
   * from the API is routinely a link this app cannot fetch — and the component
   * then drew an empty disc, because it had decided there was an image the
   * moment the field was non-null. An empty disc is worse than no logo: the
   * initial at least names the company.
   *
   * So the fallback is not "no url", it is "no picture on screen" — a 404, a
   * private link, a dead host, all land here.
   */
  const [broken, setBroken] = useState(false);
  const showImage = !!url && !broken;

  // A new URL deserves a fresh try; without this a company that fixed its logo
  // would keep showing the initial for the life of the mounted row.
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    setLastUrl(url);
    setBroken(false);
  }

  if (showImage) {
    if (contain) {
      const pad = Math.round(size * 0.1);
      return (
        <View
          style={{ width: size, height: size, borderRadius: size / 2, padding: pad }}
          className={cn(
            'items-center justify-center overflow-hidden border border-border bg-white',
            className
          )}
        >
          <Image
            source={{ uri: url }}
            style={{ width: size - pad * 2, height: size - pad * 2 }}
            contentFit="contain"
            transition={150}
            onError={() => setBroken(true)}
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
        onError={() => setBroken(true)}
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
