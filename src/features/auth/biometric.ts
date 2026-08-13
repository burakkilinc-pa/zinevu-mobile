import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Face ID / fingerprint unlock. Opt-in: the token already lives in secure store;
 * biometrics just gate access to the already-signed-in session on launch.
 */

const ENABLED_KEY = 'zinevu.biometric.enabled';

/** Hardware present AND the user has enrolled a face/finger. */
export async function biometricSupported(): Promise<boolean> {
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

/** Which biometry the device offers (to label the toggle Face ID vs Fingerprint). */
export async function biometricKind(): Promise<'face' | 'fingerprint' | 'generic'> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION))
      return 'face';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT))
      return 'fingerprint';
    return 'generic';
  } catch {
    return 'generic';
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
}

export async function setBiometricEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

/** Prompt the OS biometric sheet. Returns whether it succeeded. */
export async function authenticateBiometric(reason: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: undefined,
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
