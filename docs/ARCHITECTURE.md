# HikeyFX platform architecture

## Project status

HikeyFX is currently a software-development project. The company has not yet been incorporated and no Capital Markets Authority licence has been obtained. This repository must not be presented as an authorised broker or used to accept client money or route live customer orders.

## Design principles

- Preserve the existing public homepage and local video paths.
- Keep market-data ingestion separate from order execution.
- Treat all browser input as untrusted.
- Keep provider keys and privileged credentials on the server only.
- Use an append-only, double-entry ledger for all financial movements.
- Record administrative and security-sensitive actions in an audit trail.
- Deny access by default; enforce ownership checks on the server and with database row-level security.
- Keep demo trading isolated from any future live environment.

## Planned application areas

1. Public website: existing `index.html` and local media assets.
2. Identity: hosted authentication, verified email, session management and optional MFA.
3. Member portal: profile, account overview, verification status, support and preferences.
4. Trading workspace: watchlists, charts, instrument details and a demo-only order simulator until authorisation and execution agreements exist.
5. Administration: staff roles, member support, KYC review queues, risk controls and audit history.
6. Backend API: validates identity, permissions, business rules and provider responses.
7. Market data: server-side provider adapters and normalized quotes.
8. Future execution adapter: disabled until the legal, liquidity, risk and operational prerequisites have been approved.

## Environments

- Development: test data and test credentials only.
- Staging: production-like tests with no client funds or live order routing.
- Production: not to be enabled until the company, permissions, provider agreements, security controls and operational readiness have been independently verified.

Never commit secrets. Use the hosting provider's encrypted environment-variable settings. A public browser key may be used only where the provider explicitly designs it for public use and database policies are correctly configured; service-role keys and market-data secrets must never enter browser code.

## Regulatory and product gates

Before offering brokerage services, obtain Kenyan legal and regulatory advice and written clarification from the CMA on the applicable licence, capital, platform recognition/admission requirements and the permitted product scope. Do not assume a proprietary platform or every proposed asset class automatically qualifies under one licence.

## Initial implementation sequence

1. Repository safety and architecture foundation.
2. Backend project and environment configuration.
3. Authentication and member profiles.
4. Admin identity and role-based access.
5. Member dashboard and support workflows.
6. KYC document workflow and review audit trail.
7. Demo market workspace and simulated orders.
8. Security, monitoring, backup and recovery tests.
9. Licensing and provider-readiness review before any live functionality.
