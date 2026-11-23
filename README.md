# HikeyFX Trading Platform

This repository contains the HikeyFX website and the development foundation for a custom trading-platform project.

## Existing website assets

Preserve the current public website and its local video paths:
- `index.html`
- `assets/luxury-hero.mp4`
- `assets/trading-analysis.mp4`

The existing homepage is retained as the starting point. Do not replace its design or video assets without an explicit instruction.

## Development status

- [x] Original homepage retained on `main`; development work isolated on `development/phase-1-foundation`.
- [x] Architecture and regulatory gates documented in `docs/ARCHITECTURE.md`.
- [x] Initial private-by-default PostgreSQL schema draft added (not executed).
- [x] Static member and admin portal previews added; neither has authentication or real user data.
- [x] Browser-based demo trading workspace prototype added; prices and orders are simulated.
- [x] Localhost-only in-memory demo API and matching engine added.
- [x] Engine and HTTP API automated test source added.
- [x] GitHub Actions Node.js 20 test workflow added; a passing run is not yet verified.
- [x] Phase-one completion gates and outstanding work documented in `docs/PHASE1_COMPLETION_GATES.md`.
- [ ] Provider connection, authentication, persistent storage and database integration.
- [ ] Automated test run verified, browser/device QA and independent security review.
- [ ] Production operations, legal authorisation and provider readiness.

## Main project documents

- Architecture and boundaries: `docs/ARCHITECTURE.md`
- Remaining implementation gates: `docs/PHASE1_COMPLETION_GATES.md`
- CI status: `docs/CI_TEST_STATUS.md`
- Demo persistence design: `docs/DEMO_PERSISTENCE_SCHEMA.md`
- Market-data contract: `docs/MARKET_DATA_INTEGRATION.md`
- Backend API contract: `docs/BACKEND_API_CONTRACT.md`
- Manual trading QA checklist: `docs/PHASE1_TRADING_QA_CHECKLIST.md`

## Interface prototypes

- Member portal: `portal/index.html` (static preview only).
- Admin portal: `admin/index.html` (fictional sample data only).
- Trading workspace: `trading/index.html` (browser-only simulator; fictional chart data).
- Backend: `backend/` (local-only demo API, not publicly hosted).

## Security and legal boundary

HikeyFX is currently a software-development project. Company incorporation and CMA authorisation have not been completed. Do not present it as an authorised brokerage, accept client money, collect real KYC documents or route live orders. Live accounts, deposits, withdrawals and live execution remain disabled.

Never commit API keys, passwords, access tokens, service-role keys or other secrets. Keep privileged credentials on a server and use encrypted environment settings. Do not expose the in-memory demo API to the public internet.

## Backend test command

With Node.js 20 or later, run `npm test` from `backend/`. The test source is present; consult `docs/CI_TEST_STATUS.md` for verified run status. A workflow definition alone is not evidence of a passing run.
