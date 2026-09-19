import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';

import { t } from '@/lib/i18n';
import { loginWithApple, loginWithGoogle } from '@/features/auth/api/auth.api';
import type { AuthSession } from '@/features/auth/types';

/**
 * Native Google / Apple sign-in, reduced to "give me a session or throw".
 *
 * Both providers do the same thing here: prove who the user is to their own
 * SDK, hand us a signed token, and let the backend decide whether that person
 * has a Zinevu account. Neither ever creates one from the app — see
 * `allow_signup: false` in auth.api.ts.
 *
 * A cancelled sheet is not a failure. It throws `SocialCancelled` so the login
 * screen can drop it silently instead of flashing an error at someone who
 * simply changed their mind.
 */
export class SocialCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'SocialCancelled';
  }
}

/**
 * The audience the backend checks the ID token against. This is the WEB client
 * id, not the iOS one: configured as `webClientId`, Google mints the id_token
 * for it even though the sheet itself runs against the native client. That is
 * what lets the phone and the web portal share one verification path.
 */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export const googleAvailable = GOOGLE_WEB_CLIENT_ID !== '';

let googleConfigured = false;

function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    // No extra scopes: we want identity, not the user's Google data. The
    // calendar integration asks for its own scopes from the portal, server
    // side, and keeps its refresh token there.
    scopes: ['email', 'profile'],
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<AuthSession> {
  configureGoogle();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  // Without this, a second sign-in silently reuses the first account and the
  // picker never appears — which looks broken to anyone with two accounts.
  await GoogleSignin.signOut().catch(() => {});

  try {
    const result = await GoogleSignin.signIn();

    if (result.type === 'cancelled') {
      throw new SocialCancelled();
    }

    const idToken = result.data?.idToken;

    if (!idToken) {
      throw new Error(t('auth.social.googleNoToken'));
    }

    return await loginWithGoogle(idToken);
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new SocialCancelled();
    }
    throw err;
  }
}

/** Sign in with Apple is iOS 13+ only; Android never sees the button. */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AuthSession> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error(t('auth.social.appleNoToken'));
    }

    // Present only on the very first sign-in, and only if the user allowed it.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');

    return await loginWithApple(credential.identityToken, fullName || null);
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new SocialCancelled();
    }
    throw err;
  }
}
