-- Release an idempotency reservation only when the gateway knows no
-- counterparty submission was attempted. Unknown outcomes are never released.
create or replace function public.hikeyfx_execution_idempotency_release(
  p_user_id uuid,
  p_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'Trusted execution service required';
  end if;
  if p_user_id is null or p_key is null or length(p_key) < 8 or length(p_key) > 128 then
    raise exception 'Invalid execution idempotency release request';
  end if;

  delete from public.execution_idempotency_keys
   where user_id = p_user_id
     and idempotency_key = p_key
     and state = 'reserved';

  return found;
end;
$$;

revoke all on function public.hikeyfx_execution_idempotency_release(uuid,text)
  from public, anon, authenticated;
grant execute on function public.hikeyfx_execution_idempotency_release(uuid,text)
  to service_role;
