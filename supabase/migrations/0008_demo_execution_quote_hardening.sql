-- HikeyFX demo execution quote hardening.
-- Authenticated users may call Supabase RPCs directly. Never trust caller-supplied
-- execution prices, contract sizes or exit prices, even for demo trading.
-- This migration keeps execution demo-only and uses fixed illustrative quotes.

create table public.demo_execution_quotes (
  symbol text primary key references public.instruments(symbol) on update cascade on delete restrict,
  bid numeric(24,10) not null check (bid > 0),
  ask numeric(24,10) not null check (ask > bid),
  contract_size numeric(20,4) not null check (contract_size > 0),
  updated_at timestamptz not null default now()
);

insert into public.demo_execution_quotes(symbol,bid,ask,contract_size) values
  ('EURUSD',1.08490,1.08502,100000),
  ('GBPUSD',1.27110,1.27125,100000),
  ('AUDUSD',0.65410,0.65422,100000),
  ('XAUUSD',2340.10,2340.35,100)
on conflict(symbol) do update set
  bid=excluded.bid, ask=excluded.ask,
  contract_size=excluded.contract_size, updated_at=now();

alter table public.demo_execution_quotes enable row level security;
revoke all on table public.demo_execution_quotes from public, anon, authenticated;

create or replace function public.hikeyfx_demo_place_order(
  p_symbol text, p_side public.order_side, p_volume numeric,
  p_entry_price numeric, p_contract_size numeric,
  p_idempotency_key text,
  p_stop_loss numeric default null, p_take_profit numeric default null,
  p_leverage integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_instrument_id uuid;
  v_bid numeric(24,10);
  v_ask numeric(24,10);
  v_contract_size numeric(20,4);
  v_entry_price numeric(24,10);
  v_cash numeric(20,2);
  v_used numeric(20,2);
  v_margin numeric(20,2);
  v_position public.demo_positions%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_leverage constant integer := 100;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'A valid idempotency key is required';
  end if;
  if p_volume is null or p_volume < 0.01 or p_volume > 10
     or p_volume * 100 <> trunc(p_volume * 100)
     or p_side not in ('buy','sell') then
    raise exception 'Invalid demo order parameters';
  end if;

  v_account_id := public.bootstrap_member();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_account_id::text || p_idempotency_key, 0)
  );
  select k.response_body into v_cached
    from public.demo_idempotency_keys k
   where k.account_id=v_account_id and k.idempotency_key=p_idempotency_key;
  if v_cached is not null then return v_cached; end if;

  select i.id,q.bid,q.ask,q.contract_size
    into v_instrument_id,v_bid,v_ask,v_contract_size
    from public.instruments i
    join public.demo_execution_quotes q on q.symbol=i.symbol
   where i.symbol=upper(p_symbol) and i.is_enabled=true;
  if v_instrument_id is null then
    raise exception 'Instrument is not enabled for demo trading';
  end if;

  -- Ignore p_entry_price, p_contract_size and p_leverage. These legacy RPC
  -- parameters are retained for compatibility but are never trusted.
  v_entry_price := case when p_side='buy' then v_ask else v_bid end;

  if p_stop_loss is not null and
     ((p_side='buy' and p_stop_loss >= v_entry_price) or
      (p_side='sell' and p_stop_loss <= v_entry_price)) then
    raise exception 'Stop loss is on the wrong side of entry';
  end if;
  if p_take_profit is not null and
     ((p_side='buy' and p_take_profit <= v_entry_price) or
      (p_side='sell' and p_take_profit >= v_entry_price)) then
    raise exception 'Take profit is on the wrong side of entry';
  end if;

  select b.cash_balance into v_cash
    from public.demo_account_balances b
   where b.account_id=v_account_id for update;
  select coalesce(sum(p.reserved_margin),0) into v_used
    from public.demo_positions p
   where p.account_id=v_account_id and p.status='open';
  v_margin := round((p_volume*v_contract_size*v_entry_price)/v_leverage,2);
  if v_margin > v_cash-v_used then
    raise exception 'Insufficient demo free margin';
  end if;

  insert into public.demo_positions(
    account_id,instrument_id,side,volume,entry_price,stop_loss,
    take_profit,contract_size,reserved_margin
  ) values (
    v_account_id,v_instrument_id,p_side,p_volume,v_entry_price,
    p_stop_loss,p_take_profit,v_contract_size,v_margin
  ) returning * into v_position;

  insert into public.demo_trade_events(account_id,position_id,event_type,event_data)
  values(v_account_id,v_position.id,'opened',jsonb_build_object(
    'symbol',upper(p_symbol),'side',p_side,'volume',p_volume,
    'entryPrice',v_entry_price,'quoteSource','fixed-demo'
  ));

  v_result := jsonb_build_object(
    'id',v_position.id,'symbol',upper(p_symbol),'side',p_side,
    'volume',p_volume,'entryPrice',v_entry_price,
    'stopLoss',p_stop_loss,'takeProfit',p_take_profit,
    'margin',v_margin,'openedAt',v_position.opened_at,'status','open'
  );
  insert into public.demo_idempotency_keys(account_id,idempotency_key,response_body)
  values(v_account_id,p_idempotency_key,v_result);
  return v_result;
