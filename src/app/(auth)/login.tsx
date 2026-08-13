import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
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

/**
 * Sign-in. Zinevu portal accounts are email + password; there is no social
 * sign-in, so the only alternate path is "forgot password", which stays inside
 * the app: the backend mails a short code (`channel: 'code'`), the user types
 * it here with a new password, and comes back signed in.
 */
type Step = 'signIn' | 'resetRequest' | 'resetCode';

const RESEND_AFTER = 30; // seconds before "Resend" re-enables

export default function LoginScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();
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

  // The marketing site publishes legal pages per language; fall back to English
  // for any locale it doesn't have a page for.
  function openLegal(slug: 'privacy' | 'terms') {
    const web = ['nl', 'de', 'fr', 'tr'].includes(locale) ? locale : 'en';
    void WebBrowser.openBrowserAsync(`https://zinevu.com/${web}/legal/${slug}`);
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
            <Image
              source={require('../../../assets/images/icon.png')}
              contentFit="contain"
              style={{ width: 72, height: 72, borderRadius: 18 }}
            />
            <Text className="mt-3 text-base text-muted-foreground">
              {t('auth.login.subtitle')}
            </Text>
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
