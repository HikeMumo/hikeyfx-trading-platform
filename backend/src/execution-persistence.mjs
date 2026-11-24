const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createSupabaseExecutionRepository({ fetchImpl = fetch } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  async function rpc(name, args) {
    const response = await fetchImpl(new URL("/rest/v1/rpc/" + name, SUPABASE_URL), {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      const error = new Error("Execution persistence service rejected the operation.");
      error.statusCode = response.status >= 500 ? 503 : 409;
      throw error;
    }
    return response.json();
  }
  return {
    async reserve(userId, key, hash) {
      const result = await rpc("hikeyfx_execution_idempotency_reserve", {
        p_user_id: userId, p_key: key, p_request_sha256: hash
      });
      return result;
    },
    async complete(userId, key, result) {
      return rpc("hikeyfx_execution_idempotency_complete", {
        p_user_id: userId, p_key: key, p_response: result
      });
    },
    async fail() {
      // A pre-submission failure must remain reserved until operator reconciliation.
      // Releasing a key here could permit an unsafe duplicate if the process boundary is unclear.
      return;
    },
    async markUnknown(userId, key, error) {
      return rpc("hikeyfx_execution_idempotency_mark_unknown", {
        p_user_id: userId, p_key: key, p_error_code: error?.code || "EXECUTION_UNCERTAIN"
      });
    },
    async recordAcknowledgement(record) {
      return rpc("hikeyfx_execution_record_acknowledgement", {
        p_user_id: record.userId,
        p_account_id: record.accountId,
        p_client_order_id: record.clientOrderId,
        p_provider_code: record.providerCode,
        p_provider_order_id: record.providerOrderId,
        p_symbol: record.symbol,
        p_side: record.side,
        p_requested_volume: record.requestedVolume,
        p_executed_volume: record.executedVolume,
        p_average_fill_price: record.averagePrice,
        p_status: record.status,
        p_provider_execution_id: record.providerExecutionId || null,
        p_executed_at: record.executedAt
      });
    }
  };
}
