/**
 * FAMILJ – AI Event Parser
 *
 * Calls the `parse-event` Supabase Edge Function which uses GPT-4o-mini
 * to turn a natural-language string into structured event data.
 *
 * Requires OPENAI_API_KEY to be set as a Supabase secret:
 *   npx supabase secrets set OPENAI_API_KEY=sk-...
 */

import { supabase } from './supabase';

export interface ParsedEvent {
  title: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  /** Days from today (0 = today, 1 = tomorrow, 7 = next week, etc.) */
  dateOffsetDays: number;
  recurrence: 'none' | 'weekly' | 'biweekly' | 'weekdays';
  memberIds: string[];
  eventType: 'activity' | 'homework' | 'test' | 'other';
}

export async function aiParseEvent(
  text: string,
  members: Array<{ id: string; name: string }>,
  timezone: string
): Promise<ParsedEvent> {
  const { data, error } = await supabase.functions.invoke<ParsedEvent>('parse-event', {
    body: { text, members, timezone },
  });
  if (error) throw error;
  if (!data) throw new Error('Empty response from AI');
  return data;
}
