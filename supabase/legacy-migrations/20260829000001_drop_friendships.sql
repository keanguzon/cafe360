-- Migration: Drop Friendships and make all social features strictly Circle-based

-- 1. Drop existing policies that referenced friendships
DROP POLICY IF EXISTS "Users can view friends saves for same cafe" ON public.saved_cafes;
DROP POLICY IF EXISTS "Users can view visits they participated in" ON public.visits;
DROP POLICY IF EXISTS "Visit photos follow visit visibility" ON public.visit_photos;
DROP POLICY IF EXISTS "Users can view friend activities" ON public.activities;

-- 2. Drop the friendships table and its indexes/policies
DROP TABLE IF EXISTS public.friendships CASCADE;

-- 3. Re-create clean Circle-first policies

-- Saved cafes: users see their own saves OR saves belonging to their groups
CREATE POLICY "Users can view own saved cafes"
  ON public.saved_cafes FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Visits: users can view visits if they created it, participated in it, or if it was logged in one of their circles
CREATE POLICY "Users can view circle visits"
  ON public.visits FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = created_by
    OR EXISTS (
      SELECT 1 FROM public.visit_participants vp
      WHERE vp.visit_id = visits.id
      AND vp.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.group_members creator_gm ON creator_gm.group_id = gm.group_id
      WHERE gm.user_id = (SELECT auth.uid())
      AND creator_gm.user_id = visits.created_by
    )
  );

-- Visit photos: follow visit visibility
CREATE POLICY "Users can view circle visit photos"
  ON public.visit_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.visits v
      WHERE v.id = visit_photos.visit_id
      AND (
        v.created_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.visit_participants vp
          WHERE vp.visit_id = v.id AND vp.user_id = (SELECT auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          JOIN public.group_members creator_gm ON creator_gm.group_id = gm.group_id
          WHERE gm.user_id = (SELECT auth.uid())
          AND creator_gm.user_id = v.created_by
        )
      )
    )
  );

-- Activities: visible to members of the same group/circle OR own activities
CREATE POLICY "Users can view circle activities"
  ON public.activities FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = activities.group_id
        AND gm.user_id = (SELECT auth.uid())
      )
    )
  );
