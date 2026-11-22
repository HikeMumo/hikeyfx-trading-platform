import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { DemoTradingEngine } from "./engine.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);

function send(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY"
  });
  res.end(JSON.stringify(payload));
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

export function createApp(engine = new DemoTradingEngine()) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, service: "hikeyfx-demo-api", mode: "demo-only" });
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
      return send(res, 200, { ok: true, data: engine.snapshot().quotes, source: "fictional-seed-prices" });
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
    console.log(`HikeyFX demo API listening at http://${HOST}:${PORT}`);
    console.log("Demo-only, in-memory data. Do not expose to the public internet.");
  });
}
