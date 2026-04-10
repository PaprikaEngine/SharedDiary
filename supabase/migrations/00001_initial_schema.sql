-- SharedDiary Phase 1 Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  email text not null,
  created_at timestamptz default now() not null
);

-- Groups (日記帳)
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cover_image text,
  created_by uuid not null references public.users(id) on delete cascade,
  baton_deadline_days int default 3 not null,
  current_baton_holder_id uuid references public.users(id),
  created_at timestamptz default now() not null
);

-- Group members
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

-- Group invitations
create table public.group_invitations (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

-- Entries (日記エントリ)
create table public.entries (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text,
  created_at timestamptz default now() not null
);

-- Entry media (添付メディア)
create table public.entry_media (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  type text not null check (type in ('image', 'video', 'animation')),
  url text not null,
  "order" int not null default 0,
  width int,
  height int
);

-- Indexes
create index idx_group_members_user on public.group_members(user_id);
create index idx_entries_group on public.entries(group_id);
create index idx_entries_created on public.entries(created_at desc);
create index idx_entry_media_entry on public.entry_media(entry_id);
create index idx_group_invitations_token on public.group_invitations(token);

-- Row Level Security
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;
alter table public.entries enable row level security;
alter table public.entry_media enable row level security;

-- Users policies
create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- Groups policies
create policy "Members can view their groups"
  on public.groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "Owners can update their groups"
  on public.groups for update
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
        and group_members.role = 'owner'
    )
  );

-- Group members policies
create policy "Members can view group members"
  on public.group_members for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
    )
  );

create policy "Owners can add members"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.group_members
      where group_members.group_id = group_members.group_id
        and group_members.user_id = auth.uid()
        and group_members.role = 'owner'
    )
    or user_id = auth.uid() -- Allow self-join via invitation
  );

-- Group invitations policies
create policy "Owners can manage invitations"
  on public.group_invitations for all
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = group_invitations.group_id
        and group_members.user_id = auth.uid()
        and group_members.role = 'owner'
    )
  );

create policy "Anyone can view invitation by token"
  on public.group_invitations for select
  using (true);

-- Entries policies
create policy "Members can view entries"
  on public.entries for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = entries.group_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Baton holders can create entries"
  on public.entries for insert
  with check (
    exists (
      select 1 from public.groups
      where groups.id = entries.group_id
        and groups.current_baton_holder_id = auth.uid()
    )
    and author_id = auth.uid()
  );

-- Entry media policies
create policy "Members can view media"
  on public.entry_media for select
  using (
    exists (
      select 1 from public.entries
      join public.group_members on group_members.group_id = entries.group_id
      where entries.id = entry_media.entry_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Authors can add media"
  on public.entry_media for insert
  with check (
    exists (
      select 1 from public.entries
      where entries.id = entry_media.entry_id
        and entries.author_id = auth.uid()
    )
  );

-- Function to create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to add creator as owner when group is created
create or replace function public.handle_new_group()
returns trigger as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  -- Set creator as first baton holder
  update public.groups
  set current_baton_holder_id = new.created_by
  where id = new.id;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new group
create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_new_group();
