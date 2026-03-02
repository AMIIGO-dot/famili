/**
 * FAMILJ – Settings Store (Zustand)
 *
 * Manages user preferences: language, timezone, week start, time format.
 * Values are synced from/to the Supabase profiles table.
 */

import { create } from 'zustand';
import i18n, { type SupportedLanguage } from '../i18n';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface SettingsState {
  language: SupportedLanguage;
  timezone: string;
  locale: string;
  weekStartsOn: 0 | 1;
  timeFormat: '12h' | '24h';

  // Actions
  loadFromProfile: (profile: Profile) => void;
  setLanguage: (lang: SupportedLanguage, userId?: string) => Promise<void>;
  setTimezone: (tz: string, userId?: string) => Promise<void>;
  setWeekStartsOn: (day: 0 | 1, userId?: string) => Promise<void>;
  setTimeFormat: (fmt: '12h' | '24h', userId?: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  locale: 'en-US',
  weekStartsOn: 1, // Monday default (ISO standard)
  timeFormat: '24h',

  loadFromProfile: (profile) => {
    set({
      language: profile.language as SupportedLanguage,
      timezone: profile.timezone,
      locale: profile.locale,
      weekStartsOn: profile.week_start_preference as 0 | 1,
      timeFormat: profile.time_format_preference as '12h' | '24h',
    });
    i18n.changeLanguage(profile.language);
  },

  setLanguage: async (lang, userId) => {
    set({ language: lang });
    await i18n.changeLanguage(lang);
    if (userId) {
      await supabase.from('profiles').update({ language: lang }).eq('id', userId);
    }
  },

  setTimezone: async (tz, userId) => {
    set({ timezone: tz });
    if (userId) {
      await supabase.from('profiles').update({ timezone: tz }).eq('id', userId);
    }
  },

  setWeekStartsOn: async (day, userId) => {
    set({ weekStartsOn: day });
    if (userId) {
      await supabase.from('profiles').update({ week_start_preference: day }).eq('id', userId);
    }
  },

  setTimeFormat: async (fmt, userId) => {
    set({ timeFormat: fmt });
    if (userId) {
      await supabase.from('profiles').update({ time_format_preference: fmt }).eq('id', userId);
    }
  },
}));
