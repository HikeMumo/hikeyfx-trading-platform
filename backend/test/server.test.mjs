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


test("HTTP API supports browser CORS preflight for authenticated API requests", async t => {
  const server = createApp(undefined, undefined, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/demo/orders`, {
    method: "OPTIONS",
    headers: {
      origin: "https://hikeyfx.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type"
    }
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  assert.match(response.headers.get("access-control-allow-headers"), /Authorization/i);
});


test("HTTP API keeps demo accounts and positions isolated by authenticated member", async t => {
  const server = createApp(null, undefined, async req => ({ id: req.headers["x-test-user"] }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const forUser = user => ({ headers: { "x-test-user": user } });
  const userAOrder = await fetch(base + "/api/v1/demo/orders", {
    method: "POST",
    headers: { "x-test-user": "member-a", "content-type": "application/json" },
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", volume: 0.1 })
  });
  assert.equal(userAOrder.status, 201);
  const userAPositions = await fetch(base + "/api/v1/demo/positions", forUser("member-a"));
  assert.equal((await userAPositions.json()).data.length, 1);
  const userBPositions = await fetch(base + "/api/v1/demo/positions", forUser("member-b"));
  assert.equal((await userBPositions.json()).data.length, 0);
  const userBAccount = await fetch(base + "/api/v1/demo/account", forUser("member-b"));
  const account = await userBAccount.json();
  assert.equal(account.data.balance, 10000);
  assert.equal(account.data.usedMargin, 0);
});


test("authenticated API uses persistent repository when a bearer token is present", async t => {
  const calls = [];
  const repository = {
    snapshot: async token => { calls.push(["snapshot", token]); return { accountId: "account-a", balance: 10000, positions: [], history: [] }; },
    placeOrder: async (token, order) => { calls.push(["place", token, order]); return { id: "position-a", status: "open", ...order }; },
    closePosition: async (token, id, price) => { calls.push(["close", token, id, price]); return { id, status: "closed" }; }
  };
  const server = createApp(null, undefined, async () => ({ id: "member-a" }), repository);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: "Bearer test-access-token", "content-type": "application/json" };
  const account = await fetch(base + "/api/v1/demo/account", { headers });
  assert.equal((await account.json()).data.accountId, "account-a");
  const placed = await fetch(base + "/api/v1/demo/orders", { method: "POST", headers, body: JSON.stringify({ symbol: "EUR/USD", side: "buy", volume: 0.1 }) });
  assert.equal(placed.status, 201);
  assert.equal((await placed.json()).data.id, "position-a");
  assert.equal(calls.some(call => call[0] === "place" && call[1] === "test-access-token" && call[2].symbol === "EURUSD"), true);
});
