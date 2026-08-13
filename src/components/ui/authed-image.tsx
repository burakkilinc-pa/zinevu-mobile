import { useEffect, useState, type ReactNode } from 'react';
import { View, type StyleProp, type ImageStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';

import { authedImageSource } from '@/lib/api/authed-image';

type Source = { uri: string; headers: Record<string, string> };

/**
 * Renders an image from an authed, streamed API endpoint by resolving the
 * bearer-token source first. Shows a muted placeholder until it's ready, and
 * falls back (rather than leaving a transparent gap that shows the card
 * background as an empty white panel) when the load fails.
 */
export function AuthedImage({
  path,
  style,
  contentFit = 'cover',
  fallback,
  onError,
}: {
  path: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  /** Shown when the source can't resolve or the bytes fail (404 / network). */
  fallback?: ReactNode;
  /** Fired once when the image fails to load. */
  onError?: () => void;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false); // a new path is a fresh attempt
    authedImageSource(path).then((s) => {
      if (!active) return;
      if (s) setSource(s);
      else setFailed(true); // no token — nothing to load
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (failed) return <>{fallback ?? <View style={style} className="bg-muted" />}</>;
  if (!source) {
    return <View style={style} className="bg-muted" />;
  }
  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      transition={150}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}
