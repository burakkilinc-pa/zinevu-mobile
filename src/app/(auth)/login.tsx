import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/client';
import { useColors } from '@/lib/theme';
import { useT, useLocale } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/store';
import {
  requestPasswordReset,
  resetPasswordWithCode,
} from '@/features/auth/api/auth.api';
import { OtpInput } from '@/features/auth/components/otp-input';
import { loginSchema, passwordResetSchema } from '@/features/auth/schemas';
import {
  SocialCancelled,
  appleAvailable,
  googleAvailable,
  signInWithApple,
  signInWithGoogle,
} from '@/features/auth/social';

/**
 * Sign-in. Email + password, or Google / Apple — all three end at the same
 * portal session. The social buttons only ever sign an existing member in;
 * unlike the web sign-up page they never create a tenant (see social.ts).
 *
 * "Forgot password" stays inside the app rather than bouncing to a browser
 * link: the backend mails a short code (`channel: 'code'`), the user types it
 * here with a new password, and comes back signed in.
 */
type Step = 'signIn' | 'resetRequest' | 'resetCode';

const RESEND_AFTER = 30; // seconds before "Resend" re-enables

const MARK_H = 44; // brand Z height on the lime tile
const MARK_W = Math.round((MARK_H * 164) / 224); // the mark's own 164×224 aspect

