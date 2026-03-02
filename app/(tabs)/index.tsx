/**
 * FAMILJ – Weekly View Screen (Home)
 *
 * Shows events for the current week with per-member filtering.
 * Swipe left/right arrows navigate between weeks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { format, getISOWeek } from 'date-fns';
import {
  getWeekRangeByOffset,
  formatTime,
  convertUTCToLocal,
} from '../../src/lib/time';
import { useEventsStore, EventOccurrence } from '../../src/stores/eventStore';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import EventCreateSheet from '../../src/components/EventCreateSheet';

const DAYS = 7;
const ALL_ID = '__ALL__';

export default function WeeklyViewScreen() {
  const { t, i18n } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(ALL_ID);

  const { user } = useAuthStore();
  const { family, members } = useFamilyStore();
  const { timezone, weekStartsOn, timeFormat } = useSettingsStore();
  const { fetchEventsForWeek, getOccurrencesForRange, isLoading } = useEventsStore();

  const weekRange = getWeekRangeByOffset(weekOffset, weekStartsOn, timezone);
  const weekNumber = getISOWeek(weekRange.start);

  useEffect(() => {
    if (family) {
      fetchEventsForWeek(family.id, weekRange.start, weekRange.end);
    }
  }, [family, weekOffset]);

  const allOccurrences = getOccurrencesForRange(weekRange.start, weekRange.end);

  // Filter occurrences by selected member
  const occurrences =
    selectedMemberId === ALL_ID
      ? allOccurrences
      : allOccurrences.filter((occ) => occ.memberIds.includes(selectedMemberId));

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(weekRange.start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const getEventsForDay = useCallback(
    (day: Date) =>
      occurrences.filter((occ) => {
        const local = convertUTCToLocal(occ.start, timezone);
        return (
          local.getFullYear() === day.getFullYear() &&
          local.getMonth() === day.getMonth() &&
          local.getDate() === day.getDate()
        );
      }),
    [occurrences, timezone]
  );

  const today = convertUTCToLocal(new Date(), timezone);
  const isToday = (day: Date) =>
    day.getDate() === today.getDate() &&
    day.getMonth() === today.getMonth() &&
    day.getFullYear() === today.getFullYear();

  // Find member color for the accent bar on an event chip
  const getMemberColor = (memberIds: string[]): string => {
    if (memberIds.length === 0) return '#E8E8E4';
    const found = members.find((m) => memberIds.includes(m.id));
    return found?.color ?? '#E8E8E4';
  };

  // Derive header date range label, e.g. "3–9 mar"
  const rangeLabel = (() => {
    const s = weekRange.start;
    const e = new Date(weekRange.end);
    e.setDate(e.getDate() - 1); // end is exclusive
    const startFmt = format(s, 'd');
    const endFmt = format(e, 'd MMM', { locale: undefined });
    return `${startFmt}–${endFmt}`;
  })();

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.navBtn} onPress={() => setWeekOffset((w) => w - 1)} hitSlop={12}>
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.weekLabel}>
            {t('weeklyView.weekNumber', { number: weekNumber })}
          </Text>
          <Text style={styles.dateRange}>{rangeLabel}</Text>
        </View>
        <Pressable style={styles.navBtn} onPress={() => setWeekOffset((w) => w + 1)} hitSlop={12}>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* ── Member filter bar ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterContent}
      >
        {/* "All" chip */}
        <TouchableOpacity
          style={[styles.filterChip, selectedMemberId === ALL_ID && styles.filterChipAllSel]}
          onPress={() => setSelectedMemberId(ALL_ID)}
        >
          <Text style={[styles.filterChipText, selectedMemberId === ALL_ID && styles.filterChipTextSel]}>
            {t('weeklyView.all', 'All')}
          </Text>
        </TouchableOpacity>

        {members.map((m) => {
          const sel = selectedMemberId === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.filterChip,
                { borderColor: m.color },
                sel && { backgroundColor: m.color },
              ]}
              onPress={() => setSelectedMemberId(sel ? ALL_ID : m.id)}
            >
              <View style={[styles.filterAvatar, { backgroundColor: sel ? 'rgba(255,255,255,0.35)' : m.color }]}>
                <Text style={styles.filterAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={[styles.filterChipText, sel && styles.filterChipTextSel]}>
                {m.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Day list ── */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const today_ = isToday(day);
          const dayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' })
            .format(day)
            .toUpperCase();
          return (
            <View key={idx} style={[styles.dayRow, today_ && styles.dayRowToday]}>
              {/* Left: day label */}
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, today_ && styles.dayNameToday]}>{dayName}</Text>
                <View style={[styles.dayNumWrap, today_ && styles.dayNumWrapToday]}>
                  <Text style={[styles.dayNum, today_ && styles.dayNumToday]}>{day.getDate()}</Text>
                </View>
              </View>

              {/* Right: event cards */}
              <View style={styles.dayEvents}>
                {dayEvents.length === 0 ? (
                  <Text style={styles.emptyDayText}>—</Text>
                ) : (
                  dayEvents.map((evt, eIdx) => {
                    const accentColor = getMemberColor(evt.memberIds);
                    const timeStr = formatTime(evt.start, timezone, timeFormat === '12h');
                    // Show small avatar dots for assigned members
                    const assignedMembers = members.filter((m) => evt.memberIds.includes(m.id));
                    return (
                      <View key={eIdx} style={styles.eventCard}>
                        <View style={[styles.eventAccent, { backgroundColor: accentColor }]} />
                        <View style={styles.eventBody}>
                          <View style={styles.eventRow}>
                            <Text style={styles.eventTitle} numberOfLines={1}>{evt.title}</Text>
                            <Text style={styles.eventTime}>{timeStr}</Text>
                          </View>
                          {assignedMembers.length > 0 && (
                            <View style={styles.memberDots}>
                              {assignedMembers.map((m) => (
                                <View key={m.id} style={[styles.memberDot, { backgroundColor: m.color }]}>
                                  <Text style={styles.memberDotText}>{m.name.charAt(0).toUpperCase()}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}
        {/* bottom padding so FAB doesn't cover last event */}
        <View style={{ height: 88 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setSheetVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <EventCreateSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  navBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  navArrow: { fontSize: 26, color: '#2C2C2E' },
  headerCenter: { alignItems: 'center' },
  weekLabel: { fontSize: 15, fontWeight: '700', color: '#2C2C2E', letterSpacing: 0.2 },
  dateRange: { fontSize: 12, color: '#9999A6', marginTop: 1 },

  // Member filter bar
  filterBar: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F0F0EC',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  filterChipAllSel: { backgroundColor: '#2C2C2E', borderColor: '#2C2C2E' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6E6E7A' },
  filterChipTextSel: { color: '#fff' },
  filterAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Day rows
  scroll: { flex: 1 },
  dayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0EC',
    minHeight: 60,
    paddingVertical: 10,
  },
  dayRowToday: { backgroundColor: '#F7F7FF' },
  dayHeader: { width: 62, alignItems: 'center', paddingTop: 2 },
  dayName: { fontSize: 10, fontWeight: '700', color: '#AAAAAF', textTransform: 'uppercase', letterSpacing: 0.6 },
  dayNameToday: { color: '#5B9CF6' },
  dayNumWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  dayNumWrapToday: { backgroundColor: '#5B9CF6' },
  dayNum: { fontSize: 17, fontWeight: '600', color: '#2C2C2E' },
  dayNumToday: { color: '#fff' },

  dayEvents: { flex: 1, paddingRight: 14, gap: 6 },
  emptyDayText: { fontSize: 13, color: '#DCDCDC', paddingTop: 6 },

  // Event cards
  eventCard: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  eventAccent: { width: 4, borderRadius: 0 },
  eventBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 7 },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventTitle: { fontSize: 13, fontWeight: '600', color: '#2C2C2E', flex: 1 },
  eventTime: { fontSize: 11, color: '#9999A6', marginLeft: 6 },
  memberDots: { flexDirection: 'row', gap: 4, marginTop: 5 },
  memberDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberDotText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: { color: '#FAFAF8', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
