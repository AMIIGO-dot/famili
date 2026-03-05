/**
 * FAMILJ – Events Store (Zustand)
 *
 * Manages events for the current family.
 * Handles one-time and recurring events.
 *
 * All times stored in UTC; rendering converts to user timezone via time utilities.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { generateOccurrences } from '../lib/time';
import type { Database } from '../lib/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';


type Event = Database['public']['Tables']['events']['Row'];
type EventInsert = Database['public']['Tables']['events']['Insert'];
type EventUpdate = Database['public']['Tables']['events']['Update'];

export interface EventOccurrence {
  eventId: string;
  title: string;
  start: Date;
  end: Date;
  type: Event['type'];
  memberIds: string[];
  color?: string;
  isRecurring: boolean;
  isParentsOnly: boolean;
  reminderMinutes: number | null;
  recurrenceRule?: Event['recurrence_rule'];
}

interface EventsState {
  events: Event[];
  isLoading: boolean;

  // Actions
  fetchEventsForWeek: (familyId: string, rangeStart: Date, rangeEnd: Date) => Promise<void>;
  getOccurrencesForRange: (rangeStart: Date, rangeEnd: Date, role?: 'parent' | 'child') => EventOccurrence[];
  createEvent: (event: EventInsert, createdByUserId?: string) => Promise<Event | null>;
  updateEvent: (id: string, updates: EventUpdate) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  subscribeToFamily: (familyId: string) => void;
  unsubscribeFromFamily: () => void;
  reset: () => void;
}

let _realtimeChannel: RealtimeChannel | null = null;

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  isLoading: false,

  reset: () => set({ events: [], isLoading: false }),
  fetchEventsForWeek: async (familyId, rangeStart, rangeEnd) => {
    set({ isLoading: true });
    try {
      // Fetch one-time events within the range
      const { data: oneTime, error: err1 } = await supabase
        .from('events')
        .select('*')
        .eq('family_id', familyId)
        .is('recurrence_rule', null)
        .gte('start_time_utc', rangeStart.toISOString())
        .lte('start_time_utc', rangeEnd.toISOString());

      if (err1) throw err1;

      // Fetch all recurring master events
      const { data: recurring, error: err2 } = await supabase
        .from('events')
        .select('*')
        .eq('family_id', familyId)
        .not('recurrence_rule', 'is', null);

      if (err2) throw err2;

      set({ events: [...(oneTime ?? []), ...(recurring ?? [])] });
    } catch (err) {
      console.error('[EventsStore] fetchEventsForWeek error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Returns merged + sorted occurrences for a given range.
   * Pass role='child' to exclude parents-only events.
   * Recurring events are expanded in memory — never duplicated in the DB.
   */
  getOccurrencesForRange: (rangeStart, rangeEnd, role = 'parent') => {
    const { events } = get();
    const occurrences: EventOccurrence[] = [];

    for (const event of events) {
      // Hide parents-only events from children
      if (role === 'child' && event.is_parents_only) continue;

      if (!event.recurrence_rule) {
        // One-time event
        const start = new Date(event.start_time_utc);
        const end = new Date(event.end_time_utc);
        if (start >= rangeStart && start <= rangeEnd) {
          occurrences.push({
            eventId: event.id,
            title: event.title,
            start,
            end,
            type: event.type,
            memberIds: event.member_ids ?? [],
            isRecurring: false,
            isParentsOnly: event.is_parents_only ?? false,
            reminderMinutes: event.reminder_minutes ?? null,
            recurrenceRule: null,
          });
        }
      } else {
        // Recurring event — expand in memory
        const rule = event.recurrence_rule;
        const instances = generateOccurrences(
          event.start_time_utc,
          event.end_time_utc,
          rule,
          rangeStart,
          rangeEnd
        );
        for (const instance of instances) {
          occurrences.push({
            eventId: event.id,
            title: event.title,
            start: instance.start,
            end: instance.end,
            type: event.type,
            memberIds: event.member_ids ?? [],
            isRecurring: true,
            isParentsOnly: event.is_parents_only ?? false,
            reminderMinutes: event.reminder_minutes ?? null,
            recurrenceRule: event.recurrence_rule,
          });
        }
      }
    }

    return occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());
  },

  createEvent: async (event, createdByUserId) => {
    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single();

    if (error) {
      console.error('[EventsStore] createEvent error:', error);
      return null;
    }

    set((state) => ({ events: [...state.events, data] }));

    // Notify other parents in the background (best-effort)
    if (createdByUserId) {
      supabase.functions
        .invoke('notify-event', {
          body: {
            family_id: event.family_id,
            event_title: event.title,
            created_by_user_id: createdByUserId,
          },
        })
        .catch((err) => console.warn('[EventsStore] notify-event error:', err));
    }

    return data;
  },

  updateEvent: async (id, updates) => {
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[EventsStore] updateEvent error:', error);
      return;
    }
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  },

  deleteEvent: async (id) => {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[EventsStore] deleteEvent error:', error);
      return;
    }
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }));
  },

  subscribeToFamily: (familyId) => {
    // Clean up any existing channel first
    if (_realtimeChannel) {
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }

    _realtimeChannel = supabase
      .channel(`family-events-${familyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` },
        (payload) => {
          const newEvent = payload.new as Event;
          set((state) => {
            const exists = state.events.some((e) => e.id === newEvent.id);
            if (exists) return state; // already added locally
            return { events: [...state.events, newEvent] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'events', filter: `family_id=eq.${familyId}` },
        (payload) => {
          const deleted = payload.old as { id: string };
          set((state) => ({ events: state.events.filter((e) => e.id !== deleted.id) }));
        }
      )
      .subscribe();
  },

  unsubscribeFromFamily: () => {
    if (_realtimeChannel) {
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }
  },
}));
