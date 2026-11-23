const BASE_URL = "https://api.twelvedata.com/time_series";
const SYMBOLS = {
  EURUSD: "EUR/USD", GBPUSD: "GBP/USD", AUDUSD: "AUD/USD",
  USDJPY: "USD/JPY", USDCHF: "USD/CHF", USDCAD: "USD/CAD",
  NZDUSD: "NZD/USD", XAUUSD: "XAU/USD", XAGUSD: "XAG/USD"
};
const INTERVALS = {
  "1m": "1min", "2m": "1min", "3m": "1min", "4m": "1min",
  "5m": "5min", "6m": "1min", "10m": "1min", "12m": "1min",
  "15m": "15min", "20m": "1min", "30m": "30min",
  "1h": "1h", "2h": "2h", "3h": "1h", "4h": "4h",
  "6h": "1h", "8h": "8h", "12h": "1h",
  "1D": "1day", "1W": "1week", "1M": "1month"
};
const MINUTES = Object.fromEntries(Object.keys(INTERVALS).map(tf => [
  tf, tf.endsWith("m") ? Number(tf.slice(0, -1)) : tf.endsWith("h") ? Number(tf.slice(0, -1)) * 60 : null
]));
const error = (message, code) => Object.assign(new Error(message), { code });

function bucketStart(date, timeframe) {
  const d = new Date(date);
  if (timeframe === "1W") {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (timeframe === "1M") {
    d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (timeframe === "1D") {
    d.setUTCHours(0, 0, 0, 0); return d.toISOString();
  }
  const minutes = MINUTES[timeframe];
  const span = minutes * 60_000;
  return new Date(Math.floor(d.getTime() / span) * span).toISOString();
}

function aggregate(rows, timeframe) {
  const groups = new Map();
  for (const row of rows) {
    const key = bucketStart(row.time, timeframe);
    const current = groups.get(key);
    if (!current) groups.set(key, { time: key, open: row.open, high: row.high, low: row.low, close: row.close });
    else {
      current.high = Math.max(current.high, row.high);
      current.low = Math.min(current.low, row.low);
      current.close = row.close;
    }
  }
  return [...groups.values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

export async function fetchTwelveDataCandles({
  symbol, timeframe = "15m", apiKey = process.env.TWELVE_DATA_API_KEY,
  fetchImpl = fetch, now = Date.now()
} = {}) {
  if (!apiKey) throw error("Twelve Data historical market data is not configured.", "MARKET_DATA_NOT_CONFIGURED");
  const code = String(symbol || "").trim().toUpperCase();
  const tf = String(timeframe || "");
  const providerSymbol = SYMBOLS[code];
  const interval = INTERVALS[tf];
  if (!providerSymbol) throw error("This instrument is not mapped to Twelve Data historical coverage.", "MARKET_DATA_SYMBOL_UNAVAILABLE");
  if (!interval) throw new Error("Unsupported chart timeframe.");

  const url = new URL(BASE_URL);
  url.searchParams.set("symbol", providerSymbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", "5000");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("order", "ASC");
  url.searchParams.set("apikey", apiKey);

  let response;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  } catch {
    throw error("Twelve Data historical provider could not be reached.", "MARKET_DATA_UPSTREAM_UNAVAILABLE");
  }
  if (!response.ok) {
    throw error("Twelve Data rejected the historical candle request.", response.status === 401 || response.status === 403 ? "MARKET_DATA_HISTORY_FORBIDDEN" : "MARKET_DATA_UPSTREAM_ERROR");
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw error("Twelve Data returned invalid historical data.", "MARKET_DATA_INVALID_RESPONSE"); }
  if (!Array.isArray(payload.values)) {
    const message = String(payload.message || payload.status || "No historical candle series was returned.");
    const restricted = /plan|permission|not available|not supported|api key|credits|trial/i.test(message);
    throw error(restricted ? "Twelve Data restricted this symbol or interval for the current API plan." : message,
      restricted ? "MARKET_DATA_HISTORY_FORBIDDEN" : "MARKET_DATA_EMPTY");
  }

  const rows = payload.values.flatMap(item => {
    const open = Number(item.open), high = Number(item.high), low = Number(item.low), close = Number(item.close);
    const time = Date.parse(String(item.datetime || "").replace(" ", "T") + (/[zZ]|[+-]\\d{2}:?\\d{2}$/.test(String(item.datetime || "")) ? "" : "Z"));
    if (![open, high, low, close, time].every(Number.isFinite) || Math.min(open, high, low, close) <= 0 ||
        high < Math.max(open, close, low) || low > Math.min(open, close, high)) return [];
    return [{ time: new Date(time).toISOString(), open, high, low, close }];
  }).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

  if (!rows.length) throw error("Twelve Data returned no valid OHLC candles.", "MARKET_DATA_EMPTY");
  const candles = (interval === (tf.endsWith("m") ? (tf === "1m" ? "1min" : tf === "5m" ? "5min" : tf === "15m" ? "15min" : tf === "30m" ? "30min" : "") : interval) &&
    ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "1D", "1W", "1M"].includes(tf))
    ? rows : aggregate(rows, tf);
  const result = candles.slice(-240);
  if (!result.length) throw error("Twelve Data returned no candles for this chart request.", "MARKET_DATA_EMPTY");
  return { source: "Twelve Data historical", symbol: code, timeframe: tf, receivedAt: new Date(now).toISOString(), candles: result };
}
