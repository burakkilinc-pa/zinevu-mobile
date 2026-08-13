import { request } from '@/lib/api/client';

export type RegisteredDevice = { id: string; platform: string };

/**
 * POST /portal/me/devices — idempotent on (portal_user, token): re-registering
 * the same token just bumps last_seen_at and clears a previous revocation.
 *
 * Lives under `v1/portal` (not the dealer-only group) because an assembler's
 * crew phone must register too.
 */
export async function registerDevice(input: {
  token: string;
  platform: 'ios' | 'android';
  appVersion?: string | null;
  deviceName?: string | null;
}): Promise<RegisteredDevice> {
  const data = await request<{ device: { id: string; platform: string } }>(
    '/portal/me/devices',
    {
      method: 'POST',
      body: {
        token: input.token,
        platform: input.platform,
        app_version: input.appVersion ?? null,
        device_name: input.deviceName ?? null,
      },
    }
  );
  return { id: data.device.id, platform: data.device.platform };
}

/** Soft-revokes the device server-side — used on sign-out. */
export async function unregisterDevice(deviceId: string): Promise<void> {
  await request(`/portal/me/devices/${deviceId}`, { method: 'DELETE' });
}
