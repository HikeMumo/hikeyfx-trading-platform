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
- `TRADERMADE_API_KEY` (optional; existing live quote and historical fallback provider)\n- `TWELVE_DATA_API_KEY` (preferred historical candle provider; when set, chart history requests use Twelve Data instead of TraderMade)

Never put a Supabase secret/service-role key or TraderMade key in browser code or Git.

## Historical chart data\n\nWhen `TWELVE_DATA_API_KEY` is configured, the authenticated candle route uses Twelve Data for mapped FX and precious-metal symbols. Native provider intervals are used where available; other supported chart periods are aggregated from genuine lower-timeframe OHLC records. Unsupported instruments and provider-plan restrictions are reported instead of generating placeholder candles. The current adapter maps EURUSD, GBPUSD, AUDUSD, USDJPY, USDCHF, USDCAD, NZDUSD, XAUUSD and XAGUSD. Index CFDs are not mapped yet and need a verified data symbol/provider entitlement before they can show history.\n\nTwelve Data's plan and display licensing must match the intended HikeyFX audience and use; a working API key alone does not establish permission to redistribute market data.\n\n## Routes

- `GET /health` (returns process status and safe booleans indicating Supabase persistence and market-data configuration; it does not probe the database or validate provider credentials)
- `GET /api/v1/demo/account`
- `GET /api/v1/demo/positions`
- `GET /api/v1/demo/history`
- `GET /api/v1/market/quotes`\n- `GET /api/v1/market/candles`
- `GET /api/v1/execution/status` (authenticated; reports fail-closed gateway readiness)
- `POST /api/v1/execution/orders` (authenticated; disabled unless the live gateway and every required production dependency are injected)
- `POST /api/v1/demo/orders`
- `POST /api/v1/demo/positions/{id}/close`

All non-health routes require a verified Supabase access token. When Supabase configuration and a bearer token are present, demo account reads and order/close operations use the persistent Supabase RPC functions. Tests can inject a repository adapter. The no-token injected-test path retains the in-memory engine.

## Database migrations

Apply `../supabase/migrations/0006_persistent_demo_trading.sql` after migrations 0001–0005. Apply `../supabase/migrations/0007_admin_access_foundation.sql` for the manually controlled admin membership foundation, then apply `../supabase/migrations/0008_demo_execution_quote_hardening.sql`. Migration 0008 is critical: it revokes the older price-trusting RPCs and installs versioned `_v2` RPCs. The backend only calls those hardened functions, so updated backend deployments fail closed until migration 0008 exists. The new functions protect fixed demo execution quotes and ignore caller-supplied entry prices, contract sizes, leverage and exit prices. It also adds stricter stop-loss/take-profit validation. Migration 0006 seeds a limited set of demo instruments and adds authenticated, member-scoped snapshot, order and close RPCs. The RPCs derive the user from `auth.uid()`, enforce demo-account ownership, lock the account balance for margin checks, append trade events and use idempotency keys for order submissions.

GitHub stores the migration source but does not execute it. The project owner has confirmed migrations 0006 and 0007 were applied in Supabase. Migration 0008 is newly committed and must also be applied before deploying the updated backend or using persistent demo execution. Verify the hosted RPCs with authenticated end-to-end tests before relying on persistence.

## Broker-owned execution gateway

The independent execution gateway core is in `src/execution-gateway.mjs`; its authenticated status and order-entry routes are `/api/v1/execution/status` and `/api/v1/execution/orders`. Live execution is disabled by default. The gateway requires a connected counterparty adapter, durable idempotency store, pre-trade risk engine, append-only audit service, and durable execution-record repository. `src/execution-persistence.mjs` implements the service-role Supabase persistence contract. `src/http-counterparty-adapter.mjs` is a signed HTTPS connector template that requires a counterparty implementing the documented HikeyFX connector API; it is not a substitute for provider certification or a FIX session. It will not treat a market-data quote or a successful network write as a fill; only a validated provider acknowledgement can produce a filled/partially-filled response. Apply `../supabase/migrations/0015_broker_execution_gateway.sql`, `0016_execution_acknowledgement_persistence.sql`, then `0017_execution_acknowledgement_replay_hardening.sql`, and finally `0018_execution_idempotency_safe_release.sql` for backend-only order, fill, event and idempotency persistence. Migration 0017 rejects conflicting acknowledgement replays and validates fill/status consistency. Migration 0018 releases idempotency reservations only after a confirmed pre-submission failure; unknown outcomes remain locked for reconciliation. These migrations are source files only and have not been applied to hosted Supabase. These migration files are committed but have not been applied to hosted Supabase by this code change. Configure `SUPABASE_SERVICE_ROLE_KEY` only in the backend host secret manager; never expose it in frontend code. Configure `EXECUTION_COUNTERPARTY_URL`, `EXECUTION_COUNTERPARTY_API_KEY`, `EXECUTION_COUNTERPARTY_SIGNING_SECRET`, and `EXECUTION_COUNTERPARTY_CODE` only after the counterparty has agreed to and implemented the connector contract. The migrations do not enable live accounts or order routing. See `../docs/EXECUTION_GATEWAY.md` for required FIX/provider integration and rollout controls.

## Demo trading behavior and limitations

- Each authenticated member has a distinct database demo account.
- Demo positions, balance changes and history persist in Supabase.
- The UI accepts unit quantities and converts them to lots (100,000 units per lot).
- Supported execution symbols in the current demo engine are EURUSD, GBPUSD, AUDUSD and XAUUSD.
- Execution prices still come from hard-coded demonstration quotes. They are not live, delayed or broker-provided market prices.
- A basic per-member, per-process burst limiter protects quote, order and close routes. It is not a distributed limiter and must be replaced with shared rate limiting before production.
- Unrealised P/L, stop-out, swaps, commissions, multi-currency conversion, server-side streaming quote updates and automatic stop-loss/take-profit execution are not implemented.
- This is not a broker backend. No live accounts, real orders, deposits, withdrawals or client-money movement are enabled.

Before any public trading or money movement, complete production-grade risk and accounting design, rate limiting, monitoring, incident response, independent security review, licensed market-data and execution agreements, and all applicable company and regulatory approvals. Do not use real funds.
