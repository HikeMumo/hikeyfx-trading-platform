# Automated test workflow status

Workflow: `.github/workflows/demo-backend.yml`

The workflow runs the Node.js 20 demo backend test suite on pushes and pull requests that change backend files, and supports manual dispatch from the GitHub Actions tab.

## Current verification status

- Workflow definition is committed to `development/phase-1-foundation`.
- Engine and HTTP API test files have been expanded to cover 19 cases in total.
- The latest backend test changes were committed, which should satisfy the workflow's push path filter.
- This environment cannot access GitHub Actions run history or execute a clean clone because direct GitHub network access is unavailable here.
- No successful CI run has been verified in this session. Do not describe the tests as passing until the Actions run is inspected.

## How to verify

1. Open the repository's **Actions** tab.
2. Select **HikeyFX demo backend checks**.
3. Open the run for the latest `development/phase-1-foundation` commit.
4. Confirm the **Run automated tests** step is green and the summary reports all tests passing.
5. If it fails, inspect the failing test output before making further changes.

## Acceptance

A successful run must execute `npm test` in `backend/` under Node.js 20 and pass both the engine unit tests and HTTP API integration tests. Passing tests are necessary but not sufficient for production readiness.
