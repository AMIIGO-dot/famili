/**
 * FAMILJ – Weekly View Screen (Home)
 *
 * The primary screen of the app. Shows events for the current week
 * with swipe navigation between weeks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getISOWeek } from 'date-fns';
import {
  getWeekRangeByOffset,
  formatWeekDayLabel,
  formatTime,
  convertUTCToLocal,
} from '../../src/lib/time';
import { useEventsStore } from '../../src/stores/eventStore';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';

const DAYS = 7;

export default function WeeklyViewScreen() {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);

  const { user } = useAuthStore();
  const { family } = useFamilyStore();
  const { timezone, weekStartsOn, timeFormat } = useSettingsStore();
  const { fetchEventsForWeek, getOccurrencesForRange, isLoading } = useEventsStore();

  const weekRange = getWeekRangeByOffset(weekOffset, weekStartsOn, timezone);
  const weekNumber = getISOWeek(weekRange.start);

  useEffect(() => {
    if (family) {
      fetchEventsForWeek(family.id, weekRange.start, weekRange.end);
    }
  }, [family, weekOffset]);

  const occurrences = getOccurrencesForRange(weekRange.start, weekRange.end);

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(weekRange.start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const getEventsForDay = useCallback(
    (day: Date) => {
      return occurrences.filter((occ) => {
        const localStart = convertUTCToLocal(occ.start, timezone);
        return (
          localStart.getFullYear() === day.getFullYear() &&
          localStart.getMonth() === day.getMonth() &&
          localStart.getDate() === day.getDate()
        );
      });
    },
    [occurrences, timezone]
  );

  const today = convertUTCToLocal(new Date(), timezone);
  const isToday = (day: Date) =>
    day.getDate() === today.getDate() &&
    day.getMonth() === today.getMonth() &&
    day.getFullYear() === today.getFullYear();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={12}>
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.weekLabel}>
          {t('weeklyView.weekNumber', { number: weekNumber })}
        </Text>
        <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={12}>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Day columns */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const today_ = isToday(day);
          return (
            <View key={idx} style={styles.dayRow}>
              <View style={[styles.dayHeader, today_ && styles.dayHeaderToday]}>
                <Text style={[styles.dayLabel, today_ && styles.dayLabelToday]}>
                  {formatWeekDayLabel(day, timezone)}
                </Text>
                {today_ && <Text style={styles.todayDot}>•</Text>}
              </View>
              <View style={styles.dayEvents}>
                {dayEvents.length === 0 ? (
                  <Text style={styles.emptyDayText}>{t('weeklyView.noEvents')}</Text>
                ) : (
                  dayEvents.map((evt, eIdx) => (
                    <View key={eIdx} style={[styles.eventChip, { backgroundColor: EVENT_TYPE_COLORS[evt.type] }]}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {evt.title}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatTime(evt.start, timezone, timeFormat === '12h')}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  activity: '#D0E8FF',
  homework: '#FFF3CD',
  test: '#FFD6D6',
  other: '#E8E8E4',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E4',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2E',
    letterSpacing: 0.2,
  },
  navArrow: {
    fontSize: 26,
    color: '#2C2C2E',
    paddingHorizontal: 8,
  },
  scroll: {
    flex: 1,
  },
  dayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0EC',
    minHeight: 56,
    paddingVertical: 8,
  },
  dayHeader: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  dayHeaderToday: {},
  dayLabel: {
    fontSize: 12,
    color: '#9999A6',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayLabelToday: {
    color: '#2C2C2E',
    fontWeight: '700',
  },
  todayDot: {
    fontSize: 16,
    color: '#2C2C2E',
    lineHeight: 14,
  },
  dayEvents: {
    flex: 1,
    paddingRight: 16,
    gap: 4,
  },
  emptyDayText: {
    fontSize: 12,
    color: '#C8C8CC',
    fontStyle: 'italic',
    paddingTop: 4,
  },
  eventChip: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2C2C2E',
    flex: 1,
  },
  eventTime: {
    fontSize: 11,
    color: '#6E6E7A',
    marginLeft: 6,
  },
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
  fabIcon: {
    color: '#FAFAF8',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
  },
});
