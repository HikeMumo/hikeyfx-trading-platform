-- HikeyFX demo-only persistence schema draft.
-- This migration is NOT executed. It contains no live accounts, deposits or withdrawals.
-- Keep all writes behind authenticated server-side transactions.

create type public.demo_position_status as enum ('open', 'closed');
create type public.demo_trade_event_type as enum ('opened', 'closed', 'stop_loss', 'take_profit', 'adjustment');

create table public.demo_account_balances (
  account_id uuid primary key references public.trading_accounts(id) on delete restrict,
  opening_balance numeric(20, 2) not null default 10000 check (opening_balance >= 0),
  cash_balance numeric(20, 2) not null default 10000 check (cash_balance >= 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.demo_positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  instrument_id uuid not null references public.instruments(id) on delete restrict,
  side public.order_side not null,
  volume numeric(16, 4) not null check (volume >= 0.01 and volume <= 10),
  entry_price numeric(24, 10) not null check (entry_price > 0),
  stop_loss numeric(24, 10),
  take_profit numeric(24, 10),
  contract_size numeric(20, 4) not null check (contract_size > 0),
  reserved_margin numeric(20, 2) not null default 0 check (reserved_margin >= 0),
  status public.demo_position_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  exit_price numeric(24, 10),
  realised_pnl numeric(20, 2),
  close_reason text,
  constraint demo_position_close_fields_consistent check (
    (status = 'open' and closed_at is null and exit_price is null and realised_pnl is null)
    or
    (status = 'closed' and closed_at is not null and exit_price is not null and realised_pnl is not null)
  )
);

create index demo_positions_account_status_idx
  on public.demo_positions(account_id, status, opened_at desc);

create table public.demo_trade_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  position_id uuid references public.demo_positions(id) on delete restrict,
  event_type public.demo_trade_event_type not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index demo_trade_events_account_created_idx
  on public.demo_trade_events(account_id, created_at desc);

create table public.demo_idempotency_keys (
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (account_id, idempotency_key)
);

-- Prevent demo rows from ever being attached to a live-mode account.
create function public.require_demo_trading_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.trading_accounts a
    where a.id = new.account_id and a.mode = 'demo'
  ) then
    raise exception 'Only demo trading accounts may use demo trading records';
  end if;
  return new;
end;
$$;

create trigger demo_balance_mode_guard
before insert or update of account_id on public.demo_account_balances
for each row execute function public.require_demo_trading_account();

create trigger demo_position_mode_guard
before insert or update of account_id on public.demo_positions
for each row execute function public.require_demo_trading_account();

create trigger demo_event_mode_guard
before insert or update of account_id on public.demo_trade_events
for each row execute function public.require_demo_trading_account();

create trigger demo_idempotency_mode_guard
before insert or update of account_id on public.demo_idempotency_keys
for each row execute function public.require_demo_trading_account();

-- Event records are append-only. A trusted backend must append a compensating event
-- rather than changing or deleting an earlier record.
create function public.reject_demo_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Demo trade event records are append-only';
end;
$$;

create trigger demo_trade_events_no_update
before update or delete on public.demo_trade_events
for each row execute function public.reject_demo_event_mutation();

-- These tables have no client policies. Only a trusted server-side service may write.
alter table public.demo_account_balances enable row level security;
alter table public.demo_positions enable row level security;
alter table public.demo_trade_events enable row level security;
alter table public.demo_idempotency_keys enable row level security;

-- Deliberately no authenticated client SELECT/INSERT/UPDATE/DELETE policies.
-- Implement atomic account locking, margin checks, idempotency and balance/position
-- changes in reviewed server-side database functions before connecting the API.
