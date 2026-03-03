/**
 * FAMILJ – Family Invite Service (Co-parent)
 *
 * Parent A invites Parent B via email.
 * When Parent B signs in for the first time, claimPendingInvite() auto-joins them.
 *
 * DEV mode: in-memory Map.
 * Production: Supabase `family_invites` table.
 */

import { supabase } from './supabase';

const DEV_BYPASS = true;

interface PendingInvite {
  familyId: string;
  invitedBy: string;
}

// In-memory store (dev only)
const DEV_PENDING = new Map<string, PendingInvite>(); // key = normalised email

const MEMBER_COLORS = [
  '#5B9CF6', '#F97B8B', '#68D9A4', '#F5A623',
  '#BF86FF', '#FF7043', '#26C6DA', '#8D8D99',
];
function randomColor() {
  return MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
}
function defaultName(email: string) {
  // "anna.svensson@gmail.com" → "Anna"
  const local = email.split('@')[0].replace(/[._-]/g, ' ');
  return local.charAt(0).toUpperCase() + local.slice(1).split(' ')[0];
}

/**
 * Store a pending parent invite.
 * In production this also sends an email via a Supabase Edge Function.
 */
export async function sendParentInvite(
  email: string,
  familyId: string,
  invitedBy: string,
): Promise<void> {
  const normalised = email.trim().toLowerCase();

  if (DEV_BYPASS) {
    DEV_PENDING.set(normalised, { familyId, invitedBy });
    console.log('[FamilyInvite] DEV pending invite stored for', normalised);
    return;
  }

  // Upsert: invalidate any earlier un-accepted invite for the same email + family
  const { error } = await supabase.from('family_invites').upsert(
    {
      family_id: familyId,
      email: normalised,
      invited_by: invitedBy,
      accepted_at: null,
      accepted_by: null,
    },
    { onConflict: 'family_id,email' },
  );
  if (error) throw new Error(error.message);

  // TODO: trigger Supabase Edge Function to send the email notification
}

export interface ClaimResult {
  familyId: string;
}

/**
 * Called right after the user logs in.
 * If their email has a pending invite, accepts it and creates their member record.
 * Returns the familyId they joined, or null if nothing was pending.
 */
export async function claimPendingInvite(
  email: string,
  userId: string,
): Promise<ClaimResult | null> {
  const normalised = email.trim().toLowerCase();

  if (DEV_BYPASS) {
    const pending = DEV_PENDING.get(normalised);
    if (!pending) return null;
    DEV_PENDING.delete(normalised);
    // In DEV we can't truly spin up a second user session, but the infrastructure is correct.
    console.log('[FamilyInvite] DEV invite claimed for', normalised);
    return { familyId: pending.familyId };
  }

  // 1. Find un-accepted invite for this email
  const { data: invite, error: findErr } = await supabase
    .from('family_invites')
    .select('*')
    .eq('email', normalised)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) {
    console.error('[FamilyInvite] claimPendingInvite lookup error:', findErr);
    return null;
  }
  if (!invite) return null;

  // 2. Mark invite as accepted
  const { error: updateErr } = await supabase
    .from('family_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', invite.id);

  if (updateErr) {
    console.error('[FamilyInvite] claimPendingInvite accept error:', updateErr);
    return null;
  }

  // 3. Create a parent member record for the joining user
  const { error: memberErr } = await supabase.from('members').insert({
    family_id: invite.family_id,
    name: defaultName(normalised),
    color: randomColor(),
    role: 'parent',
    user_id: userId,
  });

  if (memberErr) {
    console.error('[FamilyInvite] claimPendingInvite member create error:', memberErr);
    // Don't block — they can still join but may need to set their name
  }

  return { familyId: invite.family_id };
}
