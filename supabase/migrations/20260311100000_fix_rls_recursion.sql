-- FAMILJ: Fix infinite recursion in RLS policies (2026-03-11)
--
-- Root cause: families policy references members, members policy references
-- families → circular dependency → 42P17 infinite recursion error.
--
-- Fix: introduce a SECURITY DEFINER helper that runs as postgres (bypasses RLS)
-- so the subquery inside the function never triggers any policy.

-- ─── Helper function ─────────────────────────────────────────────────────────
-- Returns the family_id the caller belongs to.
-- SECURITY DEFINER = runs as the function owner (postgres), bypassing RLS.
-- This breaks the recursion cycle entirely.

CREATE OR REPLACE FUNCTION public.get_family_id_for_user(uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id          FROM public.families WHERE owner_id  = uid LIMIT 1),
    (SELECT family_id   FROM public.members  WHERE user_id   = uid LIMIT 1)
  )
$$;

-- ─── Drop old recursive policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "family_member_can_read"   ON public.families;
DROP POLICY IF EXISTS "member_self_read"          ON public.members;
DROP POLICY IF EXISTS "member_family_read"        ON public.members;
DROP POLICY IF EXISTS "event_family_member_read"  ON public.events;

-- ─── families ─────────────────────────────────────────────────────────────────
-- Owner OR any member of this family can read it.
CREATE POLICY "family_member_can_read"
  ON public.families
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id = public.get_family_id_for_user(auth.uid())
  );

-- ─── members ─────────────────────────────────────────────────────────────────
-- A user can always read their own row (bootstrapping; no recursion risk).
CREATE POLICY "member_self_read"
  ON public.members
  FOR SELECT
  USING (user_id = auth.uid());

-- A user can read all members that share the same family.
CREATE POLICY "member_family_read"
  ON public.members
  FOR SELECT
  USING (family_id = public.get_family_id_for_user(auth.uid()));

-- ─── events ──────────────────────────────────────────────────────────────────
-- Any family member can read events for their family.
CREATE POLICY "event_family_member_read"
  ON public.events
  FOR SELECT
  USING (family_id = public.get_family_id_for_user(auth.uid()));
