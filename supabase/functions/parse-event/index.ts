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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseRequest {
  text: string;
  members: Array<{ id: string; name: string }>;
  timezone: string;
}

Deno.serve(async (req) => {
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
    const DOW_SV = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
    const DOW_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const todayDow = DOW[now.getDay()];

    // Build a concrete calendar for this week + next 2 weeks so the model can
    // resolve "nu på lördag", "nästa vecka på tisdag", "nächsten Mittwoch", etc.
    const calendarLines: string[] = [];
    for (let d = 0; d <= 20; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() + d);
      const iso = date.toISOString().split('T')[0];
      const weekLabel = d < 7 ? 'this week' : d < 14 ? 'next week' : 'in 2 weeks';
      calendarLines.push(
        `  offset ${d}: ${iso} (${DOW[date.getDay()]} / ${DOW_SV[date.getDay()]} / ${DOW_DE[date.getDay()]}) [${weekLabel}]`
      );
    }

    // Pre-compute offsets for specific dates mentioned in the text (e.g. "20 Juni", "June 20", "20. Juni")
    // Month name → month number (1-based), all lowercased for matching
    const MONTH_MAP: Record<string, number> = {
      // English
      january:1, february:2, march:3, april:4, may:5, june:6,
      july:7, august:8, september:9, october:10, november:11, december:12,
      jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
      // Swedish
      januari:1, februari:2, mars:3, maj:5, juni:6, juli:7,
      augusti:8, oktober:10,
      // German
      januar:1, februar:2, märz:3, marz:3, mai:5,
    };
    const specificDates: string[] = [];
    // Patterns: "20 Juni", "den 20 juni", "June 20", "am 20. Juni", "20. März"
    const datePattern = /\b(\d{1,2})\.?\s+([a-zA-ZäöüÄÖÜ]+)\b|\b([a-zA-ZäöüÄÖÜ]+)\s+(\d{1,2})\b/gi;
    let match: RegExpExecArray | null;
    while ((match = datePattern.exec(text)) !== null) {
      const dayStr = match[1] ?? match[4];
      const monthStr = (match[2] ?? match[3] ?? '').toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u');
      const day = parseInt(dayStr, 10);
      const month = MONTH_MAP[monthStr];
      if (month && day >= 1 && day <= 31) {
        // Find the next occurrence of this month/day on or after today
        const candidate = new Date(now.getFullYear(), month - 1, day);
        if (candidate < now) candidate.setFullYear(candidate.getFullYear() + 1);
        const offsetDays = Math.round((candidate.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
        specificDates.push(`  "${match[0].trim()}" → offset ${offsetDays}: ${candidate.toISOString().split('T')[0]} (${DOW[candidate.getDay()]} / ${DOW_SV[candidate.getDay()]} / ${DOW_DE[candidate.getDay()]})`);
      }
    }
    if (specificDates.length > 0) {
      calendarLines.push('');
      calendarLines.push('Pre-computed specific dates found in the input:');
      calendarLines.push(...specificDates);
      calendarLines.push('Use these pre-computed offsets exactly as shown above.');
    }

    const memberList = members.length
      ? members.map((m) => `"${m.name}" (id: ${m.id})`).join(', ')
      : 'no members defined';

    const systemPrompt = `You are a calendar event parser for a family scheduling app called FAMILU.
Today is ${todayStr} (${todayDow}), timezone: ${timezone}.
Family members available: ${memberList}.

Here is the calendar with exact dates and dateOffsetDays values:
${calendarLines.join('\n')}

Extract the event from the user's text and return ONLY a valid JSON object with exactly these fields:
{
  "title": string,           // concise event name
  "startHour": number,       // 0–23
  "startMinute": number,     // 0, 5, 10, …, 55 (round to nearest 5)
  "endHour": number,         // 0–23
  "endMinute": number,       // 0, 5, 10, …, 55
  "dateOffsetDays": number,  // use the calendar above to find the exact offset
  "recurrence": "none" | "weekly" | "biweekly" | "weekdays",
  "memberIds": string[],     // array of matched member IDs (empty if no match)
  "eventType": "activity" | "homework" | "test" | "other",
  "reminderMinutes": 30 | 60 | 1440 | 2880 | null  // reminder before event; null if not mentioned
}

CRITICAL — date offset rules (use the calendar above to look up the exact offset):
- "today" / "idag" / "heute" → offset 0
- "tomorrow" / "imorgon" / "morgen" → offset 1
- "nu på [day]" / "den här [day]" / "kommande [day]" / "this [day]" → the FIRST occurrence of that day from today (this week). Look up in the calendar above.
- "nästa [day]" / "next [day]" / "nächsten [day]" → the occurrence in NEXT WEEK (offset 7–13). Look up the [next week] entries in the calendar.
- "nästa vecka på [day]" / "next week [day]" → same as above, NEXT WEEK (offset 7–13).
- "om två veckor" / "in two weeks" → the occurrence in the [in 2 weeks] range (offset 14–20).
- If only a day name is mentioned without "nästa"/"next", use the NEAREST FUTURE occurrence (this week first, next week if today is past that day).
- If a SPECIFIC DATE is mentioned (e.g. "20 Juni", "June 20", "20. Juni", "den 20 juni", "am 20. Juni"): first check the "Pre-computed specific dates" section above — use that offset EXACTLY without doing any math yourself. If no pre-computed entry exists, calculate the days from ${todayStr} to that date yourself.

Other rules:
- If no time mentioned: startHour=15, startMinute=0, endHour=16, endMinute=0
- If only start time mentioned: endHour = startHour+1 (capped at 23)
- Round minutes to nearest 5
- For "every week" / "weekly" / "varje vecka" → recurrence "weekly"
- For "every two weeks" / "biweekly" / "varannan vecka" → recurrence "biweekly"
- For "weekdays" / "mon–fri" / "vardagar" → recurrence "weekdays"
- Match member names case-insensitively; only include confident matches
- Reminder rules (reminderMinutes):
  - "remind me" / "påminn mig" / "erinnere mich" without specific time → 1440 (1 day before)
  - "remind ... 30 minutes" / "30 min påminnelse" → 30
  - "remind ... 1 hour" / "en timme innan" → 60
  - "remind ... 1 day" / "dagen före" / "einen Tag vorher" → 1440
  - "remind ... 2 days" / "två dagar före" / "zwei Tage vorher" → 2880
  - No reminder mentioned → null
- eventType "homework" if mentions homework/läxa/Hausaufgabe/Schulaufgabe; "test" if exam/prov/Prüfung/tentamen; "other" if any work/job signal — EN: work/working/works/job/office/meeting/conference/deadline/colleague/boss/shift; SV: arbete/arbetar/jobbar/jobb/jobbet/kontor/möte/konferens/deadline/kollega/chef/pass; DE: Arbeit/arbeite/arbeitet/arbeiten/Job/Büro/Besprechung/Konferenz/Kollege/Chef/Schicht; else "activity"`;

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
    if (!content) {
      console.error('No content in OpenAI response:', JSON.stringify(json));
      return new Response(
        JSON.stringify({ error: 'No content in AI response' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('JSON parse failed on content:', content);
      return new Response(
        JSON.stringify({ error: 'AI returned invalid JSON', raw: content }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields with safe defaults
    const result = {
      title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
      startHour: typeof parsed.startHour === 'number' ? parsed.startHour : 15,
      startMinute: typeof parsed.startMinute === 'number' ? parsed.startMinute : 0,
      endHour: typeof parsed.endHour === 'number' ? parsed.endHour : 16,
      endMinute: typeof parsed.endMinute === 'number' ? parsed.endMinute : 0,
      dateOffsetDays: typeof parsed.dateOffsetDays === 'number' ? parsed.dateOffsetDays : 0,
      recurrence: ['none', 'weekly', 'biweekly', 'weekdays'].includes(parsed.recurrence) ? parsed.recurrence : 'none',
      memberIds: Array.isArray(parsed.memberIds) ? parsed.memberIds.filter((id: unknown) => typeof id === 'string') : [],
      eventType: ['activity', 'homework', 'test', 'other'].includes(parsed.eventType) ? parsed.eventType : 'activity',
      reminderMinutes: [30, 60, 1440, 2880].includes(parsed.reminderMinutes) ? parsed.reminderMinutes : null,
    };

    return new Response(JSON.stringify(result), {
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
