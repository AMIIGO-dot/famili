-- FAMILJ: Member profile photos
-- Applied: 2026-03-11

-- ─── Add avatar_url to members ───────────────────────────────────────────────
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ─── Storage: member-avatars bucket ──────────────────────────────────────────
-- Bucket is created via the Supabase Storage API (see apply script).
-- These policies are created after the bucket exists.

-- Parents (family owner or linked parent member) can upload / replace photos.
-- The path convention is: {family_id}/{member_id}.{ext}
-- Public reads are enabled on the bucket level (no SELECT policy needed).

-- Allow family parents to INSERT objects into their family's sub-folder
DROP POLICY IF EXISTS "parents can upload member avatars" ON storage.objects;
CREATE POLICY "parents can upload member avatars"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'member-avatars'
    AND (
      -- File path starts with the family_id the caller owns or belongs to as a parent
      starts_with(name, public.get_family_id_for_user(auth.uid())::text)
    )
  );

-- Allow parents to UPDATE (overwrite) objects
DROP POLICY IF EXISTS "parents can update member avatars" ON storage.objects;
CREATE POLICY "parents can update member avatars"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'member-avatars'
    AND starts_with(name, public.get_family_id_for_user(auth.uid())::text)
  );

-- Allow parents to DELETE objects
DROP POLICY IF EXISTS "parents can delete member avatars" ON storage.objects;
CREATE POLICY "parents can delete member avatars"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'member-avatars'
    AND starts_with(name, public.get_family_id_for_user(auth.uid())::text)
  );

-- Public SELECT is controlled by bucket.public = true (set via API).
