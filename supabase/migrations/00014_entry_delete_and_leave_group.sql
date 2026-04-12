-- Entry deletion, group leave with owner/baton hand-off, and
-- baton reassignment / skip-turn.
--
-- Authors (or group owners) can delete their own entries.
-- Members can leave a group — if they hold the baton it gets passed on,
-- and if they are the owner the ownership transfers to the new baton holder.
-- The baton holder may "skip" their turn; the group owner may reassign
-- the baton freely. Both share the same `pass_baton` RPC.

-- =============================================================
-- 1. entries DELETE policy — author or group owner
-- =============================================================

create policy "Authors and owners can delete entries"
  on public.entries for delete
  using (
    author_id = auth.uid()
    or public.is_group_owner(group_id, auth.uid())
  );

-- =============================================================
-- 2. group_members DELETE policy — self-leave.
--    Ownership / baton transfer is handled by leave_group() below;
--    this policy only covers the direct delete path (defense in depth:
--    even if leave_group is bypassed, a member can still remove
--    themselves, but never kick others).
-- =============================================================

create policy "Members can leave groups"
  on public.group_members for delete
  using (user_id = auth.uid());

-- =============================================================
-- 3. leave_group(group_id) — atomic self-leave with hand-off
-- =============================================================

create or replace function public.leave_group(p_group_id uuid)
returns void as $$
declare
  v_user_id uuid;
  v_role text;
  v_current_holder uuid;
  v_next_holder uuid;
  v_remaining int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
    from public.group_members
    where group_id = p_group_id and user_id = v_user_id;
  if v_role is null then
    raise exception 'Not a member of this group';
  end if;

  select current_baton_holder_id into v_current_holder
    from public.groups
    where id = p_group_id
    for update;

  -- Pick a replacement from remaining members (oldest joiner first)
  select user_id into v_next_holder
    from public.group_members
    where group_id = p_group_id
      and user_id <> v_user_id
    order by joined_at asc
    limit 1;

  -- If the leaver currently holds the baton, hand it off.
  if v_current_holder = v_user_id then
    update public.groups
      set current_baton_holder_id = v_next_holder,
          baton_passed_at = case when v_next_holder is null then baton_passed_at else now() end
      where id = p_group_id;
    v_current_holder := v_next_holder;
  end if;

  -- Owner leaving → ownership goes to the (possibly updated) baton holder.
  if v_role = 'owner' and v_current_holder is not null and v_current_holder <> v_user_id then
    update public.group_members
      set role = 'owner'
      where group_id = p_group_id
        and user_id = v_current_holder;
  end if;

  -- Remove the leaver.
  delete from public.group_members
    where group_id = p_group_id and user_id = v_user_id;

  -- Last member out → drop the whole group.
  select count(*) into v_remaining
    from public.group_members
    where group_id = p_group_id;
  if v_remaining = 0 then
    delete from public.groups where id = p_group_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.leave_group(uuid) to authenticated;

-- =============================================================
-- 4. pass_baton(group_id, new_holder_id) — reassign or skip turn.
--    Callable by:
--      - the group owner (reassignment / order change)
--      - the current baton holder (skip own turn)
-- =============================================================

create or replace function public.pass_baton(p_group_id uuid, p_new_holder_id uuid)
returns void as $$
declare
  v_user_id uuid;
  v_is_owner boolean;
  v_current_holder uuid;
  v_target_is_member boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = v_user_id and role = 'owner'
  ) into v_is_owner;

  select current_baton_holder_id into v_current_holder
    from public.groups where id = p_group_id;

  if not (v_is_owner or v_current_holder = v_user_id) then
    raise exception 'Not authorized to pass the baton';
  end if;

  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_new_holder_id
  ) into v_target_is_member;
  if not v_target_is_member then
    raise exception 'Target user is not a group member';
  end if;

  if p_new_holder_id = v_current_holder then
    raise exception 'Baton is already held by this user';
  end if;

  update public.groups
    set current_baton_holder_id = p_new_holder_id,
        baton_passed_at = now()
    where id = p_group_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.pass_baton(uuid, uuid) to authenticated;
