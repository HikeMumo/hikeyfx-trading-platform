import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("persistent demo migration defines member-scoped authenticated RPCs", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0006_persistent_demo_trading.sql", import.meta.url), "utf8");
  for (const name of ["hikeyfx_demo_snapshot", "hikeyfx_demo_place_order", "hikeyfx_demo_close_position"]) {
    assert.match(sql, new RegExp("create or replace function public\\." + name + "\\("));
  }
  assert.equal((sql.match(/security definer/gi) || []).length, 3);
  assert.equal((sql.match(/set search_path = ''/gi) || []).length, 3);
  assert.ok(sql.includes("auth.uid()"));
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /demo_idempotency_keys/);
  assert.ok(sql.includes("grant execute on function public.hikeyfx_demo_place_order"));
  assert.match(sql, /from public, anon/);
});

test("Supabase repository forwards only the member JWT and publishable key to RPC", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  try {
    const { createSupabaseDemoRepository } = await import("../src/supabase.mjs?repository-test");
    const requests = [];
    const repository = createSupabaseDemoRepository({
      fetchImpl: async (url, options) => {
        requests.push({ url: String(url), options });
        return Response.json({ accountId: "account-1", balance: 10000, positions: [], history: [] });
      }
    });
    const result = await repository.placeOrder("member-jwt", {
      symbol: "EURUSD", side: "buy", volume: 0.01, entryPrice: 1.085,
      contractSize: 100000, idempotencyKey: "test-order-key-001"
    });
    assert.equal(result.accountId, "account-1");
    assert.ok(requests[0].url.endsWith("/rpc/hikeyfx_demo_place_order_v2"));
    assert.equal(requests[0].options.headers.apikey, "sb_publishable_test");
    assert.equal(requests[0].options.headers.authorization, "Bearer member-jwt");
    const body = JSON.parse(requests[0].options.body);
    assert.equal(body.p_idempotency_key, "test-order-key-001");
    assert.equal(body.p_symbol, "EURUSD");
    assert.equal(body.p_side, "buy");
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});


test("demo execution migration ignores caller-supplied entry, contract and exit prices", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0008_demo_execution_quote_hardening.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.demo_execution_quotes/);
  assert.match(sql, /revoke all on function public\.hikeyfx_demo_place_order\(/);
  assert.match(sql, /revoke all on function public\.hikeyfx_demo_close_position\(/);
  assert.match(sql, /revoke all on table public\.demo_execution_quotes from public, anon, authenticated/);
  assert.match(sql, /join public\.demo_execution_quotes q on q\.symbol=i\.symbol/);
  const place = sql.slice(sql.indexOf("create or replace function public.hikeyfx_demo_place_order_v2"), sql.indexOf("create or replace function public.hikeyfx_demo_close_position_v2"));
  const close = sql.slice(sql.indexOf("create or replace function public.hikeyfx_demo_close_position_v2"));
  assert.match(place, /v_entry_price := case when p_side='buy' then v_ask else v_bid end/);
  assert.match(place, /v_contract_size numeric/);
  assert.doesNotMatch(place, /v_entry_price\s*:=\s*p_entry_price/i);
  assert.doesNotMatch(place, /v_contract_size\s*:=\s*p_contract_size/i);
  assert.match(close, /v_exit_price := case when v_position\.side='buy' then v_bid else v_ask end/);
  assert.doesNotMatch(close, /v_exit_price\s*:=\s*p_exit_price/i);
  assert.match(close, /Invalid demo close reason/);
  assert.match(sql, /security definer/);
  assert.match(sql, /grant execute on function public\.hikeyfx_demo_place_order_v2/);
  assert.match(sql, /grant execute on function public\.hikeyfx_demo_close_position_v2/);
  assert.match(sql, /set search_path = ''/);
});

test("Supabase repository converts network failures to retryable service-unavailable errors", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  try {
    const { createSupabaseDemoRepository } = await import("../src/supabase.mjs?network-failure-test");
    const repository = createSupabaseDemoRepository({ fetchImpl: async () => { throw new Error("socket closed"); } });
    await assert.rejects(repository.snapshot("member-jwt"), error => error.statusCode === 503);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});

