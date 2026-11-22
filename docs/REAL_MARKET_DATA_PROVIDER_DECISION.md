# HikeyFX Real Market Data — Provider Decision and Integration Gate

## Product decision
HikeyFX should use genuine provider-sourced market data in the trading workspace. Do not generate random candles, seed quotes, or silently fall back to fabricated values.

The member's account may be labelled **Demo Account**. Market prices and candles must be labelled according to the provider's actual entitlement and feed status (for example, real-time, delayed, indicative, stale, or unavailable). Do not call a provider quote executable unless the provider contract and a separate authorised execution arrangement establish that fact.

## Provider shortlist reviewed on 22 November 2026

### TraderMade — preferred candidate for broker-style display discussions
TraderMade advertises real-time FX, commodities, US stocks and indices over REST, WebSocket and FIX, and specifically markets data/display rights for trading platforms and brokers. Its commercial pricing and exact instrument coverage/licensing must be confirmed in writing before integration.
Reference: https://marketdata.tradermade.com/

### Twelve Data — useful API candidate, but not a default public-display licence
Twelve Data documents real-time forex streaming and broad market-data APIs. Its published terms state that external redistribution/display requires the relevant rights/add-on or a separate written agreement; individual plans are for personal/internal use, not commercial display to third parties. Its Forex API v2 documentation also says redistribution requires a separate licensing agreement.
References:
- https://twelvedata.com/docs
- https://twelvedata.com/terms
- https://support.twelvedata.com/en/articles/12520817-forex-api-v2
- https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage

## Decision gate before connecting a provider
Obtain written confirmation covering:
1. HikeyFX's intended use as a future trading-platform/broker service, including pre-launch development and external display.
2. Kenya and any other target territories.
3. Forex, indices and commodities symbols actually required.
4. Real-time versus delayed/indicative status, bid/ask availability, timestamps and historical candle intervals.
5. Client display, redistribution, caching, derived indicators and attribution rights.
6. API/WebSocket limits, connection limits, uptime/support and total recurring cost.
7. Whether the provider's prices are informational only or may be used for any permitted execution workflow (never assume execution rights).

No subscription or data rights are assumed by this document.

## Engineering requirements
- Provider credentials live only in backend secret storage; never in browser code or Git.
- The browser reads HikeyFX's own authenticated market-data API.
- Every quote includes symbol, bid/ask or last as actually supplied, provider timestamp, receive timestamp, provider/source, price type and delay status.
- Candles are fetched from provider historical OHLC data. Do not create random candles.
- Reject malformed, crossed or out-of-order quotes/candles.
- Enforce per-instrument freshness limits. Stale or missing data returns an unavailable/stale state.
- There is no fallback to hard-coded seed prices, generated candles, or a different provider without explicit configuration and provenance.
- Persist provider identity and timestamps with market-data audit/diagnostic records, subject to the provider's storage terms.
- Keep the data adapter independent from order/account logic.

## Trading and regulatory boundary
A genuine market-data feed does not make a trade real. Until HikeyFX has the required Kenyan authorisation, agreements, safeguards, risk controls, operational readiness and legal review, order entry remains a demo-account workflow. No customer funds are accepted and no external order is routed. Do not represent a demo fill as a broker/exchange execution.

## Immediate implementation sequence
1. Select a provider and obtain written display/licensing terms.
2. Store the provider credential in backend environment secrets.
3. Implement provider adapter and authenticated read-only quote/candle endpoints.
4. Remove all seeded quotes and generated chart candles from the trading UI; show unavailable when the provider is not connected.
5. Connect the persistent demo engine to validated provider quotes only after the feed is working and freshness tests pass.
6. Complete database transaction, authentication, idempotency and security tests before deployment.
