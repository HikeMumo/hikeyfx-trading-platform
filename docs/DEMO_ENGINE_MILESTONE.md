# Server-side demo engine milestone

## Added
- A local Node.js HTTP API skeleton in `backend/src/server.mjs`.
- A server-side in-memory demo trading engine in `backend/src/engine.mjs`.
- Basic market/limit validation, margin checks, position P&L, manual close, and stop-loss/take-profit trigger logic.
- Automated unit tests in `backend/test/engine.test.mjs`.

## Not connected
- The website UI is not wired to this API.
- No real market data, broker execution, authentication, database, persistent ledger, or customer accounts.
- The seed quotes are fictional and all in-memory records reset on restart.

## Next engineering gates
1. Execute the Node test suite in a Node.js 20+ environment and fix any failures.
2. Add API-level tests and request validation/security middleware.
3. Design persistent demo account storage and user isolation before integrating authentication.
4. Integrate a read-only market data provider only after provider terms, credentials and server-side secret handling are ready.
5. Keep live execution and client deposits disabled until legal, regulatory, provider and operational prerequisites are satisfied.

This milestone is source-code work only. It is not evidence of production readiness or completed browser/device QA.
