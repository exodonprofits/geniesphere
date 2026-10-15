// /shared/js/app-config.js
// Loads runtime configuration for GenieSphere.
// This keeps project URLs/keys out of individual HTML files.
// Note: Supabase anon keys are meant to be public, but centralizing them
// makes rotation + environment switching easier.
//
// Two consumers share this file:
// - Legacy pages call window.GSConfig, which fetches /shared/config.json.
// - The canonical client (shared/js/gs-client.js) reads window.GenieSphereConfig
//   synchronously, so the same public values are set below.
// scripts/package_site.py refuses to package if these values and
// /shared/config.json disagree. Never place secret/service-role keys here.

window.GenieSphereConfig = window.GenieSphereConfig || {
  supabaseUrl: window.GS_SUPABASE_URL || "https://pbojacnagutipfhcxltj.supabase.co",
  supabaseAnonKey: window.GS_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0",
  appName: "GenieSphere",
  environment: "production"
};

(function () {
  const DEFAULT_CONFIG_URL = "/shared/config.json?v=0402";

  async function loadConfig(configUrl = DEFAULT_CONFIG_URL) {
    // Allow override via <meta name="gs-config" content="/path/config.json">
    const meta = document.querySelector('meta[name="gs-config"]');
    const url = (meta && meta.content) ? meta.content : configUrl;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`[GSConfig] Failed to load config: ${res.status} ${res.statusText}`);
    }
    const cfg = await res.json();

    // Back-compat: allow nested supabase config shape
    // { supabase: { url, anonKey } } -> { supabaseUrl, supabaseAnonKey }
    if (cfg && typeof cfg === "object") {
      if (!cfg.supabaseUrl && cfg.supabase && typeof cfg.supabase === "object" && cfg.supabase.url) {
        cfg.supabaseUrl = cfg.supabase.url;
      }
      if (!cfg.supabaseAnonKey && cfg.supabase && typeof cfg.supabase === "object" && cfg.supabase.anonKey) {
        cfg.supabaseAnonKey = cfg.supabase.anonKey;
      }
    }

    // Validate minimal shape
    if (!cfg || typeof cfg !== "object") throw new Error("[GSConfig] Invalid config object");
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      throw new Error("[GSConfig] Missing supabaseUrl or supabaseAnonKey in config");
    }
    return cfg;
  }

  // Cached promise so multiple scripts can await the same config load
  let _configPromise = null;

  function getConfigPromise() {
    if (!_configPromise) _configPromise = loadConfig();
    return _configPromise;
  }

  window.GSConfig = {
    loadConfig,
    getConfigPromise
  };
})();