end;
$$;

create or replace function public.hikeyfx_demo_close_position(
  p_position_id uuid, p_exit_price numeric, p_reason text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_position public.demo_positions%rowtype;
  v_symbol text;
  v_bid numeric(24,10);
  v_ask numeric(24,10);
  v_exit_price numeric(24,10);
  v_pnl numeric(20,2);
  v_new_balance numeric(20,2);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_account_id := public.bootstrap_member();
  select * into v_position
    from public.demo_positions
   where id=p_position_id and account_id=v_account_id and status='open'
   for update;
  if not found then raise exception 'Open demo position not found'; end if;

  select i.symbol,q.bid,q.ask into v_symbol,v_bid,v_ask
    from public.instruments i
    join public.demo_execution_quotes q on q.symbol=i.symbol
   where i.id=v_position.instrument_id and i.is_enabled=true;
  if v_symbol is null then raise exception 'Demo execution quote unavailable'; end if;

  -- Ignore caller-supplied p_exit_price. Exit is fixed by the protected quote row.
  v_exit_price := case when v_position.side='buy' then v_bid else v_ask end;
  v_pnl := round((v_exit_price-v_position.entry_price)
    * case when v_position.side='buy' then 1 else -1 end
    * v_position.contract_size*v_position.volume,2);

  update public.demo_account_balances
     set cash_balance=greatest(0,cash_balance+v_pnl),
         version=version+1,updated_at=now()
   where account_id=v_account_id
   returning cash_balance into v_new_balance;

  update public.demo_positions
     set status='closed',closed_at=now(),exit_price=v_exit_price,
         realised_pnl=v_pnl,close_reason=left(coalesce(p_reason,'manual'),40)
   where id=v_position.id;

  insert into public.demo_trade_events(account_id,position_id,event_type,event_data)
  values(v_account_id,v_position.id,'closed',jsonb_build_object(
    'symbol',v_symbol,'exitPrice',v_exit_price,'realisedPnl',v_pnl,
    'reason',p_reason,'quoteSource','fixed-demo'
  ));

  return jsonb_build_object(
    'id',v_position.id,'symbol',v_symbol,'side',v_position.side,
    'volume',v_position.volume,'entryPrice',v_position.entry_price,
    'exitPrice',v_exit_price,'realisedPnl',v_pnl,
    'closeReason',p_reason,'closedAt',now(),'status','closed',
    'balance',v_new_balance
  );
end;
$$;

revoke all on function public.hikeyfx_demo_place_order(text,public.order_side,numeric,numeric,numeric,text,numeric,numeric,integer) from public, anon;
revoke all on function public.hikeyfx_demo_close_position(uuid,numeric,text) from public, anon;
grant execute on function public.hikeyfx_demo_place_order(text,public.order_side,numeric,numeric,numeric,text,numeric,numeric,integer) to authenticated;
grant execute on function public.hikeyfx_demo_close_position(uuid,numeric,text) to authenticated;

comment on table public.demo_execution_quotes is
  'Protected fixed illustrative demo quotes. No authenticated client may read or change execution prices.';
