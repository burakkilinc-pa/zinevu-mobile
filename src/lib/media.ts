import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { t } from '@/lib/i18n';

export type CapturedFile = { uri: string; name: string; type: string };

const MAX_EDGE = 1920;

export class PermissionDeniedError extends Error {
  constructor() {
    super(t('errors.permissionDenied'));
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Captures photo(s) from the camera or library and re-encodes each to a
 * 1920px-max-edge JPEG (quality 0.8) to keep uploads small — shared by montage
 * proof photos and message attachments. Returns [] if the user cancels.
 */
export async function capturePhotos(
  source: 'camera' | 'library',
  selectionLimit = 10
): Promise<CapturedFile[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PermissionDeniedError();
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new PermissionDeniedError();
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: source === 'library',
    selectionLimit: source === 'library' ? selectionLimit : 1,
    exif: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return [];

  const files: CapturedFile[] = [];
  for (const asset of result.assets) {
    const uri = await compress(asset.uri, asset.width, asset.height);
    files.push({
      uri,
      name: `photo-${Date.now()}-${files.length}.jpg`,
      type: 'image/jpeg',
    });
  }
  return files;
}

/**
 * Captures a single video from the camera or library. No re-encoding (Expo
 * can't compress video); we cap the recorded duration to keep the file within
 * the backend's 100MB limit. Returns null if the user cancels.
 *
 * NOT CALLED ANYWHERE, and `RECORD_AUDIO` is blocked in `app.json` because of
 * that — an unused permission is a question at store review and a line in the
 * listing saying we can record you. Recording from the camera with it blocked
 * yields silent video rather than an error, so if you wire this up, unblock the
 * permission in the same change.
 */
export async function captureVideo(
  source: 'camera' | 'library'
): Promise<CapturedFile | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PermissionDeniedError();
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new PermissionDeniedError();
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    videoMaxDuration: 90,
    quality: 1,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  // iOS records .mov (video/quicktime); the backend accepts mp4/quicktime/webm.
  const ext = asset.uri.split('.').pop()?.toLowerCase();
  const type =
    asset.mimeType ?? (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  const name = asset.fileName ?? `video-${Date.now()}.${ext ?? 'mp4'}`;
  return { uri: asset.uri, name, type };
}

async function compress(
  uri: string,
  width?: number,
  height?: number
): Promise<string> {
  try {
    const longest = Math.max(width ?? 0, height ?? 0);
    const actions =
      longest > MAX_EDGE
        ? [
            (width ?? 0) >= (height ?? 0)
              ? { resize: { width: MAX_EDGE } }
              : { resize: { height: MAX_EDGE } },
          ]
        : [];
    const out = await manipulateAsync(uri, actions, {
      compress: 0.8,
      format: SaveFormat.JPEG,
    });
    return out.uri;
  } catch {
    return uri; // never block the upload on a compression failure
  }
}
