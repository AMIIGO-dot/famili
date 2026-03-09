/**
 * FAMILJ – upload-member-avatar Edge Function
 *
 * Accepts a base64-encoded image + memberId from a parent user,
 * verifies the caller is a parent in the same family as the member,
 * then uploads to the member-avatars Storage bucket using the
 * service-role key (bypasses storage RLS entirely).
 *
 * Body: { base64: string, memberId: string, ext: string }
 * Returns: { publicUrl: string }
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

    // 1. Validate caller JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { base64, memberId, ext } = body as { base64: string; memberId: string; ext: string };
    if (!base64 || !memberId || !ext) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 2. Look up the target member to get its family_id
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, family_id, role')
      .eq('id', memberId)
      .single();

    if (memberErr || !member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 3. Verify the caller is a parent in the same family (or the family owner)
    const { data: callerRow } = await admin
      .from('members')
      .select('role, family_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: ownedFamily } = await admin
      .from('families')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    const callerFamilyId = callerRow?.family_id ?? ownedFamily?.id ?? null;
    const callerIsParent = (callerRow?.role === 'parent') || !!ownedFamily;

    if (!callerIsParent || callerFamilyId !== member.family_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // 4. Decode base64 → Uint8Array
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const contentType = safeExt === 'png' ? 'image/png' : 'image/jpeg';
    const path = `${member.family_id}/${memberId}.${safeExt}`;

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // 5. Upload via service-role client (bypasses storage RLS)
    const { error: uploadErr } = await admin.storage
      .from('member-avatars')
      .upload(path, bytes, { contentType, upsert: true });

    if (uploadErr) {
      return new Response(JSON.stringify({ error: uploadErr.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: pub } = admin.storage
      .from('member-avatars')
      .getPublicUrl(path);

    return new Response(
      JSON.stringify({ publicUrl: `${pub.publicUrl}?v=${Date.now()}` }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
