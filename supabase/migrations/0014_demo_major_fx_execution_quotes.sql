-- Extend fixed illustrative demo execution quotes to the two enabled major FX pairs.
-- Live TraderMade quotes remain informational and are not used for demo execution.

insert into public.demo_execution_quotes(symbol,bid,ask,contract_size) values
  ('USDJPY',149.610,149.630,100000),
  ('USDCHF',0.88404,0.88416,100000)
on conflict(symbol) do update set
  bid=excluded.bid,
  ask=excluded.ask,
  contract_size=excluded.contract_size,
  updated_at=now();

comment on table public.demo_execution_quotes is
  'Protected fixed illustrative demo quotes. No authenticated client may read or change execution prices.';
