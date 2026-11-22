# HikeyFX Backend API Contract (Draft)

## Status
Design contract only. No backend routes are deployed or connected. The current trading page is a static demo prototype.

## Design rules
- All account and order mutations must be authorised server-side.
- The browser must never be trusted to calculate account balance, margin, exposure or final profit/loss.
- Market data is read-only and separated from trading commands.
- Demo and future live account modes must be separate server-side.
- The current system must reject live account creation and live order execution.
- Every privileged action must be auditable.
- Do not expose database service-role credentials or provider secrets to the browser.

## Proposed routes

### Identity
- `POST /api/auth/register` — future registration adapter; hosted identity provider should own passwords and verification.
- `POST /api/auth/session` — session establishment through the chosen identity provider.
- `POST /api/auth/logout` — revoke the current session.
- `GET /api/me` — current authenticated profile and account permissions.

### Demo accounts
- `GET /api/accounts` — list accounts visible to the authenticated user.
- `POST /api/demo-accounts` — create a demo account only.
- `GET /api/demo-accounts/{accountId}` — retrieve demo account summary.
- `GET /api/demo-accounts/{accountId}/positions` — list open demo positions.
- `GET /api/demo-accounts/{accountId}/orders` — list demo order history.

### Demo orders
- `POST /api/demo-accounts/{accountId}/orders` — submit a demo order to a server-side simulator.
- `POST /api/demo-accounts/{accountId}/positions/{positionId}/close` — close a demo position.
- `GET /api/demo-accounts/{accountId}/activity` — retrieve an ordered activity feed.

The server must validate symbol availability, order type, volume bounds, account ownership, price freshness, risk limits and idempotency. A request from a client must never be able to choose another user's account.

### Market data
Use the read-only routes in `docs/MARKET_DATA_INTEGRATION.md`. Do not reuse market-data credentials for execution.

## Common response envelope
Successful response:
`{ "data": { ... }, "requestId": "..." }`

Error response:
`{ "error": { "code": "...", "message": "..." }, "requestId": "..." }`

Do not return stack traces, secret values, provider credentials or internal database errors to clients.

## Security requirements
- HTTPS only.
- Secure, HttpOnly, SameSite session cookies where supported.
- CSRF protection for cookie-authenticated mutations.
- Input schema validation and output encoding.
- Rate limiting and abuse detection.
- Ownership checks on every account, position and order identifier.
- Idempotency keys for order submission and close requests.
- Append-only audit events for sensitive actions.
- Database row-level security as defence in depth, not a replacement for server authorisation.
- Structured logs with secrets and sensitive personal data redacted.

## Live trading lock
The live trading routes do not exist in this phase. If they are added in a later phase, they must remain feature-flagged off until all legal, regulatory, liquidity, risk, security, operational and reconciliation approvals are documented. The browser must not be able to enable the flag.
