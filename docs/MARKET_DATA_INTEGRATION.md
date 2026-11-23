# HikeyFX Market Data Integration Contract

## Purpose
Define the boundary for a future read-only market-data service. Market data must remain separate from order execution and account funding.

## Provider selection gates
Before selecting a provider, confirm:
- Supported instruments and asset classes (forex, indices, commodities).
- Historical OHLC candle coverage and supported intervals.
- Streaming quote method, latency expectations, rate limits and reconnect behaviour.
- Commercial licence permitting display to end users and any redistribution.
- Availability, uptime commitments, geographic restrictions and support.
- Whether delayed, indicative or executable prices are supplied; never label indicative prices as executable.
- Key rotation, server-side credential storage and permitted origin/IP restrictions.

## Proposed server contract
The browser should call HikeyFX's own backend, not a provider with a secret key embedded in the page.

### Instruments
`GET /api/market/instruments`

Returns a list of instruments enabled for display:
- `symbol`
- `displayName`
- `assetClass`
- `baseCurrency` and `quoteCurrency` when relevant
- `pricePrecision`
- `status`

### Latest quote
`GET /api/market/quotes?symbols=EURUSD,GBPUSD`

Each quote should include:
- `symbol`
- `bid`, `ask`, and/or `last` only where the provider actually supplies them
- `providerTimestamp`
- `receivedAt`
- `source`
- `isDelayed`
- `priceType` (for example indicative or delayed)

### Historical candles
`GET /api/market/candles?symbol=EURUSD&interval=15m&from=...&to=...`

Each candle:
- `time` (UTC timestamp)
- `open`
- `high`
- `low`
- `close`
- `volume` only when supplied and meaningful for that instrument

Validate that high is not below open/close/low, low is not above open/close/high, timestamps are ordered, and duplicate candles are handled deterministically.

## Browser behaviour
- Display source and last-update time.
- Clearly distinguish live, delayed, indicative, stale and unavailable data.
- Never silently fall back from live data to invented sample prices while retaining a live label.
- Show an explicit connection/error state when data is unavailable.
- Keep chart display code independent from the selected provider.
- Use WebSocket/SSE only through a backend relay when provider terms and infrastructure permit it.

## Security and operations
- Provider API secrets remain server-side in environment/secret storage.
- Apply per-user and per-IP rate limits and validate requested symbols/intervals.
- Log provider outages and data freshness without logging secrets.
- Monitor reconnects, stale quote age, missing candles and provider errors.
- Never use market-data credentials as execution credentials.

## Execution boundary
This contract is read-only. It does not authorise or implement orders. A future execution service requires separate legal review, authorisation, liquidity/provider agreements, server-side risk controls, audit logging and reconciliation. The current demo simulator must remain non-executable against external markets.