export default function LoginScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
  const { colorScheme: scheme } = useColorScheme();
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const signInWithSession = useAuthStore((s) => s.signInWithSession);

  const [step, setStep] = useState<Step>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [social, setSocial] = useState<'google' | 'apple' | null>(null);
  const [showApple, setShowApple] = useState(false);

  // Sign in with Apple exists on iOS 13+ only, so the button is asked for
  // rather than assumed — on Android and older iOS it never renders.
  useEffect(() => {
    let alive = true;
    void appleAvailable().then((ok) => {
      if (alive) setShowApple(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Resend cooldown so a user can't hammer the (rate-limited) mail endpoint.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function friendlyError(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return t('auth.login.genericError');
  }

  async function handleSignIn() {
    const parsed = loginSchema().safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('auth.login.checkDetails'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(parsed.data.email, parsed.data.password);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Both social buttons end the same way — a session from the backend — so the
   * provider is just which SDK opens the sheet. A cancelled sheet leaves the
   * screen exactly as it was: no error, nothing to dismiss.
   */
  async function handleSocial(provider: 'google' | 'apple') {
    setError(null);
    setSocial(provider);
    try {
      const session = await (provider === 'google' ? signInWithGoogle() : signInWithApple());
      await signInWithSession(session);
    } catch (err) {
      if (!(err instanceof SocialCancelled)) setError(friendlyError(err));
    } finally {
      setSocial(null);
    }
  }

  async function handleSendResetCode() {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setCode('');
      setStep('resetCode');
      setCooldown(RESEND_AFTER);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit() {
    const parsed = passwordResetSchema().safeParse({ email, code, password: newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('auth.login.checkCode'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const session = await resetPasswordWithCode(
        parsed.data.email,
        parsed.data.code,
        parsed.data.password
      );
      await signInWithSession(session);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  function backToSignIn() {
    setStep('signIn');
    setCode('');
    setNewPassword('');
    setCooldown(0);
    setError(null);
  }

  // The marketing site publishes legal pages in nl/en/de/fr only — Turkish
  // falls back to English. The privacy page the App Store listing points at is
  // the mobile-specific one, not the generic /legal/privacy.
  function openLegal(page: 'privacy' | 'terms') {
    const web = ['nl', 'de', 'fr'].includes(locale) ? locale : 'en';
    const path = page === 'privacy' ? 'mobile-app-privacy' : 'legal/terms';
    void WebBrowser.openBrowserAsync(`https://zinevu.com/${web}/${path}`);
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={0}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-9 items-center">
            {/* The bare Z on a lime tile — the same mark the tab bar uses, not
                the app-icon PNG, whose Z sits inside so much safe-area padding
                that at this size it reads as an empty square. Lime behind it
                so the black mark holds up in both schemes. */}
            <View
              className="items-center justify-center bg-brand-lime"
              style={{ width: 76, height: 76, borderRadius: 20 }}
            >
              <Image
                source={require('../../../assets/images/zinevu-mark.svg')}
                contentFit="contain"
                style={{ width: MARK_W, height: MARK_H }}
              />
            </View>
          </View>

          {step === 'resetCode' ? (
            /* ---- Code + new password ---- */
            <View className="gap-5">
              <View className="gap-1.5 rounded-2xl bg-accent/60 p-4">
                <View className="mb-1 h-8 w-8 items-center justify-center rounded-full bg-card">
                  <Ionicons name="mail-outline" size={17} color={c.foreground} />
                </View>
                <Text className="text-sm text-foreground">
                  {t('auth.reset.codeSentTo', { email })}
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">
                  {t('auth.reset.codeLabel')}
                </Text>
                <OtpInput value={code} onChange={setCode} />
              </View>

              <TextField
                label={t('auth.reset.newPassword')}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                revealToggle
                placeholder="••••••••"
              />

              {error ? (
                <Text className="text-center text-sm text-destructive">{error}</Text>
              ) : null}

              <Button
                title={t('auth.reset.submit')}
                loading={loading}
                onPress={handleResetSubmit}
              />

              <Pressable
                onPress={handleSendResetCode}
                disabled={cooldown > 0 || loading}
                accessibilityRole="button"
                className="items-center py-1 disabled:opacity-40"
              >
                <Text className="text-sm font-semibold text-foreground">
                  {cooldown > 0
                    ? `${t('auth.reset.resendCode')} (${cooldown})`
                    : t('auth.reset.resendCode')}
                </Text>
              </Pressable>

              <Button title={t('auth.login.back')} variant="outline" onPress={backToSignIn} />
            </View>
          ) : (
            /* ---- Email + password, or the reset request ---- */
            <View className="gap-4">
              <TextField
                label={t('auth.login.emailLabel')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder={t('auth.login.emailPlaceholder')}
              />

              {step === 'signIn' ? (
                <TextField
                  label={t('auth.login.passwordLabel')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  revealToggle
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              ) : null}

              {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

              {step === 'signIn' ? (
                <>
                  <Button
                    title={t('auth.login.signIn')}
                    loading={loading}
                    onPress={handleSignIn}
                  />
                  <Button
                    title={t('auth.reset.start')}
                    variant="ghost"
                    onPress={() => {
                      setStep('resetRequest');
                      setError(null);
                    }}
                  />

                  {googleAvailable || showApple ? (
                    <>
                      <View className="my-1 flex-row items-center gap-3">
                        <View className="h-px flex-1 bg-border" />
                        <Text className="text-xs uppercase text-muted-foreground">
                          {t('auth.social.divider')}
                        </Text>
                        <View className="h-px flex-1 bg-border" />
                      </View>

                      {googleAvailable ? (
                        <Button
                          title={t('auth.social.google')}
                          variant="outline"
                          icon="logo-google"
                          loading={social === 'google'}
                          disabled={loading || social !== null}
                          onPress={() => handleSocial('google')}
                        />
                      ) : null}

                      {/* Apple's own button, not our outline one: the App Store
                          guidelines pin its wording and appearance, and a
                          look-alike is a known review rejection. */}
                      {showApple ? (
                        <AppleAuthentication.AppleAuthenticationButton
                          buttonType={
                            AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                          }
                          buttonStyle={
                            scheme === 'dark'
                              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                          }
                          cornerRadius={6}
                          style={{ height: 48 }}
                          onPress={() => handleSocial('apple')}
                        />
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Button
                    title={t('auth.reset.sendCode')}
                    loading={loading}
                    onPress={handleSendResetCode}
                  />
                  <Button
                    title={t('auth.login.back')}
                    variant="ghost"
                    onPress={backToSignIn}
                  />
                </>
              )}
            </View>
          )}

          {/* Legal footer — required for App Store review; links open in an
              in-app browser (SFSafariViewController on iOS). */}
          <View className="mt-8 px-4">
            <Text className="text-center text-xs leading-5 text-muted-foreground">
              {t('auth.login.legalIntro')}{' '}
              <Text
                accessibilityRole="link"
                className="font-medium text-foreground underline"
                onPress={() => openLegal('terms')}
              >
                {t('auth.login.termsOfUse')}
              </Text>
              {' & '}
              <Text
                accessibilityRole="link"
                className="font-medium text-foreground underline"
                onPress={() => openLegal('privacy')}
              >
                {t('auth.login.privacyPolicy')}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
