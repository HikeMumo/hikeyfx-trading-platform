(() => {
  const config = window.HIKEYFX_SUPABASE_CONFIG || {};
  const fail = message => {
    document.documentElement.style.visibility = "visible";
    document.body.innerHTML = '<main style="max-width:560px;margin:12vh auto;padding:24px;color:#26231e;font:15px system-ui;background:#fffdf7;border:1px solid #ded6c5;border-radius:14px;box-shadow:0 12px 36px rgba(40,32,20,.08)"><h2>HikeyFX member area</h2><p>' + message.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) + '</p><a style="color:#26734d" href="../auth/">Return to sign in</a></main>';
  };
  if (!window.supabase || !config.url || !config.publishableKey) {
    fail("Supabase connection settings are missing. Please return to member sign-in.");
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  client.auth.getSession().then(async ({ data, error }) => {
    if (error || !data.session) {
      window.location.replace("../auth/");
      return;
    }
    const user = data.session.user;
    const [profileResult, accountResult] = await Promise.all([
      client.from("profiles").select("display_name,phone_e164,country_code").eq("id", user.id).maybeSingle(),
      client.from("trading_accounts").select("id,mode,status,currency,created_at").eq("user_id", user.id).order("created_at", { ascending: true })
    ]);
    if (profileResult.error || accountResult.error) {
      fail("We could not load your member records. Please try signing in again or contact development support. Details: " + (profileResult.error || accountResult.error).message);
      return;
    }
    const profile = profileResult.data || {};
    const accounts = accountResult.data || [];
    const demo = accounts.find(a => a.mode === "demo");
    let demoBalance = null;
    let openPositions = 0;
    let recentHistory = [];
    if (demo && window.HIKEYFX_API_BASE_URL) {
      const headers = { authorization: "Bearer " + data.session.access_token };
      const apiBase = String(window.HIKEYFX_API_BASE_URL).replace(/\/$/, "");
      const [accountResponse, positionsResponse, historyResponse] = await Promise.all([
        fetch(apiBase + "/api/v1/demo/account", { headers, cache: "no-store" }),
        fetch(apiBase + "/api/v1/demo/positions", { headers, cache: "no-store" }),
        fetch(apiBase + "/api/v1/demo/history", { headers, cache: "no-store" })
      ]);
      if (accountResponse.ok) {
        const result = await accountResponse.json();
        if (result.ok && result.data) demoBalance = Number(result.data.balance);
      }
      if (positionsResponse.ok) {
        const result = await positionsResponse.json();
        if (result.ok && Array.isArray(result.data)) openPositions = result.data.length;
      }
      if (historyResponse.ok) {
        const result = await historyResponse.json();
        if (result.ok && Array.isArray(result.data)) recentHistory = result.data.slice(0, 5);
      }
    }
    if (demoBalance === null && demo) {
      const balanceResult = await client.from("demo_account_balances").select("cash_balance").eq("account_id", demo.id).maybeSingle();
      if (!balanceResult.error && balanceResult.data) demoBalance = balanceResult.data.cash_balance;
    }
    const welcome = document.querySelector(".welcome h1");
    const intro = document.querySelector(".welcome p");
    if (welcome) welcome.textContent = "Welcome, " + (profile.display_name || user.email || "HikeyFX member");
    if (intro) intro.textContent = "Signed in as " + (user.email || "authenticated member");
    const metrics = document.querySelectorAll(".metric strong");
    if (metrics[0]) metrics[0].textContent = demoBalance === null ? "Balance pending" : new Intl.NumberFormat("en-US", { style: "currency", currency: demo.currency || "USD" }).format(Number(demoBalance));
    if (metrics[1]) metrics[1].textContent = String(openPositions);
    if (metrics[2]) metrics[2].textContent = "Not started";
    if (metrics[3]) metrics[3].textContent = "Demo only";
    const accountRow = document.querySelector(".main-grid .account");
    if (accountRow && demo) {
      const title = accountRow.querySelector("b");
      const detail = accountRow.querySelector("small");
      if (title) title.textContent = "HikeyFX Demo Account";
      if (detail) detail.textContent = "Account ID · " + demo.id + " · " + demo.currency + " · " + demo.status;
    } else if (accountRow) {
      const detail = accountRow.querySelector("small");
      if (detail) detail.textContent = "No demo account was returned for this member.";
    }
    const activityBody = document.querySelector(".table tbody");
    if (activityBody) {
      activityBody.replaceChildren();
      recentHistory.forEach(item => {
        const tr = document.createElement("tr");
        const activity = document.createElement("td");
        activity.textContent = (item.symbol || "Demo trade") + " · " + (item.side || "").toUpperCase();
        const status = document.createElement("td");
        const pnl = Number(item.realisedPnl || 0);
        status.textContent = (pnl >= 0 ? "+" : "−") + new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(pnl));
        tr.append(activity, status); activityBody.appendChild(tr);
      });
      if (!activityBody.children.length) activityBody.innerHTML = "<tr><td colspan='2'>No completed demo trades yet.</td></tr>";
    }
    const header = document.querySelector(".top");
    const signOut = document.createElement("button");
    signOut.type = "button";
    signOut.textContent = "Sign out";
    signOut.style.cssText = "border:1px solid #3b6548;background:#173022;color:#b5efc5;padding:9px 12px;border-radius:8px;font-weight:700";
    signOut.addEventListener("click", async () => {
      signOut.disabled = true;
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) { signOut.disabled = false; alert("Sign out failed: " + signOutError.message); return; }
      window.location.replace("../auth/");
    });
    if (header) header.appendChild(signOut);
    const notice = document.querySelector(".notice");
    if (notice) notice.innerHTML = "<b>Development status:</b> Member sign-in, profile, demo account and demo trading summaries are connected. Identity verification, deposits, withdrawals and live trading are not enabled. Do not submit payment details or identity documents here.";
    document.documentElement.style.visibility = "visible";
  }).catch(error => fail(error && error.message ? error.message : "Unable to verify your session."));
})();