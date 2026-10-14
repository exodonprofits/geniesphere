/**
 * GenieSphere - Most Used Agents Today (Supabase-powered)
 *
 * Requirements:
 * - Supabase JS v2 loaded and available as window.supabase
 * - A client instance available as `client` OR set window.GS_SUPABASE_CLIENT
 * - SQL migration installed (agent_most_used_today view + record_agent_use RPC)
 *
 * Usage:
 * - Provide a container element with id="mostUsedStrip" and optional template handling.
 * - Call GSMostUsed.init({ client, mountId, agentCatalog })
 */

(function(){
  function qs(id){ return document.getElementById(id); }

  const DEFAULT_AGENT_CATALOG = {
    "salon-genie":   { name:"Salon Genie",   emoji:"💅", href:"/salon/index.html" },
    "rental-genie":  { name:"Rental Genie",  emoji:"🏡", href:"/rental/index.html" },
    "hvac-genie":    { name:"HVAC Genie",    emoji:"❄️🔥", href:"/hvac/hvac-owner.html" },
    "email-genie":   { name:"Email Genie",   emoji:"📨", href:"/dashboard/agent_users.html?agent=email-genie" },
    "payroll-master":{ name:"Payroll Master",emoji:"🧾", href:"/dashboard/agent_users.html?agent=payroll-master" },
    "inventory-manager":{ name:"Inventory Manager",emoji:"📦", href:"/dashboard/agent_users.html?agent=inventory-manager" },
    "travel-genie":  { name:"Travel Genie",  emoji:"✈️", href:"/voyage/index.html" },
    "investment-genie":{ name:"Investment Genie",emoji:"📈", href:"/dashboard/investment.html" },
    "credit-card-genie":{ name:"Credit Card Genie",emoji:"💳", href:"/dashboard/credit-card-setup.html" }
  };

  async function fetchMostUsed(client){
    const { data, error } = await client
      .from('agent_most_used_today')
      .select('agent_key, uses, unique_users');

    if(error) throw error;
    return (data || []);
  }

  function renderStrip(rows, mount, catalog){
    // Minimal, mobile-friendly chip strip (no framework)
    mount.innerHTML = '';

    if(!rows.length){
      const empty = document.createElement('div');
      empty.style.color = 'var(--muted, #8aa0c2)';
      empty.style.fontSize = '13px';
      empty.textContent = 'No usage yet today. Be the first to open an agent 👇';
      mount.appendChild(empty);
      return;
    }

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '10px';
    wrap.style.flexWrap = 'wrap';

    rows.forEach(r=>{
      const meta = catalog[r.agent_key] || { name: r.agent_key, emoji:"🧩", href:"#"};
      const a = document.createElement('a');
      a.href = meta.href || '#';
      a.setAttribute('data-agent-key', r.agent_key);
      a.style.display = 'inline-flex';
      a.style.alignItems = 'center';
      a.style.gap = '8px';
      a.style.padding = '8px 12px';
      a.style.borderRadius = '999px';
      a.style.border = '1px solid rgba(120,155,255,.22)';
      a.style.textDecoration = 'none';
      a.style.color = 'inherit';
      a.style.background = 'rgba(255,255,255,.03)';
      a.style.fontWeight = '800';
      a.style.fontSize = '13px';
      a.style.cursor = 'pointer';

      const left = document.createElement('span');
      left.textContent = meta.emoji || '🧩';

      const label = document.createElement('span');
      label.textContent = meta.name;

      const stat = document.createElement('span');
      stat.textContent = `(${r.uses})`;
      stat.style.opacity = '0.8';
      stat.style.fontWeight = '900';

      a.appendChild(left);
      a.appendChild(label);
      a.appendChild(stat);

      wrap.appendChild(a);
    });

    mount.appendChild(wrap);
  }

  function attachUsageTracking(client, mount){
    mount.addEventListener('click', async (e)=>{
      const a = e.target.closest('a[data-agent-key]');
      if(!a) return;
      const agentKey = a.getAttribute('data-agent-key');
      if(!agentKey) return;

      // Fire-and-forget; do not block navigation
      try { await client.rpc('record_agent_use', { p_agent_key: agentKey }); } catch(_){}
    });
  }

  window.GSMostUsed = {
    async init(opts){
      const client = opts?.client || window.GS_SUPABASE_CLIENT || window.client;
      const mountId = opts?.mountId || 'mostUsedStrip';
      const catalog = { ...DEFAULT_AGENT_CATALOG, ...(opts?.agentCatalog || {}) };

      const mount = qs(mountId);
      if(!client || !mount) return;

      try{
        const rows = await fetchMostUsed(client);
        renderStrip(rows, mount, catalog);
        attachUsageTracking(client, mount);
      }catch(err){
        console.warn('Most used agents load failed:', err);
      }
    }
  };
})();