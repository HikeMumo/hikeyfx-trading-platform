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
    assert.ok(requests[0].url.endsWith("/rpc/hikeyfx_demo_place_order"));
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


test("admin migration restricts operational overview to active admin memberships", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0007_admin_access_foundation.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("create table public.admin_memberships"));
  assert.ok(sql.includes("alter table public.admin_memberships enable row level security"));
  assert.ok(sql.includes("m.user_id=v_uid and m.is_active=true"));
  assert.ok(sql.includes("Administrator access required"));
  assert.ok(sql.includes("grant execute on function public.hikeyfx_admin_overview() to authenticated"));
  assert.ok(sql.includes("revoke all on function public.hikeyfx_admin_overview() from public, anon"));
});
