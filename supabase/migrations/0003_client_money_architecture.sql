-- HikeyFX client-money and payment architecture foundation.
-- DESIGN / DEVELOPMENT ONLY: this migration creates records and controls, not payment execution.
-- Do not use this schema to accept, hold, move, or pay out customer funds.
-- Live payment processing remains disabled until legal, regulatory, banking, provider,
-- security, reconciliation, and operational approvals have been independently completed.

create type public.ledger_account_class as enum ('asset', 'liability', 'equity', 'income', 'expense');
create type public.ledger_entry_side as enum ('debit', 'credit');
create type public.ledger_journal_status as enum ('draft', 'posted', 'reversed');
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
  constraint ledger_client_account_currency_scope check (
    client_money_account_id is null or currency is not null
  )
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
  reversed_by_journal_id uuid references public.ledger_journals(id) on delete restrict,
  constraint posted_journal_timestamp_consistent check (
    (status = 'draft' and posted_at is null)
    or (status in ('posted', 'reversed') and posted_at is not null)
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

-- A journal can only be posted when it has at least two entries, every entry uses
-- the journal currency, and total debits equal total credits.
create function public.validate_ledger_journal_posting()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry_count bigint;
  debit_total numeric(24, 2);
  credit_total numeric(24, 2);
  wrong_currency_count bigint;
begin
  if new.status in ('posted', 'reversed') and old.status = 'draft' then
    select count(*),
           coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0),
           coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0),
           count(*) filter (where e.currency <> new.currency)
      into entry_count, debit_total, credit_total, wrong_currency_count
      from public.ledger_entries e
     where e.journal_id = new.id;

    if entry_count < 2 then
      raise exception 'A posted ledger journal requires at least two entries';
    end if;
    if wrong_currency_count <> 0 then
      raise exception 'All ledger entries must use the journal currency';
    end if;
    if debit_total <> credit_total then
      raise exception 'Ledger journal is not balanced: debits % credits %', debit_total, credit_total;
    end if;
    new.posted_at := coalesce(new.posted_at, now());
  end if;
  return new;
end;
$$;

create trigger ledger_journal_posting_guard
before update of status on public.ledger_journals
for each row execute function public.validate_ledger_journal_posting();

create function public.reject_posted_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_journal_id uuid;
  journal_state public.ledger_journal_status;
begin
  if tg_table_name = 'ledger_journals' then
    if old.status <> 'draft' then
      raise exception 'Posted ledger journals are immutable; use a reversal journal';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  target_journal_id := case when tg_op = 'DELETE' then old.journal_id else new.journal_id end;
  select j.status into journal_state
    from public.ledger_journals j
   where j.id = target_journal_id;
  if journal_state is distinct from 'draft' then
    raise exception 'Entries for posted or missing journals cannot be changed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger ledger_journals_immutable_after_post
before update or delete on public.ledger_journals
for each row execute function public.reject_posted_ledger_mutation();

create trigger ledger_entries_draft_only
before insert or update or delete on public.ledger_entries
for each row execute function public.reject_posted_ledger_mutation();

-- Deposit records are intents and provider confirmations, not proof of cleared funds.
-- Only a trusted, verified provider callback/reconciliation workflow may advance them.
create table public.deposit_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  client_money_account_id uuid not null,
  provider_code text not null,
  provider_reference text,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  amount numeric(20, 2) not null check (amount > 0),
  currency char(3) not null,
  status public.deposit_status not null default 'created',
  ledger_journal_id uuid unique references public.ledger_journals(id) on delete restrict,
  provider_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (provider_code, provider_reference),
  foreign key (client_money_account_id, user_id)
    references public.client_money_accounts(id, user_id) on delete restrict
);

create index deposit_intents_user_created_idx on public.deposit_intents(user_id, created_at desc);

-- Withdrawal requests require independent review and payout verification.
-- payout_destination_token is a reference held by an approved provider, never raw bank/card credentials.
create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  client_money_account_id uuid not null,
  provider_code text,
  payout_destination_token text,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  amount numeric(20, 2) not null check (amount > 0),
  currency char(3) not null,
  status public.withdrawal_status not null default 'requested',
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text,
  provider_reference text,
  ledger_journal_id uuid unique references public.ledger_journals(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (provider_code, provider_reference),
  foreign key (client_money_account_id, user_id)
    references public.client_money_accounts(id, user_id) on delete restrict
);

create index withdrawal_requests_user_created_idx on public.withdrawal_requests(user_id, requested_at desc);
create index withdrawal_requests_status_created_idx on public.withdrawal_requests(status, requested_at);

-- Store minimal callback metadata and a hash, not raw payment credentials or full sensitive payloads.
create table public.payment_provider_events (
  id bigint generated always as identity primary key,
  provider_code text not null,
  provider_event_id text not null,
  payload_sha256 text not null check (length(payload_sha256) = 64),
  event_type text not null,
  status public.payment_event_status not null default 'received',
  related_deposit_id uuid references public.deposit_intents(id) on delete restrict,
  related_withdrawal_id uuid references public.withdrawal_requests(id) on delete restrict,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_note text,
  unique (provider_code, provider_event_id),
  constraint payment_event_single_relation check (
    not (related_deposit_id is not null and related_withdrawal_id is not null)
  )
);

create table public.reconciliation_batches (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null,
  currency char(3) not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'open' check (status in ('open', 'in_review', 'completed', 'exception')),
  external_total numeric(20, 2),
  ledger_total numeric(20, 2),
  difference numeric(20, 2),
  prepared_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (period_end > period_start)
);

create table public.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.reconciliation_batches(id) on delete restrict,
  external_reference text,
  internal_reference text,
  amount numeric(20, 2) not null,
  currency char(3) not null,
  outcome text not null check (outcome in ('matched', 'missing_internal', 'missing_external', 'amount_mismatch', 'duplicate', 'manual_review')),
  note text,
  created_at timestamptz not null default now()
);

create index reconciliation_items_batch_idx on public.reconciliation_items(batch_id);

-- Every table is private by default. No browser role receives direct financial write access.
-- Access must be provided through reviewed server-side functions after authentication,
-- authorisation, segregation-of-duties and transaction tests are implemented.
alter table public.client_money_accounts enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_journals enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.deposit_intents enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.reconciliation_batches enable row level security;
alter table public.reconciliation_items enable row level security;

-- No client policies are intentionally created in this foundation migration.
-- No provider credentials, automatic payouts, payment webhooks, balance mutation
-- endpoints, or live-money activation switches are implemented here.
