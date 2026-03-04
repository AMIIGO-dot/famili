/**
 * FAMILJ – Purchase Store (Zustand)
 *
 * Manages RevenueCat subscription state:
 *  - customerInfo (entitlements)
 *  - current offerings (packages to show in paywall)
 *  - isPremium computed flag
 *  - purchase / restore actions
 */

import { create } from 'zustand';
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { Purchases, isPurchasesConfigured, isSDKInitialized, initPurchases } from '../lib/purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export { PAYWALL_RESULT };

/**
 * Entitlement identifier as configured in the RevenueCat dashboard.
 * Dashboard → Entitlements → "pro" (display name: "Familu.app Pro")
 */
const PREMIUM_ENTITLEMENT = 'pro';

/** Derive isPremium from a CustomerInfo object */
function deriveIsPremium(ci: CustomerInfo | null): boolean {
  return !!ci?.entitlements.active[PREMIUM_ENTITLEMENT];
}

/**
 * Sync the owner's subscription to Supabase so family members (co-parents, kids)
 * can inherit premium access without a RevenueCat account of their own.
 * Acts as an in-app complement to the RevenueCat → Supabase webhook.
 */
async function syncSubscriptionToSupabase(customerInfo: CustomerInfo): Promise<void> {
  try {
    const { useAuthStore } = await import('./authStore');
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    const { supabase } = await import('../lib/supabase');
    const { Platform } = await import('react-native');

    const entitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
    const isActive = !!entitlement;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    const productId = entitlement?.productIdentifier ?? '';
    const plan = !isActive
      ? 'free'
      : productId.toLowerCase().includes('year') || productId.toLowerCase().includes('annual')
        ? 'yearly'
        : 'monthly';

    await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          status: isActive ? 'active' : 'cancelled',
          plan,
          expires_at: entitlement?.expirationDate ?? null,
          platform,
        },
        { onConflict: 'user_id' }
      );

    // Refresh family store so co-parents/kids reflect the new status immediately
    const { useFamilyStore } = await import('./familyStore');
    await useFamilyStore.getState().fetchSubscription(userId);
  } catch (err) {
    console.warn('[PurchaseStore] syncToSupabase error:', err);
  }
}

interface PurchaseState {
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  isLoading: boolean;
  error: string | null;
  isPremium: boolean;

  // Actions
  fetchCustomerInfo: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  presentPaywall: (entitlementId?: string) => Promise<PAYWALL_RESULT>;
  reset: () => void;
}

export const usePurchaseStore = create<PurchaseState>((set) => ({
  customerInfo: null,
  offerings: null,
  isLoading: false,
  error: null,
  isPremium: false,

  fetchCustomerInfo: async () => {
    if (!isPurchasesConfigured) return;
    try {
      const info = await Purchases.getCustomerInfo();
      set({ customerInfo: info, isPremium: deriveIsPremium(info), error: null });
    } catch (err: any) {
      console.warn('[PurchaseStore] fetchCustomerInfo error:', err);
      set({ error: err?.message ?? 'Failed to load subscription info' });
    }
  },

  fetchOfferings: async () => {
    if (!isPurchasesConfigured) return;
    set({ isLoading: true });
    try {
      const offerings = await Purchases.getOfferings();
      set({ offerings, error: null });
    } catch (err: any) {
      console.warn('[PurchaseStore] fetchOfferings error:', err);
      set({ error: err?.message ?? 'Failed to load plans' });
    } finally {
      set({ isLoading: false });
    }
  },

  purchasePackage: async (pkg) => {
    if (!isPurchasesConfigured) return false;
    set({ isLoading: true, error: null });
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPremium = deriveIsPremium(customerInfo);
      set({ customerInfo, isPremium, isLoading: false });
      void syncSubscriptionToSupabase(customerInfo);
      return isPremium;
    } catch (err: any) {
      if (!err.userCancelled) {
        set({ error: err?.message ?? 'Purchase failed' });
        console.warn('[PurchaseStore] purchasePackage error:', err);
      }
      set({ isLoading: false });
      return false;
    }
  },

  restorePurchases: async () => {
    set({ isLoading: true, error: null });
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = deriveIsPremium(customerInfo);
      set({ customerInfo, isPremium, isLoading: false });
      void syncSubscriptionToSupabase(customerInfo);
      return isPremium;
    } catch (err: any) {
      set({ error: err?.message ?? 'Restore failed', isLoading: false });
      console.warn('[PurchaseStore] restorePurchases error:', err);
      return false;
    }
  },

  /**
   * Present the native RevenueCat paywall imperatively.
   * Only shown if the user doesn't already have the entitlement.
   */
  presentPaywall: async (entitlementId = PREMIUM_ENTITLEMENT): Promise<PAYWALL_RESULT> => {
    if (!isPurchasesConfigured) return PAYWALL_RESULT.NOT_PRESENTED;
    // Ensure SDK is configured even if initPurchases hasn't completed yet
    if (!isSDKInitialized()) {
      const { useAuthStore } = await import('./authStore');
      const userId = useAuthStore.getState().user?.id;
      await initPurchases(userId);
    }
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: entitlementId,
        displayCloseButton: true,
      });
      // Refresh customer info after any paywall interaction
      const info = await Purchases.getCustomerInfo();
      set({ customerInfo: info, isPremium: deriveIsPremium(info) });
      if (deriveIsPremium(info)) void syncSubscriptionToSupabase(info);
      return result;
    } catch (err) {
      console.warn('[PurchaseStore] presentPaywall error:', err);
      return PAYWALL_RESULT.ERROR;
    }
  },

  reset: () => set({ customerInfo: null, offerings: null, isPremium: false, error: null }),
}));
