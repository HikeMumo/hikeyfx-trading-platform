import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("browser indicator library exposes all 30 MT5-style built-in indicators", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  const library = context.window.HikeyFXIndicators;
  assert.ok(library);
  assert.equal(library.names.length, 30);
  assert.equal(new Set(library.names).size, 30);
});

test("indicator library calculates values from historical OHLCV candles", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  const candles = Array.from({ length: 90 }, (_, i) => {
    const close = 1.08 + i * 0.0002 + Math.sin(i / 4) * 0.001;
    return { open: close - 0.0001, high: close + 0.0004, low: close - 0.0004, close, volume: 100 + i };
  });
  const values = context.window.HikeyFXIndicators.calculate(candles);
  assert.equal(Object.keys(values).length, 30);
  for (const name of ["Moving Average", "Exponential Moving Average", "Bollinger Bands", "Average True Range", "Relative Strength Index", "MACD", "On Balance Volume", "Ichimoku Kinko Hyo"]) {
    assert.notEqual(values[name], null, name + " should have a calculated value");
  }
  assert.ok(Number.isFinite(values["Relative Strength Index"]));
  assert.ok(values["Bollinger Bands"].upper > values["Bollinger Bands"].lower);
});

test("indicator library refuses insufficient and malformed candle series", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  assert.equal(Object.keys(context.window.HikeyFXIndicators.calculate([])).length, 0);
  assert.equal(Object.keys(context.window.HikeyFXIndicators.calculate([{ open: 1, high: 1, low: 1, close: "bad" }])).length, 0);
});
