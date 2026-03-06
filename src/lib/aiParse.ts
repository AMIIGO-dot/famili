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
  /** minutes before event to fire a reminder: 30, 60, 1440 (1 day), 2880 (2 days), or null */
  reminderMinutes: 30 | 60 | 1440 | 2880 | null;
}

/**
 * Transcribe a base64-encoded audio recording via the `transcribe-audio` Edge Function.
 * The Edge Function calls OpenAI Whisper under the hood.
 */
export async function transcribeAudio(
  base64Audio: string,
  language?: string,
  mimeType = 'audio/m4a'
): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ text: string; error?: string }>('transcribe-audio', {
    body: { audio: base64Audio, mimeType, language },
  });
  if (error) {
    // FunctionsHttpError: context is the raw Response — read body text for actual message
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.text === 'function') {
        const bodyText: string = await ctx.text();
        console.warn('[transcribeAudio] raw error body:', bodyText);
        try {
          const body = JSON.parse(bodyText);
          if (body?.error) msg = body.error;
        } catch { msg = bodyText || msg; }
      }
    } catch {}
    console.warn('[transcribeAudio] final error:', msg);
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.text) throw new Error('Empty transcription');
  return data.text;
}

export async function aiParseEvent(
  text: string,
  members: Array<{ id: string; name: string }>,
  timezone: string
): Promise<ParsedEvent> {
  const { data, error } = await supabase.functions.invoke<ParsedEvent>('parse-event', {
    body: { text, members, timezone },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.text === 'function') {
        const bodyText: string = await ctx.text();
        console.warn('[aiParseEvent] raw error body:', bodyText);
        try {
          const body = JSON.parse(bodyText);
          if (body?.error) msg = body.error;
        } catch { msg = bodyText || msg; }
      }
    } catch {}
    console.warn('[aiParseEvent] final error:', msg);
    throw new Error(msg);
  }
  if (!data) throw new Error('Empty response from AI');
  return data;
}
