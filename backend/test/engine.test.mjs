import test from "node:test";
import assert from "node:assert/strict";
import { DemoTradingEngine } from "../src/engine.mjs";

test("starts with a demo-only USD account", () => {
  const engine = new DemoTradingEngine();
  assert.equal(engine.getAccount().mode, "demo");
  assert.equal(engine.getAccount().balance, 10000);
  assert.equal(engine.snapshot().positions.length, 0);
});

test("opens a buy position and calculates floating PnL", () => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1 });
  assert.equal(position.entryPrice, 1.08502);
  engine.updateQuote("EURUSD", 1.08600, 1.08612);
  assert.equal(engine.getAccount().unrealisedPnl, 9.8);
});

test("closes a position and moves realised PnL into balance", () => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1 });
  engine.updateQuote("EURUSD", 1.08600, 1.08612);
  const closed = engine.closePosition(position.id);
  assert.equal(closed.status, "closed");
  assert.equal(closed.realisedPnl, 8.8);
  assert.equal(engine.getAccount().balance, 10008.8);
  assert.equal(engine.snapshot().positions.length, 0);
});

test("rejects invalid volume and unsupported instruments", () => {
  const engine = new DemoTradingEngine();
  assert.throws(() => engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.001 }), /Volume/);
  assert.throws(() => engine.placeOrder({ symbol: "BTCUSD", side: "buy", volume: 0.1 }), /Unsupported/);
});

test("validates stop-loss and take-profit direction", () => {
  const engine = new DemoTradingEngine();
  assert.throws(() => engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1, stopLoss: 1.09 }), /Stop-loss/);
  assert.throws(() => engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1, takeProfit: 1.08 }), /Take-profit/);
});

test("automatically closes a buy when stop-loss is reached", () => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1, stopLoss: 1.08400 });
  const closed = engine.updateQuote("EURUSD", 1.08400, 1.08412);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].id, position.id);
  assert.equal(closed[0].closeReason, "stop_loss");
  assert.equal(engine.snapshot().positions.length, 0);
});

test("automatically closes a sell when take-profit is reached", () => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "sell", volume: 0.1, takeProfit: 1.08350 });
  const closed = engine.updateQuote("EURUSD", 1.08340, 1.08348);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].id, position.id);
  assert.equal(closed[0].closeReason, "take_profit");
});

test("rejects malformed quote updates", () => {
  const engine = new DemoTradingEngine();
  assert.throws(() => engine.updateQuote("EURUSD", 1.1, 1.0), /ask greater/);
});

test("rejects an order when required margin exceeds free margin", () => {
  const engine = new DemoTradingEngine({ initialBalance: 50, leverage: 1 });
  assert.throws(
    () => engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.01 }),
    /Insufficient demo free margin/
  );
  assert.equal(engine.snapshot().positions.length, 0);
});

test("calculates realised profit for a sell position", () => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "sell", volume: 0.1 });
  engine.updateQuote("EURUSD", 1.08390, 1.08402);
  const closed = engine.closePosition(position.id);
  assert.equal(closed.realisedPnl, 9.8);
  assert.equal(engine.getAccount().balance, 10009.8);
});

test("automatically closes a buy when take-profit is reached", () => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "buy", volume: 0.1, takeProfit: 1.08600 });
  const closed = engine.updateQuote("EURUSD", 1.08600, 1.08612);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].id, position.id);
  assert.equal(closed[0].closeReason, "take_profit");
});

test("automatically closes a sell when stop-loss is reached", () => {
  const engine = new DemoTradingEngine();
  const position = engine.placeOrder({ symbol: "EURUSD", side: "sell", volume: 0.1, stopLoss: 1.08600 });
  const closed = engine.updateQuote("EURUSD", 1.08600, 1.08612);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].id, position.id);
  assert.equal(closed[0].closeReason, "stop_loss");
});

test("rejects zero, negative, non-finite and crossed quote updates", () => {
  const engine = new DemoTradingEngine();
  assert.throws(() => engine.updateQuote("EURUSD", 0, 1), /positive prices/);
  assert.throws(() => engine.updateQuote("EURUSD", -1, 1), /positive prices/);
  assert.throws(() => engine.updateQuote("EURUSD", Number.NaN, 1.1), /positive prices/);
  assert.throws(() => engine.updateQuote("EURUSD", 1.1, 1.1), /ask greater/);
});

test("rejects invalid leverage and initial balances", () => {
  assert.throws(() => new DemoTradingEngine({ initialBalance: 0 }), /Initial balance/);
  assert.throws(() => new DemoTradingEngine({ initialBalance: 100, leverage: 0 }), /Leverage/);
  assert.throws(() => new DemoTradingEngine({ initialBalance: 100, leverage: 501 }), /Leverage/);
});
