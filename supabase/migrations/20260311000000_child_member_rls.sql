-- FAMILJ: Fix RLS so anonymous child members can read their family data
-- Applied: 2026-03-11
--
-- Problem: anonymous child users could not read from families, members, or events
-- because existing policies only checked for the family *owner* (owner_id = auth.uid()).
-- Children are linked via members.user_id, not families.owner_id.
-- This migration adds member-aware SELECT policies for all three core tables.

-- ─── helpers ─────────────────────────────────────────────────────────────────
-- Returns the family_id for the current user via the members table.
-- Used in RLS USING clauses so any linked member can see family data.

-- ─── families ────────────────────────────────────────────────────────────────
-- Allow a user to read a family if they own it OR are a linked member.
DROP POLICY IF EXISTS "family_member_can_read" ON public.families;
CREATE POLICY "family_member_can_read"
  ON public.families
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT family_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- ─── members ─────────────────────────────────────────────────────────────────
-- Allow a user to read their own member row (needed to bootstrap family lookup).
DROP POLICY IF EXISTS "member_self_read" ON public.members;
CREATE POLICY "member_self_read"
  ON public.members
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow a user to read all members in any family they belong to.
DROP POLICY IF EXISTS "member_family_read" ON public.members;
CREATE POLICY "member_family_read"
  ON public.members
  FOR SELECT
  USING (
    family_id IN (
      SELECT id FROM public.families WHERE owner_id = auth.uid()
    )
    OR family_id IN (
      SELECT family_id FROM public.members WHERE user_id = auth.uid()
    )
  );

-- ─── events ──────────────────────────────────────────────────────────────────
-- Allow any family member (owner or linked member) to read events.
DROP POLICY IF EXISTS "event_family_member_read" ON public.events;
CREATE POLICY "event_family_member_read"
  ON public.events
  FOR SELECT
  USING (
    family_id IN (
      SELECT id FROM public.families WHERE owner_id = auth.uid()
    )
    OR family_id IN (
      SELECT family_id FROM public.members WHERE user_id = auth.uid()
    )
  );
