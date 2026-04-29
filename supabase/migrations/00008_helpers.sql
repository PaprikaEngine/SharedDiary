-- RLS helper functions used by later migrations (00014 entry delete /
-- leave group, 00018 tapes RLS storage policies, etc.). Defined as
-- SECURITY DEFINER so they can read public.group_members without
-- recursing through that table's own SELECT policy.
--
-- Idempotent CREATE OR REPLACE so re-running the migration on an
-- environment that already has these functions (e.g. an older Supabase
-- project) won't error.

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.is_group_owner(p_group_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = p_user_id
      and role = 'owner'
  );
$$ language sql security definer stable set search_path = public;

grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;
