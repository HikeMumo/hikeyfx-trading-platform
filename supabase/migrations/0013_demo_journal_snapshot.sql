-- Include the authenticated member's append-only trade event journal in the demo snapshot.

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
  v_journal jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_account_id := public.bootstrap_member();

  select b.cash_balance into v_balance
    from public.demo_account_balances b where b.account_id=v_account_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'symbol',i.symbol,'side',p.side,'volume',p.volume,
    'entryPrice',p.entry_price,'stopLoss',p.stop_loss,'takeProfit',p.take_profit,
    'contractSize',p.contract_size,'margin',p.reserved_margin,
    'openedAt',p.opened_at,'status',p.status
  ) order by p.opened_at desc),'[]'::jsonb)
  into v_open
  from public.demo_positions p
  join public.instruments i on i.id=p.instrument_id
  where p.account_id=v_account_id and p.status='open';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'symbol',i.symbol,'side',p.side,'volume',p.volume,
    'entryPrice',p.entry_price,'exitPrice',p.exit_price,
    'realisedPnl',p.realised_pnl,'closeReason',p.close_reason,
    'openedAt',p.opened_at,'closedAt',p.closed_at,'status',p.status
  ) order by p.closed_at desc),'[]'::jsonb)
  into v_history
  from public.demo_positions p
  join public.instruments i on i.id=p.instrument_id
  where p.account_id=v_account_id and p.status='closed';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',e.id,'eventType',e.event_type,'eventData',e.event_data,
    'createdAt',e.created_at
  ) order by e.created_at desc),'[]'::jsonb)
  into v_journal
  from public.demo_trade_events e
  where e.account_id=v_account_id;

  return jsonb_build_object(
    'accountId',v_account_id,'currency','USD','mode','demo',
    'balance',v_balance,'positions',v_open,'history',v_history,'journal',v_journal
  );
end;
$$;

revoke all on function public.hikeyfx_demo_snapshot() from public, anon;
grant execute on function public.hikeyfx_demo_snapshot() to authenticated;

comment on function public.hikeyfx_demo_snapshot() is
  'Returns the authenticated member demo account, positions, history and append-only event journal.';
