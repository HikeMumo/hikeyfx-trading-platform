# Automated test workflow status

Workflow: `.github/workflows/demo-backend.yml`

The workflow runs browser-script syntax checks and the Node.js 20 backend suite when backend, authentication, portal, trading, admin, Supabase migration or workflow files change.

## Latest verified run

- Successful run: [GitHub Actions run 45076825326](https://github.com/HikeMumo/hikeyfx-trading-platform/actions/runs/45076825326)
- Tested commit: `a24775c3eec4aa837b1ac552775c30937334fc91`
- Result: **38 tests passed, 0 failed**.
- Verified: backend engine/API behavior, authenticated member routes, persistent repository routing, Supabase outage and retryable status handling, protected demo-quote migration contracts, per-member quote burst limiting, browser JavaScript syntax, and SQL migration contract checks.
- Earlier successful quote-hardening checks: [run 45076675494](https://github.com/HikeMumo/hikeyfx-trading-platform/actions/runs/45076675494).
- Each newer source commit must be checked independently; a successful older run does not prove later changes passed.

## Scope and limitations

Automated tests do not apply Supabase migrations, verify the hosted Supabase schema, test the Render service, validate TraderMade credentials or confirm any real market-data entitlement. End-to-end hosted testing is still required after migrations are applied and the frontend is deployed.

Passing tests are necessary but not sufficient for production readiness.
