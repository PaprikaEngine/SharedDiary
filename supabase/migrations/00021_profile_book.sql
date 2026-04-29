-- Profile book — adds a `kind` discriminator on entries plus a new
-- entry_blocks table for structured profile fields placed on the
-- diary canvas.
--
-- Profile entries are scoped per (group, user) — each user has at
-- most one profile per diary book. Diary entries keep behaving exactly
-- as before (kind defaults to 'diary' for existing rows and any new
-- inserts that don't specify a kind).
--
-- The owner is identified by users.id (not group_members.id, which
-- doesn't exist — group_members uses a composite PK). The combination
-- (group_id, profile_owner_user_id) is enforced as unique below;
-- membership is enforced at insert time by the entries author RLS
-- policy (which only allows the user themselves to create their own
-- profile).
--
-- entry_blocks mirrors entry_tapes: positioned on the canvas in
-- canvas-space coordinates, RLS gated by entry authorship. The `data`
-- jsonb is a flat { fieldKey: value } map keyed by the block
-- template's field definitions in
-- frontend/src/components/placed-block/block-templates.ts.

-- ---------------------------------------------------------------
-- 1. entries: kind + profile owner
-- ---------------------------------------------------------------

alter table public.entries
  add column kind text default 'diary' not null
    check (kind in ('diary', 'profile')),
  add column profile_owner_user_id uuid
    references public.users(id) on delete cascade;

-- One profile per (group, user). Partial index so non-profile entries
-- with NULL profile_owner_user_id don't collide with each other.
create unique index entries_one_profile_per_user
  on public.entries(group_id, profile_owner_user_id)
  where kind = 'profile';

-- A profile entry must point at a user; a diary entry must not. Both
-- conditions in one constraint to keep the schema honest.
alter table public.entries
  add constraint entries_kind_owner_consistent
  check (
    (kind = 'profile' and profile_owner_user_id is not null) or
    (kind = 'diary'   and profile_owner_user_id is null)
  );

-- ---------------------------------------------------------------
-- 2. entry_blocks
-- ---------------------------------------------------------------

create table public.entry_blocks (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  -- Stable id of a BlockTemplate ('basic', 'food', 'school', ...).
  -- Stored as text so future templates can ship without a migration.
  block_type text not null,
  -- Canvas-space center coordinates.
  x float not null,
  y float not null,
  -- Canvas-space width. Height auto-grows from content client-side.
  width float not null default 320,
  rotation float not null default 0.0,
  -- Field-key → value map. Keys are defined per block_type by the
  -- client templates; we don't validate them in SQL because new fields
  -- can be added by editing the templates without a migration.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now() not null
);

create index idx_entry_blocks_entry on public.entry_blocks(entry_id);

alter table public.entry_blocks enable row level security;

create policy "Members can view entry blocks"
  on public.entry_blocks for select
  using (
    exists (
      select 1 from public.entries
      join public.group_members on group_members.group_id = entries.group_id
      where entries.id = entry_blocks.entry_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authors can add entry blocks"
  on public.entry_blocks for insert
  with check (
    exists (
      select 1 from public.entries
      where entries.id = entry_blocks.entry_id
        and entries.author_id = auth.uid()
    )
  );

create policy "Authors can delete their entry blocks"
  on public.entry_blocks for delete
  using (
    exists (
      select 1 from public.entries
      where entries.id = entry_blocks.entry_id
        and entries.author_id = auth.uid()
    )
  );
