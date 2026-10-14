// /js/supabase-init.js  (ES module)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** ───────────────────────────────────────────────────────────────────
 *  1) Project keys – keep only here
 *  (Use your real URL/key; anon key is safe for public clients)
 *  ─────────────────────────────────────────────────────────────────── */
export const SUPABASE_URL = "https://pbojacnagutipfhcxltj.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0";

/** ───────────────────────────────────────────────────────────────────
 *  2) Client with session persistence
 *  ─────────────────────────────────────────────────────────────────── */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handle magic-link / OAuth redirects
  },
});

/** ───────────────────────────────────────────────────────────────────
 *  3) Auth helpers
 *  ─────────────────────────────────────────────────────────────────── */

/** Send a passwordless magic-link (OTP) to email. */
export async function signInWithOtp(email, { redirectTo } = {}) {
  const url = redirectTo ?? window.location.origin + window.location.pathname;
  return await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: url }, // where the magic link returns
  });
}

/** Start OAuth (e.g., 'google', 'github'). */
export async function signInWithOAuth(provider, { redirectTo } = {}) {
  const url = redirectTo ?? window.location.origin + window.location.pathname;
  return await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: url },
  });
}

/** Sign out (clears local session). */
export async function signOut() {
  return await supabase.auth.signOut();
}

/** Get current session (access/refresh tokens) if any. */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Get current user (or null). */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/** Require auth (redirects if not logged in). */
export async function requireAuth(redirect = '/login.html') {
  const user = await getUser();
  if (user) return user;
  const next = encodeURIComponent(location.pathname + location.search);
  location.replace(`${redirect}?next=${next}`);
  return null;
}

/** Subscribe to auth state changes. */
export function onAuthChanged(callback) {
  // callback({ event, session })
  const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
    callback({ event, session });
  });
  return () => sub.subscription.unsubscribe();
}

/** ───────────────────────────────────────────────────────────────────
 *  4) Redirect/session recovery on load
 *     - Handles magic-link/OAuth returns.
 *     - Shows a friendlier console message when errors are in the URL.
 *  ─────────────────────────────────────────────────────────────────── */
async function handleReturnUrl() {
  try {
    // Supabase v2 will auto-detect session in URL with detectSessionInUrl:true.
    // But we can surface common errors for clarity:
    const hash = new URL(window.location.href).hash || '';
    const qs = new URL(window.location.href).searchParams;

    const err = qs.get('error') || (hash.includes('error=') ? new URLSearchParams(hash.slice(1)).get('error') : null);
    const errDesc = qs.get('error_description') || (hash.includes('error_description=') ? new URLSearchParams(hash.slice(1)).get('error_description') : null);

    if (err) {
      console.warn('Auth redirect error:', err, errDesc || '');
      // Optional: show a toast/banner in your app
      // alert(`Sign-in issue: ${decodeURIComponent(errDesc || err)}`);
    }

    // Clean noisy fragments like #access_token=... from the URL bar
    if (hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('type=')) {
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
    }
  } catch (e) {
    console.debug('Auth return handling skipped:', e);
  }
}

handleReturnUrl();

/** ───────────────────────────────────────────────────────────────────
 *  5) Legacy shim (optional):
 *     If some old code still expects window.supabase.createClient,
 *     expose just that constructor globally (not your URL/key).
 *  ─────────────────────────────────────────────────────────────────── */
if (!window.supabase) {
  window.supabase = { createClient };
}

// Build a redirect URL that matches the current origin + folder
export function buildRedirect(next = 'trip-dashboard.html') {
  const { origin, pathname } = window.location;
  const base = pathname.slice(0, pathname.lastIndexOf('/') + 1);
  return origin + base + next;
}

// supabase-init.js (keep your existing lines above)

// Create a shared Supabase client for all pages
// Requires the Supabase JS library to be loaded first.
if (window.supabase && !window.supabaseClient) {
  const { createClient } = window.supabase;
  window.supabaseClient = createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
}
