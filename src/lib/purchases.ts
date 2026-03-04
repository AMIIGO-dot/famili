/**
 * FAMILJ – RevenueCat Purchases Initialization
 *
 * Call `initPurchases(userId?)` once at app startup (after auth resolves).
 *
 * Reads EXPO_PUBLIC_RC_API_KEY from .env (single cross-platform key).
 * Platform-specific fallbacks EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY
 * are also supported for projects that already use separate keys.
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// Single cross-platform key takes precedence; fall back to per-platform keys
const RC_API_KEY =
  process.env.EXPO_PUBLIC_RC_API_KEY ??
  (Platform.OS === 'ios'
    ? (process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '')
    : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? ''));

export const isPurchasesConfigured = RC_API_KEY.length > 10;

if (!isPurchasesConfigured) {
  console.warn(
    '[FAMILJ] Set EXPO_PUBLIC_RC_API_KEY in .env to enable in-app purchases'
  );
}

let _initialized = false;

/** Returns true once Purchases.configure() has been called. */
export function isSDKInitialized(): boolean {
  return _initialized;
}

/**
 * Initialize RevenueCat SDK. Safe to call multiple times – idempotent.
 * Pass the authenticated Supabase user ID to link the RevenueCat customer
 * record to the app account.
 */
export async function initPurchases(userId?: string): Promise<void> {
  if (!isPurchasesConfigured) return;

  if (!_initialized) {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey: RC_API_KEY });
    _initialized = true;
    console.log('[Purchases] SDK configured');
  }

  if (userId) {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      console.log('[Purchases] Logged in user:', userId,
        '| active entitlements:', Object.keys(customerInfo.entitlements.active));
    } catch (err) {
      console.warn('[Purchases] logIn error:', err);
    }
  }
}

export { Purchases };
