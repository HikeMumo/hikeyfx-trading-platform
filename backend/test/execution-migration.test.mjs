import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("execution acknowledgement migration is service-role-only and replay-safe", async () => {
  const sql = await readFile(new URL("../../supabase/migrations/0017_execution_acknowledgement_replay_hardening.sql", import.meta.url), "utf8");
  assert.match(sql, /create or replace function public\.hikeyfx_execution_record_acknowledgement/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /current_setting\('request\.jwt\.claim\.role', true\) <> 'service_role'/);
  assert.match(sql, /on conflict \(client_order_id\) do nothing/);
  assert.match(sql, /Conflicting execution acknowledgement replay/);
  assert.match(sql, /Conflicting or incomplete provider fill replay/);
  assert.match(sql, /p_status = 'filled' and p_executed_volume <> p_requested_volume/);
  assert.match(sql, /p_status = 'partially_filled'/);
  assert.match(sql, /p_provider_execution_id/);
  assert.match(sql, /p_executed_at is null/);
  assert.match(sql, /grant execute on function public\.hikeyfx_execution_record_acknowledgement/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.hikeyfx_execution_record_acknowledgement[^;]*to authenticated/s);
});
