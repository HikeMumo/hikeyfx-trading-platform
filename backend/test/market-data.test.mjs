import test from "node:test";
import assert from "node:assert/strict";
import { fetchTraderMadeQuotes } from "../src/market-data.mjs";
import { createApp } from "../src/server.mjs";

test("TraderMade adapter maps genuine timestamped quote fields", async () => {
  const now = Date.parse("2026-11-22T12:00:00.000Z");
  let requestedUrl;
  const result = await fetchTraderMadeQuotes({
    apiKey: "unit-test-secret",
    now,
    symbols: ["EURUSD"],
    fetchImpl: async url => {
      requestedUrl = new URL(url);
      return new Response(JSON.stringify({ quotes: [{
        base_currency: "EUR", quote_currency: "USD",
        bid: 1.08, ask: 1.0802, mid: 1.0801, timestamp: now / 1000
      }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  assert.equal(requestedUrl.searchParams.get("api_key"), "unit-test-secret");
  assert.equal(result.source, "TraderMade");
  assert.equal(result.status, "fresh");
  assert.equal(result.quotes[0].symbol, "EURUSD");
  assert.equal(result.quotes[0].bid, 1.08);
  assert.equal(result.quotes[0].ask, 1.0802);
  assert.equal(result.quotes[0].status, "fresh");
});

test("TraderMade adapter rejects missing credentials", async () => {
  await assert.rejects(
    fetchTraderMadeQuotes({ apiKey: "", symbols: ["EURUSD"] }),
    error => error.code === "MARKET_DATA_NOT_CONFIGURED"
  );
});

test("TraderMade adapter rejects unsupported symbols before provider request", async () => {
  await assert.rejects(
    fetchTraderMadeQuotes({ apiKey: "test", symbols: ["FAKEPAIR"], fetchImpl: async () => { throw new Error("must not call"); } }),
    /not enabled/
  );
});

test("market quote route reports unavailable when provider is not configured", async t => {
  const server = createApp();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/market/quotes`);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "unavailable");
  assert.equal(body.ok, false);
});
