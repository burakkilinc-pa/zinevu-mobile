import * as FileSystem from 'expo-file-system/legacy';

/**
 * Writes a base64 PNG data URL to a cache file and returns its file:// uri,
 * ready to attach to a multipart upload.
 */
export async function base64ToPngFile(dataUrl: string): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const uri = `${FileSystem.cacheDirectory}signature-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' });
  return uri;
}
