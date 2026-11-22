# Automated test workflow status

Workflow: `.github/workflows/demo-backend.yml`

The workflow runs browser-script syntax checks and the Node.js 20 backend suite when backend, authentication, portal, trading, admin, Supabase migration or workflow files change.

## Latest verified run

- Successful run: [GitHub Actions run 45076241569](https://github.com/HikeMumo/hikeyfx-trading-platform/actions/runs/45076241569)
- Tested commit: `d4928c79c208b4786538de89e8f7c619d078d7fa`
- Result: **34 tests passed, 0 failed**.
- Verified: backend engine/API behavior, persistent repository routing, member API authentication, frontend JavaScript syntax, API configuration syntax, and SQL migration contract checks.
- Earlier successful persistent routing checks: [run 45076102007](https://github.com/HikeMumo/hikeyfx-trading-platform/actions/runs/45076102007).
- Each newer source commit must be checked independently; a successful older run does not prove later changes passed.

## Scope and limitations

Automated tests do not apply Supabase migrations, verify the hosted Supabase schema, test the Render service, validate TraderMade credentials or confirm any real market-data entitlement. End-to-end hosted testing is still required after migrations are applied and the frontend is deployed.

Passing tests are necessary but not sufficient for production readiness.
