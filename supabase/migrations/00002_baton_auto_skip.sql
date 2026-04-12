-- Add baton_passed_at to track when baton was last passed
ALTER TABLE public.groups ADD COLUMN baton_passed_at timestamptz;

-- Backfill: set baton_passed_at to group creation time for existing groups
UPDATE public.groups SET baton_passed_at = created_at WHERE baton_passed_at IS NULL;

-- Update handle_new_group to also set baton_passed_at
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (new.id, new.created_by, 'owner');

  UPDATE public.groups
  SET current_baton_holder_id = new.created_by,
      baton_passed_at = now()
  WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow current baton holder to update the group (for passing baton)
-- WITH CHECK (true) is needed because after update, current_baton_holder_id
-- will be someone else, which would fail the implicit WITH CHECK.
CREATE POLICY "Baton holders can update baton"
  ON public.groups FOR UPDATE
  USING (current_baton_holder_id = auth.uid())
  WITH CHECK (true);

-- Helper: get next baton holder in rotation (by joined_at order)
CREATE OR REPLACE FUNCTION public.next_baton_holder(p_group_id uuid, p_current_holder_id uuid)
RETURNS uuid AS $$
DECLARE
  v_next uuid;
BEGIN
  -- Try the next member after current holder in joined_at order
  SELECT gm.user_id INTO v_next
  FROM public.group_members gm
  WHERE gm.group_id = p_group_id
    AND gm.user_id != p_current_holder_id
    AND gm.joined_at > (
      SELECT joined_at FROM public.group_members
      WHERE group_id = p_group_id AND user_id = p_current_holder_id
    )
  ORDER BY gm.joined_at ASC
  LIMIT 1;

  -- Wrap around to the first member if current holder was last
  IF v_next IS NULL THEN
    SELECT gm.user_id INTO v_next
    FROM public.group_members gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id != p_current_holder_id
    ORDER BY gm.joined_at ASC
    LIMIT 1;
  END IF;

  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check a single group and auto-skip if overdue. Returns true if skipped.
CREATE OR REPLACE FUNCTION public.check_and_skip_baton(p_group_id uuid)
RETURNS boolean AS $$
DECLARE
  v_group RECORD;
  v_next uuid;
BEGIN
  SELECT current_baton_holder_id, baton_passed_at, baton_deadline_days
  INTO v_group
  FROM public.groups
  WHERE id = p_group_id;

  IF v_group.current_baton_holder_id IS NULL
     OR v_group.baton_passed_at IS NULL
     OR now() <= v_group.baton_passed_at + (v_group.baton_deadline_days || ' days')::interval
  THEN
    RETURN false;
  END IF;

  v_next := public.next_baton_holder(p_group_id, v_group.current_baton_holder_id);

  IF v_next IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.groups
  SET current_baton_holder_id = v_next,
      baton_passed_at = now()
  WHERE id = p_group_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
