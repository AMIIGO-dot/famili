/**
 * FAMILJ – Shared premium status hook
 *
 * Combines RevenueCat (owner's device) and Supabase subscription row
 * so co-parents and kids on the same family also reflect premium.
 */

import { usePurchaseStore } from '../stores/purchaseStore';
import { useFamilyStore } from '../stores/familyStore';

export function useIsPremium(): boolean {
  const rcPremium = usePurchaseStore((s) => s.isPremium);
  const sub = useFamilyStore((s) => s.subscription);
  const familyPremium = !!(sub?.status === 'active' && sub.plan !== 'free');
  return rcPremium || familyPremium;
}
