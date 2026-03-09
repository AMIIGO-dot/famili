/**
 * FAMILJ – send-parent-invite Edge Function
 *
 * Stores a co-parent invite in family_invites table and sends
 * an email to the invited parent via Supabase Auth.
 *
 * Body: { family_id, email, invited_by_user_id, inviter_name? }
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
    const { family_id, email, invited_by_user_id, inviter_name } = await req.json();

    if (!family_id || !email || !invited_by_user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const normalised = email.trim().toLowerCase();

    // Admin client — bypasses RLS
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Upsert invite record
    const { error: upsertError } = await admin.from('family_invites').upsert(
      {
        family_id,
        email: normalised,
        invited_by: invited_by_user_id,
        accepted_at: null,
        accepted_by: null,
      },
      { onConflict: 'family_id,email' },
    );

    if (upsertError) {
      console.error('[send-parent-invite] upsert error:', upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get family name for the invite email
    const { data: family } = await admin
      .from('families')
      .select('name')
      .eq('id', family_id)
      .maybeSingle();

    const familyName = family?.name ?? 'familjen';
    const displayName = inviter_name ?? 'Någon';

    // 3. Try to send an invite email (works for new users; existing users will be
    //    joined automatically on their next sign-in via claimPendingInvite)
    const redirectTo = 'com.superdevver.familj://';
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalised, {
      redirectTo,
      data: {
        family_id,
        invited_by: invited_by_user_id,
        inviter_name: displayName,
        family_name: familyName,
      },
    });

    if (inviteError) {
      // 422 = user already registered — that's fine, invite is stored in DB
      // They'll be joined automatically when they next open the app
      if (
        inviteError.message?.includes('already registered') ||
        inviteError.message?.includes('already been invited') ||
        (inviteError as any).status === 422
      ) {
        console.log(
          '[send-parent-invite] user already registered, invite stored in DB:',
          normalised,
        );
      } else {
        console.error('[send-parent-invite] invite email error:', inviteError);
        // Still return success — invite is stored in DB
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-parent-invite] unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
