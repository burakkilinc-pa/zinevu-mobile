import { create } from 'zustand';

import { setUnauthorizedHandler } from '@/lib/api/client';
import { getToken, setToken, clearToken } from '@/lib/storage/secure-token';
import type { AuthAccount, AuthSession, AuthUser } from '@/features/auth/types';
import * as authApi from '@/features/auth/api/auth.api';
import { forgetPushDevice, revokePushDevice } from '@/features/push/use-push';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  /** The tenant whose portal we're inside — drives white-label branding. */
  account: AuthAccount | null;
  /** True for an invited member who must choose a password before continuing. */
  mustSetPassword: boolean;
  /** Load a persisted token on app start and rehydrate the user. */
  bootstrap: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithSession: (session: AuthSession) => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Replaces the cached user after a profile / avatar update. */
  setUser: (user: AuthUser) => void;
  /** Clears the "choose a password" gate once the member has set one. */
  clearMustSetPassword: () => void;
  signOut: () => Promise<void>;
  /**
   * Erases this member and tears the session down. Throws if the backend
   * refuses (wrong password, last admin) — the session must survive a refusal.
   */
  deleteAccount: (password?: string) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  account: null,
  mustSetPassword: false,

  bootstrap: async () => {
    const token = await getToken();
    if (!token) {
      set({ status: 'unauthenticated', user: null, account: null });
      return;
    }
    try {
      const { user, account } = await authApi.fetchMe();
      set({ status: 'authenticated', user, account });
    } catch {
      await clearToken();
      set({ status: 'unauthenticated', user: null, account: null });
    }
  },

  signInWithPassword: async (email, password) => {
    const session = await authApi.login(email, password);
    await get().signInWithSession(session);
  },

  signInWithSession: async (session) => {
    await setToken(session.token);
    // The login payload carries the user but never the account (branding), so
    // /auth/me is fetched regardless — it is also the canonical copy of the
    // permissions the token was minted with.
    const { user, account } = await authApi.fetchMe();
    set({
      status: 'authenticated',
      user,
      account,
      mustSetPassword: session.mustSetPassword || !user.hasPassword,
    });
  },

  setUser: (user) => set({ user }),

  clearMustSetPassword: () => set({ mustSetPassword: false }),

  refreshUser: async () => {
    if (get().status !== 'authenticated') return;
    try {
      const { user, account } = await authApi.fetchMe();
      set({ user, account });
    } catch {
      // handled by the 401 interceptor if it's an auth failure
    }
  },

  signOut: async () => {
    // Stop this phone receiving the leaving user's pushes before the token
    // that authorizes the revocation is thrown away.
    await revokePushDevice();
    await authApi.logout();
    await clearToken();
    set({
      status: 'unauthenticated',
      user: null,
      account: null,
      mustSetPassword: false,
    });
  },

  deleteAccount: async (password) => {
    // First, and unguarded: a refusal (wrong password, last admin) must throw
    // out of here with the session — and this phone's push — untouched.
    await authApi.deleteAccount(password);
    // The device row went with the account, so only the local id is left.
    await forgetPushDevice();
    await clearToken();
    set({
      status: 'unauthenticated',
      user: null,
      account: null,
      mustSetPassword: false,
    });
  },
}));

// A 401 from any request tears down the session exactly once.
setUnauthorizedHandler(() => {
  const { status } = useAuthStore.getState();
  if (status !== 'unauthenticated') {
    void clearToken();
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      account: null,
      mustSetPassword: false,
    });
  }
});
