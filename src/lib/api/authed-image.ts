import { config } from '@/lib/config';
import { getToken } from '@/lib/storage/secure-token';

/**
 * Builds an expo-image source for an API endpoint that streams image bytes
 * behind the Sanctum bearer token (garden photos, 3D previews, etc.). The URI
 * alone is not enough — the token must ride along as a header.
 */
export async function authedImageSource(
  path: string
): Promise<{ uri: string; headers: Record<string, string> } | null> {
  const token = await getToken();
  if (!token) return null;
  const uri = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return { uri, headers: { Authorization: `Bearer ${token}` } };
}

/* Customer image path builders (streamed, authed). */
export const customerGardenPhotoPath = (projectId: string) =>
  `/me/projects/${projectId}/garden-photo`;
export const customerConfiguratorPreviewPath = (projectId: string) =>
  `/me/projects/${projectId}/configurator-preview`;
