/**
 * Zinevu's portal identity. Everyone who signs into the app is a PortalUser
 * (app/Models/PortalUser.php) — there is no separate customer identity here.
 *
 * TWO independent axes decide what a user sees, and conflating them is the
 * classic bug:
 *
 *  - `portalType` — which tenant side they belong to: the dealer's own portal
 *    ("dealer", e.g. Valk Veranda) or a subcontracted installer company
 *    ("assembler", e.g. Valk's montage firm).
 *  - `memberRole` — their seat WITHIN that company (admin / montage /
 *    production / marketing / customer_service).
 *
 * `isPlatformAdmin` is a third, orthogonal flag: Zinevu staff, granted only in
 * the database, unlocking the platform back-office.
 *
 * Neither axis is the authorization source of truth — `permissions` is. See
 * App\Support\PortalPermissions on the backend; every write is re-checked there
 * regardless of what this client believes.
 */

/** Which side of the portal the account belongs to. */
export type PortalType = 'dealer' | 'assembler';

/** Seat within the company (app/Enums/PortalUserRoleEnum.php). */
export type MemberRole =
  | 'admin'
  | 'montage'
  | 'production'
  | 'marketing'
  | 'customer_service';

/**
 * The signed-in user, shaped from the portal /auth/me payload. Snake_case
 * fields from the API are mapped to camelCase here — see api/auth.mappers.ts.
 */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  portalType: PortalType;
  memberRole: MemberRole;
  /** Effective capability keys, e.g. "leads.view", "calendar.view". */
  permissions: string[];
  isPlatformAdmin: boolean;
  /** Whether money is shown to this member at all (pricing.view). */
  pricingVisible: boolean;
  /** Whether the leads screens may show customer PII to this member. */
  leadsPiiVisible: boolean;
  /**
   * The company the user works for (the Dealer or Assembler row behind them).
   * This — not `AuthAccount` — is who they are: one account can hold many
   * dealers behind a single white-label Brand, so the account name belongs to
   * the reseller, never to the person reading the screen.
   */
  company: { id: string | null; name: string } | null;
  status: string;
  /** False for an invited member who still has to choose a password. */
  hasPassword: boolean;
};

/** The tenant whose portal the user is inside — drives white-label branding. */
export type AuthAccount = {
  id: string | null;
  name: string;
  /** False for a direct Zinevu signup, which has no white-label Brand row. */
  branded: boolean;
  logoUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  /** True when an invited member must set a password before continuing. */
  mustSetPassword: boolean;
};
