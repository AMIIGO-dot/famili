/**
 * FAMILJ – Family Store (Zustand)
 *
 * Manages the current family, its members, and subscription status.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// Keep in sync with authStore.ts
const DEV_BYPASS = true;

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
    if (DEV_BYPASS) {
      set({
        family: {
          id: 'dev-family-id',
          name: 'Familjen Ekstrand',
          owner_id: 'dev-user-id',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Family,
        members: [
          { id: 'dev-member-1', family_id: 'dev-family-id', name: 'Simon', color: '#5B9CF6', role: 'parent', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'dev-member-2', family_id: 'dev-family-id', name: 'Emma',  color: '#F97B8B', role: 'parent', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'dev-member-3', family_id: 'dev-family-id', name: 'Liam',  color: '#68D9A4', role: 'child',  created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        ] as unknown as Member[],
        isLoading: false,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('families')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (error) throw error;
      set({ family: data });
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
