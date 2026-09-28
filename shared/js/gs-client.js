/** Canonical Supabase client accessor. */
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

    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return client;
  };
})();
