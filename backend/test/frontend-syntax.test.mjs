import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("trading page inline JavaScript parses successfully", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1]) && match[2].trim());
  assert.ok(scripts.length > 0, "expected at least one inline trading script");
  for (const [index, match] of scripts.entries()) {
    assert.doesNotThrow(
      () => new vm.Script(match[2], { filename: `trading-inline-${index + 1}.js` }),
      `inline trading script ${index + 1} should parse`
    );
  }
});

test("trading API configuration JavaScript parses successfully", async () => {
  const source = await readFile(new URL("../../trading/api-config.js", import.meta.url), "utf8");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "trading/api-config.js" }));
});


test("admin page inline JavaScript parses successfully", async () => {
  const html = await readFile(new URL("../../admin/index.html", import.meta.url), "utf8");
  const start = html.lastIndexOf("<script>");
  const end = html.indexOf("</script>", start);
  assert.ok(start >= 0 && end > start, "expected an inline admin script");
  assert.doesNotThrow(() => new vm.Script(html.slice(start + 8, end), { filename: "admin-inline.js" }));
});

test("chart exposes working controls for its analytical drawing objects", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  const ids = ["trendTool","horizontalTool","verticalTool","rectangleTool","ellipseTool","rayTool","arrowTool","channelTool","fibonacciTool","triangleTool","gannFanTool","fibArcTool","fibTimeTool","crossTool","diamondTool","measureTool"];
  for (const id of ids) {
    assert.match(html, new RegExp('id="' + id + '"'), id + " control should exist");
    assert.match(html, new RegExp('el\\("' + id + '"\\)\\.addEventListener\\("click"'), id + " control should have a click action");
  }
  for (const type of ["horizontal","vertical","rectangle","ellipse","triangle","fibonacci","channel","gannfan","fibarc","fibtime","cross","diamond","measure"]) {
    assert.ok(html.includes('d.type==="' + type + '"'), type + " drawing should have a renderer");
  }
  assert.ok(!html.includes("function makeCandles"), "synthetic chart candle generator must not remain");
});

test("quotes view provides searchable categories and persistent favourites", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  for (const category of ["All","Favorites","Forex","Indices","Commodities"]) {
    assert.match(html, new RegExp('data-cat="' + category + '"'));
  }
  assert.ok(html.includes('id="search"'));
  assert.ok(html.includes('data-favorite='));
  assert.ok(html.includes('localStorage.setItem("hikeyfx-favourites"'));
  assert.ok(html.includes('function toggleFavourite'));
});

test("instrument information opens a populated accessible detail dialog", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  for (const id of ["instrumentInfoDialog","closeInstrumentInfo","detailSymbol","detailDescription","detailClass","detailBid","detailAsk","detailSpread","detailSource","detailTimestamp"]) {
    assert.ok(html.includes('id="' + id + '"'), id + " should exist");
  }
  assert.ok(html.includes('function openInstrumentInfo'));
  assert.ok(html.includes('aria-modal="true"'));
});

test("trading page contains no duplicate element IDs", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  const ids = [...html.matchAll(/\\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, "element IDs must be unique");
});

test("open positions expose a functional stop-loss and take-profit editor", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  for (const id of ["modifyPositionDialog","modifyStopLoss","modifyTakeProfit","savePositionChanges","cancelPositionChanges"]) {
    assert.ok(html.includes('id="' + id + '"'), id + " should exist");
  }
  assert.ok(html.includes('data-modify='));
  assert.ok(html.includes('"/modify"'));
  assert.ok(html.includes('function savePositionChanges'));
});

test("account panel displays equity, margin, free margin and leverage metrics", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  for (const id of ["balance","equity","usedMargin","freeMargin","marginLevel","leverage"]) {
    assert.ok(html.includes('id="' + id + '"'), id + " should be visible in account metrics");
  }
  assert.ok(html.includes('accountState=data[0]'));
  assert.ok(html.includes('function updateBalance'));
});

test("workspace settings save quote sorting, chart defaults and browser notifications", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  for (const id of ["quoteSort","defaultTimeframe","defaultChartType","browserNotifications","saveWorkspaceSettings","settingsSaveStatus"]) {
    assert.ok(html.includes('id="' + id + '"'), id + " should exist");
  }
  assert.ok(html.includes('localStorage.setItem("hikeyfx-workspace-settings"'));
  assert.ok(html.includes('function loadWorkspaceSettings'));
  assert.ok(html.includes('function saveWorkspaceSettings'));
});

test("open positions expose a validated partial-close workflow", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  for (const id of ["partialCloseDialog","partialCloseVolume","confirmPartialClose","cancelPartialClose"]) {
    assert.ok(html.includes('id="' + id + '"'), id + " should exist");
  }
  assert.ok(html.includes('data-partial='));
  assert.ok(html.includes('function confirmPartialClose'));
  assert.ok(html.includes('"/partial-close"'));
});
