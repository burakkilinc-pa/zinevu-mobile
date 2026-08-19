import type { AuthUser, MemberRole } from '@/features/auth/types';

/**
 * Which "space" of the app the user lands in — the three layers the product is
 * built around:
 *
 *  - `admin`     Zinevu platform staff (is_platform_admin). Sees the back-office
 *                on top of everything a dealer sees.
 *  - `dealer`    The tenant's own office (e.g. Valk Veranda): leads, planning,
 *                chat, support.
 *  - `installer` The montage crew — either a subcontracted assembler company or
 *                a dealer's own `montage` seat. A stripped surface: the visits
 *                assigned to them, and nothing else.
 *
 * Permission keys mirror App\Support\PortalPermissions on the backend. Nothing
 * here is a security boundary — it only decides what to render; every write is
 * re-checked server-side by the `portal_can` middleware.
 */
export type AppSpace = 'admin' | 'dealer' | 'installer';

export const PERMISSIONS = {
  leadsView: 'leads.view',
  leadsManage: 'leads.manage',
  leadsCommunicate: 'leads.communicate',
  offersView: 'offers.view',
  offersManage: 'offers.manage',
  offersSend: 'offers.send',
  chatView: 'chat.view',
  // The dealer's own lead funnels — what the `+` on the leads screen opens.
  formsView: 'forms.view',
  chatReply: 'chat.reply',
  pricingView: 'pricing.view',
  calendarView: 'calendar.view',
  calendarManage: 'calendar.manage',
  tasksView: 'tasks.view',
  // Booking / rescheduling a visit, as opposed to carrying one out.
  tasksManage: 'tasks.manage',
  tasksExecute: 'tasks.execute',
  jobsView: 'jobs.view',
  analyticsView: 'analytics.view',
  settingsView: 'settings.view',
  teamManage: 'team.manage',
} as const;

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return !!user?.permissions?.includes(permission);
}

/** True when the user holds at least one of the given permissions. */
export function hasAnyPermission(user: AuthUser | null, permissions: string[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export function isMemberRole(user: AuthUser | null, role: MemberRole): boolean {
  return user?.memberRole === role;
}

/**
 * Resolve the space to route the user into.
 *
 * Order matters. Platform admin wins outright. Then the installer test comes
 * BEFORE the dealer one, because a `montage` seat inside a dealer's own account
 * is still a crew member — its portalType is 'dealer', so checking the portal
 * type first would drop a fitter into the full office app.
 */
export function resolveAppSpace(user: AuthUser | null): AppSpace {
  if (!user) return 'dealer';
  if (user.isPlatformAdmin) return 'admin';
  if (user.portalType === 'assembler') return 'installer';
  if (user.memberRole === 'montage') return 'installer';
  return 'dealer';
}
