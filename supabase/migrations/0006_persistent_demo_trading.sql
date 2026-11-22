-- HikeyFX persistent demo trading RPCs.
-- All functions derive the member identity from the verified Supabase JWT.
-- This migration does not enable live accounts, payments, deposits or withdrawals.

insert into public.instruments (symbol, display_name, asset_class, quote_currency, is_enabled)
values
  ('EURUSD','Euro / US Dollar','forex','USD',true),
  ('GBPUSD','British Pound / US Dollar','forex','USD',true),
  ('AUDUSD','Australian Dollar / US Dollar','forex','USD',true),
  ('USDJPY','US Dollar / Japanese Yen','forex','JPY',true),
  ('USDCHF','US Dollar / Swiss Franc','forex','CHF',true),
  ('XAUUSD','Gold / US Dollar','commodity','USD',true)
on conflict (symbol) do update set is_enabled = excluded.is_enabled;

create or replace function public.hikeyfx_demo_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_account_id uuid;
  v_balance numeric(20,2);
  v_open jsonb;
  v_history jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_account_id := public.bootstrap_member();
  select b.cash_balance into v_balance
    from public.demo_account_balances b where b.account_id = v_account_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'symbol',i.symbol,'side',p.side,'volume',p.volume,
    'entryPrice',p.entry_price,'stopLoss',p.stop_loss,'takeProfit',p.take_profit,
    'contractSize',p.contract_size,'margin',p.reserved_margin,
    'openedAt',p.opened_at,'status',p.status
  ) order by p.opened_at desc),'[]'::jsonb)
  into v_open
  from public.demo_positions p join public.instruments i on i.id=p.instrument_id
  where p.account_id=v_account_id and p.status='open';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'symbol',i.symbol,'side',p.side,'volume',p.volume,
    'entryPrice',p.entry_price,'exitPrice',p.exit_price,
    'realisedPnl',p.realised_pnl,'closeReason',p.close_reason,
    'openedAt',p.opened_at,'closedAt',p.closed_at,'status',p.status
  ) order by p.closed_at desc),'[]'::jsonb)
  into v_history
  from public.demo_positions p join public.instruments i on i.id=p.instrument_id
  where p.account_id=v_account_id and p.status='closed';
  return jsonb_build_object('accountId',v_account_id,'currency','USD',
    'mode','demo','balance',v_balance,'positions',v_open,'history',v_history);
end;
$$;

