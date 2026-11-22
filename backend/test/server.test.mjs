import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.mjs";

test("HTTP API exposes demo account and accepts validated demo orders", async t => {
  const server = createApp(undefined, undefined, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, "demo-only");

  const accountResponse = await fetch(base + "/api/v1/demo/account");
  const account = await accountResponse.json();
  assert.equal(account.data.balance, 10000);
  assert.equal(account.data.mode, "demo");

  const badOrder = await fetch(base + "/api/v1/demo/orders", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", volume: 0 })
  });
  assert.equal(badOrder.status, 400);

  const orderResponse = await fetch(base + "/api/v1/demo/orders", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", volume: 0.1 })
  });
  assert.equal(orderResponse.status, 201);
  const order = await orderResponse.json();
  assert.equal(order.data.status, "open");

  const positionsResponse = await fetch(base + "/api/v1/demo/positions");
  const positions = await positionsResponse.json();
  assert.equal(positions.data.length, 1);
  assert.equal(positions.data[0].id, order.data.id);

  const closeResponse = await fetch(base + `/api/v1/demo/positions/${order.data.id}/close`, { method: "POST" });
  assert.equal(closeResponse.status, 200);
  assert.equal((await closeResponse.json()).data.status, "closed");

  const historyResponse = await fetch(base + "/api/v1/demo/history");
  assert.equal((await historyResponse.json()).data.length, 1);
});

test("HTTP API returns 404 for unknown routes", async t => {
  const server = createApp(undefined, undefined, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/not-a-route`);
  assert.equal(response.status, 404);
});

test("HTTP API rejects malformed, non-object and non-JSON request bodies", async t => {
  const server = createApp(undefined, undefined, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    { body: "{", contentType: "application/json", expected: 400 },
    { body: "[]", contentType: "application/json", expected: 400 },
    { body: "{}", contentType: "text/plain", expected: 415 }
  ];
  for (const item of cases) {
    const response = await fetch(base + "/api/v1/demo/orders", {
      method: "POST",
      headers: { "content-type": item.contentType },
      body: item.body
    });
    assert.equal(response.status, item.expected);
    assert.equal((await response.json()).ok, false);
  }
});

test("HTTP API rejects request bodies larger than 16 KiB", async t => {
  const server = createApp(undefined, undefined, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/demo/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ padding: "x".repeat(17_000) })
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).ok, false);
});

test("HTTP API sends baseline hardening headers", async t => {
  const server = createApp(undefined, undefined, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});
