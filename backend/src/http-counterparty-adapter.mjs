import { createHmac, randomUUID } from "node:crypto";

export function createHttpCounterpartyAdapter({
  endpoint = process.env.EXECUTION_COUNTERPARTY_URL,
  apiKey = process.env.EXECUTION_COUNTERPARTY_API_KEY,
  signingSecret = process.env.EXECUTION_COUNTERPARTY_SIGNING_SECRET,
  providerCode = process.env.EXECUTION_COUNTERPARTY_CODE || "configured-counterparty",
  fetchImpl = fetch
} = {}) {
  if (!endpoint || !apiKey || !signingSecret) return null;
  const base = new URL(endpoint);
  if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") {
    throw new Error("Execution counterparty endpoint must use HTTPS.");
  }
  async function request(path, payload = null) {
    const timestamp = String(Date.now());
    const nonce = randomUUID();
    const body = payload === null ? "" : JSON.stringify(payload);
    const signature = createHmac("sha256", signingSecret)
      .update(timestamp + "." + nonce + "." + body)
      .digest("hex");
    const response = await fetchImpl(new URL(path, base), {
      method: payload === null ? "GET" : "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-hikeyfx-key": apiKey,
        "x-hikeyfx-timestamp": timestamp,
        "x-hikeyfx-nonce": nonce,
        "x-hikeyfx-signature": signature
      },
      body: payload === null ? undefined : body,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error("Execution counterparty request failed with HTTP " + response.status);
    return response.json();
  }
  return {
    async health() {
      const result = await request("/health");
      return { connected: result?.connected === true, provider: providerCode };
    },
    async submitMarketOrder(order) {
      const result = await request("/v1/orders/market", {
        clientOrderId: order.clientOrderId,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        volume: order.volume,
        orderType: "market"
      });
      if (!result || !["accepted", "rejected"].includes(result.status)) {
        throw new Error("Counterparty response did not match the HikeyFX connector contract.");
      }
      return { ...result, providerExecutionId: result.providerExecutionId || null };
    }
  };
}
