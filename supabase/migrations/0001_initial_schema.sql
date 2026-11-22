-- HikeyFX initial database foundation
-- Draft migration for a Supabase/PostgreSQL development project.
-- Do not run against production. Live brokerage and client-money functions are not enabled.

create extension if not exists pgcrypto;

create type public.account_mode as enum ('demo', 'live');
create type public.account_status as enum ('pending', 'active', 'suspended', 'closed');
create type public.kyc_status as enum ('not_started', 'pending', 'in_review', 'approved', 'rejected', 'resubmission_required');
create type public.order_side as enum ('buy', 'sell');
create type public.order_type as enum ('market', 'limit', 'stop');
create type public.order_status as enum ('draft', 'pending', 'filled', 'cancelled', 'rejected', 'expired');

-- Supabase Auth owns passwords and authentication credentials. Never store passwords here.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone_e164 text,
  country_code char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  mode public.account_mode not null default 'demo',
  status public.account_status not null default 'pending',
  currency char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_accounts_disabled_at_launch check (mode = 'demo')
);

create index trading_accounts_user_id_idx on public.trading_accounts(user_id);

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  display_name text not null,
  asset_class text not null check (asset_class in ('forex','index','commodity','crypto','share','other')),
  quote_currency char(3),
  is_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.demo_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.trading_accounts(id) on delete restrict,
  instrument_id uuid not null references public.instruments(id) on delete restrict,
  side public.order_side not null,
  order_type public.order_type not null,
  quantity numeric(24, 8) not null check (quantity > 0),
  requested_price numeric(24, 10),
  stop_loss numeric(24, 10),
  take_profit numeric(24, 10),
  status public.order_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index demo_orders_account_created_idx on public.demo_orders(account_id, created_at desc);

create table public.kyc_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status public.kyc_status not null default 'not_started',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kyc_cases_user_created_idx on public.kyc_cases(user_id, created_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_created_idx on public.audit_events(created_at desc);
create index audit_events_actor_created_idx on public.audit_events(actor_user_id, created_at desc);

-- Private-by-default. Sensitive writes are performed by trusted server functions.
alter table public.profiles enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.instruments enable row level security;
alter table public.demo_orders enable row level security;
alter table public.kyc_cases enable row level security;
alter table public.audit_events enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users can read their own accounts"
  on public.trading_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Authenticated users can read enabled instruments"
  on public.instruments for select to authenticated
  using (is_enabled = true);

create policy "Users can read demo orders in their own accounts"
  on public.demo_orders for select to authenticated
  using (
    exists (
      select 1 from public.trading_accounts a
      where a.id = demo_orders.account_id
        and a.user_id = (select auth.uid())
        and a.mode = 'demo'
    )
  );

create policy "Users can read their own KYC status"
  on public.kyc_cases for select to authenticated
  using (user_id = (select auth.uid()));

-- No client-side insert/update/delete policies for orders, KYC cases or audit events.
-- Trusted server functions must validate every write and append audit events.
-- A separate migration adds development-only client-money and double-entry ledger
-- schema scaffolding. It does not enable real deposits, withdrawals, or live accounts.
-- Transaction functions and live-money operations remain blocked pending legal and
-- operational requirements, provider agreements, and independent security review.
