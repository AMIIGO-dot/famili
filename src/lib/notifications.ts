/**
 * FAMILJ – Push Notification Utilities
 *
 * Wraps expo-notifications for scheduling and cancelling event reminders.
 *
 * Each scheduled notification is stored under a stable identifier derived
 * from the event ID so it can be cleanly cancelled on update or delete.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// ─── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduleReminderParams {
  eventId: string;
  title: string;
  startTimeUtc: Date; // the event's UTC start time
  reminderMinutes: number; // minutes *before* start to fire
}

/**
 * Schedules a local notification for an event reminder.
 * Cancels any existing notification for the same event first.
 * Returns the Expo notification identifier.
 */
export async function scheduleEventReminder({
  eventId,
  title,
  startTimeUtc,
  reminderMinutes,
}: ScheduleReminderParams): Promise<string | null> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return null;

  // Cancel any existing reminder for this event
  await cancelEventReminder(eventId);

  const fireDate = new Date(startTimeUtc.getTime() - reminderMinutes * 60_000);

  // Don't schedule if the fire time is already in the past
  if (fireDate <= new Date()) return null;

  const body = reminderLabel(reminderMinutes);

  const identifier = await Notifications.scheduleNotificationAsync({
    identifier: notificationId(eventId),
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
    },
  });

  return identifier;
}

/** Cancel a previously scheduled reminder for an event. */
export async function cancelEventReminder(eventId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId(eventId));
  } catch {
    // Notification may not exist — ignore
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notificationId(eventId: string): string {
  return `familj-event-${eventId}`;
}

function reminderLabel(minutes: number): string {
  if (minutes < 60) return `In ${minutes} minutes`;
  if (minutes === 60) return 'In 1 hour';
  if (minutes < 1440) return `In ${minutes / 60} hours`;
  if (minutes === 1440) return 'Tomorrow';
  return `In ${minutes / 1440} days`;
}

// ─── Available reminder options ────────────────────────────────────────────────

export const REMINDER_OPTIONS = [
  { value: null,  labelKey: 'events.reminderNone' },
  { value: 30,    labelKey: 'events.reminder30Min' },
  { value: 60,    labelKey: 'events.reminder1Hour' },
  { value: 1440,  labelKey: 'events.reminder1Day' },
  { value: 2880,  labelKey: 'events.reminder2Days' },
] as const;

export type ReminderValue = (typeof REMINDER_OPTIONS)[number]['value'];

// ─── Push token persistence ────────────────────────────────────────────────────

/**
 * Gets the Expo push token for this device and upserts it to Supabase
 * so other family members can be notified cross-device.
 * Safe to call on every login — idempotent.
 */
export async function savePushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      '377b3160-65ec-4d15-be0b-b222c3f4c1f7';

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!tokenData) return;

    await supabase.from('push_tokens').upsert({
      user_id: userId,
      token: tokenData,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    // In Expo Go, getExpoPushTokenAsync may fail — safe to ignore
    console.warn('[Notifications] savePushToken failed:', err);
  }
}
