import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionGateway } from "../src/execution-gateway.mjs";

function setup(overrides = {}) {
  const records = new Map();
  const calls = [];
  const idempotencyStore = {
    async reserve(user, key, hash) {
      const id = user + ":" + key;
      const prior = records.get(id);
      if (prior) {
        if (prior.hash !== hash) return { state: "conflict" };
        return prior.state === "complete"
          ? { state: "existing", result: prior.result }
          : { state: "in_progress" };
      }
      records.set(id, { hash, state: "reserved" });
      return { state: "new" };
    },
    async complete(user, key, result) {
      const row = records.get(user + ":" + key);
      row.state = "complete"; row.result = result;
    },
    async fail(user, key, error) {
      const row = records.get(user + ":" + key);
      if (row) { row.state = "failed"; row.error = error; }
    },
    async markUnknown(user, key, error) {
      const row = records.get(user + ":" + key);
      if (row) { row.state = "unknown"; row.error = error; }
    }
  };
  const adapter = {
    async health() { return { connected: true, provider: "test-counterparty" }; },
    async submitMarketOrder(order) {
      calls.push(order);
      return { status: "accepted", providerOrderId: "lp-001", executedVolume: order.volume, averagePrice: 1.0851 };
    }
  };
  const auditLog = { async append() {} };
  const riskEngine = { async authorizeOrder() { return { approved: true }; } };
  return {
    gateway: new ExecutionGateway({
      enabled: true, adapter, idempotencyStore, riskEngine, auditLog,
      now: () => 1800000000000, ...overrides
    }),
    calls
  };
}
const valid = {
  userId: "member-1", accountId: "account-1", idempotencyKey: "request-1",
  symbol: "EUR/USD", side: "buy", volume: 0.1,
  quote: { bid: 1.085, ask: 1.0852, timestamp: 1800000000000 }
};

test("gateway is disabled by default", async () => {
  const gateway = new ExecutionGateway({ enabled: false });
  assert.equal((await gateway.status()).ready, false);
  await assert.rejects(gateway.submitMarketOrder(valid), e => e.code === "LIVE_EXECUTION_DISABLED");
});
test("gateway reports ready only when all dependencies and counterparty are ready", async () => {
  const { gateway } = setup();
  assert.deepEqual(await gateway.status(), {
    mode: "broker-owned-execution-gateway", enabled: true, ready: true,
    adapterConnected: true, provider: "test-counterparty",
    durableIdempotency: true, riskControls: true, auditTrail: true
  });
});
test("market order is risk-checked and acknowledged by the adapter", async () => {
  const { gateway, calls } = setup();
  const result = await gateway.submitMarketOrder(valid);
  assert.equal(result.status, "filled");
  assert.equal(result.providerOrderId, "lp-001");
  assert.equal(result.averagePrice, 1.0851);
  assert.equal(calls.length, 1);
});
test("stale quotes are rejected before order reservation", async () => {
  const { gateway, calls } = setup();
  await assert.rejects(gateway.submitMarketOrder({
    ...valid, quote: { ...valid.quote, timestamp: 1799999000000 }
  }), e => e.code === "STALE_OR_INVALID_QUOTE");
  assert.equal(calls.length, 0);
});
test("risk rejection never reaches the counterparty", async () => {
  const { gateway, calls } = setup({
    riskEngine: { async authorizeOrder() { return { approved: false, reason: "Margin too low." }; } }
  });
  await assert.rejects(gateway.submitMarketOrder(valid), e => e.code === "RISK_REJECTED");
  assert.equal(calls.length, 0);
});
test("same idempotency key returns stored result without duplicate execution", async () => {
  const { gateway, calls } = setup();
  const first = await gateway.submitMarketOrder(valid);
  const second = await gateway.submitMarketOrder(valid);
  assert.deepEqual(second, first);
  assert.equal(calls.length, 1);
});
test("idempotency key cannot be reused for a different order", async () => {
  const { gateway } = setup();
  await gateway.submitMarketOrder(valid);
  await assert.rejects(gateway.submitMarketOrder({ ...valid, volume: 0.2 }), e => e.code === "IDEMPOTENCY_CONFLICT");
});
test("gateway fails closed when durable state is missing", async () => {
  const { gateway } = setup({ idempotencyStore: null });
  assert.equal((await gateway.status()).ready, false);
  await assert.rejects(gateway.submitMarketOrder(valid), e => e.code === "GATEWAY_NOT_READY");
});


test("counterparty timeout is marked unknown and cannot be blindly retried", async () => {
  const records = new Map();
  let submissions = 0;
  let unknownMarks = 0;
  const idempotencyStore = {
    async reserve(user, key, hash) {
      const id = user + ":" + key;
      const prior = records.get(id);
      if (prior) return prior.hash === hash ? { state: "in_progress" } : { state: "conflict" };
      records.set(id, { hash, state: "reserved" });
      return { state: "new" };
    },
    async complete() {},
    async fail() {},
    async markUnknown() { unknownMarks += 1; }
  };
  const { gateway } = setup({
    idempotencyStore,
    adapter: {
      async health() { return { connected: true }; },
      async submitMarketOrder() { submissions += 1; throw new Error("network timeout"); }
    }
  });
  await assert.rejects(gateway.submitMarketOrder(valid), /network timeout/);
  assert.equal(unknownMarks, 1);
  await assert.rejects(gateway.submitMarketOrder(valid), e => e.code === "IDEMPOTENCY_UNAVAILABLE");
  assert.equal(submissions, 1);
});
