-- Allow authenticated members to read only their own trading accounts.
-- Keep row-level security enabled; do not grant access to other members' accounts.
alter table public.trading_accounts enable row level security;

revoke all on table public.trading_accounts from public, anon;
grant select on table public.trading_accounts to authenticated;

drop policy if exists "Users can read their own trading accounts" on public.trading_accounts;
create policy "Users can read their own trading accounts"
  on public.trading_accounts
  for select
  to authenticated
  using (user_id = (select auth.uid()));
