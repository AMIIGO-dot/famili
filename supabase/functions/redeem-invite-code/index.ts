/**
 * FAMILJ – redeem-invite-code Edge Function
 *
 * Called by a child after signInAnonymously().
 * Uses the admin client to bypass members RLS, which blocks a user
 * who isn't yet in any family from updating their own member row.
 *
 * Body: { code: string }
 * Auth: Bearer <anon user JWT>
 * Returns: { memberId, familyId } | { error }
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
    // Verify the caller is a real authenticated user
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Use a per-request client to validate the user's JWT
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

    const { code } = await req.json();
    if (!code) {
      return new Response(JSON.stringify({ error: 'Missing code' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Find a valid, unused, non-expired invite code
    const now = new Date().toISOString();
    const { data: invite, error: findErr } = await admin
      .from('invite_codes')
      .select('*')
      .eq('code', code.trim())
      .is('used_at', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (findErr || !invite) {
      return new Response(JSON.stringify({ error: 'invalid_code' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Mark the code as used
    await admin
      .from('invite_codes')
      .update({ used_at: now, used_by: user.id })
      .eq('id', invite.id);

    // 3. Link the anonymous user to the member row (bypasses members_owner RLS)
    const { error: memberErr } = await admin
      .from('members')
      .update({ user_id: user.id })
      .eq('id', invite.member_id);

    if (memberErr) {
      console.error('[redeem-invite-code] member update error:', memberErr);
      return new Response(JSON.stringify({ error: memberErr.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ memberId: invite.member_id, familyId: invite.family_id }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[redeem-invite-code] unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
