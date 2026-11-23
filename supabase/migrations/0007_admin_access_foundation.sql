-- HikeyFX administrator access foundation.
-- Admin membership is granted manually by a trusted project owner in the SQL editor.
-- No client-side role escalation or financial control functions are exposed.

create table public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('owner','operations','support','risk')),
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_memberships enable row level security;
revoke all on table public.admin_memberships from public, anon, authenticated;

create or replace function public.hikeyfx_admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_members jsonb;
  v_events jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.admin_memberships m
    where m.user_id=v_uid and m.is_active=true
  ) then
    raise exception 'Administrator access required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'displayName',p.display_name,
    'joinedAt',p.created_at,
    'accountMode',a.mode,
    'accountStatus',a.status
  ) order by p.created_at desc),'[]'::jsonb)
  into v_members
  from (
    select p.id,p.display_name,p.created_at
    from public.profiles p order by p.created_at desc limit 10
  ) p
  left join lateral (
    select a.mode,a.status from public.trading_accounts a
    where a.user_id=p.id order by a.created_at limit 1
  ) a on true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'action',e.action,'targetType',e.target_type,'createdAt',e.created_at
  ) order by e.created_at desc),'[]'::jsonb)
  into v_events
  from (
    select action,target_type,created_at from public.audit_events
    order by created_at desc limit 10
  ) e;

  select jsonb_build_object(
    'members',(select count(*) from public.profiles),
    'demoAccounts',(select count(*) from public.trading_accounts where mode='demo'),
    'verificationPending',(select count(*) from public.kyc_cases where status in ('pending','in_review')),
    'openDemoPositions',(select count(*) from public.demo_positions where status='open'),
    'recentMembers',v_members,
    'recentAuditEvents',v_events,
    'liveAccountsEnabled',false,
    'clientMoneyEnabled',false
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.hikeyfx_admin_overview() from public, anon;
grant execute on function public.hikeyfx_admin_overview() to authenticated;

comment on table public.admin_memberships is
  'Privileged HikeyFX admin assignments. Add or revoke rows only through trusted owner-controlled SQL; never expose direct browser writes.';
comment on function public.hikeyfx_admin_overview() is
  'Returns limited operational aggregates and recent member/audit summaries only to active administrators.';
