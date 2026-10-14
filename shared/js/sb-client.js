// /shared/js/sb-client.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

// Safe storage wrapper (prevents crashes when storage is blocked)
function safeStorage(preferred) {
  const mem = new Map();
  return {
    getItem(k) { try { return preferred?.getItem?.(k) ?? mem.get(k) ?? null; } catch { return mem.get(k) ?? null; } },
    setItem(k, v) { try { preferred?.setItem?.(k, v); } catch {} mem.set(k, v); },
    removeItem(k) { try { preferred?.removeItem?.(k); } catch {} mem.delete(k); }
  };
}

let _clientPromise = null;

export async function getSbClient() {
  if (_clientPromise) return _clientPromise;

  _clientPromise = (async () => {
    const cfg = await window.GSConfig.getConfigPromise();

    let ls = null;
    try { ls = window.localStorage; } catch { ls = null; }
    const storage = safeStorage(ls);

    const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage
      }
    });

    // Global exposure (matches your existing patterns)
    window.sb = sb;
    window.GS = window.GS || {};
    window.GS.sb = sb;
    window.GSClient = { getAsync: async () => sb };
    window.getSbClient = async () => sb;

    return sb;
  })();

  return _clientPromise;
}

// Optional: auto-init on import
await getSbClient();
