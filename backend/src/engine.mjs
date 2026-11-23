import { randomUUID } from "node:crypto";

export const INSTRUMENTS = Object.freeze({
  EURUSD: { symbol: "EURUSD", bid: 1.08490, ask: 1.08502, contractSize: 100000, digits: 5 },
  GBPUSD: { symbol: "GBPUSD", bid: 1.27110, ask: 1.27125, contractSize: 100000, digits: 5 },
  AUDUSD: { symbol: "AUDUSD", bid: 0.65410, ask: 0.65422, contractSize: 100000, digits: 5 },
  USDJPY: { symbol: "USDJPY", bid: 149.610, ask: 149.630, contractSize: 100000, digits: 3 },
  USDCHF: { symbol: "USDCHF", bid: 0.88404, ask: 0.88416, contractSize: 100000, digits: 5 },
  XAUUSD: { symbol: "XAUUSD", bid: 2340.10, ask: 2340.35, contractSize: 100, digits: 2 }
});

const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
const finite = value => typeof value === "number" && Number.isFinite(value);

export class DemoTradingEngine {
  constructor({ initialBalance = 10000, leverage = 100 } = {}) {
    if (!finite(initialBalance) || initialBalance <= 0) throw new Error("Initial balance must be positive.");
    if (!finite(leverage) || leverage < 1 || leverage > 500) throw new Error("Leverage must be between 1 and 500.");
    this.balance = roundMoney(initialBalance);
    this.leverage = leverage;
    this.quotes = structuredClone(INSTRUMENTS);
    this.positions = [];
    this.history = [];
    this.journal = [];
  }

  recordEvent(eventType, eventData) {
    this.journal.unshift({ id: randomUUID(), eventType, eventData, createdAt: new Date().toISOString() });
    if (this.journal.length > 500) this.journal.length = 500;
  }

  getQuote(symbol) {
    const quote = this.quotes[symbol];
    if (!quote) throw new Error("Unsupported instrument.");
    return { ...quote };
  }

  getUnrealisedPnl(position) {
    const quote = this.getQuote(position.symbol);
    const exitPrice = position.side === "buy" ? quote.bid : quote.ask;
    const direction = position.side === "buy" ? 1 : -1;
    return roundMoney((exitPrice - position.entryPrice) * direction * position.contractSize * position.volume);
  }

  getAccount() {
    const unrealisedPnl = roundMoney(this.positions.reduce((sum, p) => sum + this.getUnrealisedPnl(p), 0));
    const usedMargin = roundMoney(this.positions.reduce((sum, p) => sum + p.margin, 0));
    const equity = roundMoney(this.balance + unrealisedPnl);
    return {
      currency: "USD",
      mode: "demo",
      balance: this.balance,
      equity,
      unrealisedPnl,
      usedMargin,
      freeMargin: roundMoney(equity - usedMargin),
      leverage: this.leverage
    };
  }

  placeOrder({ symbol, side, volume, stopLoss = null, takeProfit = null }) {
    if (!this.quotes[symbol]) throw new Error("Unsupported instrument.");
    if (!["buy", "sell"].includes(side)) throw new Error("Side must be buy or sell.");
    if (!finite(volume) || volume < 0.01 || volume > 10 || Math.abs(volume * 100 - Math.round(volume * 100)) > 1e-8) {
      throw new Error("Volume must be between 0.01 and 10.00 lots in 0.01 increments.");
    }
    for (const [name, value] of [["stopLoss", stopLoss], ["takeProfit", takeProfit]]) {
      if (value !== null && (!finite(value) || value <= 0)) throw new Error(name + " must be a positive price or null.");
    }
    const quote = this.getQuote(symbol);
    const entryPrice = side === "buy" ? quote.ask : quote.bid;
    if (stopLoss !== null && (side === "buy" ? stopLoss >= entryPrice : stopLoss <= entryPrice)) {
      throw new Error("Stop-loss must be below entry for a buy and above entry for a sell.");
    }
    if (takeProfit !== null && (side === "buy" ? takeProfit <= entryPrice : takeProfit >= entryPrice)) {
      throw new Error("Take-profit must be above entry for a buy and below entry for a sell.");
    }
    const contractSize = this.quotes[symbol].contractSize;
    const margin = roundMoney((contractSize * volume * entryPrice) / this.leverage);
    const account = this.getAccount();
    if (margin > account.freeMargin) throw new Error("Insufficient demo free margin.");
    const position = {
      id: randomUUID(), symbol, side, volume, entryPrice,
      stopLoss, takeProfit, contractSize, margin,
      openedAt: new Date().toISOString(), status: "open"
    };
    this.positions.push(position);
    this.recordEvent("opened", { positionId: position.id, symbol, side, volume, entryPrice });
    return { ...position, unrealisedPnl: this.getUnrealisedPnl(position) };
  }

