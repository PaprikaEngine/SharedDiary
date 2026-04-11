-- SharedDiary Phase 3: Flipbook Animation (パラパラアニメ)

-- Flipbooks (1 entry に 1 flipbook)
create table public.flipbooks (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null unique references public.entries(id) on delete cascade,
  fps int not null default 8 check (fps between 1 and 24),
  loop boolean not null default true,
  created_at timestamptz default now() not null
);

-- Flipbook frames (各フレームの描画データ)
create table public.flipbook_frames (
  id uuid primary key default uuid_generate_v4(),
  flipbook_id uuid not null references public.flipbooks(id) on delete cascade,
  "order" int not null,
  canvas_json text not null,
  created_at timestamptz default now() not null
);

create index idx_flipbooks_entry_id on public.flipbooks(entry_id);
create index idx_flipbook_frames_flipbook_id on public.flipbook_frames(flipbook_id);

-- RLS
alter table public.flipbooks enable row level security;
alter table public.flipbook_frames enable row level security;

-- Flipbook policies (group members can view, entry author can create)
create policy "Members can view flipbooks"
  on public.flipbooks for select
  using (
    exists (
      select 1 from public.entries
      join public.group_members on group_members.group_id = entries.group_id
      where entries.id = flipbooks.entry_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authors can create flipbooks"
  on public.flipbooks for insert
  with check (
    exists (
      select 1 from public.entries
      where entries.id = flipbooks.entry_id
        and entries.author_id = auth.uid()
    )
  );

create policy "Authors can delete flipbooks"
  on public.flipbooks for delete
  using (
    exists (
      select 1 from public.entries
      where entries.id = flipbooks.entry_id
        and entries.author_id = auth.uid()
    )
  );

-- Flipbook frames policies
create policy "Members can view flipbook frames"
  on public.flipbook_frames for select
  using (
    exists (
      select 1 from public.flipbooks
      join public.entries on entries.id = flipbooks.entry_id
      join public.group_members on group_members.group_id = entries.group_id
      where flipbooks.id = flipbook_frames.flipbook_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authors can manage flipbook frames"
  on public.flipbook_frames for insert
  with check (
    exists (
      select 1 from public.flipbooks
      join public.entries on entries.id = flipbooks.entry_id
      where flipbooks.id = flipbook_frames.flipbook_id
        and entries.author_id = auth.uid()
    )
  );

create policy "Authors can delete flipbook frames"
  on public.flipbook_frames for delete
  using (
    exists (
      select 1 from public.flipbooks
      join public.entries on entries.id = flipbooks.entry_id
      where flipbooks.id = flipbook_frames.flipbook_id
        and entries.author_id = auth.uid()
    )
  );
