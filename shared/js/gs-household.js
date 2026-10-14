// Ask routing helper (simple heuristic)
  const HOUSEHOLD_ROUTES = [
    { kws:["bill","due","payment","mortgage","rent","utility"], id:"card-bills" },
    { kws:["budget","spend","expense"], id:"card-budget" },
    { kws:["credit","card","rewards"], id:"card-creditcards" },

    { kws:["meal","dinner","lunch","breakfast","diabetic"], id:"card-nutrition" },
    { kws:["grocery","shopping","list"], id:"card-grocery" },
    { kws:["pantry"], id:"card-pantry" },

    { kws:["appointment","doctor","dentist"], id:"card-appointments" },
    { kws:["medication","blood","sugar","vitals"], id:"card-medication" },
    { kws:["health","records","vaccin"], id:"card-healthdocs" },

    { kws:["car","oil","tire","service","registration","insurance card"], id:"card-car" },
    { kws:["toll","parking"], id:"card-tolls" },
    { kws:["vehicle","documents","registration"], id:"card-vehicle-docs" },

    { kws:["document","passport","id"], id:"card-docs" },
    { kws:["gift","present"], id:"card-gifts" },
    { kws:["birthday","party","celebrate"], id:"card-birthdays" },

    { kws:["schedule","calendar","event"], id:"card-scheduler" },
    { kws:["chore","chores"], id:"card-chores" },
    { kws:["family"], id:"card-household" },

    { kws:["travel","trip","flight","hotel","passport"], id:"card-travel-docs" },

    { kws:["emergency","911","plan","earthquake","fire"], id:"card-emergency" },
    { kws:["insurance","policy","deductible"], id:"card-personal-insurance" },

    { kws:["birthday","anniversary","party","celebration"], id:"card-birthdays" },
    { kws:["photo","memory","pictures"], id:"card-photos" },

    { kws:["learn","study","coach","tutor"], id:"card-learning" },
    { kws:["vietnamese","english","language"], id:"card-vietnamese" }
  ];

  document.getElementById('ask-form-household').addEventListener('submit',e=>{
    e.preventDefault();
    const input = document.getElementById('ask-input-household');
    const q = (input.value || "").toLowerCase().trim();
    try { localStorage.setItem("geniesphere_household_last_query", q); } catch(_){}
    if (!q) {
      document.getElementById('card-household')?.click();
      return;
    }
    for(const route of HOUSEHOLD_ROUTES){
      if(route.kws.some(k => q.includes(k))){
        const el = document.getElementById(route.id);
        if(el){ el.click(); return; }
      }
    }
    // default: Household Genie hub
    document.getElementById('card-household')?.click();
  });

  // Quick Peek aggregator (unchanged)
  const P_KEY='gs_household_reminders_v1';
  const $ = (id)=>document.getElementById(id);

  function loadHousehold(){
    try{return JSON.parse(localStorage.getItem(P_KEY))||[]}catch{return []}
  }
  function fillList(id, arr, map){
    const el=$(id); if(!el) return;
    el.innerHTML='';
    if(!arr.length){ el.innerHTML='<li>None</li>'; return;}
    arr.slice(0,6).forEach(r=>{
      const li=document.createElement('li');
      li.textContent = map(r);
      el.appendChild(li);
    });
  }
  function updateQuickPeek(){
    const rows = loadHousehold();
    const now = new Date();
    const plus7 = new Date(now); plus7.setDate(now.getDate()+7);
    const todayStr = now.toDateString();

    const bills   = rows.filter(r=> r.type==='bill'   && r.due_at && new Date(r.due_at)<=plus7);
    const events  = rows.filter(r=> r.type==='event'  && r.when   && new Date(r.when).toDateString()===todayStr);
    const errands = rows.filter(r=> r.type==='grocery' || r.type==='errand');
    const car     = rows.filter(r=> r.type==='car');
    const health  = rows.filter(r=> r.type==='health');

    fillList('list-bills', bills, r=> `${r.title} • ${new Date(r.due_at).toLocaleDateString()}`);
    fillList('list-events', events, r=> `${r.title} • ${new Date(r.when).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
    fillList('list-groceries', errands, r=> r.title);
    fillList('list-car-health', car.concat(health), r=>{
      if(r.when){
        return `${r.title} • ${new Date(r.when).toLocaleDateString()} ${new Date(r.when).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
      }
      return r.title;
    });

    $('badge-bills').textContent     = `Bills: ${bills.length}`;
    $('badge-groceries').textContent = `Groceries: ${errands.length}`;
    $('badge-events').textContent    = `Family Events: ${events.length}`;
    $('badge-car').textContent       = `Car: ${car.length}`;
    $('badge-health').textContent    = `Health: ${health.length}`;

    const todayStrip = $('today-strip');
    const todayText  = $('today-text');
    const pieces = [];
    if(bills.length) pieces.push(`🧾 ${bills.length} bill(s) due this week`);
    if(events.length) pieces.push(`📅 ${events.length} event(s) today`);
    if(car.length) pieces.push(`🚗 ${car.length} car item(s) coming up`);
    if(health.length) pieces.push(`💊 ${health.length} health item(s)`);

    if(pieces.length){
      todayStrip.style.display='block';
      todayText.textContent = `Today: ${pieces.join(' • ')}`;
    }else{
      todayStrip.style.display='none';
      todayText.textContent = '';
    }
  }
  updateQuickPeek();
  window.addEventListener('storage',(e)=>{ if(e.key===P_KEY) updateQuickPeek(); });
