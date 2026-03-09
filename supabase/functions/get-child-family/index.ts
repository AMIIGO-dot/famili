/**
 * FAMILJ – get-child-family Edge Function
 *
 * Called by child (anonymous) users whose regular Supabase client is
 * blocked by RLS from reading their own family data.
 *
 * Uses the admin client (service role) to bypass RLS and return:
 *   { family, members, currentMemberId }
 *
 * Auth: Bearer <anon user JWT>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('authorization') ?? '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate the caller's JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Find the member row linked to this user_id
    const { data: memberRow, error: memberErr } = await admin
      .from('members')
      .select('id, family_id, role, name, color, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !memberRow) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch the family
    const { data: family, error: famErr } = await admin
      .from('families')
      .select('*')
      .eq('id', memberRow.family_id)
      .single();

    if (famErr || !family) {
      return new Response(JSON.stringify({ error: 'family_not_found' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch all family members
    const { data: members } = await admin
      .from('members')
      .select('*')
      .eq('family_id', family.id);

    return new Response(
      JSON.stringify({
        family,
        members: members ?? [],
        currentMemberId: memberRow.id,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
