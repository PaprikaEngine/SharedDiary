-- Masking tape definitions (Phase 2 — user-uploadable group tapes).
-- Built-in tapes are generated client-side from tape-patterns.ts so they
-- don't need DB rows. Only group-uploaded tapes live here.

create table public.tapes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  -- Public storage URL of the source image. The image is repeated
  -- horizontally along the tape line; its short side becomes the tape
  -- width (clamped client-side to a reasonable range).
  image_url text not null,
  scope text not null default 'group' check (scope in ('builtin', 'group')),
  group_id uuid references public.groups(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now() not null
);

create index idx_tapes_scope on public.tapes(scope);
create index idx_tapes_group on public.tapes(group_id) where group_id is not null;

alter table public.tapes enable row level security;

-- Built-in tapes are visible to everyone (currently empty — built-ins
-- are bundled in the client). Kept open for future seeded data.
create policy "Anyone can view builtin tapes"
  on public.tapes for select
  using (scope = 'builtin');

create policy "Group members can view group tapes"
  on public.tapes for select
  using (
    scope = 'group'
    and exists (
      select 1 from public.group_members
      where group_members.group_id = tapes.group_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Group members can create group tapes"
  on public.tapes for insert
  with check (
    scope = 'group'
    and created_by = auth.uid()
    and exists (
      select 1 from public.group_members
      where group_members.group_id = tapes.group_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authors can delete their group tapes"
  on public.tapes for delete
  using (
    scope = 'group'
    and created_by = auth.uid()
  );
