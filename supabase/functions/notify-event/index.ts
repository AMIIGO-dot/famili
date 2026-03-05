/**
 * FAMILJ – Supabase Edge Function: notify-event
 *
 * Sends an Expo push notification to all parent members of a family
 * (excluding the event creator) when a new event is added.
 *
 * Body: { family_id: string, event_title: string, created_by_user_id: string }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { family_id, event_title, created_by_user_id } = await req.json();

    if (!family_id || !event_title || !created_by_user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Get all parent members of this family
    const { data: members, error: membersErr } = await supabase
      .from('members')
      .select('user_id, name')
      .eq('family_id', family_id)
      .eq('role', 'parent')
      .not('user_id', 'is', null);

    if (membersErr) throw membersErr;

    // 2. Exclude the creator
    const otherParentUserIds = (members ?? [])
      .map((m: { user_id: string; name: string }) => m.user_id)
      .filter((uid: string) => uid && uid !== created_by_user_id);

    if (otherParentUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 3. Look up push tokens for those users
    const { data: tokenRows, error: tokenErr } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', otherParentUserIds);

    if (tokenErr) throw tokenErr;

    const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token).filter(Boolean);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no tokens registered' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 4. Send via Expo Push API
    const messages = tokens.map((token: string) => ({
      to: token,
      title: 'FAMILJ – New event added',
      body: event_title,
      sound: 'default',
      data: { family_id },
    }));

    const expoResp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    const expoJson = await expoResp.json();
    console.log('[notify-event] Expo response:', JSON.stringify(expoJson));

    return new Response(JSON.stringify({ sent: tokens.length, expo: expoJson }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notify-event] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
