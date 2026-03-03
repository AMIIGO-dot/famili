/**
 * FAMILJ – Event Creation Bottom Sheet
 * Clean, minimal design. Three sections: when, who, what type.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button, Input } from 'heroui-native';
import { useFamilyStore } from '../stores/familyStore';
import { useEventsStore, EventOccurrence } from '../stores/eventStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { convertUTCToLocal } from '../lib/time';
import type { RecurrenceRule } from '../lib/time';

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
  const inputRef = useRef<any>(null);
  const dateScrollRef = useRef<any>(null);

  const { members, family } = useFamilyStore();
  const { currentMemberRole } = useFamilyStore();
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
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'biweekly' | 'weekdays'>('none');
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [isParentsOnly, setIsParentsOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      const freq = (editEvent.recurrenceRule as RecurrenceRule | null)?.frequency;
      setRecurrence(freq ?? 'none');
      setIsParentsOnly(editEvent.isParentsOnly ?? false);
    } else if (visible && !editEvent) {
      // Reset to defaults for new event
      setTitle('');
      setSelectedDateIdx(0);
      setStartHour(9); setStartMinute(0);
      setEndHour(10); setEndMinute(0);
      setEventType('activity');
      setSelectedMemberIds([]);
      setRecurrence('none');
      setRepeatOpen(false);
      setIsParentsOnly(false);
    }
  }, [visible, editEvent?.eventId]);

  const close = () => onClose();

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
      const recurrenceRule: RecurrenceRule | null = recurrence === 'none' ? null : {
        frequency: recurrence,
        interval: recurrence === 'biweekly' ? 2 : 1,
        timezone,
      };

      if (editEvent) {
        await updateEvent(editEvent.eventId, {
          title: title.trim(),
          type: eventType,
          start_time_utc: start.toISOString(),
          end_time_utc: end.toISOString(),
          member_ids: selectedMemberIds.length > 0 ? selectedMemberIds : members.map((m) => m.id),
          recurrence_rule: recurrenceRule as any,
          is_parents_only: isParentsOnly,
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
          recurrence_rule: recurrenceRule as any,
          is_parents_only: isParentsOnly,
        });
      }
      setTitle(''); setSelectedDateIdx(0); setStartHour(9); setStartMinute(0);
      setEndHour(10); setEndMinute(0); setEventType('activity'); setSelectedMemberIds([]);
      setRecurrence('none');
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
    <BottomSheet isOpen={visible} onOpenChange={(open) => { if (!open) close(); }}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 12}
          className="mx-3"
          backgroundClassName="rounded-[28px]"
          enablePanDownToClose
          snapPoints={['65%']}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Title row */}
              <View style={styles.sheetHeader}>
                <Input
                  ref={inputRef}
                  style={styles.titleInput}
                  placeholder={t('events.titlePlaceholder')}
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  variant="ghost"
                />
                <BottomSheet.Close />
              </View>

              {/* Type chips */}
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

              {/* PARENTS ONLY — only shown to parents */}
              {currentMemberRole === 'parent' && (
                <TouchableOpacity
                  style={styles.parentsOnlyRow}
                  onPress={() => setIsParentsOnly((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={styles.parentsOnlyLeft}>
                    <Text style={styles.parentsOnlyIcon}>🔒</Text>
                    <View>
                      <Text style={styles.parentsOnlyLabel}>{t('events.parentsOnly')}</Text>
                      <Text style={styles.parentsOnlyHint}>{t('events.parentsOnlyHint')}</Text>
                    </View>
                  </View>
                  <Switch
                    value={isParentsOnly}
                    onValueChange={setIsParentsOnly}
                    trackColor={{ false: '#E5E5EA', true: '#2C2C2E' }}
                    thumbColor="#fff"
                  />
                </TouchableOpacity>
              )}

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
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* WHEN */}
              <Text style={styles.sectionLabel}>{t('events.sectionWhen')}</Text>

              {badgeDate ? (
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

              {/* Time steppers */}
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

              {/* REPEAT */}
              <View style={styles.divider} />
              <TouchableOpacity style={styles.repeatHeader} onPress={() => setRepeatOpen((v) => !v)} activeOpacity={0.7}>
                <Text style={styles.sectionLabel}>{t('events.recurrenceLabel')}</Text>
                <View style={styles.repeatHeaderRight}>
                  {recurrence !== 'none' && !repeatOpen && (
                    <View style={styles.repeatActiveDot} />
                  )}
                  <Text style={styles.repeatChevron}>{repeatOpen ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>
              {repeatOpen && (
                <View style={styles.recurrenceRow}>
                  {(['none', 'weekly', 'biweekly', 'weekdays'] as const).map((opt) => {
                    const sel = recurrence === opt;
                    const labelKey = opt === 'none'
                      ? 'events.recurrenceNone'
                      : opt === 'weekly'
                      ? 'events.recurrenceWeekly'
                      : opt === 'biweekly'
                      ? 'events.recurrenceBiweekly'
                      : 'events.recurrenceWeekdays';
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.recurrenceChip, sel && styles.recurrenceChipSel]}
                        onPress={() => { setRecurrence(opt); setRepeatOpen(false); }}
                      >
                        <Text style={[styles.recurrenceChipText, sel && styles.recurrenceChipTextSel]}>
                          {t(labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionRow}>
                {editEvent && (
                  <Button
                    variant="ghost"
                    style={styles.deleteHeroBtn}
                    isDisabled={deleting}
                    onPress={handleDelete}
                  >
                    <Text style={styles.deleteBtnText}>
                      {deleting ? '…' : t('events.deleteEvent')}
                    </Text>
                  </Button>
                )}
                <Button
                  variant="primary"
                  style={styles.saveHeroBtn}
                  isDisabled={!title.trim() || saving}
                  onPress={handleSave}
                >
                  {saving ? '…' : editEvent ? t('events.saveChanges') : t('events.save')}
                </Button>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2E',
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9999A6',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 4,
  },

  divider: { height: 1, backgroundColor: '#EBEBEB', marginVertical: 6 },

  // Date
  dateRow: { paddingBottom: 2, gap: 5, alignItems: 'flex-end' },
  monthLabel: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4, paddingHorizontal: 3 },
  monthLabelText: { fontSize: 9, fontWeight: '800', color: '#AEAEB2', letterSpacing: 1, textTransform: 'uppercase' },
  lockedDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  lockedDateDay: { fontSize: 13, fontWeight: '700', color: '#FAFAF8', textTransform: 'capitalize' },
  lockedDateFull: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  dateChip: { alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#F2F3F5', minWidth: 44 },
  dateChipSel: { backgroundColor: '#2C2C2E' },
  dateDay: { fontSize: 9, fontWeight: '600', color: '#9999A6', textTransform: 'uppercase', letterSpacing: 0.4 },
  dateNum: { fontSize: 17, fontWeight: '700', color: '#2C2C2E', lineHeight: 22 },
  dateTextSel: { color: '#FAFAF8' },

  // Time row
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 2, gap: 8 },
  timeStepper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F3F5', borderRadius: 10, overflow: 'hidden' },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 7 },
  stepBtnText: { fontSize: 18, color: '#2C2C2E', lineHeight: 22 },
  timeLabel: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#2C2C2E', letterSpacing: 0.3 },
  timeArrow: { fontSize: 14, color: '#AEAEB2', fontWeight: '400' },

  // Parents-only toggle
  parentsOnlyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  parentsOnlyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  parentsOnlyIcon: { fontSize: 16 },
  parentsOnlyLabel: { fontSize: 13, fontWeight: '600', color: '#2C2C2E' },
  parentsOnlyHint: { fontSize: 11, color: '#9999A6', marginTop: 1 },

  // Members — circles only
  memberRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', paddingVertical: 2 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarInitial: { fontSize: 14, fontWeight: '700' },

  // Type
  typeRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', paddingVertical: 2 },
  typeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F2F3F5', gap: 5 },
  typeDot: { width: 7, height: 7, borderRadius: 4 },
  typeText: { fontSize: 12, fontWeight: '500', color: '#2C2C2E' },
  typeTextSel: { color: '#fff' },

  // Recurrence
  repeatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  repeatHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repeatActiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5B9CF6' },
  repeatChevron: { fontSize: 9, color: '#AEAEB2', marginBottom: 1 },
  recurrenceRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', paddingVertical: 4 },
  recurrenceChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F2F3F5' },
  recurrenceChipSel: { backgroundColor: '#2C2C2E' },
  recurrenceChipText: { fontSize: 12, fontWeight: '500', color: '#2C2C2E' },
  recurrenceChipTextSel: { color: '#FAFAF8' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 4 },
  saveHeroBtn: { flex: 1 },
  deleteHeroBtn: { flex: 0 },
  deleteBtnText: { color: '#F97B8B', fontSize: 14, fontWeight: '600' },
});
