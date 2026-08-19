import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  duplicateDeal,
  fetchCustomerTokens,
  fetchEngagement,
  fetchOfferLines,
  fetchOfferPdfUrl,
  fetchPriceCheck,
  issueCustomerToken,
  pinPrices,
  reprocessWizard,
  saveOffer,
  sendOffer,
  sendTestOffer,
  updateWizardAnswers,
  type OfferLine,
  type OfferSettings,
} from '@/features/leads/api/offer.api';
import { leadKeys } from '@/features/leads/hooks/use-leads';

export const offerKeys = {
  detail: (ref: string) => ['leads', 'detail', ref] as const,
  lines: (dealId: number) => ['offer', 'lines', dealId] as const,
  priceCheck: (dealId: number) => ['offer', 'price-check', dealId] as const,
  engagement: (dealId: number) => ['offer', 'engagement', dealId] as const,
  tokens: (dealId: number) => ['offer', 'tokens', dealId] as const,
};

/**
 * Everything a write touches.
 *
 * Saving lines moves the total, which the lead CARD shows, and sending moves
 * the board column the lead sits in — so a write invalidates the list and the
 * counts too, not just the screen the dealer is looking at.
 */
function useOfferInvalidator(ref: string, dealId: number) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: offerKeys.detail(ref) });
    void queryClient.invalidateQueries({ queryKey: offerKeys.lines(dealId) });
    void queryClient.invalidateQueries({ queryKey: offerKeys.priceCheck(dealId) });
    void queryClient.invalidateQueries({ queryKey: offerKeys.engagement(dealId) });
    void queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
    void queryClient.invalidateQueries({ queryKey: leadKeys.counts });
  };
}

/** The lines, fresh — the editor opens on these rather than the cached deal. */
export function useOfferLines(dealId: number | null) {
  return useQuery({
    queryKey: offerKeys.lines(dealId ?? 0),
    queryFn: () => fetchOfferLines(dealId as number),
    enabled: !!dealId,
  });
}

export function useSaveOffer(ref: string, dealId: number) {
  const invalidate = useOfferInvalidator(ref, dealId);

  return useMutation({
    mutationFn: (input: { lines: OfferLine[]; settings: OfferSettings }) =>
      saveOffer(dealId, input.lines, input.settings),
    onSuccess: invalidate,
  });
}

/**
 * What the price list says today, per line.
 *
 * Only fetched when the dealer opens the price panel: it re-runs the pricing
 * engine over the deal, which is far too much work to do on every render of an
 * editor most dealers will never open it from.
 */
export function usePriceCheck(dealId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: offerKeys.priceCheck(dealId ?? 0),
    queryFn: () => fetchPriceCheck(dealId as number),
    enabled: !!dealId && enabled,
    staleTime: 60_000,
  });
}

export function usePinPrices(ref: string, dealId: number) {
  const invalidate = useOfferInvalidator(ref, dealId);

  return useMutation({
    mutationFn: (lines: { name: string; pinned: boolean; price?: number }[]) =>
      pinPrices(dealId, lines),
    onSuccess: invalidate,
  });
}

export function useEngagement(dealId: number | null, enabled = true) {
  return useQuery({
    queryKey: offerKeys.engagement(dealId ?? 0),
    queryFn: () => fetchEngagement(dealId as number),
    enabled: !!dealId && enabled,
    staleTime: 30_000,
  });
}

export function useCustomerTokens(dealId: number | null) {
  return useQuery({
    queryKey: offerKeys.tokens(dealId ?? 0),
    queryFn: () => fetchCustomerTokens(dealId as number),
    enabled: !!dealId,
    staleTime: 30_000,
  });
}

export function useSendOffer(ref: string, dealId: number) {
  const invalidate = useOfferInvalidator(ref, dealId);

  return useMutation({
    mutationFn: () => sendOffer(dealId),
    onSuccess: invalidate,
  });
}

export function useSendTestOffer(dealId: number) {
  return useMutation({ mutationFn: () => sendTestOffer(dealId) });
}

export function useIssueCustomerToken(dealId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => issueCustomerToken(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: offerKeys.tokens(dealId) });
    },
  });
}

/** Renders the PDF if it doesn't exist yet, so it can take a moment. */
export function useOfferPdf(dealId: number) {
  return useMutation({ mutationFn: () => fetchOfferPdfUrl(dealId) });
}

export function useUpdateAnswers(ref: string, dealId: number) {
  const invalidate = useOfferInvalidator(ref, dealId);

  return useMutation({
    mutationFn: (overrides: Record<string, string>) => updateWizardAnswers(dealId, overrides),
    onSuccess: invalidate,
  });
}

export function useReprocessWizard(ref: string, dealId: number) {
  const invalidate = useOfferInvalidator(ref, dealId);

  return useMutation({
    mutationFn: (force: boolean = false) => reprocessWizard(dealId, force),
    onSuccess: invalidate,
  });
}

export function useDuplicateDeal(dealId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => duplicateDeal(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads', 'list'] });
      void queryClient.invalidateQueries({ queryKey: leadKeys.counts });
    },
  });
}
