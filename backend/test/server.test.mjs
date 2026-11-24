import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/server.mjs";
import { DemoTradingEngine } from "../src/engine.mjs";

test("HTTP API exposes demo account and accepts validated demo orders", async t => {
  const server = createApp(undefined, undefined, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  const healthPayload = await health.json();
  assert.equal(healthPayload.mode, "demo-with-live-gateway-disabled-until-ready");
  assert.equal(healthPayload.status, "alive");
  for (const key of ["supabaseConfigured", "persistentDemoConfigured", "marketDataConfigured"]) assert.equal(typeof healthPayload.checks[key], "boolean");

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

test("persistent positions, history and close use the injected member repository", async t => {
  const positionId = "123e4567-e89b-12d3-a456-426614174000";
  const calls = [];
  const repository = {
    snapshot: async token => {
      calls.push(["snapshot", token]);
      return {
        accountId: "account-a", balance: 10000,
        positions: [{ id: positionId, symbol: "EURUSD", side: "buy", margin: 108.5 }],
        history: [{ id: "closed-a", symbol: "EURUSD", realisedPnl: 12.5 }]
      };
    },
    placeOrder: async () => ({ id: "unused" }),
    closePosition: async (token, id, price) => {
      calls.push(["close", token, id, price]);
      return { id, status: "closed" };
    }
  };
  const server = createApp(null, undefined, async () => ({ id: "member-a" }), repository);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: "Bearer member-a-token" };

  const positions = await fetch(base + "/api/v1/demo/positions", { headers });
  assert.equal(positions.status, 200);
  assert.equal((await positions.json()).data[0].id, positionId);

  const history = await fetch(base + "/api/v1/demo/history", { headers });
  assert.equal(history.status, 200);
  assert.equal((await history.json()).data[0].id, "closed-a");

  const closed = await fetch(base + `/api/v1/demo/positions/${positionId}/close`, {
    method: "POST", headers
  });
  assert.equal(closed.status, 200);
  assert.equal((await closed.json()).data.status, "closed");
  assert.equal(calls.filter(call => call[0] === "snapshot").length, 3);
  assert.equal(calls.some(call => call[0] === "close" && call[1] === "member-a-token" && call[2] === positionId), true);
});

test("all member API routes reject unauthenticated requests", async t => {
  const server = createApp(null, undefined, async () => null);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/api/v1/demo/account", "/api/v1/demo/positions", "/api/v1/demo/history", "/api/v1/demo/journal", "/api/v1/demo/positions/123e4567-e89b-12d3-a456-426614174001/modify", "/api/v1/demo/positions/123e4567-e89b-12d3-a456-426614174001/partial-close", "/api/v1/market/quotes"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 401, path + " must require authentication");
    assert.equal((await response.json()).ok, false);
  }
});

test("market quote endpoint applies a per-member burst limit", async t => {
  let calls = 0;
  const marketData = async () => {
    calls += 1;
    return { quotes: [], source: "test", receivedAt: new Date().toISOString(), status: "fresh" };
  };
  const server = createApp(null, marketData, async () => ({ id: "quote-rate-member" }), null);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/market/quotes`;
  for (let i = 0; i < 30; i += 1) {
    const response = await fetch(base);
    assert.equal(response.status, 200);
  }
  const limited = await fetch(base);
  assert.equal(limited.status, 429);
  const payload = await limited.json();
  assert.equal(payload.retryAfterSeconds > 0, true);
  assert.equal(calls, 30);
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


test("historical chart candle route requires a member session and returns provider candles", async t => {
  const history=async ({symbol,timeframe})=>({symbol,timeframe,source:"test-history",receivedAt:"2026-11-22T12:00:00.000Z",candles:[{time:"2026-11-22T11:45:00.000Z",open:1.08,high:1.09,low:1.07,close:1.085}]});
  const server=createApp(null,undefined,async()=>({id:"chart-member"}),null,history);
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base="http://127.0.0.1:"+server.address().port+"/api/v1/market/candles?symbol=EURUSD&timeframe=15m";
  const response=await fetch(base);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.source,"test-history");
  assert.equal(body.data[0].close,1.085);
});

test("historical chart candle route reports plan-restricted provider access", async t => {
  const history=async()=>{const error=new Error("restricted");error.code="MARKET_DATA_HISTORY_FORBIDDEN";throw error};
  const server=createApp(null,undefined,async()=>({id:"chart-member"}),null,history);
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch("http://127.0.0.1:"+server.address().port+"/api/v1/market/candles?symbol=EURUSD&timeframe=1m");
  assert.equal(response.status,403);
  assert.equal((await response.json()).status,"plan-restricted");
});

test("HTTP API modifies stop-loss and take-profit on an open demo position", async t => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1 });
  const server = createApp(engine, undefined, async () => ({ id: "modify-member" }), null);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/demo/positions/${position.id}/modify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stopLoss: 1.08400, takeProfit: 1.08700 })
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.stopLoss, 1.08400);
  assert.equal(payload.data.takeProfit, 1.08700);
});

test("persistent position modification uses the authenticated member repository", async t => {
  const positionId = "123e4567-e89b-12d3-a456-426614174001";
  const calls = [];
  const repository = {
    snapshot: async token => {
      calls.push(["snapshot", token]);
      return { accountId: "account-a", balance: 10000, positions: [{ id: positionId }], history: [] };
    },
    modifyPosition: async (token, id, levels) => {
      calls.push(["modify", token, id, levels]);
      return { id, stopLoss: levels.stopLoss, takeProfit: levels.takeProfit, status: "open" };
    }
  };
  const server = createApp(null, undefined, async () => ({ id: "member-modify" }), repository);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/demo/positions/${positionId}/modify`, {
    method: "POST",
    headers: { authorization: "Bearer member-modify-token", "content-type": "application/json" },
    body: JSON.stringify({ stopLoss: 1.08300, takeProfit: null })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.stopLoss, 1.08300);
  assert.equal(calls.some(call => call[0] === "modify" && call[1] === "member-modify-token" && call[2] === positionId), true);
});

test("HTTP API partially closes an open demo position", async t => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.10 });
  engine.updateQuote("EURUSD", 1.08600, 1.08612);
  const server = createApp(engine, undefined, async () => ({ id: "partial-member" }), null);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/demo/positions/${position.id}/partial-close`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ volume: 0.04 })
  });
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal(data.closedVolume, 0.04);
  assert.equal(data.remainingVolume, 0.06);
});

test("HTTP API exposes the authenticated member trade journal", async t => {
  const engine = new DemoTradingEngine();
  engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1 });
  const server = createApp(engine, undefined, async () => ({ id: "journal-member" }), null);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/demo/journal`);
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal(data.length, 1);
  assert.equal(data[0].eventType, "opened");
  assert.equal(data[0].eventData.symbol, "EURUSD");
});


