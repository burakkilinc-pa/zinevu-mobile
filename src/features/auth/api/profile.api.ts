import { request, uploadMultipart } from '@/lib/api/client';
import { mapUser, type RawPortalUser } from '@/features/auth/api/auth.mappers';
import type { AuthUser } from '@/features/auth/types';

/**
 * Your own profile.
 *
 * These live under `portal/me` rather than on the team-members surface: that
 * one needs `team.manage`, which would mean a montage crew member could never
 * set their own photo. Nothing here can touch another account.
 *
 * The response carries a partial user (the fields a profile edit can change),
 * so it is merged over the one already in the store rather than replacing it —
 * permissions and the portal type do not come back from this endpoint and must
 * not be lost.
 */

function merge(current: AuthUser, raw: RawPortalUser): AuthUser {
  const updated = mapUser(raw);

  return {
    ...current,
    name: updated.name || current.name,
    email: updated.email || current.email,
    avatarUrl: raw.avatar_url ?? null,
  };
}

export async function updateProfile(current: AuthUser, name: string): Promise<AuthUser> {
  const d = await request<{ user: RawPortalUser }>('/portal/me/profile', {
    method: 'PATCH',
    body: { name },
  });

  return merge(current, d.user);
}

export async function uploadAvatar(
  current: AuthUser,
  file: { uri: string; name: string; type: string }
): Promise<AuthUser> {
  const form = new FormData();
  // React Native's classic file part. Sent over XHR (see uploadMultipart) —
  // Expo's fetch rejects this shape.
  form.append('avatar', file as unknown as Blob);

  const d = await uploadMultipart<{ user: RawPortalUser }>('/portal/me/avatar', form);

  return merge(current, d.user);
}

export async function deleteAvatar(current: AuthUser): Promise<AuthUser> {
  const d = await request<{ user: RawPortalUser }>('/portal/me/avatar', {
    method: 'DELETE',
  });

  return merge(current, d.user);
}
