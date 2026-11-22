# Phase 1 Trading Workspace QA Checklist

This is a manual verification checklist. Items are not marked passed until tested in a browser.

## Layout
- [ ] Open at 360px, 390px, 430px, tablet and desktop widths.
- [ ] Confirm market list, chart and order ticket remain readable without horizontal overflow.
- [ ] Confirm chart redraws after resizing and orientation changes.
- [ ] Confirm focus states and labels are usable on touch and keyboard.

## Market list
- [ ] Select each asset class filter.
- [ ] Search by symbol and display name.
- [ ] Select instruments across all three categories.
- [ ] Confirm the selected instrument is reflected in the chart header and order ticket.

## Chart
- [ ] Select each timeframe.
- [ ] Toggle moving average on and off.
- [ ] Toggle RSI label on and off.
- [ ] Confirm chart clearly states that the displayed data is sample data.
- [ ] Confirm chart does not claim to be a live feed.

## Demo ticket
- [ ] Change buy/sell side.
- [ ] Reject zero, negative, empty and excessive volume.
- [ ] Confirm limit and stop order types do not submit.
- [ ] Confirm demo market order adds a position.
- [ ] Close a position and confirm it appears in order history.
- [ ] Confirm no network request, payment, broker API call or real order is triggered.
- [ ] Confirm balance and order state reset on page refresh as documented.

## Release gates
- [ ] Review browser console for errors.
- [ ] Run an HTML and JavaScript syntax validation.
- [ ] Test on Android Chrome and a desktop browser.
- [ ] Review accessibility and security before linking this page from the public homepage.
- [ ] Keep real trading, deposits and withdrawals disabled.