test("Supabase RPC preserves retryable upstream status codes", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  try {
    const { createSupabaseDemoRepository } = await import("../src/supabase.mjs?status-test");
    const unavailable = createSupabaseDemoRepository({ fetchImpl: async () => new Response("{}", { status: 503 }) });
    const rateLimited = createSupabaseDemoRepository({ fetchImpl: async () => new Response("{}", { status: 429 }) });
    await assert.rejects(unavailable.snapshot("member-jwt"), error => error.statusCode === 503);
    await assert.rejects(rateLimited.snapshot("member-jwt"), error => error.statusCode === 429);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});

test("admin migration restricts operational overview to active admin memberships", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0007_admin_access_foundation.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("create table public.admin_memberships"));
  assert.ok(sql.includes("alter table public.admin_memberships enable row level security"));
  assert.ok(sql.includes("m.user_id=v_uid and m.is_active=true"));
  assert.ok(sql.includes("Administrator access required"));
  assert.ok(sql.includes("grant execute on function public.hikeyfx_admin_overview() to authenticated"));
  assert.ok(sql.includes("revoke all on function public.hikeyfx_admin_overview() from public, anon"));
});

test("position modification migration is account-scoped and validates against protected quotes", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0011_demo_position_modification.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.hikeyfx_demo_modify_position/);
  assert.match(sql, /security definer/);
  assert.match(sql, /v_account_id := public\.bootstrap_member\(\)/);
  assert.match(sql, /account_id=v_account_id and status='open'/);
  assert.match(sql, /join public\.demo_execution_quotes q on q\.symbol=i\.symbol/);
  assert.match(sql, /Stop loss is on the wrong side of current price/);
  assert.match(sql, /Take profit is on the wrong side of current price/);
  assert.match(sql, /event_type,event_data\)\s*values\(v_account_id,v_position\.id,'adjustment'/);
  assert.match(sql, /revoke all on function public\.hikeyfx_demo_modify_position/);
  assert.match(sql, /grant execute on function public\.hikeyfx_demo_modify_position/);
  assert.match(sql, /set search_path = ''/);
});

test("Supabase repository forwards position protection changes to the scoped RPC", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  const requests = [];
  try {
    const { createSupabaseDemoRepository } = await import("../src/supabase.mjs?modify-position-test");
    const repository = createSupabaseDemoRepository({ fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return new Response(JSON.stringify({ id: "position-1", status: "open" }), { status: 200 });
    }});
    const result = await repository.modifyPosition("member-jwt", "position-1", { stopLoss: 1.08, takeProfit: null });
    assert.equal(result.id, "position-1");
    assert.match(requests[0].url, /rpc\/hikeyfx_demo_modify_position$/);
    assert.equal(requests[0].options.headers.authorization, "Bearer member-jwt");
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      p_position_id: "position-1", p_stop_loss: 1.08, p_take_profit: null
    });
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});

test("partial close migration uses protected quotes and preserves the remaining position", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0012_demo_partial_close.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.hikeyfx_demo_partial_close_position/);
  assert.match(sql, /security definer/);
  assert.match(sql, /account_id=v_account_id and status='open'/);
  assert.match(sql, /join public\.demo_execution_quotes q on q\.symbol=i\.symbol/);
  assert.match(sql, /v_remaining := v_position\.volume-p_volume/);
  assert.match(sql, /set volume=v_remaining/);
  assert.match(sql, /'closedVolume',p_volume/);
  assert.match(sql, /'remainingVolume',v_remaining/);
  assert.match(sql, /revoke all on function public\.hikeyfx_demo_partial_close_position/);
  assert.match(sql, /grant execute on function public\.hikeyfx_demo_partial_close_position/);
});

test("Supabase repository forwards partial close requests to the authenticated RPC", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  const requests = [];
  try {
    const { createSupabaseDemoRepository } = await import("../src/supabase.mjs?partial-close-test");
    const repository = createSupabaseDemoRepository({ fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return new Response(JSON.stringify({ positionId: "position-1", status: "partial_closed" }), { status: 200 });
    }});
    const result = await repository.partialClosePosition("member-jwt", "position-1", 0.04);
    assert.equal(result.status, "partial_closed");
    assert.match(requests[0].url, /rpc\/hikeyfx_demo_partial_close_position$/);
    assert.equal(requests[0].options.headers.authorization, "Bearer member-jwt");
    assert.deepEqual(JSON.parse(requests[0].options.body), { p_position_id: "position-1", p_volume: 0.04 });
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
