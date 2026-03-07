/**
 * FAMILJ – Shopping List Sheet
 *
 * Parents-only bottom sheet for managing a shopping list linked to an event.
 * Features:
 *   - Create list on demand (free up to 1 list; premium for more)
 *   - Add / check off / delete items
 *   - Real-time sync so co-parents see updates instantly
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useFamilyStore } from '../stores/familyStore';
import { useAuthStore } from '../stores/authStore';
import { useShoppingStore } from '../stores/shoppingStore';
import { useIsPremium } from '../lib/premium';
import { usePurchaseStore, PAYWALL_RESULT } from '../stores/purchaseStore';
import type { ShoppingListItem } from '../lib/database.types';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The event this sheet is linked to */
  eventId: string;
  eventTitle: string;
}

export default function ShoppingListSheet({ visible, onClose, eventId, eventTitle }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const { family } = useFamilyStore();
  const { user } = useAuthStore();
  const isPremium = useIsPremium();
  const presentPaywall = usePurchaseStore((s) => s.presentPaywall);

  const {
    listsByEventId,
    itemsByListId,
    fetchItemsForList,
    countListsForFamily,
    createListForEvent,
    addItem,
    toggleItem,
    deleteItem,
    subscribeToList,
    unsubscribeFromList,
  } = useShoppingStore();

  const list = eventId ? listsByEventId[eventId] : undefined;
  const items: ShoppingListItem[] = list ? (itemsByListId[list.id] ?? []) : [];

  const [creating, setCreating] = useState(false);
  const [itemText, setItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Fetch items and subscribe to realtime when list becomes available or sheet opens
  useEffect(() => {
    if (!visible || !list) return;
    fetchItemsForList(list.id);
    subscribeToList(list.id);
    return () => {
      unsubscribeFromList();
    };
  }, [visible, list?.id]);

  // Reset input on close
  useEffect(() => {
    if (!visible) {
      setItemText('');
      setCreating(false);
    }
  }, [visible]);

  // ─── Create the list ──────────────────────────────────────────────────────

  const handleCreateList = async () => {
    if (!family || !user) return;

    // Premium gating: 1 list free, more require premium
    if (!isPremium) {
      const count = await countListsForFamily(family.id);
      if (count >= 1) {
        const result = await presentPaywall();
        if (result !== PAYWALL_RESULT.PURCHASED && result !== PAYWALL_RESULT.RESTORED) return;
      }
    }

    setCreating(true);
    try {
      const created = await createListForEvent(eventId, family.id, user.id);
      if (created) {
        subscribeToList(created.id);
      }
    } finally {
      setCreating(false);
    }
  };

  // ─── Add item ─────────────────────────────────────────────────────────────

  const handleAddItem = async () => {
    if (!list || !itemText.trim() || addingItem) return;
    setAddingItem(true);
    await addItem(list.id, itemText.trim());
    setItemText('');
    setAddingItem(false);
    // Keep keyboard open for quick sequential adds
    inputRef.current?.focus();
  };

  // ─── Toggle item ──────────────────────────────────────────────────────────

  const handleToggle = async (item: ShoppingListItem) => {
    if (!user) return;
    await toggleItem(item, !item.is_checked, user.id);
  };

  // ─── Delete item ──────────────────────────────────────────────────────────

  const handleDeleteItem = (item: ShoppingListItem) => {
    Alert.alert(
      t('shopping.deleteItemConfirm'),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteItem(item.id, item.list_id) },
      ]
    );
  };

  // ─── Sort: unchecked first, then checked ─────────────────────────────────

  const sortedItems = [...items].sort((a, b) => {
    if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;
    return a.sort_order - b.sort_order;
  });

  const checkedCount = items.filter((i) => i.is_checked).length;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 12}
          className="mx-3"
          backgroundClassName="rounded-[28px]"
          enablePanDownToClose
          snapPoints={list ? ['60%', '90%'] : ['45%']}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.kav}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.cartEmoji}>🛒</Text>
                  <Text style={styles.headerTitle}>{t('shopping.listTitle')}</Text>
                </View>
                <Text style={styles.headerSub} numberOfLines={1}>{eventTitle}</Text>
              </View>
              <BottomSheet.Close />
            </View>

            {/* ── No list yet ── */}
            {!list ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <Text style={styles.emptyEmoji}>🛒</Text>
                </View>
                <Text style={styles.emptyTitle}>{t('shopping.noList')}</Text>
                <Text style={styles.emptyHint}>{t('shopping.noListHint')}</Text>
                <TouchableOpacity
                  style={[styles.createBtn, creating && styles.createBtnDisabled]}
                  onPress={handleCreateList}
                  disabled={creating}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#FAFAF8" style={styles.createBtnIcon} />
                  <Text style={styles.createBtnText}>
                    {creating ? '…' : t('shopping.createList')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* ── Item counter ── */}
                {items.length > 0 && (
                  <View style={styles.counterRow}>
                    <Text style={styles.counterText}>
                      {t('shopping.items', { count: items.length })}
                      {checkedCount > 0 && (
                        <Text style={styles.counterChecked}> · {t('shopping.checked', { count: checkedCount })}</Text>
                      )}
                    </Text>
                  </View>
                )}

                {/* ── Items list ── */}
                <ScrollView
                  style={styles.listScroll}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {sortedItems.length === 0 ? (
                    <View style={styles.emptyItemsWrap}>
                      <Text style={styles.emptyItemsText}>{t('shopping.emptyListHint')}</Text>
                    </View>
                  ) : (
                    sortedItems.map((item) => (
                      <View
                        key={item.id}
                        style={[styles.itemRow, item.is_checked && styles.itemRowChecked]}
                      >
                        {/* Checkbox */}
                        <TouchableOpacity
                          onPress={() => handleToggle(item)}
                          style={styles.checkboxWrap}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
                            {item.is_checked && (
                              <Ionicons name="checkmark" size={12} color="#FAFAF8" />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Text */}
                        <Text
                          style={[styles.itemText, item.is_checked && styles.itemTextChecked]}
                          numberOfLines={3}
                        >
                          {item.text}
                        </Text>

                        {/* Delete */}
                        <TouchableOpacity
                          onPress={() => handleDeleteItem(item)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close" size={16} color="#C7C7CC" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                  <View style={{ height: 16 }} />
                </ScrollView>

                {/* ── Add item input ── */}
                <View style={[styles.addRow, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
                  <TextInput
                    ref={inputRef}
                    style={styles.addInput}
                    placeholder={t('shopping.addItem')}
                    value={itemText}
                    onChangeText={setItemText}
                    onSubmitEditing={handleAddItem}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    placeholderTextColor="#AEAEB2"
                    autoCapitalize="sentences"
                  />
                  <TouchableOpacity
                    style={[
                      styles.addBtn,
                      (!itemText.trim() || addingItem) && styles.addBtnDisabled,
                    ]}
                    onPress={handleAddItem}
                    disabled={!itemText.trim() || addingItem}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={22} color="#FAFAF8" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F3F5',
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  cartEmoji: { fontSize: 18 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2C2C2E' },
  headerSub: { fontSize: 13, color: '#9999A6', fontWeight: '400' },

  // Empty state (no list)
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 32,
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FFF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#2C2C2E', textAlign: 'center' },
  emptyHint: { fontSize: 14, color: '#9999A6', textAlign: 'center', lineHeight: 20 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#44B57F',
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 8,
    shadowColor: '#44B57F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnIcon: { marginRight: -2 },
  createBtnText: { color: '#FAFAF8', fontSize: 15, fontWeight: '600' },

  // Counter
  counterRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
  counterText: { fontSize: 12, fontWeight: '600', color: '#9999A6' },
  counterChecked: { color: '#44B57F' },

  // List scroll
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 6 },

  // Empty items state (list exists but no items)
  emptyItemsWrap: { alignItems: 'center', paddingVertical: 28 },
  emptyItemsText: { fontSize: 14, color: '#AEAEB2', textAlign: 'center' },

  // Item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F3F5',
  },
  itemRowChecked: { opacity: 0.55 },

  // Checkbox
  checkboxWrap: { flexShrink: 0 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#AEAEB2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    borderColor: '#44B57F',
    backgroundColor: '#44B57F',
  },

  // Item text
  itemText: {
    flex: 1,
    fontSize: 15,
    color: '#2C2C2E',
    fontWeight: '400',
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: '#9999A6',
  },

  // Add row
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F3F5',
    backgroundColor: '#FFFFFF',
  },
  addInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F2F3F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#2C2C2E',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#44B57F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#44B57F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnDisabled: {
    backgroundColor: '#AEAEB2',
    shadowOpacity: 0,
    elevation: 0,
  },
});
