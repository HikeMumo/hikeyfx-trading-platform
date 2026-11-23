import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { DemoTradingEngine } from "./engine.mjs";
import { fetchTraderMadeQuotes, fetchTraderMadeCandles } from "./market-data.mjs";
import { createSupabaseDemoRepository } from "./supabase.mjs";

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const demoRepository = createSupabaseDemoRepository();
const bearerToken = req => (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1] || null;

function send(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "600"
  });
  res.end(JSON.stringify(payload));
}

async function authenticate(req) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const response = await fetch(new URL("/auth/v1/user", SUPABASE_URL), {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${match[1]}`
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user && typeof user.id === "string" ? user : null;
  } catch {
    return null;
  }
}

async function readJson(req) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    const error = new Error("Content-Type must be application/json.");
    error.statusCode = 415;
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 16_384) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(bytes);
  }

  if (size === 0) return {};
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("Request body must be valid JSON."); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }
  return parsed;
}

export function createApp(engine = null, marketData = fetchTraderMadeQuotes, authenticateUser = authenticate, repository = demoRepository, marketHistory = fetchTraderMadeCandles) {
  const memberEngines = new Map();
  const rateBuckets = new Map();
  const ratePolicy = (method, path) => {
    if (method === "GET" && path === "/api/v1/market/quotes") return { name: "quotes", limit: 30 };
    if (method === "GET" && path === "/api/v1/market/candles") return { name: "candles", limit: 30 };
    if (method === "POST" && path === "/api/v1/demo/orders") return { name: "orders", limit: 20 };
    if (method === "POST" && /^\/api\/v1\/demo\/positions\/[0-9a-f-]+\/modify$/i.test(path)) return { name: "modifications", limit: 30 };
    if (method === "POST" && /^\/api\/v1\/demo\/positions\/[0-9a-f-]+\/close$/i.test(path)) return { name: "closes", limit: 30 };
    return { name: "member-api", limit: 120 };
  };
  const consumeRateLimit = (userId, policy, now = Date.now()) => {
    const key = userId + ":" + policy.name;
    let bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + 60_000 };
      rateBuckets.set(key, bucket);
    }
    if (bucket.count >= policy.limit) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    bucket.count += 1;
    if (rateBuckets.size > 5000) {
      for (const [entry, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(entry);
      while (rateBuckets.size > 5000) rateBuckets.delete(rateBuckets.keys().next().value);
    }
    return 0;
  };
  const getMemberEngine = user => {
    if (!memberEngines.has(user.id)) {
      const instance = typeof engine === "function" ? engine() : engine || new DemoTradingEngine();
      memberEngines.set(user.id, instance);
    }
    return memberEngines.get(user.id);
  };
  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
        "access-control-max-age": "600",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY"
      });
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, status: "alive", service: "hikeyfx-demo-api", mode: "demo-only", checks: { supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY), persistentDemoConfigured: Boolean(demoRepository), marketDataConfigured: Boolean(process.env.TRADERMADE_API_KEY) } });
    }

    const user = await authenticateUser(req);
    if (!user || typeof user.id !== "string" || !user.id) {
      return send(res, 401, { ok: false, error: "A valid HikeyFX member session is required." });
    }
    const retryAfterSeconds = consumeRateLimit(user.id, ratePolicy(req.method, url.pathname));
    if (retryAfterSeconds > 0) {
      return send(res, 429, { ok: false, error: "Too many requests. Please retry shortly.", retryAfterSeconds });
    }
    const memberEngine = getMemberEngine(user);
    const token = bearerToken(req);
    const persistent = repository && token;

    if (req.method === "GET" && url.pathname === "/api/v1/demo/account") {
      if (persistent) {
        try {
          const snapshot = await repository.snapshot(token);
          const usedMargin = snapshot.positions.reduce((sum, p) => sum + Number(p.margin || 0), 0);
          const unrealisedPnl = snapshot.positions.reduce((sum, p) => sum + memberEngine.getUnrealisedPnl(p), 0);
          const balance = Number(snapshot.balance);
          const equity = Math.round((balance + unrealisedPnl + Number.EPSILON) * 100) / 100;
          return send(res, 200, { ok: true, data: { currency: "USD", mode: "demo", balance, equity, unrealisedPnl, usedMargin, freeMargin: equity - usedMargin, leverage: 100, accountId: snapshot.accountId } });
        } catch (error) { return send(res, error.statusCode || 503, { ok: false, error: error.message }); }
      }
      return send(res, 200, { ok: true, data: memberEngine.getAccount() });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/demo/positions") {
      if (persistent) {
        try { return send(res, 200, { ok: true, data: (await repository.snapshot(token)).positions }); }
        catch (error) { return send(res, error.statusCode || 503, { ok: false, error: error.message }); }
      }
      return send(res, 200, { ok: true, data: memberEngine.snapshot().positions });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/demo/history") {
      if (persistent) {
        try { return send(res, 200, { ok: true, data: (await repository.snapshot(token)).history }); }
        catch (error) { return send(res, error.statusCode || 503, { ok: false, error: error.message }); }
      }
      return send(res, 200, { ok: true, data: memberEngine.snapshot().history });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/market/quotes") {
      try {
        const rawSymbols = url.searchParams.get("symbols");
        const result = await marketData(rawSymbols ? { symbols: rawSymbols.split(",") } : {});
        return send(res, 200, { ok: true, data: result.quotes, source: result.source, receivedAt: result.receivedAt, status: result.status });
      } catch (error) {
        const notConfigured = error.code === "MARKET_DATA_NOT_CONFIGURED";
        return send(res, notConfigured ? 503 : 502, {
          ok: false,
          status: notConfigured ? "unavailable" : "provider-error",
          error: notConfigured ? "Market data is not configured." : "Genuine market data is temporarily unavailable."
        });
      }
    }

    if (req.method === "GET" && url.pathname === "/api/v1/market/candles") {
      try {
        const symbol = String(url.searchParams.get("symbol") || "").toUpperCase();
        const timeframe = String(url.searchParams.get("timeframe") || "15m");
        const result = await marketHistory({ symbol, timeframe });
        return send(res, 200, { ok: true, data: result.candles, source: result.source, receivedAt: result.receivedAt, symbol: result.symbol, timeframe: result.timeframe });
      } catch (error) {
        const notConfigured = error.code === "MARKET_DATA_NOT_CONFIGURED";
        const forbidden = error.code === "MARKET_DATA_HISTORY_FORBIDDEN";
        return send(res, notConfigured ? 503 : forbidden ? 403 : error.code === "MARKET_DATA_EMPTY" ? 404 : 502, {
          ok: false, status: notConfigured ? "unavailable" : forbidden ? "plan-restricted" : "provider-error",
          error: notConfigured ? "Historical market data is not configured." : error.message
        });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/v1/demo/orders") {
      try {
        const order = await readJson(req);
        if (persistent) {
          const symbol = String(order.symbol || "").replace("/", "").toUpperCase();
          const quote = memberEngine.getQuote(symbol);
          const side = String(order.side || "").toLowerCase();
          const entryPrice = side === "buy" ? quote.ask : side === "sell" ? quote.bid : NaN;
          const data = await repository.placeOrder(token, { symbol, side, volume: order.volume, entryPrice, contractSize: quote.contractSize, stopLoss: order.stopLoss, takeProfit: order.takeProfit, leverage: 100, idempotencyKey: String(order.idempotencyKey || randomUUID()) });
          return send(res, 201, { ok: true, data });
        }
        return send(res, 201, { ok: true, data: memberEngine.placeOrder(order) });
      } catch (error) {
        return send(res, error.statusCode || 400, { ok: false, error: error.message });
      }
    }
    const modifyMatch = url.pathname.match(/^\\/api\\/v1\\/demo\\/positions\\/([0-9a-f-]+)\\/modify$/i);
    if (req.method === "POST" && modifyMatch) {
      try {
        const body = await readJson(req);
        const levels = {
          stopLoss: body.stopLoss === null || body.stopLoss === undefined || body.stopLoss === "" ? null : Number(body.stopLoss),
          takeProfit: body.takeProfit === null || body.takeProfit === undefined || body.takeProfit === "" ? null : Number(body.takeProfit)
        };
        if (persistent) {
          const snapshot = await repository.snapshot(token);
          if (!snapshot.positions.some(item => item.id === modifyMatch[1])) {
            return send(res, 404, { ok: false, error: "Open demo position not found." });
          }
          const data = await repository.modifyPosition(token, modifyMatch[1], levels);
          return send(res, 200, { ok: true, data });
        }
        return send(res, 200, { ok: true, data: memberEngine.modifyPosition(modifyMatch[1], levels) });
      } catch (error) {
        return send(res, error.statusCode || 400, { ok: false, error: error.message });
      }
    }
    const closeMatch = url.pathname.match(/^\/api\/v1\/demo\/positions\/([0-9a-f-]+)\/close$/i);
    if (req.method === "POST" && closeMatch) {
      try {
        if (persistent) {
          const snapshot = await repository.snapshot(token);
          const position = snapshot.positions.find(item => item.id === closeMatch[1]);
          if (!position) return send(res, 404, { ok: false, error: "Open demo position not found." });
          const quote = memberEngine.getQuote(position.symbol);
          const exitPrice = position.side === "buy" ? quote.bid : quote.ask;
          const data = await repository.closePosition(token, closeMatch[1], exitPrice);
          return send(res, 200, { ok: true, data });
        }
        return send(res, 200, { ok: true, data: memberEngine.closePosition(closeMatch[1]) });
      } catch (error) {
        return send(res, error.statusCode || 404, { ok: false, error: error.message });
      }
    }
    return send(res, 404, { ok: false, error: "Route not found." });
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const server = createApp();
  server.listen(PORT, HOST, () => {
    console.log(`HikeyFX demo API listening on port ${PORT}`);
    console.log(demoRepository ? "Persistent Supabase demo repository enabled; demo-only and non-production." : "Supabase persistence is not configured; in-memory demo mode only.");
  });
}
