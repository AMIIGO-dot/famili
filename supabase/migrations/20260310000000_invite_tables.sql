-- FAMILJ: invite_codes + family_invites tables
-- Applied: 2026-03-10

-- ─── invite_codes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        NOT NULL UNIQUE,
  member_id  UUID        NOT NULL REFERENCES public.members(id)  ON DELETE CASCADE,
  family_id  UUID        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_by UUID        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  used_by    UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parents can create invite codes"              ON public.invite_codes;
DROP POLICY IF EXISTS "authenticated users can read invite codes"    ON public.invite_codes;
DROP POLICY IF EXISTS "authenticated users can redeem invite codes"  ON public.invite_codes;

CREATE POLICY "parents can create invite codes"
  ON public.invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.families f
            WHERE f.id = invite_codes.family_id AND f.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m
               WHERE m.family_id = invite_codes.family_id
                 AND m.user_id = auth.uid()
                 AND m.role = 'parent')
  );

CREATE POLICY "authenticated users can read invite codes"
  ON public.invite_codes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can redeem invite codes"
  ON public.invite_codes FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─── family_invites ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.family_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  invited_by  UUID        NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, email)
);
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parents can create family invites"   ON public.family_invites;
DROP POLICY IF EXISTS "users can read their own invites"    ON public.family_invites;
DROP POLICY IF EXISTS "users can accept their own invites"  ON public.family_invites;

CREATE POLICY "parents can create family invites"
  ON public.family_invites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.families f
            WHERE f.id = family_invites.family_id AND f.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m
               WHERE m.family_id = family_invites.family_id
                 AND m.user_id = auth.uid()
                 AND m.role = 'parent')
  );

CREATE POLICY "users can read their own invites"
  ON public.family_invites FOR SELECT
  USING (
    auth.email() = family_invites.email
    OR EXISTS (SELECT 1 FROM public.families f
               WHERE f.id = family_invites.family_id AND f.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.members m
               WHERE m.family_id = family_invites.family_id
                 AND m.user_id = auth.uid()
                 AND m.role = 'parent')
  );

CREATE POLICY "users can accept their own invites"
  ON public.family_invites FOR UPDATE
  USING  (auth.email() = family_invites.email OR auth.uid() = family_invites.invited_by)
  WITH CHECK (auth.email() = family_invites.email OR auth.uid() = family_invites.invited_by);
