(() => {
  const config = window.HIKEYFX_SUPABASE_CONFIG || {};
  const status = document.getElementById("status");
  const form = document.getElementById("authForm");
  const submit = document.getElementById("submitButton");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const nameField = document.getElementById("nameField");
  const heading = document.getElementById("heading");
  const intro = document.getElementById("intro");
  let mode = "login";
  let client = null;

  const setStatus = message => { status.textContent = message; };
  const setMode = next => {
    mode = next;
    const signup = mode === "signup";
    loginTab.classList.toggle("active", !signup);
    signupTab.classList.toggle("active", signup);
    nameField.hidden = !signup;
    document.getElementById("displayName").required = signup;
    document.getElementById("password").autocomplete = signup ? "new-password" : "current-password";
    heading.textContent = signup ? "Create your account" : "Welcome back";
    intro.textContent = signup
      ? "Register for a HikeyFX development account."
      : "Sign in to access your HikeyFX development account.";
    submit.textContent = signup ? "Create account" : "Sign in";
    setStatus("");
  };

  if (!window.supabase || !config.url || !config.publishableKey ||
      config.url.includes("YOUR-PROJECT-REF") || config.publishableKey.includes("YOUR_SUPABASE")) {
    setStatus("Setup required: add your Supabase project URL and publishable key to auth/config.js. Never use a secret/service_role key here.");
    submit.disabled = true;
    return;
  }

  client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  loginTab.addEventListener("click", () => setMode("login"));
  signupTab.addEventListener("click", () => setMode("signup"));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    setStatus("Please wait…");
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const displayName = document.getElementById("displayName").value.trim();

    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email, password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: new URL("../portal/", window.location.href).href
          }
        });
        if (error) throw error;
        if (!data.session) {
          setStatus("Registration received. Check your email to confirm the address, then return here and sign in.");
          return;
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        setStatus("Sign-in is not complete yet. Check your email confirmation if requested.");
        return;
      }
      const { error: bootstrapError } = await client.rpc("bootstrap_member");
      if (bootstrapError) throw bootstrapError;
      window.location.assign("../portal/");
    } catch (error) {
      setStatus(error && error.message ? error.message : "Unable to complete account access. Please try again.");
    } finally {
      submit.disabled = false;
    }
  });

  client.auth.getSession().then(async ({ data, error }) => {
    if (error || !data.session) return;
    const { error: bootstrapError } = await client.rpc("bootstrap_member");
    if (!bootstrapError) window.location.assign("../portal/");
    else setStatus("You are signed in, but member setup needs attention: " + bootstrapError.message);
  });
})();
