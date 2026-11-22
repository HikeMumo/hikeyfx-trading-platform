const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

export function createSupabaseDemoRepository({ fetchImpl = fetch } = {}) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  async function rpc(accessToken, name, args = {}) {
    let response;
    try {
      response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, SUPABASE_URL), {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(10000)
      });
    } catch {
      const error = new Error("Persistent demo service is temporarily unavailable.");
      error.statusCode = 503;
      throw error;
    }
    if (!response.ok) {
      let message = "Persistent demo service is temporarily unavailable.";
      try {
        const payload = await response.json();
        if (typeof payload.message === "string" && /invalid|insufficient|not found|enabled|stop loss|take profit/i.test(payload.message)) message = payload.message;
      } catch {}
      const error = new Error(message);
      error.statusCode = response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 429 ? 429 : response.status >= 500 ? 503 : 400;
      throw error;
    }
    return response.json();
  }
  return {
    snapshot: token => rpc(token, "hikeyfx_demo_snapshot"),
    placeOrder: (token, order) => rpc(token, "hikeyfx_demo_place_order", {
      p_symbol: order.symbol,
      p_side: order.side,
      p_volume: order.volume,
      p_entry_price: order.entryPrice,
      p_contract_size: order.contractSize,
      p_stop_loss: order.stopLoss ?? null,
      p_take_profit: order.takeProfit ?? null,
      p_leverage: order.leverage ?? 100,
      p_idempotency_key: order.idempotencyKey
    }),
    closePosition: (token, id, exitPrice, reason = "manual") => rpc(token, "hikeyfx_demo_close_position", {
      p_position_id: id,
      p_exit_price: exitPrice,
      p_reason: reason
    })
  };
}
