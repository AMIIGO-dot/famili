/**
 * FAMILJ – Min dag (My Day) Screen
 *
 * A beautiful day-at-a-glance view for the whole family.
 * Shows all events for today with rich cards: who, what, when.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from 'heroui-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useEventsStore, EventOccurrence } from '../../src/stores/eventStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { convertUTCToLocal, formatTime } from '../../src/lib/time';
import EventCreateSheet from '../../src/components/EventCreateSheet';

const ALL_ID = '__ALL__';

const TYPE_COLORS: Record<string, string> = {
  activity: '#5B9CF6',
  homework: '#F5A623',
  test:     '#F97B8B',
  other:    '#9999A6',
};

const TYPE_BG: Record<string, string> = {
  activity: '#EEF4FF',
  homework: '#FFF8EE',
  test:     '#FFF0F2',
  other:    '#F5F5F6',
};

function getGreeting(hour: number, t: (k: string) => string): string {
  if (hour < 10) return t('today.greetingMorning');
  if (hour < 13) return t('today.greetingDay');
  if (hour < 18) return t('today.greetingAfternoon');
  return t('today.greetingEvening');
}

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pressedEvent, setPressedEvent] = useState<EventOccurrence | undefined>(undefined);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(ALL_ID);

  const { family, members } = useFamilyStore();
  const { fetchEventsForWeek, getOccurrencesForRange } = useEventsStore();
  const { timezone, timeFormat } = useSettingsStore();

  // Today's range in UTC
  const today = convertUTCToLocal(new Date(), timezone);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  useEffect(() => {
    if (family) {
      fetchEventsForWeek(family.id, todayStart, todayEnd);
    }
  }, [family?.id]);

  const allOccurrences = getOccurrencesForRange(todayStart, todayEnd);

  const occurrences = (
    selectedMemberId === ALL_ID
      ? allOccurrences
      : allOccurrences.filter((o) => o.memberIds.includes(selectedMemberId))
  ).sort((a, b) => a.start.getTime() - b.start.getTime());

  const now = new Date();

  const getStatus = useCallback(
    (occ: EventOccurrence): 'past' | 'ongoing' | 'upcoming' => {
      if (now > occ.end) return 'past';
      if (now >= occ.start && now <= occ.end) return 'ongoing';
      return 'upcoming';
    },
    []
  );

  const formatDuration = (start: Date, end: Date): string => {
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const greeting = getGreeting(today.getHours(), t);

  const fullDateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today);

  const typeLabel = (type: string) => {
    const keys: Record<string, string> = {
      activity: 'events.typeActivity',
      homework: 'events.typeHomework',
      test:     'events.typeTest',
      other:    'events.typeOther',
    };
    return t(keys[type] ?? 'events.typeOther');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{t('today.title')}</Text>
          <Text style={styles.headerSubtitle}>{fullDateLabel}</Text>
        </View>
        {occurrences.length > 0 && (
          <View style={styles.eventCountBadge}>
            <Text style={styles.eventCountNum}>{occurrences.length}</Text>
            <Ionicons name="calendar" size={13} color="#5B9CF6" />
          </View>
        )}
      </View>

      {/* ── Member filter ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, selectedMemberId === ALL_ID && styles.filterChipAllSel]}
          onPress={() => setSelectedMemberId(ALL_ID)}
        >
          <Text style={[styles.filterChipText, selectedMemberId === ALL_ID && styles.filterChipTextSel]}>
            {t('weeklyView.all')}
          </Text>
        </TouchableOpacity>
        {members.map((m) => {
          const sel = selectedMemberId === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.filterChip, { borderColor: m.color }, sel && { backgroundColor: m.color }]}
              onPress={() => setSelectedMemberId(sel ? ALL_ID : m.id)}
            >
              <View style={[styles.filterAvatar, { backgroundColor: sel ? 'rgba(255,255,255,0.35)' : m.color }]}>
                <Text style={styles.filterAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.filterChipText, sel && styles.filterChipTextSel]}>{m.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Event list ── */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {occurrences.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>☀</Text>
            <Text style={styles.emptyTitle}>{t('today.noEvents')}</Text>
            <Text style={styles.emptyHint}>{t('today.noEventsHint')}</Text>
          </View>
        ) : (
          occurrences.map((occ, idx) => {
            const localStart  = convertUTCToLocal(occ.start, timezone);
            const localEnd    = convertUTCToLocal(occ.end,   timezone);
            const startStr    = formatTime(occ.start, timezone, timeFormat === '12h');
            const endStr      = formatTime(occ.end,   timezone, timeFormat === '12h');
            const duration    = formatDuration(localStart, localEnd);
            const status      = getStatus(occ);
            const accentColor = TYPE_COLORS[occ.type] ?? TYPE_COLORS.other;
            const bgColor     = TYPE_BG[occ.type]     ?? TYPE_BG.other;
            const assignedMembers = members.filter((m) => occ.memberIds.includes(m.id));

            // Show a time-of-day marker if first event or gap to previous
            const prevEnd = idx > 0 ? occurrences[idx - 1].end : null;
            const showTimeSep = idx === 0 || (prevEnd && localStart.getTime() - prevEnd.getTime() > 30 * 60 * 1000);

            return (
              <React.Fragment key={`${occ.eventId}-${occ.start.getTime()}`}>
                {showTimeSep && (
                  <View style={styles.timeSep}>
                    <View style={styles.timeSepLine} />
                    <Text style={styles.timeSepText}>{startStr}</Text>
                    <View style={styles.timeSepLine} />
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    styles.cardWrap,
                    status === 'ongoing' && { borderLeftWidth: 3, borderLeftColor: accentColor },
                    status === 'past'    && styles.cardWrapPast,
                  ]}
                  onPress={() => { setPressedEvent(occ); setSheetVisible(true); }}
                >
                  <Card
                    variant="default"
                    animation="disable-all"
                    style={status === 'past' ? { opacity: 0.55 } : undefined}
                  >
                    {/* Top row: dot + title + time */}
                    <Card.Header className="flex-row items-center gap-3 pb-2">
                      <View style={[styles.typeDot, { backgroundColor: accentColor }]} />
                      <Card.Title
                        numberOfLines={1}
                        style={styles.cardTitle}
                      >
                        {occ.title}
                      </Card.Title>
                      <Card.Description style={styles.cardTime}>
                        {startStr}
                      </Card.Description>
                    </Card.Header>

                    <Card.Body className="pt-0 gap-3">
                      {/* Sub-row: duration + type + recurring + ongoing */}
                      <View style={styles.cardMetaRow}>
                        <View style={[styles.typeBadge, { backgroundColor: accentColor + '18' }]}>
                          <Text style={[styles.typeBadgeText, { color: accentColor }]}>
                            {typeLabel(occ.type)}
                          </Text>
                        </View>
                        <Text style={styles.cardDuration}>{startStr} – {endStr} · {duration}</Text>
                        {occ.isRecurring && (
                          <Ionicons name="repeat" size={13} color="#AEAEB2" />
                        )}
                        {status === 'ongoing' && (
                          <View style={[styles.ongoingPill, { backgroundColor: accentColor }]}>
                            <Text style={styles.ongoingPillText}>{t('today.ongoing')}</Text>
                          </View>
                        )}
                      </View>

                      {/* Members */}
                      {assignedMembers.length > 0 && (
                        <View style={styles.membersRow}>
                          {assignedMembers.map((m) => (
                            <View key={m.id} style={[styles.memberChip, { backgroundColor: m.color + '18' }]}>
                              <View style={[styles.memberAvatar, { backgroundColor: m.color }]}>
                                <Text style={styles.memberAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                              </View>
                              <Text style={[styles.memberName, { color: m.color }]}>{m.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </Card.Body>
                  </Card>
                </TouchableOpacity>
              </React.Fragment>
            );
          })
        )}
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => { setPressedEvent(undefined); setSheetVisible(true); }}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <EventCreateSheet
        visible={sheetVisible}
        onClose={() => { setSheetVisible(false); setPressedEvent(undefined); }}
        initialDate={today}
        lockedDate={today}
        editEvent={pressedEvent}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F2F3F5' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerLeft: { flex: 1 },
  headerBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AEAEB2',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C2C2E',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9999A6',
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  eventCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDF3FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  eventCountNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B9CF6',
  },
  greeting: { fontSize: 13, fontWeight: '600', color: '#9999A6' },
  dateLabel: { fontSize: 26, fontWeight: '700', color: '#2C2C2E' },

  // Filter bar
  filterBar: { flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F2F3F5',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  filterChipAllSel: { backgroundColor: '#2C2C2E', borderColor: '#2C2C2E' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6E6E7A' },
  filterChipTextSel: { color: '#fff' },
  filterAvatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Empty state
  emptyWrap: { alignItems: 'center', marginTop: 72, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 14, opacity: 0.35 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#2C2C2E', textAlign: 'center', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9999A6', textAlign: 'center', lineHeight: 20 },

  // Time separator
  timeSep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
    gap: 8,
  },
  timeSepLine: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  timeSepText: { fontSize: 11, fontWeight: '700', color: '#AEAEB2', letterSpacing: 0.5 },

  // Cards
  cardWrap: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardWrapPast: { shadowOpacity: 0.02, elevation: 1 },

  typeDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },

  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2C2E',
  },
  cardTime: {
    fontSize: 13,
    color: '#AEAEB2',
    fontWeight: '500',
    flexShrink: 0,
  },

  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  cardDuration: { fontSize: 12, color: '#AEAEB2', fontWeight: '400' },
  ongoingPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  ongoingPillText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  membersRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  memberAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  memberName: { fontSize: 12, fontWeight: '600' },

  textMuted: { color: '#AEAEB2' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 130,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { color: '#FAFAF8', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
