const finite = value => typeof value === "number" && Number.isFinite(value);

export function createPreTradeRiskEngine({
  riskRepository,
  policy = {}
} = {}) {
  const limits = {
    maxOrderLots: 5,
    maxSymbolLots: 20,
    minimumMarginLevelPercent: 150,
    maximumSpreadPips: 5,
    maximumQuoteAgeMs: 3000,
    ...policy
  };
  if (!riskRepository || typeof riskRepository.getPreTradeSnapshot !== "function") {
    throw new TypeError("A trusted pre-trade risk repository is required.");
  }

  return {
    async authorizeOrder({ userId, order, quote, now = Date.now() }) {
      const snapshot = await riskRepository.getPreTradeSnapshot({
        userId,
        accountId: order.accountId,
        symbol: order.symbol
      });
      const reject = reason => ({ approved: false, reason });
      if (!snapshot || !snapshot.account) return reject("Trading account was not found.");
      const account = snapshot.account;
      if (account.userId !== userId) return reject("Trading account ownership could not be verified.");
      if (account.status !== "active" || account.tradingEnabled !== true) return reject("Trading account is not enabled for live execution.");
      if (!snapshot.instrument || snapshot.instrument.symbol !== order.symbol || snapshot.instrument.enabled !== true) {
        return reject("Instrument is not enabled for this account.");
      }
      if (snapshot.instrument.marketOpen !== true) return reject("Instrument market is closed.");
      if (!finite(snapshot.equity) || snapshot.equity <= 0 ||
          !finite(snapshot.usedMargin) || snapshot.usedMargin < 0 ||
          !finite(snapshot.availableMargin) || snapshot.availableMargin < 0 ||
          !finite(snapshot.incrementalMargin) || snapshot.incrementalMargin <= 0 ||
          !finite(snapshot.currentSymbolLots) || snapshot.currentSymbolLots < 0) {
        return reject("Authoritative account margin data is unavailable.");
      }
      if (!finite(order.volume) || order.volume <= 0 || order.volume > limits.maxOrderLots) {
        return reject("Order exceeds the configured per-order volume limit.");
      }
      if (snapshot.currentSymbolLots + order.volume > limits.maxSymbolLots) {
        return reject("Order exceeds the configured instrument exposure limit.");
      }
      const spread = quote.ask - quote.bid;
      const pipSize = Number(snapshot.instrument.pipSize);
      if (!finite(pipSize) || pipSize <= 0 || !finite(spread) || spread / pipSize > limits.maximumSpreadPips) {
        return reject("Market spread exceeds the permitted limit.");
      }
      if (!finite(quote.timestamp) || now - quote.timestamp > limits.maximumQuoteAgeMs || quote.timestamp > now + 1000) {
        return reject("Market quote is too old for live execution.");
      }
      if (snapshot.incrementalMargin > snapshot.availableMargin) {
        return reject("Insufficient free margin for this order.");
      }
      const projectedMargin = snapshot.usedMargin + snapshot.incrementalMargin;
      const projectedMarginLevel = projectedMargin > 0 ? snapshot.equity / projectedMargin * 100 : Infinity;
      if (projectedMarginLevel < limits.minimumMarginLevelPercent) {
        return reject("Order would breach HikeyFX's minimum post-trade margin level.");
      }
      return {
        approved: true,
        riskSnapshotId: String(snapshot.snapshotId || ""),
        projectedMarginLevelPercent: Number.isFinite(projectedMarginLevel)
          ? Math.round(projectedMarginLevel * 100) / 100
          : null
      };
    }
  };
}
