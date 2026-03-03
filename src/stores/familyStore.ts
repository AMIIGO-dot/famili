/**
 * FAMILJ – Family Store (Zustand)
 *
 * Manages the current family, its members, and subscription status.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// Keep in sync with authStore.ts
const DEV_BYPASS = false;

type Family = Database['public']['Tables']['families']['Row'];
type Member = Database['public']['Tables']['members']['Row'];
type Subscription = Database['public']['Tables']['subscriptions']['Row'];

interface FamilyState {
  family: Family | null;
  members: Member[];
  subscription: Subscription | null;
  isLoading: boolean;

  // Computed
  isPremium: boolean;

  // Actions
  fetchFamily: (userId: string) => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchSubscription: (userId: string) => Promise<void>;
  addMember: (member: Database['public']['Tables']['members']['Insert']) => Promise<Member | null>;
  updateMember: (id: string, updates: Database['public']['Tables']['members']['Update']) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family: null,
  members: [],
  subscription: null,
  isLoading: false,

  get isPremium() {
    const sub = get().subscription;
    return sub?.status === 'active' && sub.plan !== 'free';
  },

  fetchFamily: async (userId: string) => {
    set({ isLoading: true });
    try {
      // maybeSingle() returns null (not an error) when the user has no family yet
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();

      if (error) throw error;
      set({ family: data ?? null });
      if (data) await get().fetchMembers();
    } catch (err) {
      console.error('[FamilyStore] fetchFamily error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMembers: async () => {
    const { family } = get();
    if (!family) return;

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('family_id', family.id);

    if (error) {
      console.error('[FamilyStore] fetchMembers error:', error);
      return;
    }
    set({ members: data ?? [] });
  },

  fetchSubscription: async (userId: string) => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (user is on free plan)
      console.error('[FamilyStore] fetchSubscription error:', error);
      return;
    }
    set({ subscription: data ?? null });
  },

  addMember: async (member) => {
    const { data, error } = await supabase
      .from('members')
      .insert(member)
      .select()
      .single();

    if (error) {
      console.error('[FamilyStore] addMember error:', error);
      return null;
    }
    set((state) => ({ members: [...state.members, data] }));
    return data;
  },

  updateMember: async (id, updates) => {
    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[FamilyStore] updateMember error:', error);
      return;
    }
    set((state) => ({
      members: state.members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  },

  deleteMember: async (id) => {
    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[FamilyStore] deleteMember error:', error);
      return;
    }
    set((state) => ({ members: state.members.filter((m) => m.id !== id) }));
  },
}));
