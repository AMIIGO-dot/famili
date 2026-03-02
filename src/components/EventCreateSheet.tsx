/**
 * FAMILJ – Event Creation Bottom Sheet
 * Clean, minimal design. Three sections: when, who, what type.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useEventsStore } from '../stores/eventStore';
import { useSettingsStore } from '../stores/settingsStore';

const EVENT_TYPES = ['activity', 'homework', 'test', 'other'] as const;
type EventType = typeof EVENT_TYPES[number];

const TYPE_META: Record<EventType, { dot: string; labelKey: string }> = {
  activity: { dot: '#5B9CF6', labelKey: 'events.typeActivity' },
  homework: { dot: '#F5A623', labelKey: 'events.typeHomework' },
  test:     { dot: '#F97B8B', labelKey: 'events.typeTest' },
  other:    { dot: '#9999A6', labelKey: 'events.typeOther' },
};

const DURATIONS = [
  { label: '30m', minutes: 30 },
  { label: '1h',  minutes: 60 },
  { label: '1½h', minutes: 90 },
  { label: '2h',  minutes: 120 },
];

function buildDateStrip(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 13; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}



interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function EventCreateSheet({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const inputRef = useRef<TextInput>(null);

  const { members, family } = useFamilyStore();
  const { createEvent } = useEventsStore();
  const { timezone } = useSettingsStore();

  const dateStrip = useRef(buildDateStrip()).current;

  const [title, setTitle] = useState('');
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [eventType, setEventType] = useState<EventType>('activity');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 3 }).start();
      setTimeout(() => inputRef.current?.focus(), 200);
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
    setStartHour(Math.floor(total / 60));
    setStartMinute(total % 60);
  };

  const timeLabel = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;

  const handleSave = async () => {
    if (!title.trim() || !family) return;
    setSaving(true);
    try {
      const d = dateStrip[selectedDateIdx];
      const start = new Date(d);
      start.setHours(startHour, startMinute, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      await createEvent({
        family_id: family.id,
        title: title.trim(),
        type: eventType,
        start_time_utc: start.toISOString(),
        end_time_utc: end.toISOString(),
        member_ids: selectedMemberIds.length > 0 ? selectedMemberIds : members.map((m) => m.id),
        recurrence_rule: null,
      });
      setTitle(''); setSelectedDateIdx(0); setStartHour(9); setStartMinute(0);
      setDurationMinutes(60); setEventType('activity'); setSelectedMemberIds([]);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 8, transform: [{ translateY: slideAnim }] }]}>
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

            {/* Date strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
              {dateStrip.map((day, idx) => {
                const sel = idx === selectedDateIdx;
                return (
                  <TouchableOpacity key={idx} style={[styles.dateChip, sel && styles.dateChipSel]} onPress={() => setSelectedDateIdx(idx)}>
                    <Text style={[styles.dateDay, sel && styles.dateTextSel]}>
                      {idx === 0
                        ? t('weeklyView.today')
                        : new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(day)}
                    </Text>
                    <Text style={[styles.dateNum, sel && styles.dateTextSel]}>{day.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time + Duration in one compact row */}
            <View style={styles.timeRow}>
              <View style={styles.timeStepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime(-15)}>
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.timeLabel}>{timeLabel}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime(15)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.durationRow}>
                {DURATIONS.map((d) => (
                  <TouchableOpacity
                    key={d.minutes}
                    style={[styles.durChip, durationMinutes === d.minutes && styles.durChipSel]}
                    onPress={() => setDurationMinutes(d.minutes)}
                  >
                    <Text style={[styles.durText, durationMinutes === d.minutes && styles.durTextSel]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, (!title.trim() || saving) && styles.saveBtnOff]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? '…' : t('events.save')}</Text>
            </TouchableOpacity>

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
  dateRow: { paddingBottom: 4, gap: 6 },
  dateChip: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F0F0EC', minWidth: 52 },
  dateChipSel: { backgroundColor: '#2C2C2E' },
  dateDay: { fontSize: 10, fontWeight: '600', color: '#9999A6', textTransform: 'uppercase', letterSpacing: 0.4 },
  dateNum: { fontSize: 20, fontWeight: '700', color: '#2C2C2E', lineHeight: 24 },
  dateTextSel: { color: '#FAFAF8' },

  // Time + Duration row
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  timeStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0EC', borderRadius: 12, overflow: 'hidden' },
  stepBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  stepBtnText: { fontSize: 20, color: '#2C2C2E', lineHeight: 24 },
  timeLabel: { fontSize: 20, fontWeight: '700', color: '#2C2C2E', minWidth: 58, textAlign: 'center' },
  durationRow: { flexDirection: 'row', gap: 6 },
  durChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F0F0EC' },
  durChipSel: { backgroundColor: '#2C2C2E' },
  durText: { fontSize: 13, fontWeight: '600', color: '#6E6E7A' },
  durTextSel: { color: '#FAFAF8' },

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

  // Save
  saveBtn: { backgroundColor: '#2C2C2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnOff: { opacity: 0.35 },
  saveBtnText: { color: '#FAFAF8', fontSize: 16, fontWeight: '600' },
});
