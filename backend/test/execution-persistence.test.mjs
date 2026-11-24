import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("pre-submission failure releases only the still-reserved idempotency key", async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  const requests = [];
  try {
    const { createSupabaseExecutionRepository } = await import("../src/execution-persistence.mjs?safe-release-test");
    const repository = createSupabaseExecutionRepository({
      fetchImpl: async (url, options) => {
        requests.push({ url: String(url), options });
        return new Response("true", { status: 200, headers: { "content-type": "application/json" } });
      }
    });
    await repository.fail("member-1", "idempotency-123");
    assert.match(requests[0].url, /rpc\/hikeyfx_execution_idempotency_release$/);
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      p_user_id: "member-1", p_key: "idempotency-123"
    });
    assert.equal(requests[0].options.headers.authorization, "Bearer service-role-test");
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test("safe release migration cannot delete unknown or completed idempotency keys", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0018_execution_idempotency_safe_release.sql", import.meta.url), "utf8");
  assert.match(sql, /delete from public\.execution_idempotency_keys/);
  assert.match(sql, /and state = 'reserved'/);
  assert.match(sql, /current_setting\('request\.jwt\.claim\.role', true\) <> 'service_role'/);
  assert.match(sql, /revoke all on function public\.hikeyfx_execution_idempotency_release/);
  assert.match(sql, /grant execute on function public\.hikeyfx_execution_idempotency_release\(uuid,text\)\s+to service_role/);
});
