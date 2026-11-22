# HikeyFX Trading Platform

This repository contains the HikeyFX website and the development foundation for a custom trading-platform project.

## Existing website assets

Preserve the current public website and its local video paths:
- `index.html`
- `assets/luxury-hero.mp4`
- `assets/trading-analysis.mp4`

The existing homepage is retained as the starting point. Do not replace its design or video assets without an explicit instruction.

## Development status

- [x] Existing homepage and video references retained.
- [x] Development branch created: `development/phase-1-foundation`.
- [x] Architecture and regulatory gates documented in `docs/ARCHITECTURE.md`.
- [x] Initial private-by-default PostgreSQL schema draft added at `supabase/migrations/0001_initial_schema.sql`.
- [x] Safe environment template added at `.env.example`.
- [ ] Supabase project connected.
- [ ] Authentication and member profiles implemented.
- [ ] Admin authentication and role-based permissions implemented.
- [x] Static member-portal interface preview added (authentication, database and KYC processing are not connected).
- [x] Browser-based demo workspace prototype and client-side simulated order flow added (not a production order engine).
- [ ] Security, backup, monitoring and recovery tests completed.

## Planned integrations

- Market data provider: server-side adapter only; provider credentials must never be placed in browser code.
- TradingView Lightweight Charts: chart rendering.
- Supabase/PostgreSQL: proposed authentication, database, storage and server functions; not connected yet.
- Broker execution: separate integration requiring appropriate authorisation, liquidity-provider agreements, risk controls and operational approval.

## Security

Do not commit API keys, passwords, access tokens, service-role keys or other secrets. Configure credentials through encrypted hosting-provider environment settings. See `.env.example` for variable names only.

## Legal and operational boundary

HikeyFX is currently a software-development project, not an incorporated or CMA-authorised brokerage. Live trading, client deposits and withdrawals must remain disabled until the relevant company, regulatory, provider and operational prerequisites are satisfied. Demo functionality must be clearly identified as simulated.

## Interface prototypes

- Member portal preview: `portal/index.html` (static UI only; no login or personal data collection).
- Admin portal preview: `admin/index.html` (fictional sample data only; no authentication or real admin actions).

## Server-side demo backend prototype

- API and engine: `backend/src/`.
- Setup, routes and limitations: `backend/README.md`.
- Automated unit tests: `backend/test/engine.test.mjs` (`npm test` from `backend/` with Node.js 20+).
- Milestone and remaining gates: `docs/DEMO_ENGINE_MILESTONE.md`.

The backend is local-only, in-memory and uses fictional seed prices. It is not connected to the website, authentication, a database or a real market feed. It must not be exposed publicly or used with real funds.

## Trading workspace prototype

- Entry point: `trading/index.html`.
- Scope and limitations: `trading/README.md`.
- Trading milestone: `docs/TRADING_WORKSPACE_MILESTONE.md`.
- Read-only market-data contract: `docs/MARKET_DATA_INTEGRATION.md`.
- Backend API and security contract: `docs/BACKEND_API_CONTRACT.md`.
- Manual QA checklist: `docs/PHASE1_TRADING_QA_CHECKLIST.md`.

The workspace currently uses locally generated fictional chart data and a browser-only demo simulator. It is not connected to real-time prices, a database, authentication or broker execution. Manual browser QA is still outstanding.

See `docs/ARCHITECTURE.md` for the planned components, environment separation and regulatory gates.
