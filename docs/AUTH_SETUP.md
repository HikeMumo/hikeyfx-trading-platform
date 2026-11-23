# HikeyFX member authentication setup

This is a development-stage email/password authentication flow using Supabase Auth. It creates only a member profile and one demo trading account. It does not enable live accounts, deposits, withdrawals, or live trading.

## 1. Apply the database migration

Run `supabase/migrations/0004_member_bootstrap.sql` in the Supabase SQL Editor once. It creates `public.bootstrap_member()`, a restricted authenticated RPC that uses the signed-in user's `auth.uid()` and creates at most one demo account for that user.

## 2. Configure the browser client

Edit `auth/config.js`:
- Set `url` to the Supabase Project URL.
- Set `publishableKey` to the Supabase publishable key (or legacy anon public key if the project uses that format).

These are public browser values and are protected by RLS. Never put a Supabase secret key or service_role key in `auth/config.js`, HTML, JavaScript, GitHub Pages, or any browser bundle.

## 3. Configure Supabase Auth URLs

In Supabase Authentication URL Configuration, set the production/staging Site URL to the actual HikeyFX website origin. Add the exact deployed auth/portal callback URLs to Redirect URLs. Do not use an arbitrary wildcard in production.

For email confirmation, ensure the email provider is enabled and the confirmation email template redirects to an allowed URL. The sign-up page displays a confirmation message if Supabase does not return a session immediately.

## 4. Deploy and test

Deploy only the development branch to a private/staging preview first. Test:
- Sign-up with an email address you control.
- Email confirmation (if enabled).
- Sign-in and sign-out.
- Calling `bootstrap_member` while authenticated.
- Confirm one profile and one demo account are created for the signed-in user.
- Confirm a second call does not create a duplicate demo account.
- Confirm a different user cannot read another user's profile/account.

The current member portal remains a static preview until its session guard and real profile/account reads are implemented and tested. Do not represent the entire portal or trading workspace as integrated merely because authentication works.

## Security and launch limitations

The RPC is security-definer and grants execution only to the authenticated role. It creates only demo-mode accounts. The existing schema constrains `trading_accounts.mode` to `demo`. Review the function and RLS policies before production use; run integration tests and independent security review. HikeyFX is not currently an authorised broker. No real-money features may be activated without the required legal, regulatory, banking, provider, safeguarding, reconciliation, security and operational readiness.
