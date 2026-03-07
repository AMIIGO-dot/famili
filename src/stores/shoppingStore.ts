/**
 * FAMILJ – Shopping Lists Store (Zustand)
 *
 * Manages shopping lists linked to events. Parents-only – RLS on Supabase
 * ensures child users get empty results if they somehow query.
 *
 * Real-time sync via Supabase Realtime so co-parents can collaboratively
 * check off items while shopping.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ShoppingList, ShoppingListItem } from '../lib/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ShoppingState {
  /**
   * eventId → ShoppingList (undefined = no list exists or not yet fetched)
   * Populated by fetchListsForFamily on app start.
   */
  listsByEventId: Record<string, ShoppingList | undefined>;
  /**
   * listId → ShoppingListItem[]
   * Populated lazily when a list is opened.
   */
  itemsByListId: Record<string, ShoppingListItem[]>;

  fetchListsForFamily: (familyId: string) => Promise<void>;
  fetchItemsForList: (listId: string) => Promise<void>;
  /** Returns total number of shopping lists for the family (for premium gating). */
  countListsForFamily: (familyId: string) => Promise<number>;
  createListForEvent: (eventId: string, familyId: string, userId: string) => Promise<ShoppingList | null>;
  addItem: (listId: string, text: string) => Promise<ShoppingListItem | null>;
  toggleItem: (item: ShoppingListItem, checked: boolean, checkedBy: string) => Promise<void>;
  deleteItem: (itemId: string, listId: string) => Promise<void>;
  subscribeToList: (listId: string) => void;
  unsubscribeFromList: () => void;
  reset: () => void;
}

let _realtimeChannel: RealtimeChannel | null = null;

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  listsByEventId: {},
  itemsByListId: {},

  reset: () => {
    if (_realtimeChannel) {
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }
    set({ listsByEventId: {}, itemsByListId: {} });
  },

  fetchListsForFamily: async (familyId) => {
    try {
      const { data, error } = await (supabase as any)
        .from('shopping_lists')
        .select('*')
        .eq('family_id', familyId);
      if (error) throw error;
      const map: Record<string, ShoppingList> = {};
      for (const list of (data ?? []) as ShoppingList[]) {
        map[list.event_id] = list;
      }
      set((state) => ({
        listsByEventId: { ...state.listsByEventId, ...map },
      }));
    } catch (err) {
      console.error('[ShoppingStore] fetchListsForFamily error:', err);
    }
  },

  fetchItemsForList: async (listId) => {
    try {
      const { data, error } = await (supabase as any)
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', listId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      set((state) => ({
        itemsByListId: { ...state.itemsByListId, [listId]: (data ?? []) as ShoppingListItem[] },
      }));
    } catch (err) {
      console.error('[ShoppingStore] fetchItemsForList error:', err);
    }
  },

  countListsForFamily: async (familyId) => {
    const { count, error } = await (supabase as any)
      .from('shopping_lists')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', familyId);
    if (error) {
      console.error('[ShoppingStore] countListsForFamily error:', error);
      return 0;
    }
    return count ?? 0;
  },

  createListForEvent: async (eventId, familyId, userId) => {
    const { data, error } = await (supabase as any)
      .from('shopping_lists')
      .insert({ event_id: eventId, family_id: familyId, created_by: userId })
      .select()
      .single();
    if (error) {
      console.error('[ShoppingStore] createListForEvent error:', error);
      return null;
    }
    const list = data as ShoppingList;
    set((state) => ({
      listsByEventId: { ...state.listsByEventId, [eventId]: list },
      itemsByListId:  { ...state.itemsByListId,  [list.id]: [] },
    }));
    return list;
  },

  addItem: async (listId, text) => {
    const existing = get().itemsByListId[listId] ?? [];
    const sortOrder = existing.length;
    const { data, error } = await (supabase as any)
      .from('shopping_list_items')
      .insert({ list_id: listId, text: text.trim(), sort_order: sortOrder })
      .select()
      .single();
    if (error) {
      console.error('[ShoppingStore] addItem error:', error);
      return null;
    }
    const item = data as ShoppingListItem;
    // Optimistic: check if realtime already added it
    set((state) => {
      const current = state.itemsByListId[listId] ?? [];
      if (current.some((i) => i.id === item.id)) return state;
      return { itemsByListId: { ...state.itemsByListId, [listId]: [...current, item] } };
    });
    return item;
  },

  toggleItem: async (item, checked, checkedBy) => {
    // Optimistic update
    set((state) => ({
      itemsByListId: {
        ...state.itemsByListId,
        [item.list_id]: (state.itemsByListId[item.list_id] ?? []).map((i) =>
          i.id === item.id ? { ...i, is_checked: checked, checked_by: checked ? checkedBy : null } : i
        ),
      },
    }));
    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .update({ is_checked: checked, checked_by: checked ? checkedBy : null })
      .eq('id', item.id);
    if (error) {
      // Revert optimistic
      set((state) => ({
        itemsByListId: {
          ...state.itemsByListId,
          [item.list_id]: (state.itemsByListId[item.list_id] ?? []).map((i) =>
            i.id === item.id ? { ...i, is_checked: item.is_checked, checked_by: item.checked_by } : i
          ),
        },
      }));
      console.error('[ShoppingStore] toggleItem error:', error);
    }
  },

  deleteItem: async (itemId, listId) => {
    // Optimistic update
    set((state) => ({
      itemsByListId: {
        ...state.itemsByListId,
        [listId]: (state.itemsByListId[listId] ?? []).filter((i) => i.id !== itemId),
      },
    }));
    const { error } = await (supabase as any)
      .from('shopping_list_items')
      .delete()
      .eq('id', itemId);
    if (error) {
      console.error('[ShoppingStore] deleteItem error:', error);
    }
  },

  subscribeToList: (listId) => {
    if (_realtimeChannel) {
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }
    _realtimeChannel = supabase
      .channel(`shopping-items-${listId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${listId}` },
        (payload) => {
          const item = payload.new as ShoppingListItem;
          set((state) => {
            const current = state.itemsByListId[listId] ?? [];
            if (current.some((i) => i.id === item.id)) return state;
            return { itemsByListId: { ...state.itemsByListId, [listId]: [...current, item] } };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${listId}` },
        (payload) => {
          const updated = payload.new as ShoppingListItem;
          set((state) => ({
            itemsByListId: {
              ...state.itemsByListId,
              [listId]: (state.itemsByListId[listId] ?? []).map((i) =>
                i.id === updated.id ? updated : i
              ),
            },
          }));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${listId}` },
        (payload) => {
          const deleted = payload.old as { id: string };
          set((state) => ({
            itemsByListId: {
              ...state.itemsByListId,
              [listId]: (state.itemsByListId[listId] ?? []).filter((i) => i.id !== deleted.id),
            },
          }));
        }
      )
      .subscribe();
  },

  unsubscribeFromList: () => {
    if (_realtimeChannel) {
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }
  },
}));
