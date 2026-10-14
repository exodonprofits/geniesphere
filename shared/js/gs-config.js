// Force GSConfig to use /shared/config.json (works from /dashboard/* and /onboarding/*)
  async function loadConfig(){
    const meta = document.querySelector('meta[name="gs-config"]');
    const url  = meta?.content || '/shared/config.json';
    const res  = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error('[GSConfig] Failed to load ' + url);
    const cfg = await res.json();
    if(!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) throw new Error('[GSConfig] Missing supabaseUrl or supabaseAnonKey in config');
    return cfg;
  }
  const CONFIG_PROMISE = loadConfig();

  async function getClient(){
    const cfg = await CONFIG_PROMISE;
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }
