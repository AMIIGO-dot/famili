/**
 * FAMILJ – Child Auth Store
 *
 * Manages the child login flow:
 *  - Redeeming invite codes → anonymous Supabase session
 *  - Creating a 4-digit PIN (stored in SecureStore)
 *  - Verifying PIN on each app open
 *
 * `pinVerified` is an in-memory flag. It resets to false on cold start,
 * forcing children to enter their PIN again.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';

const PIN_KEY = (userId: string) => `familj_child_pin_${userId}`;

export interface RedeemResult {
  memberId: string;
  familyId: string;
}

interface ChildAuthState {
  // True once PIN has been verified this session (in-memory only)
  pinVerified: boolean;

  // Set after successful code redemption, read by child-pin-create
  pendingJoin: { userId: string; result: RedeemResult } | null;

  // Actions
  joinWithCode: (
    code: string
  ) => Promise<{ success: true; result: RedeemResult } | { success: false; error: string }>;

  createPin: (pin: string, userId: string) => Promise<void>;
  verifyPin: (pin: string, userId: string) => Promise<boolean>;
  hasPinSet: (userId: string) => Promise<boolean>;
  setPinVerified: (v: boolean) => void;
  clearPending: () => void;
}

export const useChildAuthStore = create<ChildAuthState>((set) => ({
  pinVerified: false,
  pendingJoin: null,

  setPinVerified: (v) => set({ pinVerified: v }),
  clearPending: () => set({ pendingJoin: null }),

  joinWithCode: async (code) => {
    try {
      let userId: string;

      // Sign in anonymously to get a real Supabase user
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        return { success: false, error: error?.message ?? 'Sign in failed' };
      }
      userId = data.user.id;

      // Call edge function — validates code, marks used, links user_id to member
      // (admin client bypasses members_owner RLS for the user not yet in any family)
      const { data: redeemData, error: fnErr } = await supabase.functions.invoke(
        'redeem-invite-code',
        { body: { code } },
      );
      if (fnErr || !redeemData || redeemData.error) {
        return { success: false, error: 'invalid_code' };
      }
      const result: RedeemResult = {
        memberId: redeemData.memberId,
        familyId: redeemData.familyId,
      };

      set({ pendingJoin: { userId, result } });
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Unknown error' };
    }
  },

  createPin: async (pin, userId) => {
    await SecureStore.setItemAsync(PIN_KEY(userId), pin);
    set({ pinVerified: true, pendingJoin: null });
  },

  verifyPin: async (pin, userId) => {
    const stored = await SecureStore.getItemAsync(PIN_KEY(userId));
    const valid = stored === pin;
    if (valid) set({ pinVerified: true });
    return valid;
  },

  hasPinSet: async (userId) => {
    const stored = await SecureStore.getItemAsync(PIN_KEY(userId));
    return stored !== null;
  },
}));
