# Client-money and payment architecture foundation

Migration: `supabase/migrations/0003_client_money_architecture.sql`

## Scope
This is a development-only database foundation for a future regulated payment and client-money workflow. It does not accept, hold, transfer, or pay out real customer funds. HikeyFX is not currently authorised to provide brokerage services.

## Included structures
- `client_money_accounts`: customer/currency ownership records; these are not stored balances.
- `ledger_accounts`, `ledger_journals`, and `ledger_entries`: double-entry accounting foundation. Posted journals must balance in one currency and are immutable; corrections require reversal journals.
- `deposit_intents`: deposit requests and verified provider references. A request or provider callback is not, by itself, proof that funds have cleared.
- `withdrawal_requests`: reviewable withdrawal workflow with reviewer and payout-provider token reference. Raw bank/card credentials must not be stored here.
- `payment_provider_events`: idempotent provider-event tracking using a payload hash and minimal metadata, not raw sensitive payloads.
- `reconciliation_batches` and `reconciliation_items`: provider-to-ledger reconciliation records and exception tracking.

## Deliberate safety limits
- No live account is enabled; the existing trading-account constraint remains demo-only.
- No payment provider is connected and no API credentials are stored.
- No client-side RLS policies are created for financial records.
- No client-facing balance mutation, deposit confirmation, withdrawal approval, or payout function is implemented.
- No automatic payout or live payment execution exists.
- Balances must be derived from posted ledger entries, not edited as a mutable number.
- Deposit confirmation and withdrawal completion require trusted server-side provider verification and reconciliation.

## Required before any real-money activation
1. Kenyan legal advice and the applicable CMA authorisation and written clarification for the proposed business and products.
2. Approved client-money safeguarding/bank arrangements and documented segregation of client funds.
3. Contracted, appropriately approved payment providers and payout channels.
4. Reviewed server-side transactional functions for deposit confirmation, withdrawal reservation/approval/payment, reversals, fees, and ledger posting.
5. Enforced maker-checker separation for staff approvals, role checks, MFA, audit trails, idempotency, limits, velocity/fraud controls, and exception handling.
6. Daily reconciliation, statements, dispute/chargeback handling, AML/CFT and KYC controls, privacy controls, incident response, backup and restore tests.
7. Independent security review and end-to-end integration tests, including concurrent requests, duplicate callbacks, partial failures, reversals and reconciliation exceptions.

This migration is schema scaffolding only. It must be reviewed and tested in development before execution and must never be treated as permission to operate or handle customer money.
