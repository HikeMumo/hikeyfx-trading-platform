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
  const ids = ["trendTool","horizontalTool","verticalTool","rectangleTool","ellipseTool","rayTool","arrowTool","channelTool","fibonacciTool","triangleTool","gannFanTool","fibArcTool","fibTimeTool","crossTool","diamondTool","measureTool","horizontalRayTool","verticalRayTool","fibFanTool","fibExtensionTool","pitchforkTool","gannGridTool","textTool"];
  for (const id of ids) {
    assert.match(html, new RegExp('id="' + id + '"'), id + " control should exist");
    assert.match(html, new RegExp('el\\("' + id + '"\\)\\.addEventListener\\("click"'), id + " control should have a click action");
  }
  for (const type of ["horizontal","vertical","rectangle","ellipse","triangle","fibonacci","channel","gannfan","fibarc","fibtime","cross","diamond","measure","horizontalray","verticalray","fibfan","fibextension","pitchfork","gannGrid","text"]) {
    assert.ok(html.includes('d.type==="' + type + '"'), type + " drawing should have a renderer");
  }
  assert.ok(!html.includes("function makeCandles"), "synthetic chart candle generator must not remain");
});

test("chart indicator toggles share one calculated series with the 30-indicator library", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('var activeIndicators=new Set(["Moving Average"])'));
  assert.ok(html.includes('function syncIndicatorButtons()'));
  assert.ok(html.includes('activeIndicators.add("Exponential Moving Average")'));
  assert.ok(html.includes('activeIndicators.add("Bollinger Bands")'));
  assert.ok(html.includes('syncIndicatorButtons();updateIndicatorValues();drawChart()'));
  assert.ok(html.includes('series["Moving Average"]'));
  assert.ok(!html.includes('avg/=7'), "legacy seven-period moving average must not conflict with the 20-period library calculation");
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

test("trade workspace exposes a confirmed close-all positions action", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('id="closeAllPositions"'));
  assert.ok(html.includes('function closeAllPositions'));
  assert.ok(html.includes('window.confirm("Close all "'));
  assert.ok(html.includes('"/close"'));
});

test("chart drawings can be selected, resized by endpoint dragging and deleted", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('id="deleteSelectedDrawing"'));
  assert.ok(html.includes('selectedDrawingIndex=-1,drawingEdit=false,drawingEditMode'));
  assert.ok(html.includes('Math.hypot(p.x-endPoint.x,p.y-endPoint.y)<=14'));
  assert.ok(html.includes('edit.x2=edit.x1+dx*Math.cos(angle)-dy*Math.sin(angle)'));
  assert.ok(html.includes('if(drawingEdit){drawingEdit=false;drawingEditMode=""'));
});

test("chart drawings expose a rotation handle and persist rotated geometry", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('function drawingRotationHandle'));
  assert.ok(html.includes('ctx.rotate(d.angle)'));
  assert.ok(html.includes('drawingEditMode==="rotate"'));
  assert.ok(html.includes('edit.angle=drawingEditStartAngle'));
  assert.ok(html.includes('JSON.stringify(drawings)'));
});

test("chart drawings can be removed with a long press on a selected handle", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('drawingHoldTimer=setTimeout'));
  assert.ok(html.includes('},1800)'));
  assert.ok(html.includes('drawings.splice(hit,1)'));
  assert.ok(html.includes('clearTimeout(drawingHoldTimer)'));
});

test("chart analytical object library includes 23 drawing tools", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  const toolIds = ["trendTool","horizontalTool","verticalTool","rectangleTool","ellipseTool","rayTool","arrowTool","channelTool","fibonacciTool","triangleTool","gannFanTool","fibArcTool","fibTimeTool","crossTool","diamondTool","measureTool","horizontalRayTool","verticalRayTool","fibFanTool","fibExtensionTool","pitchforkTool","gannGridTool","textTool"];
  assert.equal(toolIds.length, 23);
  for (const id of toolIds) assert.ok(html.includes('id="' + id + '"'), id + " should exist");
  assert.ok(html.includes('window.prompt("Chart text","Text")'));
});

test("history workspace includes a separate account journal view", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('id="tabJournal"'));
  assert.ok(html.includes('id="journalTable"'));
  assert.ok(html.includes('id="journalBody"'));
  assert.ok(html.includes('apiRequest("/api/v1/demo/journal")'));
  assert.ok(html.includes('function renderJournal'));
  assert.ok(html.includes('textContent=String(event.eventType'));
});

test("account journal can be filtered by event name and event details", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('id="journalSearch"'));
  assert.ok(html.includes('id="journalTools"'));
  assert.ok(html.includes('filtered=journal.filter'));
  assert.ok(html.includes('el("journalSearch").addEventListener("input",renderJournal)'));
});

test("quote status is based on the selected instrument's own provider source", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('selected.quoteSource==="TraderMade"'));
  assert.ok(html.includes('selected.ch+" · Fallback reference quote"'));
  assert.ok(html.includes('asset.quoteSource="TraderMade"'));
});

test("chart selection state resets when changing instrument or timeframe", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('selectedDrawingIndex=-1;drawingEdit=false;drawingEditMode=""'));
});
