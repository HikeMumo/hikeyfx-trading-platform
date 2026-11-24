-- HikeyFX broker-owned execution persistence foundation.
-- This adds production-oriented order/fill/idempotency records only.
-- It does NOT enable live accounts, external order routing or client-money movement.
-- Only the trusted backend service role may read/write these records.

create table public.execution_idempotency_keys (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  request_sha256 char(64) not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'reserved'
    check (state in ('reserved', 'completed', 'unknown')),
  response_body jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  constraint execution_idempotency_response_consistent check (
    (state = 'completed' and response_body is not null)
    or (state <> 'completed' and response_body is null)
  )
);

create table public.execution_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  client_order_id uuid not null unique,
  provider_code text not null,
  provider_order_id text,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit', 'stop')),
  requested_volume numeric(20, 8) not null check (requested_volume > 0),
  executed_volume numeric(20, 8) not null default 0 check (executed_volume >= 0),
  average_fill_price numeric(24, 10),
  status text not null check (status in ('pending', 'partially_filled', 'filled', 'cancel_pending', 'cancelled', 'rejected', 'expired', 'unknown')),
  reject_reason text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_code, provider_order_id),
  constraint execution_fill_volume_not_over_requested check (executed_volume <= requested_volume)
);

create index execution_orders_user_created_idx
  on public.execution_orders(user_id, submitted_at desc);
create index execution_orders_account_status_idx
  on public.execution_orders(account_id, status, submitted_at desc);

create table public.execution_fills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.execution_orders(id) on delete restrict,
  provider_code text not null,
  provider_execution_id text not null,
  volume numeric(20, 8) not null check (volume > 0),
  price numeric(24, 10) not null check (price > 0),
  commission numeric(20, 8) not null default 0,
  commission_currency char(3),
  executed_at timestamptz not null,
  received_at timestamptz not null default now(),
  unique (provider_code, provider_execution_id)
);

create index execution_fills_order_executed_idx
  on public.execution_fills(order_id, executed_at);

create table public.execution_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete restrict,
  account_id uuid references public.trading_accounts(id) on delete restrict,
  order_id uuid references public.execution_orders(id) on delete restrict,
  event_type text not null,
  event_sha256 char(64) not null check (event_sha256 ~ '^[0-9a-f]{64}$'),
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index execution_events_order_created_idx
  on public.execution_events(order_id, created_at desc);
create index execution_events_user_created_idx
  on public.execution_events(user_id, created_at desc);

alter table public.execution_idempotency_keys enable row level security;
alter table public.execution_orders enable row level security;
alter table public.execution_fills enable row level security;
alter table public.execution_events enable row level security;

revoke all on public.execution_idempotency_keys from public, anon, authenticated;
revoke all on public.execution_orders from public, anon, authenticated;
revoke all on public.execution_fills from public, anon, authenticated;
revoke all on public.execution_events from public, anon, authenticated;

grant select, insert, update on public.execution_idempotency_keys to service_role;
grant usage, select on sequence public.execution_idempotency_keys_id_seq to service_role;
grant select, insert, update on public.execution_orders to service_role;
grant select, insert on public.execution_fills to service_role;
grant select, insert on public.execution_events to service_role;
grant usage, select on sequence public.execution_events_id_seq to service_role;

create or replace function public.hikeyfx_execution_idempotency_reserve(
  p_user_id uuid, p_key text, p_request_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.execution_idempotency_keys%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Trusted execution service required';
  end if;
  if p_user_id is null or p_key is null or length(p_key) < 8 or length(p_key) > 128
     or p_request_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid execution idempotency request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_key, 0)
  );
  select * into v_row
    from public.execution_idempotency_keys
   where user_id = p_user_id and idempotency_key = p_key
   for update;

  if found then
    if v_row.request_sha256 <> p_request_sha256 then
      return jsonb_build_object('state', 'conflict');
    end if;
    if v_row.state = 'completed' then
      return jsonb_build_object('state', 'existing', 'result', v_row.response_body);
    end if;
    return jsonb_build_object('state', 'in_progress');
  end if;

  insert into public.execution_idempotency_keys(user_id, idempotency_key, request_sha256)
  values (p_user_id, p_key, p_request_sha256);
  return jsonb_build_object('state', 'new');
end;
$$;

create or replace function public.hikeyfx_execution_idempotency_complete(
  p_user_id uuid, p_key text, p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Trusted execution service required';
  end if;
  update public.execution_idempotency_keys
     set state = 'completed', response_body = p_response, error_code = null, updated_at = now()
   where user_id = p_user_id and idempotency_key = p_key and state = 'reserved';
  if not found then raise exception 'Execution idempotency reservation not found'; end if;
end;
$$;

create or replace function public.hikeyfx_execution_idempotency_mark_unknown(
  p_user_id uuid, p_key text, p_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Trusted execution service required';
  end if;
  update public.execution_idempotency_keys
     set state = 'unknown', response_body = null,
         error_code = left(coalesce(p_error_code, 'EXECUTION_UNCERTAIN'), 80), updated_at = now()
   where user_id = p_user_id and idempotency_key = p_key and state = 'reserved';
  if not found then raise exception 'Execution idempotency reservation not found'; end if;
end;
$$;

revoke all on function public.hikeyfx_execution_idempotency_reserve(uuid,text,text) from public, anon, authenticated;
revoke all on function public.hikeyfx_execution_idempotency_complete(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.hikeyfx_execution_idempotency_mark_unknown(uuid,text,text) from public, anon, authenticated;
grant execute on function public.hikeyfx_execution_idempotency_reserve(uuid,text,text) to service_role;
grant execute on function public.hikeyfx_execution_idempotency_complete(uuid,text,jsonb) to service_role;
grant execute on function public.hikeyfx_execution_idempotency_mark_unknown(uuid,text,text) to service_role;

comment on table public.execution_orders is
  'Broker execution orders. Provider acknowledgement and execution reports are authoritative; client-submitted prices are never authoritative.';
comment on table public.execution_fills is
  'Immutable provider execution fills, deduplicated by provider execution ID.';
comment on table public.execution_events is
  'Backend-only execution audit event stream; safe metadata only, never credentials or raw payment data.';
comment on table public.execution_idempotency_keys is
  'Durable order-submission idempotency. Unknown outcomes must be reconciled with the counterparty before retry.';
