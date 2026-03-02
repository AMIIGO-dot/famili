/**
 * FAMILJ – Centralized Time Utility Module
 *
 * Golden rules:
 * - All timestamps stored in UTC in Supabase
 * - All rendering converted to user timezone
 * - Recurring generation based on original timezone
 * - DST-safe calculations mandatory
 *
 * No UI component should manipulate raw Date objects directly.
 * All conversions must go through this module.
 */

import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  parseISO,
  format,
  isWithinInterval,
  getDay,
} from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'weekdays';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // 1 = weekly, 2 = biweekly
  byWeekday?: string[]; // e.g. ['MO', 'TU', 'WE', 'TH', 'FR']
  timezone: string; // IANA timezone
}

export interface WeekRange {
  start: Date;
  end: Date;
}

const WEEKDAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

/**
 * Convert a local datetime string (in the given timezone) to a UTC Date.
 * @param localDateTimeStr - ISO string or 'yyyy-MM-dd HH:mm' in local time
 * @param timezone - IANA timezone string, e.g. 'Europe/Stockholm'
 */
export function parseLocalToUTC(localDateTimeStr: string, timezone: string): Date {
  const localDate = typeof localDateTimeStr === 'string'
    ? parseISO(localDateTimeStr.includes('T') ? localDateTimeStr : localDateTimeStr.replace(' ', 'T'))
    : localDateTimeStr;
  return fromZonedTime(localDate, timezone);
}

/**
 * Convert a UTC Date to a local Date object in the given timezone.
 * @param utcDate - UTC Date
 * @param timezone - IANA timezone string
 */
export function convertUTCToLocal(utcDate: Date | string, timezone: string): Date {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return toZonedTime(date, timezone);
}

/**
 * Format a UTC date for display in a specific timezone.
 * @param utcDate - UTC Date
 * @param timezone - IANA timezone string
 * @param formatStr - date-fns format string
 */
export function formatInZone(
  utcDate: Date | string,
  timezone: string,
  formatStr: string
): string {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return formatInTimeZone(date, timezone, formatStr);
}

/**
 * Get the start and end dates for a given week.
 * @param date - Any date within the target week
 * @param weekStartsOn - 0 = Sunday, 1 = Monday
 * @param timezone - IANA timezone string for localized week boundaries
 */
export function getWeekRange(
  date: Date,
  weekStartsOn: 0 | 1 = 1,
  timezone?: string
): WeekRange {
  const targetDate = timezone ? toZonedTime(date, timezone) : date;
  const start = startOfWeek(targetDate, { weekStartsOn });
  const end = endOfWeek(targetDate, { weekStartsOn });
  return { start, end };
}

/**
 * Get the date range for a week offset from today.
 * @param weekOffset - 0 = current week, 1 = next week, -1 = previous week
 * @param weekStartsOn - 0 = Sunday, 1 = Monday
 * @param timezone - IANA timezone for today's date
 */
export function getWeekRangeByOffset(
  weekOffset: number,
  weekStartsOn: 0 | 1 = 1,
  timezone: string = 'UTC'
): WeekRange {
  const now = toZonedTime(new Date(), timezone);
  const weekDate = addWeeks(now, weekOffset);
  return getWeekRange(weekDate, weekStartsOn, timezone);
}

/**
 * Generate all occurrences of a recurring event within a date range.
 * DST-safe: uses the event's stored timezone to generate each occurrence.
 *
 * @param masterStartUTC - The master event's start time in UTC
 * @param masterEndUTC - The master event's end time in UTC
 * @param rule - RecurrenceRule definition
 * @param rangeStart - Start of the query range (local or UTC)
 * @param rangeEnd - End of the query range
 */
export function generateOccurrences(
  masterStartUTC: Date | string,
  masterEndUTC: Date | string,
  rule: RecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date
): Array<{ start: Date; end: Date }> {
  const tz = rule.timezone;
  const startUTC = typeof masterStartUTC === 'string' ? parseISO(masterStartUTC) : masterStartUTC;
  const endUTC = typeof masterEndUTC === 'string' ? parseISO(masterEndUTC) : masterEndUTC;

  const durationMs = endUTC.getTime() - startUTC.getTime();
  const occurrences: Array<{ start: Date; end: Date }> = [];

  if (rule.frequency === 'weekdays') {
    // Generate occurrences for Mon-Fri within the range
    let cursor = toZonedTime(rangeStart, tz);
    const rangeEndLocal = toZonedTime(rangeEnd, tz);
    const masterLocal = toZonedTime(startUTC, tz);

    while (cursor <= rangeEndLocal) {
      const dayOfWeek = getDay(cursor); // 0=Sun, 6=Sat
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Set the time to match the master event's local time
        const occurrence = new Date(cursor);
        occurrence.setHours(
          masterLocal.getHours(),
          masterLocal.getMinutes(),
          masterLocal.getSeconds(),
          0
        );
        const occurrenceUTC = fromZonedTime(occurrence, tz);
        if (occurrenceUTC >= startUTC) {
          occurrences.push({
            start: occurrenceUTC,
            end: new Date(occurrenceUTC.getTime() + durationMs),
          });
        }
      }
      cursor = addDays(cursor, 1);
    }
    return occurrences;
  }

  if (rule.frequency === 'weekly' || rule.frequency === 'biweekly') {
    const intervalWeeks = rule.interval ?? (rule.frequency === 'biweekly' ? 2 : 1);
    const byWeekday = rule.byWeekday;

    let cursor = startUTC;

    // Advance cursor to rangeStart if it's before rangeStart
    while (cursor < rangeStart) {
      cursor = addWeeks(cursor, intervalWeeks);
    }

    // Iterate until we pass the rangeEnd (with a safety cap)
    let iterations = 0;
    while (cursor <= rangeEnd && iterations < 1000) {
      iterations++;
      const localCursor = toZonedTime(cursor, tz);
      const dayOfWeek = getDay(localCursor);

      if (byWeekday && byWeekday.length > 0) {
        // Only include if cursor's weekday is in byWeekday
        const dayKey = Object.entries(WEEKDAY_MAP).find(([, v]) => v === dayOfWeek)?.[0];
        if (dayKey && byWeekday.includes(dayKey)) {
          if (isWithinInterval(cursor, { start: rangeStart, end: rangeEnd })) {
            occurrences.push({
              start: cursor,
              end: new Date(cursor.getTime() + durationMs),
            });
          }
        }
      } else {
        if (isWithinInterval(cursor, { start: rangeStart, end: rangeEnd })) {
          occurrences.push({
            start: cursor,
            end: new Date(cursor.getTime() + durationMs),
          });
        }
      }
      cursor = addWeeks(cursor, intervalWeeks);
    }
    return occurrences;
  }

  return occurrences;
}

/**
 * Format a date as an ISO datetime string suitable for Supabase storage.
 * Always outputs UTC.
 */
export function toSupabaseUTC(date: Date): string {
  return date.toISOString();
}

/**
 * Get today's date in the user's timezone, as a plain Date object.
 */
export function getTodayInZone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Format a local time string for display (respects 12h/24h preference).
 */
export function formatTime(
  utcDate: Date | string,
  timezone: string,
  use12Hour: boolean = false
): string {
  const fmt = use12Hour ? 'h:mm a' : 'HH:mm';
  return formatInZone(utcDate, timezone, fmt);
}

/**
 * Format a short date label (e.g. "Mon 3" for weekly view headers).
 */
export function formatWeekDayLabel(
  date: Date,
  timezone: string,
  locale?: string
): string {
  return formatInTimeZone(date, timezone, 'EEE d');
}
