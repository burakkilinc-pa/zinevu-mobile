import * as SecureStore from 'expo-secure-store';

/**
 * Sanctum bearer token storage, backed by the platform keychain/keystore via
 * expo-secure-store. The token is the single credential the mobile app needs
 * for both REST calls and Reverb websocket auth.
 */
const TOKEN_KEY = 'zinevu.auth.token';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
