/**
 * FAMILJ – Family Store (Zustand)
 *
 * Manages the current family, its members, and subscription status.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

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

  // Current logged-in user's member record (null = family owner with full parent access)
  currentMember: Member | null;
  currentMemberRole: 'parent' | 'child';

  // Actions
  fetchFamily: (userId: string) => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchSubscription: (userId: string) => Promise<void>;
  resolveCurrentMember: (userId: string) => void;
  checkPendingInvite: (email: string, userId: string) => Promise<void>;
  addMember: (member: Database['public']['Tables']['members']['Insert']) => Promise<Member | null>;
  updateMember: (id: string, updates: Database['public']['Tables']['members']['Update']) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  reset: () => void;
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family: null,
  members: [],
  subscription: null,
  isLoading: false,
  currentMember: null,
  currentMemberRole: 'parent',

  reset: () => set({ family: null, members: [], subscription: null, currentMember: null, currentMemberRole: 'parent', isLoading: false }),

  get isPremium() {
    const sub = get().subscription;
    return sub?.status === 'active' && sub.plan !== 'free';
  },

  fetchFamily: async (userId: string) => {
    set({ isLoading: true });
    try {
      // 1. Check if user owns a family
      const { data: ownedFamily, error: ownerErr } = await supabase
        .from('families')
        .select('*')
        .eq('owner_id', userId)
        .maybeSingle();

      if (ownerErr) throw ownerErr;

      if (ownedFamily) {
        set({ family: ownedFamily });
        await get().fetchMembers();
        get().resolveCurrentMember(userId);
        return;
      }

      // 2. Check if user is a member (co-parent or child) of any family
      const { data: memberRow, error: memberErr } = await supabase
        .from('members')
        .select('family_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberErr) throw memberErr;

      if (memberRow?.family_id) {
        const { data: joinedFamily, error: famErr } = await supabase
          .from('families')
          .select('*')
          .eq('id', memberRow.family_id)
          .single();

        if (famErr) throw famErr;
        set({ family: joinedFamily ?? null });
        if (joinedFamily) {
          await get().fetchMembers();
          get().resolveCurrentMember(userId);
        }
      } else {
        // No family found — hard clear all family data
        set({ family: null, members: [], currentMember: null, currentMemberRole: 'parent' });
      }
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

  resolveCurrentMember: (userId: string) => {
    const { members, family } = get();
    // 1. Best case: member row has user_id stamped (production)
    const linked = members.find((m) => m.user_id === userId) ?? null;
    if (linked) {
      set({ currentMember: linked, currentMemberRole: linked.role });
      return;
    }
    // 2. Fallback for family owner before user_id migration / dev mode:
    //    treat the first parent row as the owner's own row
    if (family?.owner_id === userId) {
      const firstParent = members.find((m) => m.role === 'parent') ?? null;
      set({ currentMember: firstParent, currentMemberRole: 'parent' });
      return;
    }
    set({ currentMember: null, currentMemberRole: 'parent' });
  },

  checkPendingInvite: async (email: string, userId: string) => {
    const { claimPendingInvite } = await import('../lib/familyInviteService');
    const result = await claimPendingInvite(email, userId);
    if (!result) return;

    // We've been accepted into a family — fetch it
    try {
      const { data: familyData, error: famErr } = await supabase
        .from('families')
        .select('*')
        .eq('id', result.familyId)
        .single();
      if (famErr || !familyData) return;

      set({ family: familyData });
      await get().fetchMembers();
      get().resolveCurrentMember(userId);
    } catch (err) {
      console.error('[FamilyStore] checkPendingInvite join error:', err);
    }
  },

  fetchSubscription: async (userId: string) => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
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
