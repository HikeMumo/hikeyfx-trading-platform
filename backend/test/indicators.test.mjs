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
  assert.equal(values.series["Commodity Channel Index"].findIndex(Number.isFinite), 13, "default CCI should use 14 bars");
  assert.equal(values.series["Relative Strength Index"].findIndex(Number.isFinite), 14);
  assert.ok(Number.isFinite(values["Average Directional Movement Index"]));
  assert.equal(values.series["Average Directional Movement Index"].findIndex(Number.isFinite), 26, "Wilder ADX should seed after 14 valid DX values");
  assert.ok(Number.isFinite(values["Average True Range"]));
  assert.ok(Number.isFinite(values["Relative Vigor Index"].main));
  assert.equal(values.series["Relative Vigor Index"].main.findIndex(Number.isFinite), 12, "10-period RVI should seed after its first 10 smoothed range values");
  assert.equal(values.series["Relative Vigor Index"].signal.findIndex(Number.isFinite), 15, "RVI signal should use four symmetrically weighted values");
  assert.ok(Number.isFinite(values["Stochastic Oscillator"].signal));
  assert.equal(values.series["Stochastic Oscillator"].signal.findIndex(Number.isFinite), 8, "default 5-3-3 Stochastic should seed its signal at bar 9");
  assert.ok(Number.isFinite(values["Ichimoku Kinko Hyo"].senkouB));
  assert.ok(Number.isFinite(values["Moving Average of Oscillator"]));
  assert.ok(Number.isFinite(values["Money Flow Index"]));
  assert.ok(values["Bollinger Bands"].upper > values["Bollinger Bands"].lower);
  assert.equal(values.series["Moving Average"].length, candles.length);
  const emaSeed = candles.slice(0,20).reduce((sum,candle)=>sum+candle.close,0)/20;
  assert.ok(Math.abs(values.series["Exponential Moving Average"][19]-emaSeed)<1e-12);
  assert.equal(values.series.MACD.signal.findIndex(Number.isFinite), 33);
  assert.equal(values.series.MACD.main.length, candles.length);
  assert.equal(values.series.Alligator.jaw.length, candles.length);
  assert.equal(values.series["Ichimoku Kinko Hyo"].senkouB.length, candles.length);
  for (const [name, series] of Object.entries(values.series)) {
    const components = Array.isArray(series) ? [series] : Object.values(series);
    for (const points of components) {
      assert.equal(points.length, candles.length, name + " series should align with candle timestamps");
      assert.ok(points.every(point => point === null || Number.isFinite(point)), name + " series must not contain NaN or infinite values");
    }
  }
});

test("Awesome Oscillator and Alligator use median price (high plus low divided by two)", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  const candles = Array.from({ length: 90 }, (_, i) => {
    const close = 1.1 + i * 0.0003 + Math.sin(i / 5) * 0.001;
    return { open: close - 0.0002, high: close + 0.0002 + (i % 4) * 0.0003, low: close - 0.0005 - (i % 3) * 0.0002, close };
  });
  const values = context.window.HikeyFXIndicators.calculate(candles);
  const median = candles.map(candle => (candle.high + candle.low) / 2);
  const mean = points => points.reduce((sum, value) => sum + value, 0) / points.length;
  const expectedAo = mean(median.slice(-5)) - mean(median.slice(-34));
  assert.ok(Math.abs(values["Awesome Oscillator"] - expectedAo) < 1e-12);
  const smoothed = Array(median.length).fill(null);
  smoothed[12] = mean(median.slice(0, 13));
  for (let i = 13; i < median.length; i++) smoothed[i] = (smoothed[i - 1] * 12 + median[i]) / 13;
  assert.ok(Math.abs(values.series.Alligator.jaw.at(-1) - smoothed[median.length - 1 - 8]) < 1e-12);
});

test("Envelopes use a 14-period simple average with 0.1 percent bands", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  const candles = Array.from({ length: 40 }, (_, i) => {
    const close = 1.05 + i * 0.0007 + Math.sin(i / 4) * 0.0008;
    return { open: close - 0.0001, high: close + 0.0003, low: close - 0.0003, close };
  });
  const values = context.window.HikeyFXIndicators.calculate(candles);
  const expectedMiddle = candles.slice(-14).reduce((sum, candle) => sum + candle.close, 0) / 14;
  assert.ok(Math.abs(values.series.Envelopes.middle.at(-1) - expectedMiddle) < 1e-12);
  assert.ok(Math.abs(values.series.Envelopes.upper.at(-1) - expectedMiddle * 1.001) < 1e-12);
  assert.ok(Math.abs(values.series.Envelopes.lower.at(-1) - expectedMiddle * 0.999) < 1e-12);
});

test("RSI returns a neutral 50 in a flat market", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  const candles = Array.from({ length: 40 }, () => ({ open: 1, high: 1.001, low: 0.999, close: 1 }));
  const values = context.window.HikeyFXIndicators.calculate(candles);
  assert.equal(values["Relative Strength Index"], 50);
});

test("Force Index is smoothed over 13 periods and Bulls/Bears Power use EMA13", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  const candles = Array.from({ length: 50 }, (_, i) => {
    const close = 1.2 + i * 0.0004 + Math.sin(i / 3) * 0.001;
    return { open: close - 0.0001, high: close + 0.0005, low: close - 0.0006, close, volume: 200 + i * 2 };
  });
  const values = context.window.HikeyFXIndicators.calculate(candles);
  assert.equal(values.series["Force Index"].findIndex(Number.isFinite), 13);
  const rawForce = candles.slice(-13).map((candle, index, window) => {
    const absoluteIndex = candles.length - 13 + index;
    return (candle.close - candles[absoluteIndex - 1].close) * candle.volume;
  });
  const expectedForce = rawForce.reduce((sum, value) => sum + value, 0) / rawForce.length;
  assert.ok(Math.abs(values["Force Index"] - expectedForce) < 1e-9);
  let ema13 = candles.slice(0, 13).reduce((sum, candle) => sum + candle.close, 0) / 13;
  for (let i = 13; i < candles.length; i++) ema13 = candles[i].close * (2 / 14) + ema13 * (12 / 14);
  assert.ok(Math.abs(values["Bears Power"] - (candles.at(-1).low - ema13)) < 1e-12);
  assert.ok(Math.abs(values["Bulls Power"] - (candles.at(-1).high - ema13)) < 1e-12);
});

test("volume indicators remain unavailable when historical provider supplies no volume", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  const candles = Array.from({ length: 40 }, (_, i) => ({
    open: 1 + i * 0.001, high: 1.002 + i * 0.001, low: 0.999 + i * 0.001, close: 1.001 + i * 0.001
  }));
  const values = context.window.HikeyFXIndicators.calculate(candles);
  for (const name of ["Force Index","Money Flow Index","Accumulation/Distribution","On Balance Volume","Volumes"]) {
    assert.equal(values[name], null, name + " must not be fabricated without volume data");
  }
});

test("indicator library refuses insufficient and malformed candle series", async () => {
  const source = await readFile(new URL("../../trading/indicators.js", import.meta.url), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "trading/indicators.js" });
  assert.equal(Object.keys(context.window.HikeyFXIndicators.calculate([])).length, 0);
  assert.equal(Object.keys(context.window.HikeyFXIndicators.calculate([{ open: 1, high: 1, low: 1, close: "bad" }])).length, 0);
});