  modifyPosition(id, { stopLoss = null, takeProfit = null } = {}) {
    const position = this.positions.find(item => item.id === id);
    if (!position) throw new Error("Open demo position not found.");
    for (const [name, value] of [["stopLoss", stopLoss], ["takeProfit", takeProfit]]) {
      if (value !== null && (!finite(value) || value <= 0)) {
        throw new Error(name + " must be a positive price or null.");
      }
    }
    const quote = this.getQuote(position.symbol);
    const currentPrice = position.side === "buy" ? quote.bid : quote.ask;
    if (stopLoss !== null && (position.side === "buy" ? stopLoss >= currentPrice : stopLoss <= currentPrice)) {
      throw new Error("Stop-loss must remain below the current price for a buy and above it for a sell.");
    }
    if (takeProfit !== null && (position.side === "buy" ? takeProfit <= currentPrice : takeProfit >= currentPrice)) {
      throw new Error("Take-profit must remain above the current price for a buy and below it for a sell.");
    }
    position.stopLoss = stopLoss;
    position.takeProfit = takeProfit;
    position.modifiedAt = new Date().toISOString();
    this.recordEvent("adjustment", { positionId: position.id, symbol: position.symbol, stopLoss, takeProfit });
    return { ...position, unrealisedPnl: this.getUnrealisedPnl(position) };
  }

  partialClosePosition(id, volume) {
    const index = this.positions.findIndex(position => position.id === id);
    if (index < 0) throw new Error("Open demo position not found.");
    const position = this.positions[index];
    if (!finite(volume) || volume < 0.01 || Math.abs(volume * 100 - Math.round(volume * 100)) > 1e-8 ||
        volume >= position.volume || position.volume - volume < 0.01) {
      throw new Error("Partial close volume must use 0.01 lot steps and leave at least 0.01 lots open.");
    }
    const quote = this.getQuote(position.symbol);
    const exitPrice = position.side === "buy" ? quote.bid : quote.ask;
    const direction = position.side === "buy" ? 1 : -1;
    const pnl = roundMoney((exitPrice - position.entryPrice) * direction * position.contractSize * volume);
    const releasedMargin = roundMoney(position.margin * volume / position.volume);
    this.balance = roundMoney(this.balance + pnl);
    position.volume = Math.round((position.volume - volume) * 100) / 100;
    position.margin = roundMoney(Math.max(0, position.margin - releasedMargin));
    const partial = {
      ...position, id: randomUUID(), positionId: position.id, volume, exitPrice,
      realisedPnl: pnl, closeReason: "partial", closedAt: new Date().toISOString(),
      status: "partial_closed", margin: 0
    };
    this.history.unshift(partial);
    this.recordEvent("partial_close", { positionId: position.id, symbol: position.symbol, side: position.side, closedVolume: volume, remainingVolume: position.volume, exitPrice, realisedPnl: pnl });
    return { positionId: position.id, closedVolume: volume, remainingVolume: position.volume, exitPrice, realisedPnl: pnl, balance: this.balance };
  }

  closePosition(id, reason = "manual") {
    const index = this.positions.findIndex(position => position.id === id);
    if (index < 0) throw new Error("Open demo position not found.");
    const position = this.positions[index];
    const pnl = this.getUnrealisedPnl(position);
    const quote = this.getQuote(position.symbol);
    const exitPrice = position.side === "buy" ? quote.bid : quote.ask;
    this.balance = roundMoney(this.balance + pnl);
    this.positions.splice(index, 1);
    const closed = {
      ...position, exitPrice, realisedPnl: pnl, closeReason: reason,
      closedAt: new Date().toISOString(), status: "closed"
    };
    this.history.unshift(closed);
    this.recordEvent(reason === "stop_loss" || reason === "take_profit" ? reason : "closed", { positionId: position.id, symbol: position.symbol, side: position.side, volume: position.volume, exitPrice, realisedPnl: pnl, reason });
    return closed;
  }

  updateQuote(symbol, bid, ask) {
    if (!this.quotes[symbol]) throw new Error("Unsupported instrument.");
    if (!finite(bid) || !finite(ask) || bid <= 0 || ask <= bid) {
      throw new Error("Quote must contain positive prices with ask greater than bid.");
    }
    this.quotes[symbol] = { ...this.quotes[symbol], bid, ask };
    const closed = [];
    for (const position of [...this.positions]) {
      if (position.symbol !== symbol) continue;
      const exit = position.side === "buy" ? bid : ask;
      const stopHit = position.stopLoss !== null &&
        (position.side === "buy" ? exit <= position.stopLoss : exit >= position.stopLoss);
      const targetHit = position.takeProfit !== null &&
        (position.side === "buy" ? exit >= position.takeProfit : exit <= position.takeProfit);
      if (stopHit || targetHit) {
        closed.push(this.closePosition(position.id, stopHit ? "stop_loss" : "take_profit"));
      }
    }
    return closed;
  }

  snapshot() {
    return {
      account: this.getAccount(),
      positions: this.positions.map(p => ({ ...p, unrealisedPnl: this.getUnrealisedPnl(p) })),
      history: this.history.map(p => ({ ...p })),
      journal: this.journal.map(event => ({ ...event, eventData: { ...event.eventData } })),
      quotes: Object.values(this.quotes).map(q => ({ ...q }))
    };
  }
}
