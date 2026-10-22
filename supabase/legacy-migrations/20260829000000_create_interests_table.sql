-- Create cafe_interests table to support the "💖 I'm Interested" feature
CREATE TABLE IF NOT EXISTS cafe_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id UUID NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- A user can only express interest in a specific cafe once per group
  UNIQUE(cafe_id, group_id, user_id)
);

-- Enable RLS
ALTER TABLE cafe_interests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view interests in their groups" 
  ON cafe_interests FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_id = cafe_interests.group_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add their own interest to their groups" 
  ON cafe_interests FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_id = cafe_interests.group_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their own interest" 
  ON cafe_interests FOR DELETE 
  USING (
    user_id = auth.uid()
  );
