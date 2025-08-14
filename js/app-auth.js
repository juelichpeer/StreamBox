/* app-auth.js — email/pass, OAuth, session watcher (init-safe) */

async function signUp() {
  const email = $("email")?.value.trim(), pw = $("password")?.value;
  if (!email || !pw) return toast("Enter email + password", "error");
  const { error } = await sb.auth.signUp({ email, password: pw });
  if (error) return toast("Sign up failed", "error", error.message);
  toast("Check your email to confirm", "success");
}

async function signIn() {
  const email = $("email")?.value.trim(), pw = $("password")?.value;
  if (!email || !pw) return toast("Enter email + password", "error");
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) return toast("Login failed", "error", error.message);
  setEmail(data.user);
  show("home");
  refresh();
  toast("Welcome", "success");
}

async function signOut() {
  await sb.auth.signOut();
  toast("Signed out", "info");
  show("auth");
}

async function oauth(provider) {
  const redirectTo = window.location.origin + (window.location.pathname || "");
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) toast("OAuth error", "error", error.message);
  else toast("Redirecting…", "info");
}

// Session watcher keeps UI in sync if tab refreshes or OAuth returns
sb.auth.onAuthStateChange((_e, session) => {
  if (session?.user) {
    setEmail(session.user);
    show("home");
    refresh();
  } else {
    show("auth");
  }
});
