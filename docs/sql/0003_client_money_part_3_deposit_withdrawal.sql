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
  foreign key (client_money_account_id, user_id, currency)
    references public.client_money_accounts(id, user_id, currency) on delete restrict
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
  unique (user_id, idempotency_key),  unique (provider_code, provider_reference),
  foreign key (client_money_account_id, user_id)
    references public.client_money_accounts(id, user_id) on delete restrict
);

create index withdrawal_requests_user_created_idx on public.withdrawal_requests(user_id, requested_at desc);
create index withdrawal_requests_status_created_idx on public.withdrawal_requests(status, requested_at);
