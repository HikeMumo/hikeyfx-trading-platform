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

const HISTORY_API_BASE = "https://marketdata.tradermade.com/api/v1/timeseries";
const HISTORY_SYMBOLS = new Set(["EURUSD","GBPUSD","AUDUSD","USDJPY","USDCHF","USDCAD","NZDUSD","XAUUSD","XAGUSD","UK100","SPX500","US30","NAS100","WTI"]);
const TIMEFRAME_CONFIG = {
"1m":["minute",1,2],"2m":["minute",1,2],"3m":["minute",1,2],"4m":["minute",1,2],
"5m":["minute",5,2],"6m":["minute",1,2],"10m":["minute",10,2],"12m":["minute",1,2],
"15m":["minute",15,2],"20m":["minute",1,2],"30m":["minute",30,2],
"1h":["hourly",1,30],"2h":["hourly",2,30],"3h":["hourly",1,30],
"4h":["hourly",4,30],"6h":["hourly",6,30],"8h":["hourly",8,30],"12h":["hourly",1,30],
"1D":["daily",1,365],"1W":["daily",1,365],"1M":["daily",1,365]
};
const isoDate = date => date.toISOString().slice(0,19).replace("T","-");
function bucketStart(date,timeframe) {
 const d=new Date(date);
 if(timeframe==="1W"){const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);d.setUTCHours(0,0,0,0);return d.toISOString()}
 if(timeframe==="1M"){d.setUTCDate(1);d.setUTCHours(0,0,0,0);return d.toISOString()}
 const minutes=timeframe.endsWith("m")?Number(timeframe.slice(0,-1)):Number(timeframe.slice(0,-1))*60;
 const span=minutes*60000;return new Date(Math.floor(d.getTime()/span)*span).toISOString();
}
function aggregateCandles(rows,timeframe) {
 if(["1m","5m","10m","15m","30m","1h","2h","4h","6h","8h","1D"].includes(timeframe))return rows;
 const groups=new Map();
 for(const row of rows){const key=bucketStart(row.time,timeframe),item=groups.get(key);if(!item)groups.set(key,{time:key,open:row.open,high:row.high,low:row.low,close:row.close});else{item.high=Math.max(item.high,row.high);item.low=Math.min(item.low,row.low);item.close=row.close}}
 return [...groups.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
}
export async function fetchTraderMadeCandles({symbol,timeframe="15m",apiKey=process.env.TRADERMADE_API_KEY,fetchImpl=fetch,now=Date.now()}={}) {
 if(!apiKey){const error=new Error("Historical market data is not configured.");error.code="MARKET_DATA_NOT_CONFIGURED";throw error}
 const code=String(symbol||"").trim().toUpperCase(),tf=String(timeframe||""),config=TIMEFRAME_CONFIG[tf];
 if(!HISTORY_SYMBOLS.has(code))throw new Error("This instrument does not have enabled historical data.");
 if(!config)throw new Error("Unsupported chart timeframe.");
 const [interval,period,days]=config,end=new Date(now),start=new Date(now-days*86400000),url=new URL(HISTORY_API_BASE);
 url.searchParams.set("currency",code);
 url.searchParams.set("start_date",interval==="daily"?start.toISOString().slice(0,10):isoDate(start));
 url.searchParams.set("end_date",interval==="daily"?end.toISOString().slice(0,10):isoDate(end));
 url.searchParams.set("interval",interval);url.searchParams.set("period",String(period));url.searchParams.set("format","records");url.searchParams.set("api_key",apiKey);
 let response;
 try{response=await fetchImpl(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(12000)})}catch{const error=new Error("Historical market data provider could not be reached.");error.code="MARKET_DATA_UPSTREAM_UNAVAILABLE";throw error}
 if(!response.ok){const error=new Error("Historical candles are unavailable for this account or request.");error.code=response.status===401||response.status===403?"MARKET_DATA_HISTORY_FORBIDDEN":"MARKET_DATA_UPSTREAM_ERROR";throw error}
 let payload;try{payload=await response.json()}catch{const error=new Error("Historical provider returned invalid data.");error.code="MARKET_DATA_INVALID_RESPONSE";throw error}
 if(!Array.isArray(payload.quotes)){const error=new Error("Historical provider returned no candle collection.");error.code="MARKET_DATA_EMPTY";throw error}
 const rows=payload.quotes.flatMap(item=>{const open=Number(item.open),high=Number(item.high),low=Number(item.low),close=Number(item.close),time=Date.parse(item.date||item.datetime||"");if(![open,high,low,close,time].every(Number.isFinite)||Math.min(open,high,low,close)<=0||high<Math.max(open,close,low)||low>Math.min(open,close,high))return[];return[{time:new Date(time).toISOString(),open,high,low,close}]}).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 const candles=aggregateCandles(rows,tf).slice(-240);
 if(!candles.length){const error=new Error("No historical candles were returned for this instrument and timeframe.");error.code="MARKET_DATA_EMPTY";throw error}
 return{source:"TraderMade historical",symbol:code,timeframe:tf,receivedAt:new Date(now).toISOString(),candles};
}
