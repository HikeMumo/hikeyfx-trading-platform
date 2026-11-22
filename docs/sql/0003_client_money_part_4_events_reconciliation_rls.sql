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
