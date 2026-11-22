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
- [ ] Member dashboard and KYC workflow implemented.
- [ ] Demo market workspace and simulated order engine implemented.
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

See `docs/ARCHITECTURE.md` for the planned components, environment separation and regulatory gates.
