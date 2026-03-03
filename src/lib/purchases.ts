/**
 * FAMILJ – RevenueCat Purchases Initialization
 *
 * Call `initPurchases(userId?)` once at app startup (after auth resolves).
 * Uses EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY from .env
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const IOS_KEY     = process.env.EXPO_PUBLIC_RC_IOS_KEY     ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

const isConfigured = Platform.OS === 'ios'
  ? IOS_KEY.length > 10
  : ANDROID_KEY.length > 10;

if (!isConfigured) {
  console.warn(
    '[FAMILJ] Set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY in .env to enable IAP'
  );
}

let _initialized = false;

/**
 * Initialize RevenueCat. Safe to call multiple times (idempotent).
 * Pass the authenticated Supabase user ID to link the customer.
 */
export async function initPurchases(userId?: string): Promise<void> {
  if (!isConfigured) return;

  const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;

  if (!_initialized) {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey });
    _initialized = true;
  }

  // Link RevenueCat anonymous ID to the Supabase user ID
  if (userId) {
    try {
      await Purchases.logIn(userId);
    } catch (err) {
      console.warn('[Purchases] logIn error:', err);
    }
  }
}

export { isConfigured as isPurchasesConfigured };
export { Purchases };
