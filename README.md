# HikeyFX Trading Platform

This repository is the separate project for the new HikeyFX trading platform.

## Starting point

The site must retain the latest HikeyFX website supplied on 22 November 2026, including its luxury hero video and embedded trading-analysis video. The original website is being separated into:
- `index.html`
- `assets/luxury-hero.mp4`
- `assets/trading-analysis.mp4`

The two video files are referenced locally by `index.html`; keep the paths unchanged when uploading.

## Planned platform integrations

- Twelve Data: market data (API key must be stored server-side, never in browser HTML or committed to Git).
- TradingView Lightweight Charts: chart rendering.
- Secure authentication/backend: required for real user accounts.
- Broker execution API: separately required for placing real trades. Market-data access alone does not execute orders.

## Security

Do not commit API keys, passwords, access tokens, service-role keys, or other secrets. Configure provider credentials as server-side environment variables after a backend has been selected.

## Current status

The repository is initialized. The latest supplied website and its video assets are prepared for upload; live market data, authentication, and broker execution are not yet configured.
