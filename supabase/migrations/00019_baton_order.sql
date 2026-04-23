-- =================================================================
-- Migration 00019: member_order — fixed baton rotation sequence
--
-- Each group_member now carries a member_order integer (0-based) that
-- determines the round-robin baton sequence.  The baton always passes
-- to the member with the next higher order, wrapping back to 0 after
-- the last member.
-- =================================================================

-- 1. Add the column (nullable for the backfill step)
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS member_order integer;

-- 2. Backfill existing rows: order by joined_at within each group
WITH ranked AS (
  SELECT group_id, user_id,
    (ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY joined_at ASC) - 1)::integer AS ord
  FROM public.group_members
)
UPDATE public.group_members gm
SET    member_order = r.ord
FROM   ranked r
WHERE  gm.group_id = r.group_id
  AND  gm.user_id  = r.user_id;

-- 3. Trigger: auto-assign order when a new member joins
CREATE OR REPLACE FUNCTION public.assign_member_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_order IS NULL THEN
    SELECT COALESCE(MAX(member_order) + 1, 0)
    INTO   NEW.member_order
    FROM   public.group_members
    WHERE  group_id = NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_member_order ON public.group_members;
CREATE TRIGGER trg_assign_member_order
  BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.assign_member_order();


-- =================================================================
-- 4. advance_baton_in_order(group_id)
--    Moves the baton to the next member in member_order sequence.
--    Returns the new holder's user_id.
--    Called by: check_and_advance_expired_baton, skip action.
-- =================================================================
CREATE OR REPLACE FUNCTION public.advance_baton_in_order(p_group_id uuid)
RETURNS uuid AS $$
DECLARE
  v_current_holder uuid;
  v_current_order  integer;
  v_next_holder    uuid;
BEGIN
  -- Row-level lock prevents concurrent double-advances
  SELECT current_baton_holder_id
  INTO   v_current_holder
  FROM   public.groups
  WHERE  id = p_group_id
  FOR UPDATE;

  IF v_current_holder IS NULL THEN RETURN NULL; END IF;

  SELECT member_order
  INTO   v_current_order
  FROM   public.group_members
  WHERE  group_id = p_group_id AND user_id = v_current_holder;

  -- Next member after current order (wrap around)
  SELECT user_id INTO v_next_holder
  FROM   public.group_members
  WHERE  group_id = p_group_id
    AND  member_order > COALESCE(v_current_order, -1)
  ORDER  BY member_order ASC
  LIMIT  1;

  IF v_next_holder IS NULL THEN
    SELECT user_id INTO v_next_holder
    FROM   public.group_members
    WHERE  group_id = p_group_id
    ORDER  BY member_order ASC
    LIMIT  1;
  END IF;

  IF v_next_holder IS NULL OR v_next_holder = v_current_holder THEN
    RETURN v_current_holder; -- solo group, nothing to advance
  END IF;

  UPDATE public.groups
  SET    current_baton_holder_id = v_next_holder,
         baton_passed_at         = now()
  WHERE  id = p_group_id;

  RETURN v_next_holder;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.advance_baton_in_order(uuid) TO authenticated;


-- =================================================================
-- 5. check_and_advance_expired_baton(group_id)
--    Called on every group page load.  If the deadline has passed,
--    advances the baton in order (no notification).
--    Returns new holder user_id, or NULL if deadline not yet reached.
-- =================================================================
CREATE OR REPLACE FUNCTION public.check_and_advance_expired_baton(p_group_id uuid)
RETURNS uuid AS $$
DECLARE
  v_passed_at     timestamptz;
  v_deadline_days integer;
  v_current_holder uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  SELECT baton_passed_at, baton_deadline_days, current_baton_holder_id
  INTO   v_passed_at, v_deadline_days, v_current_holder
  FROM   public.groups
  WHERE  id = p_group_id;

  IF v_current_holder IS NULL
    OR v_passed_at IS NULL
    OR v_deadline_days <= 0
  THEN
    RETURN NULL;
  END IF;

  IF now() >= v_passed_at + (v_deadline_days || ' days')::interval THEN
    RETURN public.advance_baton_in_order(p_group_id);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.check_and_advance_expired_baton(uuid) TO authenticated;


-- =================================================================
-- 6. reorder_baton_sequence(group_id, ordered_user_ids)
--    Owner-only: reassign member_order based on the given array.
--    The baton sequence immediately follows the new order.
-- =================================================================
CREATE OR REPLACE FUNCTION public.reorder_baton_sequence(
  p_group_id       uuid,
  p_ordered_user_ids uuid[]
)
RETURNS void AS $$
DECLARE
  v_idx integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
      AND role     = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the group owner can reorder the baton sequence';
  END IF;

  FOR v_idx IN 1..array_length(p_ordered_user_ids, 1) LOOP
    UPDATE public.group_members
    SET    member_order = v_idx - 1
    WHERE  group_id = p_group_id
      AND  user_id  = p_ordered_user_ids[v_idx];
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reorder_baton_sequence(uuid, uuid[]) TO authenticated;
