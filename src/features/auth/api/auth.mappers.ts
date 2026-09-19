import type {
  AuthAccount,
  AuthUser,
  MemberRole,
  PortalType,
} from '@/features/auth/types';

/**
 * Raw payloads from the portal auth endpoints (snake_case, loosely typed).
 *
 * /auth/me and the login token payload are NOT the same shape: `me` nests the
 * user under `user` and adds `account` + a duplicated flat copy of the same
 * fields at the top level (a backwards-compat tail the web frontend still
 * reads), while login returns only the nested `user`. Both are mapped through
 * `mapUser` below, which is why every field is optional here.
 */
export type RawPortalUser = {
  id?: number | string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
  role?: string;
  member_role?: string;
  permissions?: string[];
  is_platform_admin?: boolean;
  pricing_visible?: boolean;
  leads_pii_visible?: boolean;
  status?: string;
  has_password?: boolean;
  /** The company this user belongs to — the Dealer or Assembler row. */
  authenticatable?: { id?: number | string | null; name?: string | null } | null;
};

export type RawPortalAccount = {
  id?: number | string | null;
  name?: string;
  branded?: boolean;
  logo_url?: string | null;
  logo_data_uri?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
};

const MEMBER_ROLES: MemberRole[] = [
  'admin',
  'montage',
  'production',
  'marketing',
  'customer_service',
];

export function mapUser(raw: RawPortalUser): AuthUser {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    email: raw.email ?? '',
    avatarUrl: raw.avatar_url ?? null,
    portalType: (raw.role === 'assembler' ? 'assembler' : 'dealer') as PortalType,
    // Missing or unrecognised falls back to 'admin', matching the backend's own
    // backfill default. That is not a hole: memberRole only picks which SURFACE
    // to render, while `permissions` — resolved server-side — is what actually
    // gates every action, so an unknown role gets the office shell with only
    // the buttons its permissions allow.
    memberRole: MEMBER_ROLES.includes(raw.member_role as MemberRole)
      ? (raw.member_role as MemberRole)
      : 'admin',
    permissions: raw.permissions ?? [],
    isPlatformAdmin: !!raw.is_platform_admin,
    pricingVisible: !!raw.pricing_visible,
    leadsPiiVisible: !!raw.leads_pii_visible,
    // Who they actually work for. NOT the same as the account: account 5 alone
    // carries ~15 dealers behind a single Brand row named "Barida BV", so
    // greeting a Valk Veranda user with the account name puts another
    // company's identity on their screen (the same bug the backend's
    // PortalUserBrandResolver fixed for portal mail).
    company: raw.authenticatable?.name
      ? {
          id: raw.authenticatable.id != null ? String(raw.authenticatable.id) : null,
          name: raw.authenticatable.name,
        }
      : null,
    status: raw.status ?? 'active',
    // Only an explicit `false` means "invited, no password yet"; the login
    // payload omits the field entirely for an ordinary sign-in.
    hasPassword: raw.has_password !== false,
  };
}

export function mapAccount(raw: RawPortalAccount | undefined | null): AuthAccount {
  return {
    id: raw?.id != null ? String(raw.id) : null,
    name: raw?.name ?? 'Zinevu',
    branded: !!raw?.branded,
    // Prefer the inlined data URI: the portal serves logos through a private
    // disk, so the plain URL is not fetchable with a bearer token from here.
    logoUrl: raw?.logo_data_uri ?? raw?.logo_url ?? null,
    supportEmail: raw?.support_email ?? null,
    supportPhone: raw?.support_phone ?? null,
  };
}
