-- Add atomic, account-scoped partial close support for demo positions.
-- Exit prices are read from protected server-side demo quote rows, never caller input.

create or replace function public.hikeyfx_demo_partial_close_position(
  p_position_id uuid,
  p_volume numeric
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
  v_released_margin numeric(20,2);
  v_new_balance numeric(20,2);
  v_remaining numeric(16,4);
  v_closed public.demo_positions%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_position_id is null or p_volume is null or p_volume < 0.01
     or p_volume * 100 <> trunc(p_volume * 100) then
    raise exception 'Invalid partial close volume';
  end if;

  v_account_id := public.bootstrap_member();
  select * into v_position
    from public.demo_positions
   where id=p_position_id and account_id=v_account_id and status='open'
   for update;
  if not found then raise exception 'Open demo position not found'; end if;
  if p_volume >= v_position.volume or v_position.volume-p_volume < 0.01 then
    raise exception 'Partial close must leave at least 0.01 lots open';
  end if;

  select i.symbol,q.bid,q.ask into v_symbol,v_bid,v_ask
    from public.instruments i
    join public.demo_execution_quotes q on q.symbol=i.symbol
   where i.id=v_position.instrument_id and i.is_enabled=true;
  if v_symbol is null then raise exception 'Demo execution quote unavailable'; end if;

  v_exit_price := case when v_position.side='buy' then v_bid else v_ask end;
  v_pnl := round((v_exit_price-v_position.entry_price)
    * case when v_position.side='buy' then 1 else -1 end
    * v_position.contract_size*p_volume,2);
  v_released_margin := round(v_position.reserved_margin*p_volume/v_position.volume,2);
  v_remaining := v_position.volume-p_volume;

  update public.demo_account_balances
     set cash_balance=greatest(0,cash_balance+v_pnl),
         version=version+1,updated_at=now()
   where account_id=v_account_id returning cash_balance into v_new_balance;

  update public.demo_positions
     set volume=v_remaining,
         reserved_margin=greatest(0,reserved_margin-v_released_margin)
   where id=v_position.id;

  insert into public.demo_positions(
    account_id,instrument_id,side,volume,entry_price,stop_loss,take_profit,
    contract_size,reserved_margin,status,opened_at,closed_at,exit_price,
    realised_pnl,close_reason
  ) values (
    v_account_id,v_position.instrument_id,v_position.side,p_volume,
    v_position.entry_price,v_position.stop_loss,v_position.take_profit,
    v_position.contract_size,0,'closed',v_position.opened_at,now(),
    v_exit_price,v_pnl,'partial'
  ) returning * into v_closed;

  insert into public.demo_trade_events(account_id,position_id,event_type,event_data)
  values(v_account_id,v_position.id,'closed',jsonb_build_object(
    'symbol',v_symbol,'closedPositionId',v_closed.id,'closedVolume',p_volume,
    'remainingVolume',v_remaining,'exitPrice',v_exit_price,
    'realisedPnl',v_pnl,'reason','partial','quoteSource','fixed-demo'
  ));

  return jsonb_build_object(
    'positionId',v_position.id,'closedPositionId',v_closed.id,
    'symbol',v_symbol,'side',v_position.side,'closedVolume',p_volume,
    'remainingVolume',v_remaining,'exitPrice',v_exit_price,
    'realisedPnl',v_pnl,'balance',v_new_balance,'status','partial_closed'
  );
end;
$$;

revoke all on function public.hikeyfx_demo_partial_close_position(uuid,numeric) from public, anon;
grant execute on function public.hikeyfx_demo_partial_close_position(uuid,numeric) to authenticated;

comment on function public.hikeyfx_demo_partial_close_position(uuid,numeric) is
  'Atomically closes part of the authenticated member own demo position using protected fixed demo quotes.';
