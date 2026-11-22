# Automated test workflow

Workflow: `.github/workflows/demo-backend.yml`

The workflow runs the Node.js 20 demo backend test suite on pushes and pull requests that change backend files, and supports manual dispatch from the GitHub Actions tab.

## Current verification status
- Workflow definition committed to the development branch.
- The GitHub Actions API returned no workflow runs at the time this status was checked.
- Therefore no green CI result is claimed. The workflow still needs to be run in GitHub Actions and its result reviewed.
- Local execution also remains outstanding in this environment.

## Required acceptance
A successful run must execute `npm test` in `backend/` and pass both the engine unit tests and HTTP API integration tests. A passing test suite is necessary but not sufficient for production readiness.
