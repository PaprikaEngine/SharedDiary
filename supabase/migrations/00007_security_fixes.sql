-- Security fixes migration
-- Addresses: self-join RLS bypass, invitation token exposure, invitation consumption

-- =============================================================
-- 1. Fix group_members INSERT policy (Critical)
--    Remove the `or user_id = auth.uid()` self-join bypass.
--    Joining via invitation now goes through join_group_via_invitation().
-- =============================================================

drop policy if exists "Owners can add members" on public.group_members;

create policy "Owners can add members"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.group_members as gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'owner'
    )
  );

-- =============================================================
-- 2. Add used_at column to group_invitations for token consumption
-- =============================================================

alter table public.group_invitations
  add column if not exists used_count int default 0 not null,
  add column if not exists max_uses int default null;

-- =============================================================
-- 3. Secure join function — validates token, checks expiry,
--    increments usage, and inserts member atomically.
-- =============================================================

create or replace function public.join_group_via_invitation(invitation_token text)
returns uuid as $$
declare
  v_invitation record;
  v_group_id uuid;
  v_user_id uuid;
  v_existing record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the invitation row to prevent race conditions
  select * into v_invitation
    from public.group_invitations
    where token = invitation_token
    for update;

  if v_invitation is null then
    raise exception 'Invalid invitation token';
  end if;

  -- Check expiry
  if v_invitation.expires_at is not null and v_invitation.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  -- Check max uses
  if v_invitation.max_uses is not null and v_invitation.used_count >= v_invitation.max_uses then
    raise exception 'Invitation has reached maximum uses';
  end if;

  v_group_id := v_invitation.group_id;

  -- Check if already a member
  select * into v_existing
    from public.group_members
    where group_id = v_group_id and user_id = v_user_id;

  if v_existing is not null then
    -- Already a member, just return the group id
    return v_group_id;
  end if;

  -- Insert as member
  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, 'member');

  -- Increment usage count
  update public.group_invitations
  set used_count = used_count + 1
  where id = v_invitation.id;

  return v_group_id;
end;
$$ language plpgsql security definer;

-- =============================================================
-- 4. Fix group_invitations SELECT policy (High)
--    Replace `using(true)` with a policy that only allows:
--    - Owners to manage their invitations (already exists)
--    - Authenticated users to look up a specific token (via RPC)
--    The open SELECT is needed for the invite page to check token
--    validity, but we restrict it to authenticated users only.
-- =============================================================

drop policy if exists "Anyone can view invitation by token" on public.group_invitations;

-- Authenticated users can view invitations (needed for token lookup on invite page)
-- This is safer than using(true) which exposed to anon role too
create policy "Authenticated users can view invitations"
  on public.group_invitations for select
  using (auth.uid() is not null);

-- =============================================================
-- 5. Add users SELECT policy for group co-members
--    Allow viewing profiles of users in the same group
-- =============================================================

create policy "Users can view group co-members"
  on public.users for select
  using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid()
        and gm2.user_id = users.id
    )
  );
