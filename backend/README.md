# HikeyFX demo backend

A local Node.js HTTP API and in-memory demo order engine. This is an engineering prototype, not a broker backend.

## Requirements and run

- Node.js 20 or later.
- From this directory: `npm test` to run the automated engine tests.
- Run locally with `npm start`.
- Health check: `http://127.0.0.1:8787/health`.

The server binds to `127.0.0.1` only. It is not configured for public hosting.

## Routes

- `GET /health`
- `GET /api/v1/demo/account`
- `GET /api/v1/demo/positions`
- `GET /api/v1/demo/history`
- `GET /api/v1/market/quotes`
- `POST /api/v1/demo/orders` — JSON: `{"symbol":"EURUSD","side":"buy","volume":0.1,"stopLoss":1.08,"takeProfit":1.09}`
- `POST /api/v1/demo/positions/{id}/close`

## Current behavior

- All balances and orders exist only in server memory and reset when the process restarts.
- Prices are fictional seed quotes, not a market feed.
- Supported demo symbols: EURUSD, GBPUSD, AUDUSD and XAUUSD.
- Market buy/sell positions use the ask/bid respectively.
- Basic volume, margin, stop-loss and take-profit validation is performed.
- The engine can process stop-loss/take-profit when its quote-update method receives a new price. No external quote stream is connected.
- Profit calculations are simplified demo calculations, not production-grade multi-currency accounting.

## Critical limitations

There is no user authentication, database persistence, account isolation, rate limiting, CSRF protection, production logging, monitoring, broker connectivity, real-time data, deposits, withdrawals or live order execution. Do not expose this service to the internet or use it with real funds or personal information.

Before any hosted use, implement authenticated server-side identity and authorization, persistent transactional storage, per-user account isolation, idempotency, audit trails, robust risk/margin rules, secure deployment controls, independent security testing and the required company/regulatory/provider approvals. Live trading and client money remain disabled.
