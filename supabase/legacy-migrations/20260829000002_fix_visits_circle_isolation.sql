-- Delete legacy visits that lack circle context
DELETE FROM public.visits;

-- Add explicit circle boundary
ALTER TABLE public.visits ADD COLUMN group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE;

-- Update RLS for visits
DROP POLICY IF EXISTS "Users can view circle visits" ON public.visits;
CREATE POLICY "Users can view circle visits" ON public.visits FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = visits.group_id AND user_id = auth.uid())
);

-- Note: We also need to drop legacy policies that might allow global access
DROP POLICY IF EXISTS "Users can view their own visits" ON public.visits;
DROP POLICY IF EXISTS "Users can view friends visits" ON public.visits;
DROP POLICY IF EXISTS "Users can view group members visits" ON public.visits;

-- A user can create visits for groups they belong to
DROP POLICY IF EXISTS "Users can create their own visits" ON public.visits;
CREATE POLICY "Users can create circle visits" ON public.visits FOR INSERT WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = visits.group_id AND user_id = auth.uid())
);

-- A user can update their own visits
CREATE POLICY "Users can update their own visits" ON public.visits FOR UPDATE USING (
  created_by = auth.uid()
);

-- A user can delete their own visits
CREATE POLICY "Users can delete their own visits" ON public.visits FOR DELETE USING (
  created_by = auth.uid()
);

-- Update RLS for visit photos
DROP POLICY IF EXISTS "Users can view circle visit photos" ON public.visit_photos;
CREATE POLICY "Users can view circle visit photos" ON public.visit_photos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.visits v 
    JOIN public.group_members gm ON gm.group_id = v.group_id
    WHERE v.id = visit_photos.visit_id AND gm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view their own photos" ON public.visit_photos;
DROP POLICY IF EXISTS "Users can view friends visit photos" ON public.visit_photos;
DROP POLICY IF EXISTS "Users can view group members visit photos" ON public.visit_photos;

-- Allow inserts if they own the visit photo and the visit exists in their circle
DROP POLICY IF EXISTS "Users can create their own photos" ON public.visit_photos;
CREATE POLICY "Users can create visit photos" ON public.visit_photos FOR INSERT WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.visits v 
    JOIN public.group_members gm ON gm.group_id = v.group_id
    WHERE v.id = visit_photos.visit_id AND gm.user_id = auth.uid()
  )
);
