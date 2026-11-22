(() => {
  const config = window.HIKEYFX_SUPABASE_CONFIG || {};
  const fail = message => {
    document.documentElement.style.visibility = "visible";
    document.body.innerHTML = '<main style="max-width:560px;margin:12vh auto;padding:24px;color:#edf5ef;font:15px system-ui;background:#111a15;border:1px solid #26372c;border-radius:14px"><h2>HikeyFX member area</h2><p>' + message.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) + '</p><a style="color:#b5efc5" href="../auth/">Return to sign in</a></main>';
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
    if (demo) {
      const balanceResult = await client.from("demo_account_balances").select("cash_balance").eq("account_id", demo.id).maybeSingle();
      if (!balanceResult.error && balanceResult.data) demoBalance = balanceResult.data.cash_balance;
    }
    const welcome = document.querySelector(".welcome h1");
    const intro = document.querySelector(".welcome p");
    if (welcome) welcome.textContent = "Welcome, " + (profile.display_name || user.email || "HikeyFX member");
    if (intro) intro.textContent = "Signed in as " + (user.email || "authenticated member");
    const metrics = document.querySelectorAll(".metric strong");
    if (metrics[0]) metrics[0].textContent = demoBalance === null ? "Balance pending" : new Intl.NumberFormat("en-US", { style: "currency", currency: demo.currency || "USD" }).format(Number(demoBalance));
    if (metrics[1]) metrics[1].textContent = "—";
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
    if (activityBody) activityBody.innerHTML = "<tr><td colspan='2'>No live activity feed is connected yet.</td></tr>";
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
    if (notice) notice.innerHTML = "<b>Development status:</b> Your sign-in and profile/account records are connected. Demo balance, positions, KYC workflows, payments and live trading are not connected to this page. Do not submit payment details or identity documents here.";
    document.documentElement.style.visibility = "visible";
  }).catch(error => fail(error && error.message ? error.message : "Unable to verify your session."));
})();