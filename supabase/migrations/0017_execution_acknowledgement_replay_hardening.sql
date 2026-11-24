-- Harden provider acknowledgement idempotency and fill integrity.
-- A provider order acknowledgement is persisted exactly once. Conflicting replays
-- are rejected; this function does not infer fills or fabricate execution data.

create or replace function public.hikeyfx_execution_record_acknowledgement(
  p_user_id uuid,
  p_account_id uuid,
  p_client_order_id uuid,
  p_provider_code text,
  p_provider_order_id text,
  p_symbol text,
  p_side text,
  p_requested_volume numeric,
  p_executed_volume numeric,
  p_average_fill_price numeric,
  p_status text,
  p_provider_execution_id text,
  p_executed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.execution_orders%rowtype;
  v_existing_fill public.execution_fills%rowtype;
  v_account_owner uuid;
  v_hash text;
  v_inserted integer;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Trusted execution service required';
  end if;

  if p_user_id is null or p_account_id is null or p_client_order_id is null
     or nullif(btrim(p_provider_code), '') is null
     or nullif(btrim(p_provider_order_id), '') is null
     or p_symbol !~ '^[A-Z0-9]{6,12}$'
     or p_side not in ('buy', 'sell')
     or p_status not in ('filled', 'partially_filled', 'rejected')
     or p_requested_volume is null or p_requested_volume <= 0
     or p_executed_volume is null or p_executed_volume < 0
     or p_executed_volume > p_requested_volume then
    raise exception 'Invalid execution acknowledgement';
  end if;

  if (p_status = 'rejected' and p_executed_volume <> 0)
     or (p_status = 'filled' and p_executed_volume <> p_requested_volume)
     or (p_status = 'partially_filled' and
         (p_executed_volume <= 0 or p_executed_volume >= p_requested_volume)) then
    raise exception 'Execution status and executed volume are inconsistent';
  end if;

  if p_executed_volume > 0 and
     (p_average_fill_price is null or p_average_fill_price <= 0
      or nullif(btrim(p_provider_execution_id), '') is null
      or p_executed_at is null) then
    raise exception 'A fill requires a positive price, provider execution ID and execution time';
  end if;

  select ta.user_id into v_account_owner
    from public.trading_accounts ta
   where ta.id = p_account_id
   for update;
  if v_account_owner is distinct from p_user_id then
    raise exception 'Trading account ownership mismatch';
  end if;

  insert into public.execution_orders(
    user_id, account_id, client_order_id, provider_code, provider_order_id,
    symbol, side, order_type, requested_volume, executed_volume,
    average_fill_price, status, reject_reason, updated_at
  ) values (
    p_user_id, p_account_id, p_client_order_id, p_provider_code, p_provider_order_id,
    p_symbol, p_side, 'market', p_requested_volume, p_executed_volume,
    p_average_fill_price, p_status, null, now()
  )
  on conflict (client_order_id) do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_order
    from public.execution_orders
   where client_order_id = p_client_order_id
   for update;

  if v_order.user_id <> p_user_id
     or v_order.account_id <> p_account_id
     or v_order.provider_code <> p_provider_code
     or v_order.provider_order_id <> p_provider_order_id
     or v_order.symbol <> p_symbol
     or v_order.side <> p_side
     or v_order.requested_volume <> p_requested_volume
     or v_order.executed_volume <> p_executed_volume
     or v_order.average_fill_price is distinct from p_average_fill_price
     or v_order.status <> p_status then
    raise exception 'Conflicting execution acknowledgement replay';
  end if;

  if p_executed_volume > 0 then
    if v_inserted = 0 then
      select * into v_existing_fill
        from public.execution_fills
       where provider_code = p_provider_code
         and provider_execution_id = p_provider_execution_id;
      if not found
         or v_existing_fill.order_id <> v_order.id
         or v_existing_fill.volume <> p_executed_volume
         or v_existing_fill.price <> p_average_fill_price
         or v_existing_fill.executed_at <> p_executed_at then
        raise exception 'Conflicting or incomplete provider fill replay';
      end if;
      return jsonb_build_object(
        'orderId', v_order.id, 'status', v_order.status, 'duplicate', true
      );
    end if;

    insert into public.execution_fills(
      order_id, provider_code, provider_execution_id, volume, price, executed_at
    ) values (
      v_order.id, p_provider_code, p_provider_execution_id,
      p_executed_volume, p_average_fill_price, p_executed_at
    );
  elsif v_inserted = 0 then
    return jsonb_build_object(
      'orderId', v_order.id, 'status', v_order.status, 'duplicate', true
    );
  end if;

  v_hash := pg_catalog.encode(
    public.digest(
      concat_ws('|', p_client_order_id::text, p_provider_order_id, p_status,
        p_executed_volume::text, coalesce(p_average_fill_price::text, '')),
      'sha256'
    ), 'hex'
  );

  insert into public.execution_events(
    user_id, account_id, order_id, event_type, event_sha256, safe_metadata
  ) values (
    p_user_id, p_account_id, v_order.id, 'provider_execution_acknowledgement',
    v_hash,
    jsonb_build_object(
      'providerCode', p_provider_code,
      'providerOrderId', p_provider_order_id,
      'status', p_status,
      'executedVolume', p_executed_volume
    )
  );

  return jsonb_build_object(
    'orderId', v_order.id, 'status', v_order.status, 'duplicate', false
  );
end;
$$;

revoke all on function public.hikeyfx_execution_record_acknowledgement(
  uuid,uuid,uuid,text,text,text,text,numeric,numeric,numeric,text,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.hikeyfx_execution_record_acknowledgement(
  uuid,uuid,uuid,text,text,text,text,numeric,numeric,numeric,text,text,timestamptz
) to service_role;
