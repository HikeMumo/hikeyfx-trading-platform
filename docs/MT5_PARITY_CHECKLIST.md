# MT5 Android parity checklist

This checklist tracks HikeyFX against the MetaTrader 5 Android feature set. A check mark means the capability exists in this repository; it does not imply live broker execution.

## Quotes / Market Watch
- [x] Bid / ask display and symbol search
- [x] Asset-class filters and persistent favourites
- [x] Quote context actions and instrument details
- [x] Price alerts with browser notifications
- [ ] Full broker symbol catalogue, daily high/low and contract specifications
- [ ] Market Depth / Level II order book (requires broker depth feed)

## Charts
- [x] Candlesticks, bars, line and Heikin Ashi
- [x] 21 timeframe choices and historical OHLC endpoint
- [x] Zoom, pan, crosshair and OHLC readout
- [x] 30 built-in technical-indicator calculations, with plotted price overlays and oscillator panes
- [x] 23 analytical drawing controls, selection, endpoint editing, rotation and long-press deletion
- [ ] Multi-chart tiled layouts with independent symbol/timeframe state
- [ ] Chart-trading lines and full broker-side order editing from chart
- [ ] Extended historical paging beyond the current provider response window
- [ ] Volume-dependent indicators remain unavailable where the provider supplies no volume

## Trading / account
- [x] Market buy / sell in the development account
- [x] Balance, equity, used margin, free margin and margin level
- [x] Stop-loss / take-profit entry and modification
- [x] Full close, partial close and sequential close-all
- [x] Order history, CSV export and searchable account journal
- [ ] Buy/Sell Limit, Buy/Sell Stop and Stop-Limit pending orders
- [ ] Close-by, hedging/netting account modes and full order/position modification parity
- [ ] Trusted live execution-quote updates and automatic SL/TP triggering in persistent accounts
- [ ] Real MT5 broker connection and live order routing

## MT5 terminal services
- [ ] News feed
- [ ] Economic calendar
- [ ] Mailbox / broker messages
- [ ] Community chat
- [ ] Trading applications / marketplace
- [ ] Full MT5 journal and terminal diagnostics beyond the HikeyFX account event journal
- [x] Workspace settings for timeframe, chart type, quote sorting and notifications

## Release gates
- [x] Backend and frontend syntax checks in CI
- [x] Automated tests for chart indicators, market data validation, trade modifications, partial closes and journal access
- [ ] Apply and verify migrations 0011–0013 in the connected Supabase project
- [ ] Complete end-to-end Android browser QA
- [ ] Complete security review and broker/legal readiness before any real-money activation

**Important:** HikeyFX currently remains a development-account application. TraderMade quotes and historical candles are informational market data; they are not a broker execution connection. No live trading, deposits or withdrawals are enabled.
