/**
 * FAMILJ – Supabase Edge Function: parse-event
 *
 * Receives a natural-language event description and returns structured
 * event data using OpenAI GPT-4o-mini with JSON output mode.
 *
 * Setup:
 *   npx supabase secrets set OPENAI_API_KEY=sk-...
 *   npx supabase functions deploy parse-event
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseRequest {
  text: string;
  members: Array<{ id: string; name: string }>;
  timezone: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { text, members, timezone }: ParseRequest = await req.json();

    // Build a clear today reference in the user's timezone
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    const todayStr = now.toISOString().split('T')[0];
    const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDow = DOW[now.getDay()];

    const memberList = members.length
      ? members.map((m) => `"${m.name}" (id: ${m.id})`).join(', ')
      : 'no members defined';

    const systemPrompt = `You are a calendar event parser for a family scheduling app called FAMILJ.
Today is ${todayStr} (${todayDow}), timezone: ${timezone}.
Family members available: ${memberList}.

Extract the event from the user's text and return ONLY a valid JSON object with exactly these fields:
{
  "title": string,           // concise event name
  "startHour": number,       // 0–23
  "startMinute": number,     // 0, 5, 10, …, 55 (round to nearest 5)
  "endHour": number,         // 0–23
  "endMinute": number,       // 0, 5, 10, …, 55
  "dateOffsetDays": number,  // 0=today, 1=tomorrow, 2=day after, 7=next week, etc.
  "recurrence": "none" | "weekly" | "biweekly" | "weekdays",
  "memberIds": string[],     // array of matched member IDs (empty if no match)
  "eventType": "activity" | "homework" | "test" | "other"
}

Rules:
- If no time mentioned: startHour=15, startMinute=0, endHour=16, endMinute=0
- If only start time mentioned: endHour = startHour+1 (capped at 23)
- Round minutes to nearest 5
- For "every week" / "weekly" → recurrence "weekly"
- For "every two weeks" / "biweekly" / "varannan" → recurrence "biweekly"
- For "weekdays" / "mon–fri" / "vardagar" → recurrence "weekdays"
- Match member names case-insensitively; only include confident matches
- For "today" → dateOffsetDays=0; "tomorrow"/"imorgon" → 1
- For day-of-week (e.g. "Tuesday"), compute offset from today (1–7)
- eventType "homework" if mentions homework/läxa/hausaufgabe; "test" if exam/prov/test; else "activity"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'OpenAI request failed', detail: errorText }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('parse-event error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
