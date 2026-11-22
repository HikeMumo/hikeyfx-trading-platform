-- A journal can only be posted when it has at least two entries, every entry uses
-- the journal currency, and total debits equal total credits.
create function public.validate_ledger_journal_posting()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  entry_count bigint;
  debit_total numeric(24, 2);
  credit_total numeric(24, 2);
  wrong_currency_count bigint;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Ledger journals must be created as drafts';
    end if;
    return new;
  end if;

  if old.status <> 'draft' then
    raise exception 'Posted ledger journals are immutable; create a separate reversal journal';
  end if;

  if new.status = 'posted' then
    select count(*),
           coalesce(sum(case when e.side = 'debit' then e.amount else 0 end), 0),
           coalesce(sum(case when e.side = 'credit' then e.amount else 0 end), 0),
           count(*) filter (where e.currency <> new.currency)
      into entry_count, debit_total, credit_total, wrong_currency_count
      from public.ledger_entries e
     where e.journal_id = new.id;

    if entry_count < 2 then
      raise exception 'A posted ledger journal requires at least two entries';
    end if;
    if wrong_currency_count <> 0 then
      raise exception 'All ledger entries must use the journal currency';
    end if;
    if debit_total <> credit_total then
      raise exception 'Ledger journal is not balanced: debits % credits %', debit_total, credit_total;
    end if;
    new.posted_at := coalesce(new.posted_at, now());
  end if;
  return new;end;
$$;

create trigger ledger_journal_posting_guard
before insert or update of status on public.ledger_journals
for each row execute function public.validate_ledger_journal_posting();

create function public.reject_posted_ledger_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_journal_id uuid;
  journal_state public.ledger_journal_status;
  account_currency char(3);
  journal_currency char(3);
begin
  if tg_op in ('UPDATE', 'DELETE') then
    target_journal_id := old.journal_id;
    select j.status into journal_state
      from public.ledger_journals j
     where j.id = target_journal_id;
    if journal_state is distinct from 'draft' then
      raise exception 'Entries for posted or missing journals cannot be changed';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select j.status, j.currency into journal_state, journal_currency
      from public.ledger_journals j
     where j.id = new.journal_id;
    if journal_state is distinct from 'draft' then
      raise exception 'Entries can only be added to draft journals';
    end if;

    select a.currency into account_currency
      from public.ledger_accounts a
     where a.id = new.ledger_account_id;
    if account_currency is distinct from new.currency or journal_currency is distinct from new.currency then
      raise exception 'Ledger entry, ledger account, and journal currencies must match';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function public.reject_posted_journal_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Posted ledger journals are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger ledger_journals_immutable_after_post
before update or delete on public.ledger_journals
for each row execute function public.reject_posted_journal_mutation();

create trigger ledger_entries_draft_only
before insert or update or delete on public.ledger_entries
for each row execute function public.reject_posted_ledger_mutation();
