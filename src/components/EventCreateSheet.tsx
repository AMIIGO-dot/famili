/**
 * FAMILJ – Event Creation Bottom Sheet
 * Clean, minimal design. Three sections: when, who, what type.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../stores/familyStore';
import { useEventsStore, EventOccurrence } from '../stores/eventStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { convertUTCToLocal } from '../lib/time';

const EVENT_TYPES = ['activity', 'homework', 'test', 'other'] as const;
type EventType = typeof EVENT_TYPES[number];

const TYPE_META: Record<EventType, { dot: string; labelKey: string }> = {
  activity: { dot: '#5B9CF6', labelKey: 'events.typeActivity' },
  homework: { dot: '#F5A623', labelKey: 'events.typeHomework' },
  test:     { dot: '#F97B8B', labelKey: 'events.typeTest' },
  other:    { dot: '#9999A6', labelKey: 'events.typeOther' },
};

function clampToToday(date: Date): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today ? today : date;
}

function buildDateStrip(from: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}



interface Props {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
  lockedDate?: Date;
  editEvent?: EventOccurrence;
}

export default function EventCreateSheet({ visible, onClose, initialDate, lockedDate, editEvent }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const inputRef = useRef<TextInput>(null);
  const dateScrollRef = useRef<any>(null);

  const { members, family } = useFamilyStore();
  const { createEvent, updateEvent, deleteEvent } = useEventsStore();
  const { timezone } = useSettingsStore();
  const { user } = useAuthStore();

  const stripStart = useMemo(() => clampToToday(initialDate ?? new Date()), [initialDate]);
  const dateStrip = useMemo(() => buildDateStrip(stripStart), [stripStart]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isActualToday = (d: Date) => d.getTime() === today.getTime();

  const [title, setTitle] = useState('');
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [eventType, setEventType] = useState<EventType>('activity');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Track keyboard so we can remove safe-area bottom pad when keyboard is up
  useEffect(() => {
    const s1 = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const s2 = Keyboard.addListener('keyboardDidShow',  () => setKeyboardVisible(true));
    const h1 = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    const h2 = Keyboard.addListener('keyboardDidHide',  () => setKeyboardVisible(false));
    return () => { s1.remove(); s2.remove(); h1.remove(); h2.remove(); };
  }, []);

  // Reset selection to first date whenever the viewed week changes
  useEffect(() => {
    setSelectedDateIdx(0);
    dateScrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [stripStart.getTime()]);

  // Pre-populate form when opening an existing event for editing
  useEffect(() => {
    if (visible && editEvent) {
      const localStart = convertUTCToLocal(editEvent.start, timezone);
      const localEnd   = convertUTCToLocal(editEvent.end,   timezone);
      setTitle(editEvent.title);
      setStartHour(localStart.getHours());
      setStartMinute(localStart.getMinutes());
      setEndHour(localEnd.getHours());
      setEndMinute(localEnd.getMinutes());
      setEventType(editEvent.type as EventType);
      setSelectedMemberIds(editEvent.memberIds);
    } else if (visible && !editEvent) {
      // Reset to defaults for new event
      setTitle('');
      setSelectedDateIdx(0);
      setStartHour(9); setStartMinute(0);
      setEndHour(10); setEndMinute(0);
      setEventType('activity');
      setSelectedMemberIds([]);
    }
  }, [visible, editEvent?.eventId]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 3 }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [visible]);

  const close = () => {
    Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => onClose());
  };

  const toggleMember = (id: string) =>
    setSelectedMemberIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const stepTime = (delta: number) => {
    let total = startHour * 60 + startMinute + delta;
    if (total < 0) total = 23 * 60 + 45;
    if (total >= 24 * 60) total = 0;
    const newStartH = Math.floor(total / 60);
    const newStartM = total % 60;
    setStartHour(newStartH);
    setStartMinute(newStartM);
    // Push end forward if it would be <= new start
    if (endHour * 60 + endMinute <= total) {
      const newEnd = total + 60;
      setEndHour(Math.floor(newEnd / 60) % 24);
      setEndMinute(newEnd % 60);
    }
  };

  const stepEndTime = (delta: number) => {
    let total = endHour * 60 + endMinute + delta;
    const startTotal = startHour * 60 + startMinute;
    // Keep end at least 15 min after start
    if (total <= startTotal) total = startTotal + 15;
    if (total >= 24 * 60) total = 23 * 60 + 45;
    setEndHour(Math.floor(total / 60));
    setEndMinute(total % 60);
  };

  const startLabel = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
  const endLabel   = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

  // Date shown in the locked badge — event's local date when editing, long-press date when creating
  const badgeDate: Date | null = editEvent
    ? convertUTCToLocal(editEvent.start, timezone)
    : lockedDate ?? null;

  const handleSave = async () => {
    if (!title.trim() || !family) return;
    setSaving(true);
    try {
      const d = editEvent
        ? convertUTCToLocal(editEvent.start, timezone)
        : (lockedDate ?? dateStrip[selectedDateIdx]);
      const start = new Date(d);
      start.setHours(startHour, startMinute, 0, 0);
      const end = new Date(d);
      end.setHours(endHour, endMinute, 0, 0);
      // If end is before or equal to start (e.g. overnight edge), add one day
      if (end <= start) end.setDate(end.getDate() + 1);
      if (editEvent) {
        await updateEvent(editEvent.eventId, {
          title: title.trim(),
          type: eventType,
          start_time_utc: start.toISOString(),
          end_time_utc: end.toISOString(),
          member_ids: selectedMemberIds.length > 0 ? selectedMemberIds : members.map((m) => m.id),
        });
      } else {
        await createEvent({
          family_id: family.id,
          title: title.trim(),
          type: eventType,
          start_time_utc: start.toISOString(),
          end_time_utc: end.toISOString(),
          timezone,
          created_by: user?.id ?? '',
          member_ids: selectedMemberIds.length > 0 ? selectedMemberIds : members.map((m) => m.id),
          recurrence_rule: null,
        });
      }
      setTitle(''); setSelectedDateIdx(0); setStartHour(9); setStartMinute(0);
      setEndHour(10); setEndMinute(0); setEventType('activity'); setSelectedMemberIds([]);
      close();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editEvent) return;
    setDeleting(true);
    try {
      await deleteEvent(editEvent.eventId);
      close();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.kav}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View style={[styles.sheet, { paddingBottom: keyboardVisible ? 8 : insets.bottom + 8, transform: [{ translateY: slideAnim }] }]}>
          {/* Handle + cancel */}
          <View style={styles.handle} />
          <TouchableOpacity style={styles.cancelBtn} onPress={close}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* WHO */}
            {members.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t('events.sectionWho')}</Text>
                <View style={styles.memberRow}>
                  {members.map((m) => {
                    const sel = selectedMemberIds.includes(m.id);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.avatar, { backgroundColor: sel ? m.color : '#F0F0EC', borderColor: m.color }]}
                        onPress={() => toggleMember(m.id)}
                      >
                        <Text style={[styles.avatarInitial, { color: sel ? '#fff' : m.color }]}>
                          {m.name.charAt(0).toUpperCase()}
                        </Text>
                        <Text style={[styles.avatarName, { color: sel ? '#fff' : '#6E6E7A' }]}>
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* WHAT */}
            <Text style={styles.sectionLabel}>{t('events.sectionWhat')}</Text>
            <TextInput
              ref={inputRef}
              style={styles.titleInput}
              placeholder={t('events.titlePlaceholder')}
              placeholderTextColor="#C0C0C8"
              value={title}
              onChangeText={setTitle}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
            <View style={styles.typeRow}>
              {EVENT_TYPES.map((type) => {
                const sel = eventType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, sel && { backgroundColor: TYPE_META[type].dot }]}
                    onPress={() => setEventType(type)}
                  >
                    <View style={[styles.typeDot, { backgroundColor: sel ? '#fff' : TYPE_META[type].dot }]} />
                    <Text style={[styles.typeText, sel && styles.typeTextSel]}>
                      {t(TYPE_META[type].labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* WHEN */}
            <Text style={styles.sectionLabel}>{t('events.sectionWhen')}</Text>

            {badgeDate ? (
              /* Locked to a specific day — show badge only */
              <View style={styles.lockedDateBadge}>
                <Text style={styles.lockedDateDay}>
                  {isActualToday(badgeDate)
                    ? t('weeklyView.today')
                    : new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(badgeDate)}
                </Text>
                <Text style={styles.lockedDateFull}>
                  {new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(badgeDate)}
                </Text>
              </View>
            ) : (
              /* Full scrollable date strip */
              <ScrollView
                ref={dateScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateRow}
              >
                {dateStrip.map((day, idx) => {
                  const sel = idx === selectedDateIdx;
                  const showMonthLabel = idx === 0 || day.getMonth() !== dateStrip[idx - 1].getMonth();
                  const dayLabel = isActualToday(day)
                    ? t('weeklyView.today')
                    : new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(day);
                  return (
                    <React.Fragment key={idx}>
                      {showMonthLabel && (
                        <View style={styles.monthLabel}>
                          <Text style={styles.monthLabelText}>
                            {new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(day).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.dateChip, sel && styles.dateChipSel]}
                        onPress={() => setSelectedDateIdx(idx)}
                      >
                        <Text style={[styles.dateDay, sel && styles.dateTextSel]}>{dayLabel}</Text>
                        <Text style={[styles.dateNum, sel && styles.dateTextSel]}>{day.getDate()}</Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            )}

            {/* Time — from/to steppers */}
            <View style={styles.timeRow}>
              <View style={styles.timeStepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime(-15)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.timeLabel}>{startLabel}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime(15)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.timeArrow}>→</Text>
              <View style={styles.timeStepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => stepEndTime(-15)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.timeLabel}>{endLabel}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => stepEndTime(15)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, (!title.trim() || saving) && styles.saveBtnOff]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? '…' : editEvent ? t('events.saveChanges') : t('events.save')}
              </Text>
            </TouchableOpacity>

            {/* Delete — only in edit mode */}
            {editEvent && (
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && styles.saveBtnOff]}
                onPress={handleDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteBtnText}>{deleting ? '…' : t('events.deleteEvent')}</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FAFAF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 14,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D8D8DC', marginBottom: 8 },
  cancelBtn: { position: 'absolute', top: 18, right: 20 },
  cancelText: { fontSize: 15, color: '#9999A6' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9999A6',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2C2C2E',
    paddingVertical: 10,
    minHeight: 48,
    marginBottom: 10,
  },

  divider: { height: 1, backgroundColor: '#EBEBEB', marginVertical: 12 },

  // Date
  dateRow: { paddingBottom: 4, gap: 6, alignItems: 'flex-end' },
  monthLabel: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6, paddingHorizontal: 4 },
  monthLabelText: { fontSize: 9, fontWeight: '800', color: '#AEAEB2', letterSpacing: 1, textTransform: 'uppercase' },
  lockedDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  lockedDateDay: { fontSize: 13, fontWeight: '700', color: '#FAFAF8', textTransform: 'capitalize' },
  lockedDateFull: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  dateChip: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F0F0EC', minWidth: 52 },
  dateChipSel: { backgroundColor: '#2C2C2E' },
  dateDay: { fontSize: 10, fontWeight: '600', color: '#9999A6', textTransform: 'uppercase', letterSpacing: 0.4 },
  dateNum: { fontSize: 20, fontWeight: '700', color: '#2C2C2E', lineHeight: 24 },
  dateTextSel: { color: '#FAFAF8' },

  // Time + Duration row
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4, gap: 8 },
  timeStepper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0EC', borderRadius: 12, overflow: 'hidden' },
  stepBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  stepBtnText: { fontSize: 20, color: '#2C2C2E', lineHeight: 24 },
  timeLabel: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#2C2C2E', letterSpacing: 0.3 },
  timeArrow: { fontSize: 16, color: '#AEAEB2', fontWeight: '400' },

  // Members
  memberRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingVertical: 4 },
  avatar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2, gap: 6 },
  avatarInitial: { fontSize: 14, fontWeight: '700' },
  avatarName: { fontSize: 13, fontWeight: '500' },

  // Type
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingVertical: 4 },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F0F0EC', gap: 6 },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  typeText: { fontSize: 13, fontWeight: '500', color: '#2C2C2E' },
  typeTextSel: { color: '#fff' },

  // Save / Delete
  saveBtn: { backgroundColor: '#2C2C2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnOff: { opacity: 0.35 },
  saveBtnText: { color: '#FAFAF8', fontSize: 16, fontWeight: '600' },
  deleteBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  deleteBtnText: { color: '#F97B8B', fontSize: 15, fontWeight: '600' },
});
