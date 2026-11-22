# HikeyFX demo backend

Authenticated Node.js API for the HikeyFX development demo platform.

## Requirements and run

- Node.js 20 or later.
- From this directory: `npm test` to run the engine, API and adapter tests.
- Run locally with `npm start`.
- Health check: `http://127.0.0.1:8787/health`.

## Configuration

Set these environment variables on the backend host:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `TRADERMADE_API_KEY` (optional until a valid, permitted data subscription is available)

Never put a Supabase secret/service-role key or TraderMade key in browser code or Git.

## Routes

- `GET /health` (returns process status and safe booleans indicating Supabase persistence and market-data configuration; it does not probe the database or validate provider credentials)
- `GET /api/v1/demo/account`
- `GET /api/v1/demo/positions`
- `GET /api/v1/demo/history`
- `GET /api/v1/market/quotes`
- `POST /api/v1/demo/orders`
- `POST /api/v1/demo/positions/{id}/close`

All non-health routes require a verified Supabase access token. When Supabase configuration and a bearer token are present, demo account reads and order/close operations use the persistent Supabase RPC functions. Tests can inject a repository adapter. The no-token injected-test path retains the in-memory engine.

## Database migrations

Apply `../supabase/migrations/0006_persistent_demo_trading.sql` after migrations 0001–0005. Apply `../supabase/migrations/0007_admin_access_foundation.sql` afterward to add the manually controlled admin membership foundation. It seeds a limited set of demo instruments and adds authenticated, member-scoped snapshot, order and close RPCs. The RPCs derive the user from `auth.uid()`, enforce demo-account ownership, lock the account balance for margin checks, append trade events and use idempotency keys for order submissions.

GitHub stores the migration source but does not execute it. The project owner has confirmed migrations 0006 and 0007 were applied in Supabase; verify the hosted RPCs with authenticated end-to-end tests before relying on persistence.

## Demo trading behavior and limitations

- Each authenticated member has a distinct database demo account.
- Demo positions, balance changes and history persist in Supabase.
- The UI accepts unit quantities and converts them to lots (100,000 units per lot).
- Supported execution symbols in the current demo engine are EURUSD, GBPUSD, AUDUSD and XAUUSD.
- Execution prices still come from hard-coded demonstration quotes. They are not live, delayed or broker-provided market prices.
- Unrealised P/L, stop-out, swaps, commissions, multi-currency conversion, server-side streaming quote updates and automatic stop-loss/take-profit execution are not implemented.
- This is not a broker backend. No live accounts, real orders, deposits, withdrawals or client-money movement are enabled.

Before any public trading or money movement, complete production-grade risk and accounting design, rate limiting, monitoring, incident response, independent security review, licensed market-data and execution agreements, and all applicable company and regulatory approvals. Do not use real funds.
