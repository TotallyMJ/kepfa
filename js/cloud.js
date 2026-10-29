// Optional cloud sync. Skies stay local-first and fully usable without any of this; Supabase
// (auth + Postgres + Storage) is imported lazily, only when the owner chooses to sign in, so a
// dropped CDN or an offline start never touches the core app. Data is client-safe: the publishable
// key only reaches rows RLS lets this user see.

const API_URL = 'https://bosbwrdkyrglsmrytekj.supabase.co';
const API_KEY = 'sb_publishable_tEYTakmNrRU0Eq82wm7J7A_6i1YAVzM';
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/+esm';

// Sign-in returns to the app root (no hash route), so PKCE's ?code= lands where we can read it.
const redirectUrl = () => `${location.origin}${location.pathname}`;

let clientPromise = null;
function client() {
  if (!clientPromise) {
    clientPromise = import(CDN).then(({ createClient }) => createClient(API_URL, API_KEY, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    }));
  }
  return clientPromise;
}

/** The current session, or null (also null offline or when the CDN can't be reached). */
export async function session() {
  try { const c = await client(); return (await c.auth.getSession()).data.session; }
  catch { return null; }
}

/** Start Google sign-in: redirects away, then back to the app with ?code= to finish. */
export async function signInGoogle() {
  const c = await client();
  return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
}

export async function signOut() {
  try { const c = await client(); await c.auth.signOut(); } catch { /* already gone */ }
}

/** True when the page came back from an OAuth redirect and the client needs to finish sign-in. */
export const returningFromOAuth = () => new URLSearchParams(location.search).has('code');

/** Finish the OAuth round-trip (the client exchanges ?code= on creation), then clean the URL. */
export async function completeSignIn() {
  try { const c = await client(); await c.auth.getSession(); }
  catch { /* leave it; the owner can try again from the sheet */ }
  try {
    const u = new URL(location.href);
    u.search = '';
    history.replaceState(null, '', u.pathname + u.hash);
  } catch { /* the code just stays in the address */ }
}
