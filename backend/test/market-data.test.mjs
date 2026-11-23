import test from "node:test";
import assert from "node:assert/strict";
import { fetchTraderMadeQuotes, fetchTraderMadeCandles, parseHistoricalTimestamp } from "../src/market-data.mjs";
import { createApp } from "../src/server.mjs";

test("timezone-free historical timestamps are explicitly normalized to UTC", () => {
  assert.equal(parseHistoricalTimestamp("2026-11-22 11:30:00"), Date.parse("2026-11-22T11:30:00.000Z"));
  assert.equal(parseHistoricalTimestamp("2026-11-22T11:30:00+03:00"), Date.parse("2026-11-22T08:30:00.000Z"));
});

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

test("TraderMade adapter accepts the complete HikeyFX forex, metal and index quote set", async () => {
  const symbols = ["EURUSD","GBPUSD","AUDUSD","USDJPY","USDCHF","SPX500","NAS100","UK100","XAUUSD"];
  const now = Date.parse("2026-11-23T12:00:00.000Z");
  const result = await fetchTraderMadeQuotes({
    apiKey: "coverage-test-secret", symbols, now,
    fetchImpl: async () => new Response(JSON.stringify({ quotes: symbols.map((instrument, index) => ({
      instrument, bid: 100 + index, ask: 100.2 + index, timestamp: now / 1000
    })) }), { status: 200, headers: { "content-type": "application/json" } })
  });
  assert.deepEqual(result.quotes.map(quote => quote.symbol), symbols);
  assert.equal(result.status, "fresh");
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
  const server = createApp(undefined, async () => {
    const error = new Error("Market data provider is not configured.");
    error.code = "MARKET_DATA_NOT_CONFIGURED";
    throw error;
  }, async () => ({ id: "test-user" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/market/quotes`);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, "unavailable");
  assert.equal(body.ok, false);
});


test("TraderMade historical adapter requests real OHLC time-series data", async () => {
  let requestedUrl;
  const now=Date.parse("2026-11-22T12:00:00.000Z");
  const result=await (await import("../src/market-data.mjs")).fetchTraderMadeCandles({
    apiKey:"history-test-secret",symbol:"EURUSD",timeframe:"15m",now,
    fetchImpl:async url=>{
      requestedUrl=new URL(url);
      return new Response(JSON.stringify({quotes:[
        {date:"2026-11-22 11:30:00",open:1.08,high:1.081,low:1.079,close:1.0805},
        {date:"2026-11-22 11:45:00",open:1.0805,high:1.082,low:1.08,close:1.0815}
      ]}),{status:200,headers:{"content-type":"application/json"}});
    }
  });
  assert.equal(requestedUrl.pathname,"/api/v1/timeseries");
  assert.equal(requestedUrl.searchParams.get("currency"),"EURUSD");
  assert.equal(requestedUrl.searchParams.get("interval"),"minute");
  assert.equal(requestedUrl.searchParams.get("period"),"15");
  assert.equal(requestedUrl.searchParams.has("api_key"),true);
  assert.equal(result.candles.length,2);
  assert.equal(result.candles[1].close,1.0815);
  assert.equal(result.candles[0].time,"2026-11-22T11:30:00.000Z","timezone-free provider timestamps must be interpreted consistently as UTC");
});

test("TraderMade historical adapter aggregates unsupported minute periods without fabricating bars", async () => {
  const {fetchTraderMadeCandles}=await import("../src/market-data.mjs");
  const result=await fetchTraderMadeCandles({
    apiKey:"history-test-secret",symbol:"EURUSD",timeframe:"2m",now:Date.parse("2026-11-22T12:00:00Z"),
    fetchImpl:async()=>new Response(JSON.stringify({quotes:[
      {date:"2026-11-22 11:58:00",open:1.1,high:1.11,low:1.09,close:1.105},
      {date:"2026-11-22 11:59:00",open:1.105,high:1.12,low:1.1,close:1.115}
    ]}),{status:200})
  });
  assert.equal(result.candles.length,1);
  assert.equal(result.candles[0].open,1.1);
  assert.equal(result.candles[0].high,1.12);
  assert.equal(result.candles[0].low,1.09);
  assert.equal(result.candles[0].close,1.115);
});


test("historical adapter rejects unknown symbols and timeframes before network access", async () => {
  const noNetwork=async()=>{throw new Error("network must not be called")};
  await assert.rejects(fetchTraderMadeCandles({apiKey:"test",symbol:"UNKNOWN",timeframe:"15m",fetchImpl:noNetwork}),/enabled historical data/);
  await assert.rejects(fetchTraderMadeCandles({apiKey:"test",symbol:"EURUSD",timeframe:"7m",fetchImpl:noNetwork}),/Unsupported chart timeframe/);
});

test("historical adapter discards malformed OHLC records and rejects an empty valid series", async () => {
  await assert.rejects(fetchTraderMadeCandles({
    apiKey:"test",symbol:"EURUSD",timeframe:"15m",now:Date.parse("2026-11-22T12:00:00Z"),
    fetchImpl:async()=>new Response(JSON.stringify({quotes:[
      {date:"2026-11-22 11:45:00",open:1.08,high:1.07,low:1.06,close:1.075},
      {date:"invalid-date",open:1.08,high:1.09,low:1.07,close:1.085}
    ]}),{status:200})
  }),error=>error.code==="MARKET_DATA_EMPTY");
});

test("weekly and monthly chart periods aggregate daily provider bars", async () => {
  const daily=[
    {date:"2026-11-02",open:1.1,high:1.12,low:1.09,close:1.11},
    {date:"2026-11-03",open:1.11,high:1.13,low:1.1,close:1.12},
    {date:"2026-11-09",open:1.12,high:1.14,low:1.115,close:1.13}
  ];
  const fetchImpl=async()=>new Response(JSON.stringify({quotes:daily}),{status:200});
  const weekly=await fetchTraderMadeCandles({apiKey:"test",symbol:"EURUSD",timeframe:"1W",now:Date.parse("2026-11-22T12:00:00Z"),fetchImpl});
  assert.equal(weekly.candles.length,2);
  assert.equal(weekly.candles[0].open,1.1);
  assert.equal(weekly.candles[0].high,1.13);
  assert.equal(weekly.candles[0].low,1.09);
  assert.equal(weekly.candles[0].close,1.12);
  const monthly=await fetchTraderMadeCandles({apiKey:"test",symbol:"EURUSD",timeframe:"1M",now:Date.parse("2026-11-22T12:00:00Z"),fetchImpl});
  assert.equal(monthly.candles.length,1);
  assert.equal(monthly.candles[0].open,1.1);
  assert.equal(monthly.candles[0].high,1.14);
  assert.equal(monthly.candles[0].low,1.09);
  assert.equal(monthly.candles[0].close,1.13);
});
