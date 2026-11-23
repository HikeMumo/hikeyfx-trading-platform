-- Restore least-privilege access required by the signed-in member portal.
-- RLS remains enabled: authenticated members can read only their own profile.
alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));
