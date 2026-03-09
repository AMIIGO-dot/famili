/**
 * FAMILJ – claim-parent-invite Edge Function
 *
 * Called on login for every authenticated user.
 * Checks if their email has a pending family invite, and if so:
 *  - marks the invite as accepted
 *  - creates a parent member row (bypasses members_owner RLS)
 *
 * No body needed — email and userId come from the JWT.
 * Returns: { familyId } | { familyId: null }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEMBER_COLORS = [
  '#5B9CF6', '#F97B8B', '#68D9A4', '#F5A623',
  '#BF86FF', '#FF7043', '#26C6DA', '#8D8D99',
];
function randomColor() {
  return MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
}
function defaultName(email: string) {
  const local = email.split('@')[0].replace(/[._-]/g, ' ');
  return local.charAt(0).toUpperCase() + local.slice(1).split(' ')[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate the caller's JWT to get email + userId
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user || !user.email) {
      return new Response(JSON.stringify({ familyId: null }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const normalised = user.email.trim().toLowerCase();
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Find un-accepted invite for this email
    const { data: invite } = await admin
      .from('family_invites')
      .select('*')
      .eq('email', normalised)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return new Response(JSON.stringify({ familyId: null }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Mark invite accepted
    await admin
      .from('family_invites')
      .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq('id', invite.id);

    // 3. Check if user is already a member of this family (avoid duplicate rows)
    const { data: existing } = await admin
      .from('members')
      .select('id')
      .eq('family_id', invite.family_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      // 4. Create parent member row (bypasses members_owner RLS)
      await admin.from('members').insert({
        family_id: invite.family_id,
        name: defaultName(normalised),
        color: randomColor(),
        role: 'parent',
        user_id: user.id,
      });
    }

    return new Response(JSON.stringify({ familyId: invite.family_id }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[claim-parent-invite] unexpected error:', err);
    return new Response(JSON.stringify({ familyId: null }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
