# HikeyFX broker-owned execution gateway

## Purpose
The gateway is the broker-side boundary between authenticated HikeyFX trading accounts and execution counterparties. It is separate from the demo engine. It does not fabricate liquidity or report a fill without a counterparty acknowledgement.

## Implemented core
- backend/src/execution-gateway.mjs defines the execution service and dependency contracts.
- backend/src/pre-trade-risk.mjs adds an account-aware risk policy engine.
- backend/src/execution-persistence.mjs provides service-role-only Supabase RPC persistence for idempotency and acknowledged orders/fills. It requires `SUPABASE_SERVICE_ROLE_KEY` on the backend host only.
- backend/src/http-counterparty-adapter.mjs provides a signed HTTPS connector template for a counterparty implementing the documented HikeyFX connector contract. It is not a generic FIX adapter and must be certified against the actual provider API before use. It verifies account ownership/status, instrument permissions and market hours, quote age/spread, per-order and per-symbol exposure limits, free margin and projected post-trade margin level. It requires an authoritative risk snapshot from a trusted repository; it does not invent account balances or margin.
- Live execution defaults to disabled and requires LIVE_EXECUTION_ENABLED=true.
- It fails closed unless a connected adapter, durable idempotency store, risk engine and append-only audit log are injected.
- Orders require a fresh executable bid/ask quote, valid symbol, side and lot size, authenticated member/account identifiers and a client idempotency key.
- A provider acknowledgement is required before a fill is reported. Invalid accepted acknowledgements are rejected. Partial fills are distinguished from full fills.
- Reused idempotency keys cannot submit duplicate orders or be reused for different order parameters.

## Production integrations still required
1. Execution adapter to a contracted liquidity provider, prime-of-prime, exchange or other authorised counterparty. FIX 4.4/5.0 SP2 is a common option, but actual protocol, tags, session rules, symbols and order types must follow the counterparty specification. Implement logon/logout, heartbeat, sequence persistence/recovery, new-order-single, execution reports, rejects, cancel/replace, partial fills and disconnect recovery. A successful socket write is not an execution acknowledgement.
2. Durable database-backed idempotency with a unique user/key constraint, request hash, reservation state, provider IDs, terminal result and crash recovery. It must prevent concurrent duplicate submissions across processes. If submission may have reached the counterparty but its outcome is uncertain, mark the key unknown and reconcile before any retry.
3. Instrument-aware pre-trade risk: account ownership/status, permissions, quote age/spread, trading hours, lot/exposure limits, leverage, margin, concentration, credit limits, price collars and kill switches. Currency conversion must use approved rates.
4. Append-only, tamper-evident audit events for requests, risk decisions, outbound messages, acknowledgements, fills, rejects, corrections and operator actions. The current migration stores safe acknowledgement metadata; full event ingestion and operator audit coverage remain to be completed.
5. Position and double-entry ledger services consuming execution reports idempotently and transactionally. Order state, fills, positions, cash ledger and margin reservations must remain distinct.

## Rollout
1. Implement and certify a counterparty adapter in its sandbox.
2. Implement durable order/fill/event persistence and transactional outbox/inbox.
3. Complete risk, margin, exposure and kill-switch controls and independent review.
4. Reconcile provider executions to positions and accounting under duplicate, delayed, reordered and missing-event tests.
5. Complete monitoring, runbooks, disaster recovery and security testing.
6. Complete counterparty certification and a controlled pilot.
7. Enable live execution only after real provider credentials and production dependencies pass readiness checks.

## Safety boundary
A standalone gateway does not create liquidity, clearing, custody or settlement. A broker needs a real execution/counterparty arrangement (or a properly capitalised and controlled principal dealing operation), market-data rights, banking/payment rails, client-money controls and applicable authorisations. Until those exist, HikeyFX must not accept live orders or customer funds. Demo execution remains isolated and must never be represented as live.

## Persistence migrations
Apply `supabase/migrations/0015_broker_execution_gateway.sql` followed by `supabase/migrations/0016_execution_acknowledgement_persistence.sql`. These migrations are source files only; they have not been applied to the hosted Supabase project by this code change. Verify schema and RPC permissions in a non-production project first.

## Configuration
`SUPABASE_SERVICE_ROLE_KEY` is required by the server-side execution persistence adapter and must never be exposed to the browser. `EXECUTION_COUNTERPARTY_URL`, `EXECUTION_COUNTERPARTY_API_KEY`, `EXECUTION_COUNTERPARTY_SIGNING_SECRET`, and `EXECUTION_COUNTERPARTY_CODE` configure the signed HTTPS connector template. The counterparty must implement the exact request/response contract and replay protection before this connector is usable. `LIVE_EXECUTION_ENABLED` defaults to false. Setting it to true alone does not enable trading: all required adapters and health checks must pass. Provider secrets belong only in the host's secret manager/environment, never source control or browser code.


## Current repository integration state
The backend now constructs the gateway with the Supabase execution persistence adapter and the signed HTTPS connector when their environment configuration exists. The pre-trade risk repository is intentionally not injected, so the gateway reports `ready: false` and rejects all live submissions. This is deliberate: the current schema still constrains trading accounts to demo mode and does not yet provide a trusted live-account equity/margin snapshot or instrument entitlement function. Do not set `LIVE_EXECUTION_ENABLED=true` expecting this to bypass those missing dependencies. Migrations 0015 and 0016 must be reviewed and applied in a non-production Supabase project before integration testing.
