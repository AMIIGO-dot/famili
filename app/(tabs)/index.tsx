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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { format, getISOWeek } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
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
  const [pressedDate, setPressedDate] = useState<Date | undefined>(undefined);
  const [pressedEvent, setPressedEvent] = useState<EventOccurrence | undefined>(undefined);

  const { user } = useAuthStore();
  const { family, members, currentMemberRole } = useFamilyStore();
  const { timezone, weekStartsOn, timeFormat } = useSettingsStore();
  const { fetchEventsForWeek, getOccurrencesForRange, isLoading } = useEventsStore();

  const weekRange = getWeekRangeByOffset(weekOffset, weekStartsOn, timezone);
  const weekNumber = getISOWeek(weekRange.start);

  // Ordered list of filter IDs for swipe cycling
  const filterIds = [ALL_ID, ...members.map((m) => m.id)];

  // Reanimated values for smooth member-switch transition
  const translateX = useSharedValue(0);
  const opacity    = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const SLIDE_OUT = 45;
  const EXIT_MS   = 100;
  const ENTER_MS  = 220;

  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.12;
      opacity.value = interpolate(
        Math.abs(e.translationX),
        [0, 130],
        [1, 0.72],
        Extrapolation.CLAMP,
      );
    })
    .onEnd((e) => {
      const isDecisive =
        Math.abs(e.velocityX) > 280 || Math.abs(e.translationX) > 55;

      if (!isDecisive) {
        // Snap back
        translateX.value = withSpring(0, { damping: 22, stiffness: 340 });
        opacity.value    = withTiming(1, { duration: 160 });
        return;
      }

      const goNext = e.velocityX < 0; // swipe left → next
      const currentIdx = filterIds.indexOf(selectedMemberId);
      const nextId = goNext
        ? filterIds[(currentIdx + 1) % filterIds.length]
        : filterIds[(currentIdx - 1 + filterIds.length) % filterIds.length];

      // Slide + fade out
      translateX.value = withTiming(goNext ? -SLIDE_OUT : SLIDE_OUT, { duration: EXIT_MS });
      opacity.value    = withTiming(0, { duration: EXIT_MS });

      setTimeout(() => {
        // Switch member then slide in from opposite side
        setSelectedMemberId(nextId);
        translateX.value = goNext ? SLIDE_OUT : -SLIDE_OUT;
        opacity.value    = 0;
        translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
        opacity.value    = withTiming(1, { duration: ENTER_MS });
      }, EXIT_MS + 10);
    });

  useEffect(() => {
    if (family) {
      fetchEventsForWeek(family.id, weekRange.start, weekRange.end);
    }
  }, [family, weekOffset]);

  const allOccurrences = getOccurrencesForRange(weekRange.start, weekRange.end, currentMemberRole);

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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            {t('weeklyView.weekNumber', { number: weekNumber })}
          </Text>
          <Text style={styles.headerSubtitle}>{rangeLabel}</Text>
        </View>
        <View style={styles.headerNav}>
          <Pressable
            style={styles.navBtn}
            onPress={() => setWeekOffset((w) => w - 1)}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={20} color="#44B57F" />
          </Pressable>
          <View style={styles.navDivider} />
          <Pressable
            style={styles.navBtn}
            onPress={() => setWeekOffset((w) => w + 1)}
            hitSlop={10}
          >
            <Ionicons name="chevron-forward" size={20} color="#44B57F" />
          </Pressable>
        </View>
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
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        <View style={styles.weekCard}>
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const today_ = isToday(day);
            const isFirst = idx === 0;
            const isLast  = idx === days.length - 1;
            const dayName = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' })
              .format(day)
              .toUpperCase();
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={1}
                delayLongPress={350}
                onLongPress={() => {
                  if (currentMemberRole !== 'parent') return;
                  setPressedDate(day); setPressedEvent(undefined); setSheetVisible(true);
                }}
                style={[
                  styles.dayRow,
                  today_ && styles.dayRowToday,
                  isFirst && styles.dayRowFirst,
                  isLast  && styles.dayRowLast,
                  !isLast && styles.dayRowBorder,
                ]}
              >
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
                      <TouchableOpacity
                        key={eIdx}
                        activeOpacity={currentMemberRole === 'parent' ? 0.75 : 1}
                        onPress={() => {
                          if (currentMemberRole !== 'parent') return;
                          setPressedEvent(evt); setSheetVisible(true);
                        }}
                        style={styles.eventCard}
                      >
                        <View style={[styles.eventAccent, { backgroundColor: accentColor }]} />
                        <View style={styles.eventBody}>
                          <View style={styles.eventRow}>
                            <Text style={styles.eventTitle} numberOfLines={1}>{evt.title}</Text>
                            <View style={styles.eventTimeRow}>
                              {evt.isParentsOnly && (
                                <Text style={styles.lockIcon}>🔒</Text>
                              )}
                              <Text style={styles.eventTime}>{timeStr}</Text>
                            </View>
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
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* bottom padding so FAB doesn't cover last event */}
        <View style={{ height: 140 }} />
      </ScrollView>
        </Animated.View>
      </GestureDetector>

      {/* —— FAB —— only parents can create events */}
      {currentMemberRole === 'parent' && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => { setPressedDate(undefined); setPressedEvent(undefined); setSheetVisible(true); }}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      <EventCreateSheet
        visible={sheetVisible}
        onClose={() => { setSheetVisible(false); setPressedDate(undefined); setPressedEvent(undefined); }}
        initialDate={pressedDate ?? weekRange.start}
        lockedDate={pressedDate}
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
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F3F5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  navBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  navDivider: { width: 1, height: 20, backgroundColor: '#E0E0E5' },
  weekLabel: { fontSize: 15, fontWeight: '700', color: '#2C2C2E', letterSpacing: 0.2 },
  dateRange: { fontSize: 12, color: '#9999A6', marginTop: 1 },

  // Member filter bar
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
  filterChipAllSel: { backgroundColor: '#44B57F', borderColor: '#44B57F' },
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
  scrollContent: { paddingHorizontal: 14, paddingTop: 14 },
  weekCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  dayRow: {
    flexDirection: 'row',
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
  },
  dayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  dayRowFirst: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  dayRowLast: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  dayRowToday: { backgroundColor: '#EBF7F2' },
  dayHeader: { width: 62, alignItems: 'center', paddingTop: 2 },
  dayName: { fontSize: 10, fontWeight: '700', color: '#AAAAAF', textTransform: 'uppercase', letterSpacing: 0.6 },
  dayNameToday: { color: '#44B57F' },
  dayNumWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  dayNumWrapToday: { backgroundColor: '#44B57F' },
  dayNum: { fontSize: 17, fontWeight: '600', color: '#2C2C2E' },
  dayNumToday: { color: '#fff' },

  dayEvents: { flex: 1, paddingRight: 14, gap: 6 },
  emptyDayText: { fontSize: 13, color: '#DCDCDC', paddingTop: 6 },

  // Event cards
  eventCard: {
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  eventAccent: { width: 4, borderRadius: 0 },
  eventBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 7 },
  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventTitle: { fontSize: 13, fontWeight: '600', color: '#2C2C2E', flex: 1 },
  eventTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 6 },
  lockIcon: { fontSize: 10 },
  eventTime: { fontSize: 11, color: '#9999A6' },
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
    bottom: 130,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#44B57F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#44B57F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: { color: '#FAFAF8', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
