/* =========================================================
   GenieSphere Hub Badges (shared)
   - Attaches count badges + "Next due" lines to hub cards
   - Safe: no-ops if data not available
   - Prefers Supabase via GSClient when available, otherwise localStorage
   ========================================================= */
(function(){
  const DAYS_AHEAD = 7;

  function parseDate(d){
    if(!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function startOfDay(dt){
    const x = new Date(dt);
    x.setHours(0,0,0,0);
    return x;
  }

  function addDays(dt, n){
    const x = new Date(dt);
    x.setDate(x.getDate() + n);
    return x;
  }

  function fmtDate(dt){
    try{
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }catch{
      return dt.toISOString().slice(0,10);
    }
  }

  function readJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
    catch { return fallback; }
  }

  async function getClientAndUser(){
    if(!window.GSClient || !window.GSClient.getAsync) return { client:null, user:null };
    try{
      const client = await window.GSClient.getAsync();
      const { data: { user } } = await client.auth.getUser();
      return { client, user };
    }catch{
      return { client:null, user:null };
    }
  }


  const __vehicleNickCache = new Map();
  async function getVehicleNickname(vehicleId){
    if(!vehicleId) return null;
    if(__vehicleNickCache.has(vehicleId)) return __vehicleNickCache.get(vehicleId);
    const { client, user } = await getClientAndUser();
    if(!client || !user){
      __vehicleNickCache.set(vehicleId, null);
      return null;
    }
    try{
      const { data, error } = await client
        .from("vehicles")
        .select("nickname")
        .eq("user_id", user.id)
        .eq("id", vehicleId)
        .maybeSingle();
      const nick = (!error && data && data.nickname) ? data.nickname : null;
      __vehicleNickCache.set(vehicleId, nick);
      return nick;
    }catch{
      __vehicleNickCache.set(vehicleId, null);
      return null;
    }
  }


  function ensureRelative(card){
    const cs = getComputedStyle(card);
    if(cs.position === "static") card.style.position = "relative";
  }

  function setBadge(card, text, variant){
    if(!text) return clearBadge(card);
    ensureRelative(card);
    let b = card.querySelector(".hub-badge");
    if(!b){
      b = document.createElement("div");
      b.className = "hub-badge";
      card.appendChild(b);
    }
    b.textContent = text;
    if(variant) b.dataset.variant = variant;
    else b.removeAttribute("data-variant");
  }

  function clearBadge(card){
    const b = card.querySelector(".hub-badge");
    if(b) b.remove();
  }

  function setNextDue(card, label, title, dueDate){
    const lineText = (title && dueDate)
      ? `${label}: ${title} • ${fmtDate(dueDate)}`
      : "";
    let p = card.querySelector(".hub-nextdue");
    if(!lineText){
      if(p) p.remove();
      return;
    }
    if(!p){
      p = document.createElement("div");
      p.className = "hub-nextdue";
      card.appendChild(p);
    }
    p.innerHTML = `${label}: <strong>${escapeHtml(title)}</strong> • ${fmtDate(dueDate)}`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // -------------------------
  // Bills provider (existing)
  // -------------------------
  // Bills provider (Supabase-first)
  // -------------------------
  async function getBillsDueSoon(){
  const today = startOfDay(new Date());
  const cutoff = addDays(today, DAYS_AHEAD);

  let billItems = [];
  let taskItems = [];

  // ---------- Supabase FIRST ----------
  const { client, user } = await getClientAndUser();
  if(client && user){
    try{
      // Bills (next_due_date)
      const { data: billsData, error: billsErr } = await client
        .from("user_bills")
        .select("name,next_due_date,status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("next_due_date", today.toISOString().slice(0,10))
        .lte("next_due_date", cutoff.toISOString().slice(0,10))
        .order("next_due_date", { ascending: true });

      if(!billsErr && Array.isArray(billsData) && billsData.length){
        billItems = billsData
          .map(b => ({ title: b.name, due: parseDate(b.next_due_date) }))
          .filter(x => x.title && x.due);
      }

      // Bill payment tasks (explicit tasks)
      const { data: tasksData, error: tasksErr } = await client
        .from("user_bill_tasks")
        .select("title,due_date,status")
        .eq("user_id", user.id)
        .eq("status", "open")
        .gte("due_date", today.toISOString().slice(0,10))
        .lte("due_date", cutoff.toISOString().slice(0,10))
        .order("due_date", { ascending: true });

      if(!tasksErr && Array.isArray(tasksData) && tasksData.length){
        taskItems = tasksData
          .map(t => ({ title: t.title, due: parseDate(t.due_date) }))
          .filter(x => x.title && x.due);
      }
    }catch{}
  }

  // ---------- Fallback: localStorage ----------
  if(billItems.length === 0 && taskItems.length === 0){
    // Local bills
    const bills = readJSON("hm_bills", []);
    billItems = bills
      .map(b => ({ title: b.name || b.title, due: parseDate(b.due || b.due_date || b.date) }))
      .filter(x => x.title && x.due && x.due >= today && x.due <= cutoff);

    // Local bill tasks
    const tasksLocal = readJSON("hg_tasks", []);
    taskItems = tasksLocal
      .filter(t => (t.type || t.task_type) === "bill_payment" && (t.status || "open") !== "paid")
      .map(t => ({ title: t.title || t.name, due: parseDate(t.due_date || t.due) }))
      .filter(x => x.title && x.due && x.due >= today && x.due <= cutoff);
  }

  billItems.sort((a,b)=>a.due - b.due);
  taskItems.sort((a,b)=>a.due - b.due);

  // Prefer tasks for "Next due" (once a task exists, show that instead of raw bill date)
  let next = null;
  if(taskItems[0]) next = { ...taskItems[0], kind: "task" };
  else if(billItems[0]) next = { ...billItems[0], kind: "bill" };

  // Bills UX: show whether the next item is a Task vs a Bill (like Car Care shows a vehicle nickname)
  if(next){
    let baseTitle = next.title;
    if(next.kind === "task") baseTitle = String(baseTitle).replace(/^Pay\s+/i, "").trim();
    const tag = next.kind === "task" ? "Task" : "Bill";
    next.title = `${baseTitle} (${tag})`;
  }

  // Count can include both (helps the hub badge feel "complete")
  const count = billItems.length + taskItems.length;

  return { count, next };
}

  // --------------------------------
  // Appointments provider (new, safe)
  // --------------------------------
  // Appointments provider (Supabase-first)
  // --------------------------------
  function getAppointmentStores(){
    // supports multiple potential keys (won't break if empty)
    return [
      { key: "hg_appointments", map: (a)=>({ title: a.title||a.name||a.reason, when: parseDate(a.start||a.date||a.when||a.datetime) }) },
      { key: "hc_appointments", map: (a)=>({ title: a.title||a.name||a.reason, when: parseDate(a.start||a.date||a.when||a.datetime) }) },
      { key: "appointments", map: (a)=>({ title: a.title||a.name||a.reason, when: parseDate(a.start||a.date||a.when||a.datetime) }) },
    ];
  }

  async function getAppointmentsSoon(){
    const today = startOfDay(new Date());
    const cutoff = addDays(today, DAYS_AHEAD);

    let items = [];

    // ---------- Supabase FIRST ----------
    const { client, user } = await getClientAndUser();
    if(client && user){
      try{
        const { data, error } = await client
          .from("user_appointments")
          .select("title,start_time,status")
          .eq("user_id", user.id)
          .eq("status", "scheduled")
          .gte("start_time", today.toISOString())
          .lte("start_time", cutoff.toISOString())
          .order("start_time", { ascending: true });

        if(!error && Array.isArray(data) && data.length){
          items = data.map(r => ({ title: r.title, when: parseDate(r.start_time) }));
        }
      }catch{}
    }

    // ---------- Fallback: localStorage ----------
    if(items.length === 0){
      for(const store of getAppointmentStores()){
        const arr = readJSON(store.key, []);
        if(Array.isArray(arr) && arr.length){
          items = items.concat(arr.map(store.map));
        }
      }
    }

    items = items.filter(x => x.title && x.when && x.when >= today && x.when <= cutoff);
    items.sort((a,b)=>a.when - b.when);

    return {
      count: items.length,
      next: items[0] ? { title: items[0].title, due: items[0].when } : null
    };
  }

  // -------------------------
  // Boot
  // -------------------------
  
  async function getCarCareSoon(){
    const today = startOfDay(new Date());
    const cutoff = addDays(today, DAYS_AHEAD);

    let tasks = [];
    let reminders = [];

    // ---------- Supabase FIRST ----------
    const { client, user } = await getClientAndUser();
    if(client && user){
      try{
        // Open service tasks due soon
        const { data: tdata, error: terr } = await client
          .from("vehicle_service_tasks")
          .select("id,vehicle_id,title,due_date,reminder_id,status")
          .eq("user_id", user.id)
          .eq("status", "open")
          .gte("due_date", today.toISOString().slice(0,10))
          .lte("due_date", cutoff.toISOString().slice(0,10))
          .order("due_date", { ascending: true });

        if(!terr && Array.isArray(tdata) && tdata.length){
          tasks = tdata.map(r => ({
            id: r.id,
            vehicle_id: r.vehicle_id,
            title: r.title,
            due: parseDate(r.due_date),
            reminder_id: r.reminder_id || null
          })).filter(x => x.due);
        }

        // Active reminders due soon
        const { data: rdata, error: rerr } = await client
          .from("vehicle_service_reminders")
          .select("id,vehicle_id,title,next_due_date,status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .gte("next_due_date", today.toISOString().slice(0,10))
          .lte("next_due_date", cutoff.toISOString().slice(0,10))
          .order("next_due_date", { ascending: true });

        if(!rerr && Array.isArray(rdata) && rdata.length){
          reminders = rdata.map(r => ({
            id: r.id,
            vehicle_id: r.vehicle_id,
            title: r.title,
            due: parseDate(r.next_due_date)
          })).filter(x => x.due);
        }
      }catch{}
    }

    // ---------- Fallback: localStorage (best-effort, non-breaking) ----------
    if(tasks.length === 0 && reminders.length === 0){
      const lsTasks = readJSON("carcare_tasks", []);
      const lsRems  = readJSON("carcare_reminders", []);
      if(Array.isArray(lsTasks)){
        tasks = lsTasks.map(x => ({ title: x.title || x.name || "Service task", due: parseDate(x.due_date || x.due) }))
                      .filter(x => x.due && x.due >= today && x.due <= cutoff)
                      .sort((a,b)=>a.due-b.due);
      }
      if(Array.isArray(lsRems)){
        reminders = lsRems.map(x => ({ title: x.title || x.name || "Service reminder", due: parseDate(x.next_due_date || x.due_date || x.due) }))
                          .filter(x => x.due && x.due >= today && x.due <= cutoff)
                          .sort((a,b)=>a.due-b.due);
      }
    }

    // Dedupe: if an open task exists that references a reminder, don't also count that reminder
    const taskReminderIds = new Set(tasks.map(t => t.reminder_id).filter(Boolean));
    const filteredReminders = reminders.filter(r => !taskReminderIds.has(r.id));

    const count = tasks.length + filteredReminders.length;

    // Prefer tasks for "Next due"
    const nextTask = tasks[0] ? { title: tasks[0].title, due: tasks[0].due, vehicle_id: tasks[0].vehicle_id } : null;
    const nextRem  = filteredReminders[0] ? { title: filteredReminders[0].title, due: filteredReminders[0].due, vehicle_id: filteredReminders[0].vehicle_id } : null;

    return {
      count,
      next: nextTask || nextRem
    };
  }

async function run(){
    // Bills Hub card
    const billsCard = document.querySelector("#card-bills-hub, #card-bills, [data-hub='bills']");
    if(billsCard){
      const bills = await getBillsDueSoon();
      if(bills.count > 0){
        setBadge(billsCard, `${bills.count} due soon`, "warn");
        if(bills.next) setNextDue(billsCard, "Next due", bills.next.title, bills.next.due);
      }else{
        clearBadge(billsCard);
        setNextDue(billsCard);
      }
    }

    
    // Car Care card (optional)
    const carCard = document.querySelector("#card-car-care, #card-car, #link-car, [data-hub='carcare']");
    if(carCard){
      const car = await getCarCareSoon();
      if(car.count > 0){
        setBadge(carCard, `${car.count} due soon`, "warn");
        if(car.next){
          let t = car.next.title;
          if(car.next.vehicle_id){
            const nick = await getVehicleNickname(car.next.vehicle_id);
            if(nick) t = `${t} (${nick})`;
          }
          setNextDue(carCard, "Next", t, car.next.due);
        }
      }else{
        clearBadge(carCard);
        setNextDue(carCard);
      }
    }

// Appointments card (optional)
    const apptCard = document.querySelector("#card-appointments, #link-appointments, [data-hub='appointments']");
    if(apptCard){
      const appts = await getAppointmentsSoon();
      if(appts.count > 0){
        setBadge(apptCard, `${appts.count} soon`, "warn");
        if(appts.next) setNextDue(apptCard, "Next", appts.next.title, appts.next.due);
      }else{
        clearBadge(apptCard);
        setNextDue(apptCard);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", run);
})();


/* --- Patch: Appointments 'Next' line includes person name --- */
(function(){
  try{
    const OLD = window.updateAppointmentsBadge;
    if(typeof OLD !== "function") return;
    window.updateAppointmentsBadge = async function(){
      await OLD.apply(this, arguments);
      const nextEl = document.querySelector('[data-badge-next="appointments"]');
      // If script already set text, try to improve by re-querying the next appt quickly
      try{
        const client = await window.GSClient.getAsync();
        const { data:{user} } = await client.auth.getUser();
        if(!user) return;
        const nowIso = new Date().toISOString();
        const { data } = await client
          .from("user_appointments")
          .select("title,person,start_time")
          .eq("user_id", user.id)
          .eq("status","scheduled")
          .gte("start_time", nowIso)
          .order("start_time",{ascending:true})
          .limit(1);
        const appt = (data && data[0]) ? data[0] : null;
        if(!appt || !nextEl) return;
        const d = new Date(appt.start_time);
        const date = isNaN(d.getTime()) ? "—" : d.toLocaleDateString([], {month:"short", day:"numeric"});
        const who = appt.person ? ` (${appt.person})` : "";
        nextEl.textContent = `Next: ${appt.title}${who} • ${date}`;
      }catch(e){}
    };
  }catch(e){}
})();


/* ============================================================
   Appointments badge: prefer appointment tasks for "Next:"
   - If an open task exists (user_appointment_tasks), show it.
   - Otherwise, keep the next scheduled appointment text.
   ============================================================ */
(function(){
  async function setAppointmentsNextFromTasks(){
    const nextEl = document.querySelector('[data-badge-next="appointments"]');
    if(!nextEl) return;

    // Needs GSClient + logged in user
    if(!window.GSClient || typeof window.GSClient.getAsync !== "function") return;

    const client = await window.GSClient.getAsync();
    const { data:{ user } } = await client.auth.getUser();
    if(!user) return;

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,"0");
    const d = String(today.getDate()).padStart(2,"0");
    const todayYMD = `${y}-${m}-${d}`;

    // Fetch next open task (soonest due)
    const { data: tasks, error } = await client
      .from("user_appointment_tasks")
      .select("title,due_date,appointment_id, user_appointments(title,person)")
      .eq("user_id", user.id)
      .eq("status", "open")
      .gte("due_date", todayYMD)
      .order("due_date", { ascending: true })
      .limit(1);

    if(error) return;

    const t = tasks && tasks[0] ? tasks[0] : null;
    if(!t) return;

    // Build label: Task • date (Appointment (Person))
    const dateObj = new Date((t.due_date || "") + "T00:00:00");
    const date = isNaN(dateObj.getTime()) ? "—" : dateObj.toLocaleDateString([], {month:"short", day:"numeric"});

    let ap = t.user_appointments || null;
    let apLabel = "";
    if(ap && (ap.title || ap.person)){
      const who = ap.person ? ` (${ap.person})` : "";
      apLabel = ` (${ap.title || "Appointment"}${who})`;
    }

    nextEl.textContent = `Next: ${t.title}${apLabel} • ${date}`;
  }

  function wrap(fn){
    return async function(){
      const res = await fn.apply(this, arguments);
      try{ await setAppointmentsNextFromTasks(); }catch(e){}
      return res;
    };
  }

  try{
    // If the hub already defines a function we can wrap, wrap it.
    if(typeof window.updateAppointmentsBadge === "function"){
      window.updateAppointmentsBadge = wrap(window.updateAppointmentsBadge);
      return;
    }
    if(typeof window.refreshAppointmentsBadge === "function"){
      window.refreshAppointmentsBadge = wrap(window.refreshAppointmentsBadge);
      return;
    }

    // Otherwise, run once after load (best effort).
    window.addEventListener("load", ()=>{
      setTimeout(()=>{ setAppointmentsNextFromTasks().catch(()=>{}); }, 250);
    });
  }catch(e){}
})();


/* ============================================================
   Leisure Events badge: prefer event tasks for "Next:"
   - If an open task exists (user_event_tasks), show it.
   - Otherwise, keep the next scheduled event text (from user_events).
   Requires Leisure hub card to include: data-badge-next="events"
   ============================================================ */
(function(){
  async function setEventsNextFromTasks(){
    const nextEl = document.querySelector('[data-badge-next="events"]');
    if(!nextEl) return;

    if(!window.GSClient || typeof window.GSClient.getAsync !== "function") return;

    const client = await window.GSClient.getAsync();
    const { data:{ user } } = await client.auth.getUser();
    if(!user) return;

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,"0");
    const d = String(today.getDate()).padStart(2,"0");
    const todayYMD = `${y}-${m}-${d}`;

    const { data: tasks, error } = await client
      .from("user_event_tasks")
      .select("title,due_date,event_id, user_events(title,start_time)")
      .eq("user_id", user.id)
      .eq("status", "open")
      .gte("due_date", todayYMD)
      .order("due_date", { ascending: true })
      .limit(1);

    if(error) return;

    const t = tasks && tasks[0] ? tasks[0] : null;
    if(!t) return;

    const dateObj = new Date((t.due_date || "") + "T00:00:00");
    const date = isNaN(dateObj.getTime()) ? "—" : dateObj.toLocaleDateString([], {month:"short", day:"numeric"});

    const ev = t.user_events || null;
    const evLabel = (ev && ev.title) ? ` (${ev.title})` : "";

    nextEl.textContent = `Next: ${t.title}${evLabel} • ${date}`;
  }

  function wrap(fn){
    return async function(){
      const res = await fn.apply(this, arguments);
      try{ await setEventsNextFromTasks(); }catch(e){}
      return res;
    };
  }

  try{
    if(typeof window.updateEventsBadge === "function"){
      window.updateEventsBadge = wrap(window.updateEventsBadge);
      return;
    }
    if(typeof window.refreshEventsBadge === "function"){
      window.refreshEventsBadge = wrap(window.refreshEventsBadge);
      return;
    }
    window.addEventListener("load", ()=>{
      setTimeout(()=>{ setEventsNextFromTasks().catch(()=>{}); }, 250);
    });
  }catch(e){}
})();
