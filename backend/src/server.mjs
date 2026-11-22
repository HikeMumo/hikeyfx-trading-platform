import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { DemoTradingEngine } from "./engine.mjs";
import { fetchTraderMadeQuotes } from "./market-data.mjs";

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8787);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

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

export function createApp(engine = new DemoTradingEngine(), marketData = fetchTraderMadeQuotes, authenticateUser = authenticate) {
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
      return send(res, 200, { ok: true, service: "hikeyfx-demo-api", mode: "demo-only" });
    }

    const user = await authenticateUser(req);
    if (!user) {
      return send(res, 401, { ok: false, error: "A valid HikeyFX member session is required." });
    }

    if (req.method === "GET" && url.pathname === "/api/v1/demo/account") {
      return send(res, 200, { ok: true, data: engine.getAccount() });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/demo/positions") {
      return send(res, 200, { ok: true, data: engine.snapshot().positions });
    }
    if (req.method === "GET" && url.pathname === "/api/v1/demo/history") {
      return send(res, 200, { ok: true, data: engine.snapshot().history });
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
    if (req.method === "POST" && url.pathname === "/api/v1/demo/orders") {
      try {
        const order = await readJson(req);
        return send(res, 201, { ok: true, data: engine.placeOrder(order) });
      } catch (error) {
        return send(res, error.statusCode || 400, { ok: false, error: error.message });
      }
    }
    const closeMatch = url.pathname.match(/^\/api\/v1\/demo\/positions\/([0-9a-f-]+)\/close$/i);
    if (req.method === "POST" && closeMatch) {
      try {
        return send(res, 200, { ok: true, data: engine.closePosition(closeMatch[1]) });
      } catch (error) {
        return send(res, 404, { ok: false, error: error.message });
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
    console.log("Development demo API. Demo trading remains in-memory and non-production.");
  });
}
