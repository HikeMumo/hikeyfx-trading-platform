import test from "node:test";
import assert from "node:assert/strict";
import { createHttpCounterpartyAdapter } from "../src/http-counterparty-adapter.mjs";

test("connector remains absent when credentials are not configured", () => {
  assert.equal(createHttpCounterpartyAdapter({
    endpoint: "", apiKey: "", signingSecret: ""
  }), null);
});

test("connector refuses non-HTTPS remote endpoints", () => {
  assert.throws(() => createHttpCounterpartyAdapter({
    endpoint: "http://broker.example", apiKey: "key", signingSecret: "secret"
  }), /HTTPS/);
});

test("connector signs health and market-order requests and validates acknowledgements", async () => {
  const requests = [];
  const adapter = createHttpCounterpartyAdapter({
    endpoint: "https://counterparty.example",
    apiKey: "test-key",
    signingSecret: "test-secret",
    providerCode: "test-lp",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return {
        ok: true,
        async json() {
          return requests.length === 1
            ? { connected: true }
            : { status: "accepted", providerOrderId: "lp-order-1", providerExecutionId: "lp-fill-1", executedVolume: 0.1, averagePrice: 1.085 };
        }
      };
    }
  });
  assert.deepEqual(await adapter.health(), { connected: true, provider: "test-lp" });
  const result = await adapter.submitMarketOrder({
    clientOrderId: "client-order-1", accountId: "account-1",
    symbol: "EURUSD", side: "buy", volume: 0.1
  });
  assert.equal(result.providerExecutionId, "lp-fill-1");
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.options.headers["x-hikeyfx-key"], "test-key");
    assert.match(request.options.headers["x-hikeyfx-signature"], /^[a-f0-9]{64}$/);
    assert.ok(request.options.headers["x-hikeyfx-nonce"]);
  }
});
