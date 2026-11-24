import test from "node:test";
import assert from "node:assert/strict";
import { createPreTradeRiskEngine } from "../src/pre-trade-risk.mjs";

const now = 1800000000000;
const request = {
  userId: "member-1",
  order: { accountId: "account-1", symbol: "EURUSD", side: "buy", volume: 0.1 },
  quote: { bid: 1.085, ask: 1.0852, timestamp: now }
};
const snapshot = {
  snapshotId: "risk-snapshot-1",
  account: { userId: "member-1", status: "active", tradingEnabled: true },
  instrument: { symbol: "EURUSD", enabled: true, marketOpen: true, pipSize: 0.0001 },
  equity: 10000,
  usedMargin: 1000,
  availableMargin: 9000,
  incrementalMargin: 100,
  currentSymbolLots: 0.2
};

function engine(data = snapshot, policy = {}) {
  return createPreTradeRiskEngine({
    riskRepository: { async getPreTradeSnapshot() { return data; } },
    policy
  });
}

test("approves an order within account, spread, exposure and margin limits", async () => {
  const result = await engine().authorizeOrder({ ...request, now });
  assert.equal(result.approved, true);
  assert.equal(result.projectedMarginLevelPercent, 909.09);
});

test("rejects an account belonging to another member", async () => {
  const result = await engine({ ...snapshot, account: { ...snapshot.account, userId: "other-user" } })
    .authorizeOrder({ ...request, now });
  assert.equal(result.approved, false);
  assert.match(result.reason, /ownership/);
});

test("rejects inactive or trading-disabled accounts", async () => {
  const result = await engine({ ...snapshot, account: { ...snapshot.account, tradingEnabled: false } })
    .authorizeOrder({ ...request, now });
  assert.equal(result.approved, false);
});

test("rejects closed or disabled instruments", async () => {
  const result = await engine({ ...snapshot, instrument: { ...snapshot.instrument, marketOpen: false } })
    .authorizeOrder({ ...request, now });
  assert.equal(result.approved, false);
  assert.match(result.reason, /closed/);
});

test("rejects excessive spreads and stale quotes", async () => {
  const wide = await engine().authorizeOrder({
    ...request, quote: { ...request.quote, ask: 1.086 }, now
  });
  const stale = await engine().authorizeOrder({
    ...request, quote: { ...request.quote, timestamp: now - 5000 }, now
  });
  assert.equal(wide.approved, false);
  assert.equal(stale.approved, false);
});

test("rejects orders exceeding volume and symbol exposure limits", async () => {
  const tooLarge = await engine().authorizeOrder({
    ...request, order: { ...request.order, volume: 6 }, now
  });
  const tooMuchExposure = await engine({
    ...snapshot, currentSymbolLots: 19.95
  }).authorizeOrder({ ...request, now });
  assert.equal(tooLarge.approved, false);
  assert.equal(tooMuchExposure.approved, false);
});

test("rejects insufficient margin and projected margin-level breaches", async () => {
  const noFreeMargin = await engine({
    ...snapshot, availableMargin: 50
  }).authorizeOrder({ ...request, now });
  const lowMarginLevel = await engine({
    ...snapshot, equity: 1000, usedMargin: 900, incrementalMargin: 100
  }).authorizeOrder({ ...request, now });
  assert.equal(noFreeMargin.approved, false);
  assert.equal(lowMarginLevel.approved, false);
});

test("fails closed when authoritative risk data is missing", async () => {
  const result = await engine(null).authorizeOrder({ ...request, now });
  assert.equal(result.approved, false);
});
