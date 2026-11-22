# HikeyFX Trading Workspace — Phase 1 Milestone

## Status
Planning and interface foundation only. This milestone does not enable live customer trading, accept deposits, or represent that HikeyFX is licensed.

## Objective
Create a responsive, custom trading workspace that can later connect to authenticated accounts, a market-data provider, and an authorised execution service without coupling those systems together.

## Phase 1 scope (safe to build before Supabase)
1. Workspace shell
   - Responsive desktop and mobile layouts.
   - Instrument search and watchlist.
   - Market category tabs: Forex, Indices, Commodities.
   - Instrument details panel.
2. Chart interface
   - Candlestick and line display.
   - Timeframes: 1m, 5m, 15m, 1h, 4h, 1D, 1W.
   - Crosshair, zoom, pan, and chart resizing.
   - Indicator controls prepared for moving averages, RSI, and MACD.
   - Clearly label sample/demo data until a provider is connected.
3. Demo order ticket
   - Buy/sell direction, volume, order type, stop loss, and take profit inputs.
   - Client-side validation and clear risk information.
   - Demo-only simulated order submission.
   - No payment, deposit, withdrawal, or live execution controls.
4. Demo portfolio
   - Open positions, order history, and account summary.
   - Simulated balance and profit/loss calculations.
   - Persistent storage is deferred until the database is connected; initial prototype state may reset on refresh.
5. Integration boundaries
   - Market-data adapter is read-only and separate from execution.
   - Provider credentials must remain server-side; never put secret keys in browser code or Git.
   - Execution adapter remains disabled.
   - Authentication and durable account records are deferred until Supabase or another backend is available.

## Acceptance checks
- Existing public homepage and its media remain unchanged.
- Trading workspace works at common Android phone widths and desktop widths.
- All visible controls have a working demo behaviour or are clearly marked as not yet connected.
- No hardcoded price is presented as a live quote.
- Demo orders cannot trigger real trades or financial transfers.
- No API secret or private credential is committed to the repository.

## Later dependencies
- Supabase project: authentication, database, row-level security, and server-side functions.
- Market-data provider: written selection of supported instruments, historical candles, streaming quotes, limits, and commercial terms.
- Legal/regulatory review: before any public brokerage representation, client onboarding, deposits, or live execution.
- Execution/liquidity provider and risk/operations controls: before any live trading capability.

## Immediate next build task
Implement the isolated trading workspace UI and demo simulator on the development branch, leaving the existing homepage and main branch untouched.
