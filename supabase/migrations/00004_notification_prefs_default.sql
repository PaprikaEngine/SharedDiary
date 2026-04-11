-- Auto-create notification_preferences for new users
-- Updates handle_new_user() to also insert default notification preferences

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

  insert into public.notification_preferences (user_id, email_enabled, push_enabled)
  values (new.id, true, false);

  return new;
end;
$$ language plpgsql security definer;

-- Backfill: create notification_preferences for existing users who don't have one
insert into public.notification_preferences (user_id, email_enabled, push_enabled)
select u.id, true, false
from public.users u
left join public.notification_preferences np on np.user_id = u.id
where np.user_id is null;
