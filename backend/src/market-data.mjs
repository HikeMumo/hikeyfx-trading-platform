const API_BASE = "https://marketdata.tradermade.com/api/v1/live";
const ALLOWED_SYMBOLS = new Set(["EURUSD","GBPUSD","AUDUSD","USDJPY","USDCHF","USDCAD","NZDUSD","XAUUSD","XAGUSD","UK100","SPX500","US30","NAS100","WTI"]);
const MAX_QUOTE_AGE_SECONDS = Number(process.env.MARKET_DATA_MAX_AGE_SECONDS || 120);

const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;
function symbolOf(q) {
  if (typeof q.instrument === "string") return q.instrument.toUpperCase();
  if (typeof q.base_currency === "string" && typeof q.quote_currency === "string") return (q.base_currency + q.quote_currency).toUpperCase();
  return null;
}

export async function fetchTraderMadeQuotes({ symbols = ["EURUSD","GBPUSD","AUDUSD","XAUUSD"], apiKey = process.env.TRADERMADE_API_KEY, fetchImpl = fetch, now = Date.now() } = {}) {
  if (!apiKey) {
    const error = new Error("Market data provider is not configured.");
    error.code = "MARKET_DATA_NOT_CONFIGURED";
    throw error;
  }
  if (!Array.isArray(symbols) || symbols.length < 1 || symbols.length > 20) throw new Error("Request between 1 and 20 supported symbols.");
  const requested = [...new Set(symbols.map(value => String(value).trim().toUpperCase()))];
  if (requested.some(symbol => !ALLOWED_SYMBOLS.has(symbol))) throw new Error("One or more requested instruments are not enabled.");

  const url = new URL(API_BASE);
  url.searchParams.set("currency", requested.join(","));
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("per_quote_ts", "true");

  let response;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch {
    const error = new Error("Market data provider could not be reached.");
    error.code = "MARKET_DATA_UPSTREAM_UNAVAILABLE";
    throw error;
  }
  if (!response.ok) {
    const error = new Error("Market data provider returned an unsuccessful response.");
    error.code = "MARKET_DATA_UPSTREAM_ERROR";
    throw error;
  }
  let payload;
  try { payload = await response.json(); }
  catch {
    const error = new Error("Market data provider returned invalid data.");
    error.code = "MARKET_DATA_INVALID_RESPONSE";
    throw error;
  }
  if (!Array.isArray(payload.quotes)) {
    const error = new Error("Provider returned no quote collection.");
    error.code = "MARKET_DATA_EMPTY";
    throw error;
  }

  const receivedAt = new Date(now).toISOString();
  const quotes = payload.quotes.flatMap(item => {
    const symbol = symbolOf(item);
    if (!symbol || !requested.includes(symbol)) return [];
    const bid = positive(item.bid) ? item.bid : null;
    const ask = positive(item.ask) ? item.ask : null;
    const mid = positive(item.mid) ? item.mid : null;
    if ((!bid || !ask) && !mid) return [];
    if (bid && ask && ask < bid) return [];
    const seconds = Number(item.timestamp ?? payload.timestamp);
    if (!Number.isFinite(seconds) || seconds <= 0) return [];
    const providerTime = new Date(seconds * 1000);
    if (Number.isNaN(providerTime.getTime())) return [];
    const age = (now - providerTime.getTime()) / 1000;
    const status = age < -60 || age > MAX_QUOTE_AGE_SECONDS ? "stale" : "fresh";
    return [{ symbol, bid, ask, mid, providerTimestamp: providerTime.toISOString(), receivedAt, source: "TraderMade", priceType: "provider-reported", isDelayed: null, status }];
  });
  if (!quotes.length) {
    const error = new Error("No valid timestamped quotes were returned.");
    error.code = "MARKET_DATA_EMPTY";
    throw error;
  }
  return { source: "TraderMade", receivedAt, status: quotes.every(q => q.status === "fresh") ? "fresh" : "stale", quotes };
}
