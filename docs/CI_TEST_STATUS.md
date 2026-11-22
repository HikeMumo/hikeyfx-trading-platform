# Automated test workflow status

Workflow: `.github/workflows/demo-backend.yml`

The workflow runs browser-script syntax checks and the Node.js 20 backend suite when backend, authentication, portal, trading, admin, Supabase migration or workflow files change.

## Latest verified run

- Successful run: [GitHub Actions run 45074995760](https://github.com/HikeMumo/hikeyfx-trading-platform/actions/runs/45074995760)
- Commit: `fd4622da377765ece22021da38030eccd0d4b9ea`
- Verified: backend engine/API tests, trading-page JavaScript syntax, API configuration syntax, and admin-page JavaScript syntax.
- Persistent demo SQL and adapter tests passed in run [45074847518](https://github.com/HikeMumo/hikeyfx-trading-platform/actions/runs/45074847518).
- Each newer commit must be checked independently; a successful older run does not prove later changes passed.

## Scope and limitations

Automated tests do not apply Supabase migrations, verify the hosted Supabase schema, test the Render service, validate TraderMade credentials or confirm any real market-data entitlement. End-to-end hosted testing is still required after migrations are applied and the frontend is deployed.

Passing tests are necessary but not sufficient for production readiness.
