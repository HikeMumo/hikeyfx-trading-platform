# HikeyFX Trading Workspace

This folder contains the isolated Phase 1 trading workspace prototype.

## Entry point
- `index.html` — responsive browser-based trading workspace.

## Current behaviour
- Local sample instrument list covering forex, indices and commodities.
- Locally generated illustrative candlesticks.
- Selectable chart timeframes (the timeframe changes the interface state; it does not fetch historical market candles).
- Moving-average overlay and a calculated RSI (14) panel based only on the generated sample candles.
- Demo-only market order ticket, simulated positions, close action and order history.
- Demo balance and order state exist only in the current page session and reset on refresh.

## Explicit limitations
- No live quotes, historical market-data API, authentication, persistent database, server API or broker connection.
- Limit and stop orders are interface previews only.
- Stop-loss and take-profit fields are currently captured as interface inputs but are not yet evaluated by a matching engine.
- No deposits, withdrawals, real-money accounts or live trading.
- The page must not be described as a live brokerage platform.

## Development rule
Keep this workspace isolated from the public homepage until it has been reviewed and the user explicitly approves integration. Do not put provider secrets in HTML, JavaScript, GitHub, or any browser-delivered file.
