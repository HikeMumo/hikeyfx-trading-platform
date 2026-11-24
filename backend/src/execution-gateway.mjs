import { createHash, randomUUID } from "node:crypto";

const finite = value => typeof value === "number" && Number.isFinite(value);
const round = value => Math.round((value + Number.EPSILON) * 1e8) / 1e8;

export class GatewayError extends Error {
  constructor(message, statusCode = 400, code = "GATEWAY_ERROR") {
    super(message);
    this.name = "GatewayError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/*
 * Broker-owned execution boundary. Production dependencies are mandatory:
 * adapter: health() and submitMarketOrder(order)
 * idempotencyStore: reserve(userId,key,hash), complete(userId,key,result), fail(userId,key,error), markUnknown(userId,key,error)
 * riskEngine: authorizeOrder({userId,order,quote})
 * auditLog: append(event)
 * No in-memory fallback is permitted for money-affecting state.
 */
export class ExecutionGateway {
  constructor({
    enabled = process.env.LIVE_EXECUTION_ENABLED === "true",
    adapter = null, idempotencyStore = null, riskEngine = null, auditLog = null,
    maxQuoteAgeMs = 3000, now = () => Date.now()
  } = {}) {
    this.enabled = enabled;
    this.adapter = adapter;
    this.idempotencyStore = idempotencyStore;
    this.riskEngine = riskEngine;
    this.auditLog = auditLog;
    this.maxQuoteAgeMs = maxQuoteAgeMs;
    this.now = now;
  }

  async status() {
    let health = { connected: false };
    if (this.adapter && typeof this.adapter.health === "function") {
      try {
        const result = await this.adapter.health();
        health = { connected: result?.connected === true, provider: result?.provider || null };
      } catch { health = { connected: false }; }
    }
    const unknownOutcomeProtection = typeof this.idempotencyStore?.markUnknown === "function";
    const dependenciesReady = Boolean(this.adapter && this.idempotencyStore && unknownOutcomeProtection && this.riskEngine && this.auditLog);
    return {
      mode: "broker-owned-execution-gateway",
      enabled: this.enabled,
      ready: this.enabled && dependenciesReady && health.connected,
      adapterConnected: health.connected,
      provider: health.provider,
      durableIdempotency: Boolean(this.idempotencyStore),
      unknownOutcomeProtection,
      riskControls: Boolean(this.riskEngine),
      auditTrail: Boolean(this.auditLog)
    };
  }

  async submitMarketOrder({ userId, accountId, idempotencyKey, symbol, side, volume, quote }) {
    if (!this.enabled) throw new GatewayError("Live execution is disabled.", 503, "LIVE_EXECUTION_DISABLED");
    if (!userId || !accountId || !idempotencyKey) throw new GatewayError("Authenticated user, trading account and idempotency key are required.");
    if (!this.adapter || !this.idempotencyStore || typeof this.idempotencyStore.markUnknown !== "function" || !this.riskEngine || !this.auditLog) {
      throw new GatewayError("Execution gateway is not fully configured.", 503, "GATEWAY_NOT_READY");
    }

    const normalizedSymbol = String(symbol || "").replace("/", "").toUpperCase();
    const normalizedSide = String(side || "").toLowerCase();
    const amount = Number(volume);
    if (!/^[A-Z0-9]{6,12}$/.test(normalizedSymbol)) throw new GatewayError("Unsupported instrument symbol.");
    if (!["buy", "sell"].includes(normalizedSide)) throw new GatewayError("Side must be buy or sell.");
    if (!finite(amount) || amount < 0.01 || amount > 100 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
      throw new GatewayError("Volume must be between 0.01 and 100.00 lots in 0.01 increments.");
    }
    if (!quote || !finite(quote.bid) || !finite(quote.ask) || quote.bid <= 0 || quote.ask <= quote.bid ||
        !finite(quote.timestamp) || this.now() - quote.timestamp > this.maxQuoteAgeMs || quote.timestamp > this.now() + 1000) {
      throw new GatewayError("A fresh, valid executable quote is required.", 503, "STALE_OR_INVALID_QUOTE");
    }

    const order = {
      clientOrderId: randomUUID(), accountId, symbol: normalizedSymbol, side: normalizedSide,
      volume: amount, orderType: "market", bid: quote.bid, ask: quote.ask, quoteTimestamp: quote.timestamp
    };
    const requestHash = createHash("sha256").update(JSON.stringify({
      accountId, symbol: normalizedSymbol, side: normalizedSide, volume: amount
    })).digest("hex");
    const key = String(idempotencyKey);
    const reservation = await this.idempotencyStore.reserve(userId, key, requestHash);
    if (!reservation || reservation.state === "conflict") {
      throw new GatewayError("Idempotency key was already used for a different order.", 409, "IDEMPOTENCY_CONFLICT");
    }
    if (reservation.state === "existing") return reservation.result;
    if (reservation.state !== "new") throw new GatewayError("Order reservation could not be confirmed.", 503, "IDEMPOTENCY_UNAVAILABLE");

    let submissionAttempted = false;
    try {
      const health = await this.adapter.health();
      if (health?.connected !== true) throw new GatewayError("Execution counterparty is disconnected.", 503, "COUNTERPARTY_DISCONNECTED");
      const decision = await this.riskEngine.authorizeOrder({ userId, order, quote });
      if (!decision || decision.approved !== true) {
        throw new GatewayError(decision?.reason || "Order rejected by HikeyFX risk controls.", 422, "RISK_REJECTED");
      }
      await this.auditLog.append({
        event: "order_submission_requested", userId, accountId, clientOrderId: order.clientOrderId,
        symbol: order.symbol, side: order.side, volume: order.volume, at: new Date(this.now()).toISOString()
      });

      // From this point onward a timeout or malformed response may mean the counterparty
      // received the order. Never make the idempotency key reusable after this boundary.
      submissionAttempted = true;
      const ack = await this.adapter.submitMarketOrder(order);
      if (!ack || !["accepted", "rejected"].includes(ack.status)) {
        throw new GatewayError("Counterparty returned an invalid execution acknowledgement.", 502, "INVALID_EXECUTION_ACK");
      }
      if (ack.status === "rejected") {
        const rejected = {
          status: "rejected", clientOrderId: order.clientOrderId,
          providerOrderId: ack.providerOrderId || null,
          reason: String(ack.reason || "Counterparty rejected the order.")
        };
        await this.idempotencyStore.complete(userId, key, rejected);
        await this.auditLog.append({
          event: "order_rejected", userId, accountId, clientOrderId: order.clientOrderId,
          reason: rejected.reason, at: new Date(this.now()).toISOString()
        });
        return rejected;
      }

      const executedVolume = ack.executedVolume === undefined ? amount : Number(ack.executedVolume);
      const averagePrice = Number(ack.averagePrice);
      if (!finite(executedVolume) || executedVolume <= 0 || executedVolume > amount ||
          !finite(averagePrice) || averagePrice <= 0 || !ack.providerOrderId) {
        throw new GatewayError("Accepted acknowledgement is missing valid fill details.", 502, "INVALID_FILL");
      }
      const result = {
        status: executedVolume === amount ? "filled" : "partially_filled",
        clientOrderId: order.clientOrderId, providerOrderId: String(ack.providerOrderId),
        accountId, symbol: normalizedSymbol, side: normalizedSide, requestedVolume: amount,
        executedVolume: round(executedVolume), averagePrice: round(averagePrice),
        executedAt: ack.executedAt || new Date(this.now()).toISOString()
      };
      await this.idempotencyStore.complete(userId, key, result);
      await this.auditLog.append({
        event: "order_execution_acknowledged", userId, accountId,
        clientOrderId: order.clientOrderId, providerOrderId: result.providerOrderId,
        status: result.status, executedVolume: result.executedVolume,
        averagePrice: result.averagePrice, at: new Date(this.now()).toISOString()
      });
      return result;
    } catch (error) {
      const safeError = { code: error.code || "EXECUTION_FAILED", message: error.message || "Execution failed." };
      try {
        if (submissionAttempted) {
          if (typeof this.idempotencyStore.markUnknown !== "function") {
            throw new Error("Durable unknown-outcome handling is required after submission.");
          }
          await this.idempotencyStore.markUnknown(userId, key, safeError);
        } else {
          await this.idempotencyStore.fail(userId, key, safeError);
        }
      } catch {}
      try {
        await this.auditLog.append({
          event: "order_execution_error", userId, accountId,
          clientOrderId: order.clientOrderId, code: safeError.code,
          at: new Date(this.now()).toISOString()
        });
      } catch {}
      throw error;
    }
  }
}
