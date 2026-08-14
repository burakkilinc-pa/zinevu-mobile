import { useQuery } from '@tanstack/react-query';

import { request } from '@/lib/api/client';
import { useAuthStore } from '@/features/auth/store';

/**
 * The signed-in dealer's own company card — trade name and logo.
 *
 * `/auth/me` cannot answer this: its `account` block is the white-label Brand
 * of the whole tenant, and one tenant can hold a dozen dealers behind a single
 * brand. The dealer profile is the only place the company's own logo lives.
 *
 * Read is open to every role (the web shell fetches it on every page to learn
 * which modules are enabled), so a montage member sees their firm's logo too.
 * Assembler crews have no dealer profile at all — the query stays disabled for
 * them rather than firing a request the route would reject.
 */

type RawProfile = { name?: string | null; logo_url?: string | null };

export type Company = { name: string | null; logoUrl: string | null };

export function useCompany() {
  const isDealer = useAuthStore((s) => s.user?.portalType) === 'dealer';

  return useQuery({
    queryKey: ['company', 'profile'],
    enabled: isDealer,
    // The logo changes about once a year; there is no reason to refetch it on
    // every visit to Settings.
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Company> => {
      const raw = await request<RawProfile>('/portal/dealer/profile');
      return { name: raw?.name ?? null, logoUrl: raw?.logo_url ?? null };
    },
  });
}
