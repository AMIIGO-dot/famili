/**
 * FAMILJ – Invite Code Service
 *
 * Generates 6-digit invite codes that parents share with children.
 * Children redeem codes to join the family without an email address.
 *
 * DEV mode: stores codes in memory.
 * Production: reads/writes Supabase invite_codes table.
 */

import { supabase } from './supabase';

const DEV_BYPASS = true;

// In-memory store for dev
const DEV_CODES = new Map<string, { memberId: string; familyId: string; expiresAt: Date }>();

function generateCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

/** Create and persist a new invite code for a given member. Returns the code string. */
export async function createInviteCode(
  memberId: string,
  familyId: string,
  createdBy: string
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  if (DEV_BYPASS) {
    // Invalidate any previous code for this member
    for (const [k, v] of DEV_CODES.entries()) {
      if (v.memberId === memberId) DEV_CODES.delete(k);
    }
    DEV_CODES.set(code, { memberId, familyId, expiresAt });
    return code;
  }

  // Prod: insert into Supabase
  const { error } = await supabase.from('invite_codes').insert({
    code,
    member_id: memberId,
    family_id: familyId,
    created_by: createdBy,
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw new Error(error.message);
  return code;
}

export interface RedeemResult {
  memberId: string;
  familyId: string;
}

/**
 * Validate a code.
 * Returns member/family info if valid, null if expired/used/not found.
 */
export async function redeemInviteCode(
  code: string,
  redeemedByUserId: string
): Promise<RedeemResult | null> {
  if (DEV_BYPASS) {
    const entry = DEV_CODES.get(code.trim());
    if (!entry) return null;
    if (entry.expiresAt < new Date()) {
      DEV_CODES.delete(code);
      return null;
    }
    // Mark as used (single-use in dev too)
    DEV_CODES.delete(code);
    return { memberId: entry.memberId, familyId: entry.familyId };
  }

  // Prod: fetch and mark used atomically via RPC or sequential queries
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('code', code.trim())
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (error || !data) return null;

  // Mark as redeemed
  await supabase
    .from('invite_codes')
    .update({ used_at: now, used_by: redeemedByUserId })
    .eq('id', data.id);

  return { memberId: data.member_id, familyId: data.family_id };
}
