import { z } from 'zod';

import { t } from '@/lib/i18n';

/**
 * Validation schemas for the auth forms. These are factory functions so the
 * localized messages resolve against the current language at validation time
 * rather than being frozen when the module loads.
 */

/** Mirrors the backend's own `min:8` rule on every password field. */
export const MIN_PASSWORD_LENGTH = 8;

export const loginSchema = () =>
  z.object({
    email: z.string().email(t('auth.validation.email')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  });
export type LoginInput = z.infer<ReturnType<typeof loginSchema>>;

export const passwordResetSchema = () =>
  z.object({
    email: z.string().email(t('auth.validation.email')),
    code: z.string().min(4, t('auth.validation.codeIncomplete')),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, t('account.password.tooShort', { n: MIN_PASSWORD_LENGTH })),
  });
export type PasswordResetInput = z.infer<ReturnType<typeof passwordResetSchema>>;