create or replace function public.hikeyfx_demo_place_order(
  p_symbol text, p_side public.order_side, p_volume numeric,
  p_entry_price numeric, p_contract_size numeric,
  p_stop_loss numeric default null, p_take_profit numeric default null,
  p_leverage integer default 100,
  p_idempotency_key text
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
  v_cash numeric(20,2);
  v_used numeric(20,2);
  v_margin numeric(20,2);
  v_position public.demo_positions%rowtype;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then raise exception 'A valid idempotency key is required'; end if;
  if p_side not in ('buy','sell') or p_volume < 0.01 or p_volume > 10
     or p_volume * 100 <> trunc(p_volume * 100)
     or p_entry_price <= 0 or p_contract_size <= 0
     or p_leverage < 1 or p_leverage > 500 then
    raise exception 'Invalid demo order parameters';
  end if;
  if p_stop_loss is not null and p_stop_loss <= 0 then raise exception 'Invalid stop loss'; end if;
  if p_take_profit is not null and p_take_profit <= 0 then raise exception 'Invalid take profit'; end if;
  if p_stop_loss is not null and ((p_side='buy' and p_stop_loss >= p_entry_price) or (p_side='sell' and p_stop_loss <= p_entry_price)) then
    raise exception 'Stop loss is on the wrong side of entry';
  end if;
  if p_take_profit is not null and ((p_side='buy' and p_take_profit <= p_entry_price) or (p_side='sell' and p_take_profit >= p_entry_price)) then
    raise exception 'Take profit is on the wrong side of entry';
  end if;
  v_account_id := public.bootstrap_member();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_account_id::text || p_idempotency_key, 0));
  select k.response_body into v_cached from public.demo_idempotency_keys k where k.account_id=v_account_id and k.idempotency_key=p_idempotency_key;
  if v_cached is not null then return v_cached; end if;
  select i.id into v_instrument_id from public.instruments i
   where i.symbol=upper(p_symbol) and i.is_enabled=true;
  if v_instrument_id is null then raise exception 'Instrument is not enabled for demo trading'; end if;
  select b.cash_balance into v_cash from public.demo_account_balances b
   where b.account_id=v_account_id for update;
  select coalesce(sum(p.reserved_margin),0) into v_used
   from public.demo_positions p where p.account_id=v_account_id and p.status='open';
  v_margin := round((p_volume*p_contract_size*p_entry_price)/p_leverage,2);
  if v_margin > v_cash-v_used then raise exception 'Insufficient demo free margin'; end if;
  insert into public.demo_positions(account_id,instrument_id,side,volume,entry_price,stop_loss,take_profit,contract_size,reserved_margin)
  values(v_account_id,v_instrument_id,p_side,p_volume,p_entry_price,p_stop_loss,p_take_profit,p_contract_size,v_margin)
  returning * into v_position;
  insert into public.demo_trade_events(account_id,position_id,event_type,event_data)
  values(v_account_id,v_position.id,'opened',jsonb_build_object('symbol',upper(p_symbol),'side',p_side,'volume',p_volume,'entryPrice',p_entry_price));
  v_result := jsonb_build_object('id',v_position.id,'symbol',upper(p_symbol),'side',p_side,
    'volume',p_volume,'entryPrice',p_entry_price,'stopLoss',p_stop_loss,
    'takeProfit',p_take_profit,'margin',v_margin,'openedAt',v_position.opened_at,'status','open');
  insert into public.demo_idempotency_keys(account_id,idempotency_key,response_body)
  values(v_account_id,p_idempotency_key,v_result);
  return v_result;
end;
$;

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
  v_pnl numeric(20,2);
  v_new_balance numeric(20,2);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_exit_price <= 0 then raise exception 'Invalid exit price'; end if;
  v_account_id := public.bootstrap_member();
  select * into v_position from public.demo_positions
   where id=p_position_id and account_id=v_account_id and status='open' for update;
  if not found then raise exception 'Open demo position not found'; end if;
  select i.symbol into v_symbol from public.instruments i where i.id=v_position.instrument_id;
  v_pnl := round((p_exit_price-v_position.entry_price)
    * case when v_position.side='buy' then 1 else -1 end
    * v_position.contract_size*v_position.volume,2);
  update public.demo_account_balances
     set cash_balance=greatest(0,cash_balance+v_pnl), version=version+1,updated_at=now()
   where account_id=v_account_id returning cash_balance into v_new_balance;
  update public.demo_positions set status='closed',closed_at=now(),exit_price=p_exit_price,
    realised_pnl=v_pnl,close_reason=left(coalesce(p_reason,'manual'),40)
   where id=v_position.id;
  insert into public.demo_trade_events(account_id,position_id,event_type,event_data)
  values(v_account_id,v_position.id,'closed',jsonb_build_object('symbol',v_symbol,'exitPrice',p_exit_price,'realisedPnl',v_pnl,'reason',p_reason));
  return jsonb_build_object('id',v_position.id,'symbol',v_symbol,'side',v_position.side,
    'volume',v_position.volume,'entryPrice',v_position.entry_price,'exitPrice',p_exit_price,
    'realisedPnl',v_pnl,'closeReason',p_reason,'closedAt',now(),'status','closed','balance',v_new_balance);
end;
$$;

revoke all on function public.hikeyfx_demo_snapshot() from public, anon;
revoke all on function public.hikeyfx_demo_place_order(text,public.order_side,numeric,numeric,numeric,numeric,numeric,integer,text) from public, anon;
revoke all on function public.hikeyfx_demo_close_position(uuid,numeric,text) from public, anon;
grant execute on function public.hikeyfx_demo_snapshot() to authenticated;
grant execute on function public.hikeyfx_demo_place_order(text,public.order_side,numeric,numeric,numeric,numeric,numeric,integer) to authenticated;
grant execute on function public.hikeyfx_demo_close_position(uuid,numeric,text) to authenticated;
