import { request } from '@/lib/api/client';
import { t } from '@/lib/i18n';
import type { AuthAccount, AuthSession, AuthUser } from '@/features/auth/types';
import {
  mapAccount,
  mapUser,
  type RawPortalAccount,
  type RawPortalUser,
} from '@/features/auth/api/auth.mappers';

/**
 * Portal authentication (routes/api.php, `v1/portal/auth`).
 *
 * Note the prefix: the app signs in as a PortalUser, NOT through the `/v1/auth`
 * routes — those belong to the old back-office `User` identity and would issue
 * a token with no portal ability, which every dealer route then rejects.
 *
 * The token comes back ability-scoped (`portal:dealer` / `portal:assembler`);
 * the client just carries it as a bearer.
 */

type TokenPayload = {
  token?: string;
  abilities?: string[];
  must_set_password?: boolean;
  user?: RawPortalUser;
};

function toSession(data: TokenPayload): AuthSession {
  if (!data.token) {
    throw new Error(t('auth.api.noSessionToken'));
  }
  return {
    token: data.token,
    user: data.user ? mapUser(data.user) : ({} as AuthUser),
    mustSetPassword: !!data.must_set_password,
  };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const data = await request<TokenPayload>('/portal/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
  return toSession(data);
}

/**
 * Starts a forgotten-password reset. `channel: 'code'` is what the app wants:
 * it mails a short code the user types on the next screen, so the flow finishes
 * inside the app instead of bouncing out to a browser link.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await request('/portal/auth/password/forgot', {
    method: 'POST',
    auth: false,
    body: { email, channel: 'code' },
  });
}

/** Completes the reset with the emailed code, returning a fresh session. */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  password: string
): Promise<AuthSession> {
  const data = await request<TokenPayload>('/portal/auth/password/reset-with-code', {
    method: 'POST',
    auth: false,
    body: { email, code, password, password_confirmation: password },
  });
  return toSession(data);
}

/** Sets the first password for an invited member (already authenticated). */
export async function setPassword(password: string): Promise<void> {
  await request('/portal/auth/set-password', {
    method: 'POST',
    body: { password, password_confirmation: password },
  });
}

/**
 * Changes the password of a signed-in member. The backend accepts EITHER the
 * current password or an emailed code as proof of identity (the latter for a
 * member who signed in by invite and never knew a password), so both are
 * optional here and exactly one is expected to be filled.
 */
export async function changePassword(args: {
  password: string;
  currentPassword?: string;
  code?: string;
}): Promise<void> {
  await request('/portal/auth/password/change', {
    method: 'POST',
    body: {
      password: args.password,
      password_confirmation: args.password,
      current_password: args.currentPassword || undefined,
      code: args.code || undefined,
    },
  });
}

/** Mails the signed-in member a code they can use to change their password. */
export async function sendOwnAccessCode(): Promise<void> {
  await request('/portal/auth/password/send-code', { method: 'POST' });
}

type MePayload = {
  user?: RawPortalUser;
  account?: RawPortalAccount;
} & RawPortalUser;

/**
 * The current user plus the tenant they belong to. `me` also repeats the user
 * fields at the top level for older clients; the nested `user` is preferred and
 * the flat copy is the fallback — except `leads_pii_visible`, which the backend
 * resolves live and only ever puts at the top level.
 */
export async function fetchMe(): Promise<{ user: AuthUser; account: AuthAccount }> {
  const data = await request<MePayload>('/portal/auth/me');
  const raw: RawPortalUser = {
    ...(data.user ?? data),
    leads_pii_visible: data.leads_pii_visible,
  };
  return { user: mapUser(raw), account: mapAccount(data.account) };
}

export async function logout(): Promise<void> {
  try {
    await request('/portal/auth/logout', { method: 'POST' });
  } catch {
    // Even if the server call fails, the client clears its token.
  }
}
