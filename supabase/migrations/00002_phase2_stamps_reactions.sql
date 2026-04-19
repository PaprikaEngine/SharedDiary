-- SharedDiary Phase 2: Stamps, Reactions, Notification Preferences

-- Stamps (組み込み + グループカスタム)
create table public.stamps (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('lottie', 'apng', 'webp')),
  url text not null,
  thumbnail_url text,
  scope text not null default 'builtin' check (scope in ('builtin', 'group')),
  group_id uuid references public.groups(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Entry stamps (日記ページ上に配置されたスタンプ)
create table public.entry_stamps (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  stamp_id uuid not null references public.stamps(id) on delete cascade,
  x float not null,
  y float not null,
  scale float not null default 1.0,
  rotation float not null default 0.0,
  created_at timestamptz default now() not null
);

-- Reactions (動くスタンプでリアクション)
create table public.reactions (
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  stamp_id uuid not null references public.stamps(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (entry_id, user_id, stamp_id)
);

-- Notification preferences (通知設定)
create table public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  email_enabled boolean default true not null,
  push_enabled boolean default false not null,
  push_subscription jsonb,
  updated_at timestamptz default now() not null
);

-- Indexes
create index idx_stamps_scope on public.stamps(scope);
create index idx_stamps_group on public.stamps(group_id) where group_id is not null;
create index idx_entry_stamps_entry on public.entry_stamps(entry_id);
create index idx_reactions_entry on public.reactions(entry_id);
create index idx_reactions_user on public.reactions(user_id);

-- Row Level Security
alter table public.stamps enable row level security;
alter table public.entry_stamps enable row level security;
alter table public.reactions enable row level security;
alter table public.notification_preferences enable row level security;

-- Stamps policies
create policy "Anyone can view builtin stamps"
  on public.stamps for select
  using (scope = 'builtin');

create policy "Group members can view group stamps"
  on public.stamps for select
  using (
    scope = 'group'
    and exists (
      select 1 from public.group_members
      where group_members.group_id = stamps.group_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Group members can create group stamps"
  on public.stamps for insert
  with check (
    scope = 'group'
    and created_by = auth.uid()
    and exists (
      select 1 from public.group_members
      where group_members.group_id = stamps.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Entry stamps policies
create policy "Members can view entry stamps"
  on public.entry_stamps for select
  using (
    exists (
      select 1 from public.entries
      join public.group_members on group_members.group_id = entries.group_id
      where entries.id = entry_stamps.entry_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authors can add entry stamps"
  on public.entry_stamps for insert
  with check (
    exists (
      select 1 from public.entries
      where entries.id = entry_stamps.entry_id
        and entries.author_id = auth.uid()
    )
  );

-- Reactions policies
create policy "Members can view reactions"
  on public.reactions for select
  using (
    exists (
      select 1 from public.entries
      join public.group_members on group_members.group_id = entries.group_id
      where entries.id = reactions.entry_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Members can add reactions"
  on public.reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.entries
      join public.group_members on group_members.group_id = entries.group_id
      where entries.id = reactions.entry_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Users can remove their own reactions"
  on public.reactions for delete
  using (user_id = auth.uid());

-- Notification preferences policies
create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  using (user_id = auth.uid());

create policy "Users can insert their own notification preferences"
  on public.notification_preferences for insert
  with check (user_id = auth.uid());

create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  using (user_id = auth.uid());
