# HikeyFX remaining implementation gates

This is the active engineering checklist for the HikeyFX development branch. It is intentionally separate from the public website and does not authorise deployment, client onboarding, deposits or live trading.

## Completed source foundations
- [x] Keep the original homepage and media assets on `main`; development remains isolated on `development/phase-1-foundation`.
- [x] Document the proposed architecture, environment boundaries and regulatory gates.
- [x] Draft private-by-default identity, account, instrument, demo-order, KYC-status and audit schemas.
- [x] Build static member and admin portal previews with fictional data and explicit limitations.
- [x] Build a browser-only simulated trading workspace.
- [x] Build a localhost-only, in-memory demo API and matching engine.
- [x] Add engine and HTTP API automated tests.
- [x] Harden API request parsing with JSON object validation, a 16 KiB body cap, status-aware errors and baseline response headers.
- [x] Add test coverage for margin rejection, sell-side P/L, both protective exits, malformed quotes, invalid engine configuration, malformed request bodies, oversized bodies and response headers.
- [x] Add a Node.js 20 GitHub Actions test workflow.
- [x] Add a development-only client-money schema foundation for a double-entry ledger, deposit intents, withdrawal requests, provider-event deduplication and reconciliation records. This is schema scaffolding, not an active payment system.

## Verification still required
- [ ] Obtain and inspect a successful GitHub Actions run for the current development commit. A workflow file and test source are not proof that tests passed.
- [ ] Run the same test suite locally from a clean checkout and retain the output.
- [ ] Validate all HTML, CSS and JavaScript in the portal, admin and trading prototypes.
- [ ] Complete Android Chrome and desktop browser QA using the checklist in `docs/PHASE1_TRADING_QA_CHECKLIST.md`.
- [ ] Test keyboard navigation, screen-reader labels, contrast, narrow-screen overflow and reduced-motion behavior.
- [ ] Conduct an independent code and dependency security review.

## Backend and data work blocked on provider setup
- [ ] Choose and connect an authentication/database provider. Supabase is now selected for development, but migrations have not been executed.
- [ ] Review and test database migrations in a disposable development project before any production environment.
- [ ] Implement reviewed atomic database functions for demo order placement/closure, account-row locking, margin checks, idempotency and append-only event recording.
- [ ] Add database integration tests for ownership isolation, concurrent order requests, duplicate retries, transaction rollback and RLS.
- [ ] Implement real authentication, verified email, session lifecycle, MFA policy and server-side role checks.
- [ ] Review and test client-money ledger posting, balanced-journal enforcement, deposit verification, withdrawal approval, provider-event deduplication, reconciliation and maker-checker separation before any payment-provider integration.
- [ ] Implement secure payment-provider adapters and webhook signature verification only after contracts and legal approvals; do not expose provider credentials to the browser.
- [ ] Implement operational logging, alerting, backups, restore drills, rate limits, abuse controls and incident response.

## Market data and platform integration
- [ ] Select a market-data provider after checking licence, redistribution, display, latency and cost terms.
- [ ] Keep provider credentials server-side and implement stale-quote, outage and market-session handling.
- [ ] Replace fictional sample prices with clearly labelled provider data only after approval and QA.
- [ ] Select and integrate a chart library with documented licence and mobile performance checks.
- [ ] Do not connect a broker execution API as part of this demo milestone.

## Legal and launch gates
- [ ] Obtain Kenyan legal advice and written CMA clarification on the applicable licence, capital, platform admission/recognition, client-money safeguarding and reconciliation obligations, permitted products and non-dealing broker obligations.
- [ ] Incorporate the company and complete required governance, ownership and compliance arrangements when financially possible.
- [ ] Secure the relevant CMA authorisation before holding out as a broker or providing regulated services.
- [ ] Complete liquidity/data-provider agreements, client-money safeguarding design, complaints handling, AML/CFT, KYC, risk, reconciliation and operational controls as legally required.
- [ ] Commission independent penetration testing, privacy review, disaster-recovery tests and production readiness sign-off.
- [ ] Only then consider a separately approved production deployment.

## Hard-disabled scope
- No live accounts, live order routing, live client deposits or withdrawals, real KYC document collection or public backend hosting.
- The new client-money tables are design scaffolding only; no customer funds may be received, held, transferred or paid out.
- Demo balances and prices are fictional. They must never be represented as customer funds or executable market prices.
- No database migration in this repository has been executed.
- No company incorporation, CMA licence, provider contract, authentication connection or production deployment is claimed.
