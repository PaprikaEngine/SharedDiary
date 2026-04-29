-- Entry tapes — masking tape pieces placed on a diary entry as DOM
-- overlays (parallel to entry_stamps). Phase 1 stored tapes as
-- rasterised pixels inside the canvas image; this table promotes them
-- to first-class objects so they can layer above placed media.
--
-- tape_id is text (not uuid) because builtin tape ids are stable
-- string slugs ("check-rose", "plain-mint") while group tapes have
-- uuid ids. Storing as text keeps both forms in one column without
-- a polymorphic relation.

create table public.entry_tapes (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  tape_id text not null,
  -- Canvas-space center coordinates
  x float not null,
  y float not null,
  -- Length along the tape's long axis in canvas-space pixels.
  -- Thickness is fixed per-tape (TAPES[tape_id].width on the client),
  -- so it isn't stored.
  length float not null,
  rotation float not null default 0.0,
  created_at timestamptz default now() not null
);

create index idx_entry_tapes_entry on public.entry_tapes(entry_id);

alter table public.entry_tapes enable row level security;

create policy "Members can view entry tapes"
  on public.entry_tapes for select
  using (
    exists (
      select 1 from public.entries
      join public.group_members on group_members.group_id = entries.group_id
      where entries.id = entry_tapes.entry_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authors can add entry tapes"
  on public.entry_tapes for insert
  with check (
    exists (
      select 1 from public.entries
      where entries.id = entry_tapes.entry_id
        and entries.author_id = auth.uid()
    )
  );

create policy "Authors can delete their entry tapes"
  on public.entry_tapes for delete
  using (
    exists (
      select 1 from public.entries
      where entries.id = entry_tapes.entry_id
        and entries.author_id = auth.uid()
    )
  );
