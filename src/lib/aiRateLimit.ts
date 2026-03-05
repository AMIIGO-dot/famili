/**
 * FAMILJ – AI Voice Rate Limiter
 *
 * Tracks daily usage of the AI voice feature per user using AsyncStorage.
 * Resets automatically at midnight (local date).
 *
 * Limits:
 *   - MAX_CALLS_PER_DAY: 20 AI calls per user per day
 *   - MAX_RECORDING_SECONDS: 30 seconds per recording (enforced in today.tsx)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_CALLS_PER_DAY = 20;
export const MAX_RECORDING_SECONDS = 30;

const KEY_PREFIX = 'ai_rate_limit';

interface RateLimitData {
  date: string;   // 'YYYY-MM-DD' in local time
  count: number;
}

function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function storageKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

/** Returns how many AI calls this user has made today. */
export async function getUsageToday(userId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return 0;
    const data: RateLimitData = JSON.parse(raw);
    if (data.date !== todayLocalDate()) return 0; // new day → reset
    return data.count;
  } catch {
    return 0;
  }
}

/** Returns remaining AI calls for today. */
export async function getRemainingCalls(userId: string): Promise<number> {
  const used = await getUsageToday(userId);
  return Math.max(0, MAX_CALLS_PER_DAY - used);
}

/**
 * Checks whether the user is allowed to make another AI call.
 * Returns true if allowed, false if the daily limit is reached.
 */
export async function canMakeAiCall(userId: string): Promise<boolean> {
  const used = await getUsageToday(userId);
  return used < MAX_CALLS_PER_DAY;
}

/**
 * Increments the usage counter after a successful AI call.
 * Must be called once per completed transcription + parse cycle.
 */
export async function recordAiCall(userId: string): Promise<void> {
  try {
    const today = todayLocalDate();
    const raw = await AsyncStorage.getItem(storageKey(userId));
    let count = 0;
    if (raw) {
      const data: RateLimitData = JSON.parse(raw);
      if (data.date === today) count = data.count;
    }
    const updated: RateLimitData = { date: today, count: count + 1 };
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.warn('[aiRateLimit] failed to record usage:', err);
  }
}
