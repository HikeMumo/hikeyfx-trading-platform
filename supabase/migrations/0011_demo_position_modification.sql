-- Add authenticated, account-scoped modification of open demo position protection.
-- Execution remains demo-only and uses protected quote rows; clients never supply prices.

create or replace function public.hikeyfx_demo_modify_position(
  p_position_id uuid,
  p_stop_loss numeric default null,
  p_take_profit numeric default null
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
  v_current_price numeric(24,10);
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_position_id is null then raise exception 'Position ID is required'; end if;

  if p_stop_loss is not null and
     (p_stop_loss <= 0 or p_stop_loss::text in ('NaN','Infinity','-Infinity')) then
    raise exception 'Invalid stop loss';
  end if;
  if p_take_profit is not null and
     (p_take_profit <= 0 or p_take_profit::text in ('NaN','Infinity','-Infinity')) then
    raise exception 'Invalid take profit';
  end if;

  v_account_id := public.bootstrap_member();
  select * into v_position
    from public.demo_positions
   where id=p_position_id and account_id=v_account_id and status='open'
   for update;
  if not found then raise exception 'Open demo position not found'; end if;

  select i.symbol,q.bid,q.ask
    into v_symbol,v_bid,v_ask
    from public.instruments i
    join public.demo_execution_quotes q on q.symbol=i.symbol
   where i.id=v_position.instrument_id and i.is_enabled=true;
  if v_symbol is null then raise exception 'Demo execution quote unavailable'; end if;

  v_current_price := case when v_position.side='buy' then v_bid else v_ask end;
  if p_stop_loss is not null and
     ((v_position.side='buy' and p_stop_loss >= v_current_price) or
      (v_position.side='sell' and p_stop_loss <= v_current_price)) then
    raise exception 'Stop loss is on the wrong side of current price';
  end if;
  if p_take_profit is not null and
     ((v_position.side='buy' and p_take_profit <= v_current_price) or
      (v_position.side='sell' and p_take_profit >= v_current_price)) then
    raise exception 'Take profit is on the wrong side of current price';
  end if;

  update public.demo_positions
     set stop_loss=p_stop_loss,take_profit=p_take_profit
   where id=v_position.id
   returning * into v_position;

  insert into public.demo_trade_events(account_id,position_id,event_type,event_data)
  values(v_account_id,v_position.id,'adjustment',jsonb_build_object(
    'symbol',v_symbol,'stopLoss',p_stop_loss,'takeProfit',p_take_profit,
    'validationPrice',v_current_price
  ));

  return jsonb_build_object(
    'id',v_position.id,'symbol',v_symbol,'side',v_position.side,
    'volume',v_position.volume,'entryPrice',v_position.entry_price,
    'stopLoss',v_position.stop_loss,'takeProfit',v_position.take_profit,
    'status',v_position.status,'modifiedAt',now()
  );
end;
$$;

revoke all on function public.hikeyfx_demo_modify_position(uuid,numeric,numeric) from public, anon;
grant execute on function public.hikeyfx_demo_modify_position(uuid,numeric,numeric) to authenticated;

comment on function public.hikeyfx_demo_modify_position(uuid,numeric,numeric) is
  'Modifies stop-loss and take-profit on the authenticated member own open demo position using protected demo quotes.';
