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
import { Purchases, isPurchasesConfigured } from '../lib/purchases';

/** Entitlement identifier configured in the RevenueCat dashboard */
const PREMIUM_ENTITLEMENT = 'premium';

interface PurchaseState {
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  isLoading: boolean;
  error: string | null;

  // Computed
  isPremium: boolean;

  // Actions
  fetchCustomerInfo: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  reset: () => void;
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  customerInfo: null,
  offerings: null as PurchasesOfferings | null,
  isLoading: false,
  error: null,

  get isPremium() {
    const ci = get().customerInfo;
    return !!ci?.entitlements.active[PREMIUM_ENTITLEMENT];
  },

  fetchCustomerInfo: async () => {
    if (!isPurchasesConfigured) return;
    try {
      const info = await Purchases.getCustomerInfo();
      set({ customerInfo: info, error: null });
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
      set({ customerInfo, isLoading: false });
      return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
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
      set({ customerInfo, isLoading: false });
      return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
    } catch (err: any) {
      set({ error: err?.message ?? 'Restore failed', isLoading: false });
      console.warn('[PurchaseStore] restorePurchases error:', err);
      return false;
    }
  },

  reset: () => set({ customerInfo: null, offerings: null, error: null }),
}));
