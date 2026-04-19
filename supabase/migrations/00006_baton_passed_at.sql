-- Track when baton was last passed for deadline/reminder calculation
alter table public.groups add column baton_passed_at timestamptz default now();
