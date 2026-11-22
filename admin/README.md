# HikeyFX admin area

The admin page is a restricted, read-only operations overview. It uses Supabase Auth and the `hikeyfx_admin_overview()` RPC. A normal authenticated member cannot call the RPC unless an active row exists for their user ID in `public.admin_memberships`.

## Enable an administrator

1. Apply `supabase/migrations/0007_admin_access_foundation.sql` after migrations 0001–0006.
2. In Supabase Authentication, locate the intended administrator and copy their user UUID.
3. In the Supabase SQL editor, as the project owner, insert the approved UUID into `public.admin_memberships` with an approved role, for example `owner`, `operations`, `support`, or `risk`.
4. Never expose a browser action that can insert or update administrator memberships.

Example owner-controlled assignment (replace the UUID with the verified Auth user ID):

```sql
insert into public.admin_memberships (user_id, role)
values ('00000000-0000-0000-0000-000000000000', 'owner');
```

The dashboard exposes aggregate counts, recent member profile summaries and recent audit events only. It does not expose identity documents, credentials, payment destinations or financial controls. KYC decisions, payouts, deposits, live trading and account suspension actions are not implemented.
