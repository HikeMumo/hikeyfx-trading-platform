-- HikeyFX demo balance bootstrap and member-safe read policy.
-- Creates only demo starting balances; no live funds or payment operations.

create or replace function public.bootstrap_member()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  v_display_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
    nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), ''),
    'HikeyFX member'
  );

  insert into public.profiles (id, display_name)
  values (v_user_id, v_display_name)
  on conflict (id) do nothing;

  select a.id
    into v_account_id
    from public.trading_accounts a
   where a.user_id = v_user_id
     and a.mode = 'demo'
   order by a.created_at
   limit 1;

  if v_account_id is null then
    insert into public.trading_accounts (user_id, mode, status, currency)
    values (v_user_id, 'demo', 'active', 'USD')
    returning id into v_account_id;
  end if;

  insert into public.demo_account_balances
    (account_id, opening_balance, cash_balance)
  values
    (v_account_id, 10000.00, 10000.00)
  on conflict (account_id) do nothing;

  return v_account_id;
end;
$$;

revoke all on function public.bootstrap_member() from public;
revoke all on function public.bootstrap_member() from anon;
grant execute on function public.bootstrap_member() to authenticated;

drop policy if exists "Users can read their own demo account balances"
  on public.demo_account_balances;

create policy "Users can read their own demo account balances"
  on public.demo_account_balances
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trading_accounts a
      where a.id = demo_account_balances.account_id
        and a.user_id = (select auth.uid())
        and a.mode = 'demo'
    )
  );

comment on function public.bootstrap_member() is
  'Creates the authenticated user profile, one demo-only account and its initial demo balance; never creates live accounts or moves real money.';
