/**
 * FAMILJ – Auth Store (Zustand)
 *
 * Manages authentication state and Supabase session.
 */

import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// ─── DEV BYPASS ───────────────────────────────────────────────────────────────
// Set to true to skip authentication entirely during development.
// Remove before releasing to production.
const DEV_BYPASS = true;
const DEV_FAKE_USER: User = {
  id: 'dev-user-id',
  email: 'dev@familj.app',
  app_metadata: {},
  user_metadata: { full_name: 'Dev User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User;
// ──────────────────────────────────────────────────────────────────────────────

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: false,
  isInitialized: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },

  setProfile: (profile) => {
    set({ profile });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    set({ isLoading: true });
    try {
      // Try to fetch existing profile
      const { data: existing, error: selectErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (selectErr) throw selectErr;

      if (existing) {
        set({ profile: existing });
        return;
      }

      // First sign-in: create a default profile
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          language: 'en',
          timezone: deviceTz,
          locale: 'en-US',
          week_start_preference: 1,
          time_format_preference: '24h',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      set({ profile: created });
    } catch (err) {
      console.error('[AuthStore] fetchProfile error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  initialize: async () => {
    if (DEV_BYPASS) {
      set({
        session: { user: DEV_FAKE_USER } as unknown as Session,
        user: DEV_FAKE_USER,
        profile: {
          id: 'dev-user-id',
          full_name: 'Dev User',
          avatar_url: null,
          timezone: 'Europe/Stockholm',
          week_starts_on: 1,
          time_format: '24h',
          language: 'en',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Profile,
        isInitialized: true,
      });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null, isInitialized: true });

    if (session?.user) {
      await get().fetchProfile();
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({ session: newSession, user: newSession?.user ?? null });
      if (newSession?.user) {
        get().fetchProfile();
      } else {
        set({ profile: null });
      }
    });
  },
}));
