/**
 * Canonical Supabase client accessor (one client per page).
 * Depends on /shared/js/app-config.js and the Supabase JS library.
 *
 * - New code: window.GenieSphere.getSupabase() (synchronous).
 * - Legacy pages: window.GSClient.getAsync() / getSync(), kept for the live
 *   pages that still call them. Both return the same client instance.
 *
 * The client is created synchronously from window.GenieSphereConfig, so
 * concurrent callers cannot race into two createClient() calls (the cause of
 * the Edge auth-lock AbortError the old async version guarded against). A
 * failed attempt leaves no client behind, so the next call retries.
 */
(function () {
  let client = null;

  window.GenieSphere = window.GenieSphere || {};

  window.GenieSphere.getSupabase = function getSupabase() {
    if (client) return client;

    const cfg = window.GenieSphereConfig || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      throw new Error('GenieSphere Supabase configuration is missing.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('Supabase JS library is not loaded.');
    }

    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return client;
  };

  window.GSClient = {
    getAsync: async function getAsync() {
      return window.GenieSphere.getSupabase();
    },
    // Returns null until a client has been created.
    getSync: function getSync() {
      return client;
    }
  };
})();