test("fresh market quotes revalue open demo positions and expose floating PnL", async t => {
  const marketData = async () => ({
    source: "test-feed",
    receivedAt: new Date().toISOString(),
    status: "fresh",
    quotes: [{ symbol: "EURUSD", bid: 1.08600, ask: 1.08612, status: "fresh" }]
  });
  const server = createApp(undefined, marketData, async () => ({ id: "mark-to-market-member" }), null);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = { authorization: "Bearer mark-to-market-token", "content-type": "application/json" };

  const opened = await fetch(base + "/api/v1/demo/orders", {
    method: "POST", headers,
    body: JSON.stringify({ symbol: "EURUSD", side: "buy", volume: 0.1 })
  });
  assert.equal(opened.status, 201);
  const position = (await opened.json()).data;
  assert.equal(position.unrealisedPnl, -1.2); // The bid/ask spread is a normal initial trading cost.

  const quotes = await fetch(base + "/api/v1/market/quotes?symbols=EURUSD", { headers });
  assert.equal(quotes.status, 200);
  assert.deepEqual((await quotes.json()).executionQuotesUpdated, ["EURUSD"]);

  const response = await fetch(base + "/api/v1/demo/positions", { headers });
  const marked = (await response.json()).data[0];
  assert.equal(marked.currentPrice, 1.086);
  assert.equal(marked.unrealisedPnl, 9.8);

  const account = await fetch(base + "/api/v1/demo/account", { headers });
  assert.equal((await account.json()).data.unrealisedPnl, 9.8);
});


test("execution API reports fail-closed status and refuses live orders when gateway is disabled", async t => {
  const { ExecutionGateway } = await import("../src/execution-gateway.mjs");
  const gateway = new ExecutionGateway({ enabled: false });
  const marketData = async () => ({
    quotes: [{
      symbol: "EURUSD", status: "fresh", bid: 1.1, ask: 1.1002,
      providerTimestamp: new Date().toISOString()
    }]
  });
  const server = createApp(undefined, marketData, async () => ({ id: "test-user" }), null, undefined, gateway);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const statusResponse = await fetch(base + "/api/v1/execution/status");
  assert.equal(statusResponse.status, 200);
  const status = await statusResponse.json();
  assert.equal(status.data.enabled, false);
  assert.equal(status.data.ready, false);

  const orderResponse = await fetch(base + "/api/v1/execution/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accountId: "00000000-0000-4000-8000-000000000001",
      idempotencyKey: "live-order-123",
      symbol: "EURUSD", side: "buy", volume: 0.01
    })
  });
  assert.equal(orderResponse.status, 503);
  const order = await orderResponse.json();
  assert.equal(order.ok, false);
  assert.match(order.error, /Live execution is disabled/);
});
