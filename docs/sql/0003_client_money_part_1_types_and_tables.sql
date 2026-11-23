-- HikeyFX client-money and payment architecture foundation.
-- DESIGN / DEVELOPMENT ONLY: this migration creates records and controls, not payment execution.
-- Do not use this schema to accept, hold, move, or pay out customer funds.
-- Live payment processing remains disabled until legal, regulatory, banking, provider,
-- security, reconciliation, and operational approvals have been independently completed.

create type public.ledger_account_class as enum ('asset', 'liability', 'equity', 'income', 'expense');
create type public.ledger_entry_side as enum ('debit', 'credit');
create type public.ledger_journal_status as enum ('draft', 'posted');
create type public.deposit_status as enum ('created', 'pending', 'confirmed', 'failed', 'cancelled', 'reversed');
create type public.withdrawal_status as enum ('requested', 'under_review', 'approved', 'processing', 'paid', 'rejected', 'cancelled', 'failed');
create type public.payment_event_status as enum ('received', 'processing', 'processed', 'ignored', 'failed');

-- A customer-facing money account is a currency-specific ownership record.
-- It is not a balance. Balances must be derived from posted double-entry ledger entries.
create table public.client_money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  currency char(3) not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'restricted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, currency),
  unique (id, user_id, currency),
  unique (user_id, currency)
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  account_name text not null,
  account_class public.ledger_account_class not null,
  currency char(3) not null,
  client_money_account_id uuid references public.client_money_accounts(id) on delete restrict,
  is_control_account boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (client_money_account_id, currency)
    references public.client_money_accounts(id, currency) on delete restrict
);

create table public.ledger_journals (
  id uuid primary key default gen_random_uuid(),
  journal_reference text not null unique,
  source_type text not null check (source_type in ('deposit', 'withdrawal', 'fee', 'adjustment', 'reversal', 'reconciliation')),
  source_id uuid,
  currency char(3) not null,
  status public.ledger_journal_status not null default 'draft',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  constraint posted_journal_timestamp_consistent check (
    (status = 'draft' and posted_at is null)
    or (status = 'posted' and posted_at is not null)
  )
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  journal_id uuid not null references public.ledger_journals(id) on delete restrict,
  ledger_account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  side public.ledger_entry_side not null,
  amount numeric(20, 2) not null check (amount > 0),
  currency char(3) not null,
  memo text,
  created_at timestamptz not null default now()
);

create index ledger_entries_journal_idx on public.ledger_entries(journal_id);
create index ledger_entries_account_created_idx on public.ledger_entries(ledger_account_id, created_at desc);
create index ledger_journals_source_idx on public.ledger_journals(source_type, source_id);
