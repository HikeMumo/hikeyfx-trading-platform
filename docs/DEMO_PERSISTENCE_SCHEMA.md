# Demo persistence schema draft

Migration: `supabase/migrations/0002_demo_trading_persistence.sql`

## Purpose
Prepare a database shape for authenticated demo trading without enabling live accounts or client money.

## Tables
- `demo_account_balances`: demo cash balance and optimistic version number.
- `demo_positions`: open/closed demo positions with entry, exit, margin and protective-price fields.
- `demo_trade_events`: append-only event history for opens, closes and protective exits.
- `demo_idempotency_keys`: unique per-account request keys to prevent duplicate order submissions.

## Safety boundaries
- Every record is tied to a trading account.
- Database triggers reject rows linked to a non-demo account.
- New tables have RLS enabled and no client policies.
- Trade events cannot be updated or deleted; use compensating events.
- The migration is a draft and has not been executed.
- No live account, deposit, withdrawal, or financial ledger functionality is added.

## Required before connecting an API
Implement and review atomic server-side database functions that lock the account row, validate account ownership and demo mode, check margin, reserve/release margin, create positions, write append-only events, and store idempotency responses in the same transaction. Add integration tests for concurrent requests, duplicate retries, rollback behavior and row-level security. Do not use a service-role key in browser code.
