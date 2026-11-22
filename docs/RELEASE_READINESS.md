# HikeyFX release-readiness checklist

This is a development platform. Do not merge to `main`, publish as a public broker, accept customer money, or route live orders until every applicable gate below is complete.

## Database and identity gates

- [ ] Apply Supabase migrations 0001–0005 (already reported complete by the project owner).
- [x] Apply `supabase/migrations/0006_persistent_demo_trading.sql` (owner-confirmed).
- [x] Apply `supabase/migrations/0007_admin_access_foundation.sql` (owner-confirmed).
- [ ] Apply `supabase/migrations/0008_demo_execution_quote_hardening.sql` (newly committed; required before persistent demo orders are used).
- [ ] Configure Supabase Auth Site URL and redirect URLs to the final HTTPS frontend origin.
- [ ] Verify email confirmation, sign-in, sign-out, session refresh and account bootstrap.
- [ ] Verify two different test members cannot see or modify each other's demo account, positions or history.
- [ ] Verify demo orders persist across backend restarts and duplicate submissions are idempotent.
- [ ] Grant administrator membership manually to verified Auth user IDs only; verify ordinary members are denied.

## Hosting and frontend gates

- [ ] Deploy the frontend static site from `development/phase-1-foundation` only after staging is ready.
- [ ] Keep the backend service separate from the static frontend.
- [ ] Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on the backend host.
- [ ] Keep all provider secrets in server-side environment variables; never commit them.
- [ ] Test the hosted frontend on Android Chrome and desktop browsers.
- [ ] Test refresh/deep links, sign-in redirects, API CORS and sign-out.
- [ ] Test persistent demo account, order, close, history and account isolation against the hosted database.

## Trading and market-data gates

- [ ] Replace fictional seed prices with a verified provider feed before describing prices as live.
- [ ] Validate provider payloads, symbol mappings, quote freshness, outages and rate limits.
- [ ] Obtain a market-data licence that permits the intended public display and commercial use.
- [ ] Implement robust price validation, P/L, margin, stop-out, swaps, commissions and multi-currency accounting.
- [ ] Independently review order execution, risk controls, concurrency and auditability.
- [ ] Keep live accounts and real order routing disabled until all authorisations and broker/provider contracts are in place.

## Admin and client-money gates

- [ ] Confirm admin membership grants and revocations are owner-controlled and audited.
- [ ] Build and independently review any KYC review, account restriction or support actions before enabling them.
- [ ] Keep deposits, withdrawals, payouts and customer balances disabled until payment-provider agreements, reconciliation, segregation of duties, security review and legal approvals are complete.
- [ ] Never collect raw card details, bank credentials or identity documents through this prototype.

## Regulatory and operational gates

- [ ] Obtain Kenyan legal advice and all required CMA authorisation before operating or marketing a forex brokerage service.
- [ ] Complete company, compliance, AML/KYC, complaints, data-protection, safeguarding and operational requirements.
- [ ] Complete independent penetration testing, incident response, backups, disaster recovery, monitoring and support procedures.
- [ ] Obtain explicit project-owner approval before merging to `main` or making a public production release.

## Current verified engineering baseline

- GitHub branch: `development/phase-1-foundation`.
- Backend health service exists at the current Render URL; a health response alone does not verify database persistence, market data or trading.
- GitHub Actions run [45075273243](https://github.com/HikeMumo/hikeyfx-trading-platform/actions/runs/45075273243) passed 32 automated tests and browser/backend syntax checks for its commit.
- Supabase migrations 0006 and 0007 are reported applied by the project owner; the resulting hosted database behavior has not yet been independently verified.
- Demo execution uses fixed illustrative quotes, not live market data. Migration 0008 hardens database execution against caller-supplied prices; it must be applied before persistent demo orders are used. No live market data, real trading, deposits or withdrawals are enabled.
