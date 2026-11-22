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
