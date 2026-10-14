/* ═══════════════════════════════════════════════════════════════════
   GENIE CHAT WIDGET  v2 — drop into any Voyage Genie page
   ═══════════════════════════════════════════════════════════════════ */
(function () {

const WEBHOOK = 'https://exodonprofits.app.n8n.cloud/webhook/genie-chat';

const PLANNER_MAP = {
  'Tropical Resort':  'tropical-trip-planner.html',
  'Cruise Adventure': 'cruise-trip-planner.html',
  'City & Stays':     'airbnb-trip-planner.html',
  'Adventure Trip':   'adventure-trip-planner.html',
};
const PLANNER_LABELS = {
  'Tropical Resort':  'Tropical Resort Planner',
  'Cruise Adventure': 'Cruise Planner',
  'City & Stays':     'City & Stays Planner',
  'Adventure Trip':   'Adventure Planner',
};
const PLANNER_ICONS = {
  'Tropical Resort':  '🏖️',
  'Cruise Adventure': '🚢',
  'City & Stays':     '🏨',
  'Adventure Trip':   '🌄',
};
const PLANNER_DESCS = {
  'Tropical Resort':  'Beach, islands & resorts',
  'Cruise Adventure': 'Ocean voyages & ports',
  'City & Stays':     'Hotels, Airbnb & city trips',
  'Adventure Trip':   'Hiking, safari & outdoors',
};

// ── State ──────────────────────────────────────────────────────────
let isOpen     = false;
let messages   = [];   // full conversation history [{role, content}]
let tripData   = {};   // accumulated extracted fields
let generating = false;
let retryCount = 0;

// ── CSS ────────────────────────────────────────────────────────────
const css = `
.gc-btn {
  position:fixed; bottom:28px; right:28px; z-index:9000;
  width:62px; height:62px; border-radius:50%; border:none; cursor:pointer;
  background:linear-gradient(135deg,#00b4d8,#0077b6);
  color:#fff; font-size:1.5rem; display:flex; align-items:center; justify-content:center;
  box-shadow:0 6px 24px rgba(0,119,182,.45);
  transition:transform .22s cubic-bezier(.4,0,.2,1),box-shadow .22s;
}
.gc-btn:hover { transform:scale(1.08); box-shadow:0 10px 32px rgba(0,119,182,.55); }
.gc-badge {
  position:absolute; top:-4px; right:-4px;
  width:18px; height:18px; border-radius:50%; background:#e76f51;
  font-size:.6rem; font-weight:700; display:flex; align-items:center;
  justify-content:center; border:2px solid #fff; color:#fff;
  animation:gc-pulse 2.5s infinite;
}
@keyframes gc-pulse{0%,100%{transform:scale(1)}55%{transform:scale(1.22)}}

.gc-window {
  position:fixed; bottom:104px; right:28px; z-index:9001;
  width:min(430px,calc(100vw - 36px));
  height:min(600px,calc(100vh - 140px));
  background:#fff; border-radius:20px;
  box-shadow:0 24px 64px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06);
  display:flex; flex-direction:column; overflow:hidden;
  transform:scale(.93) translateY(16px); opacity:0;
  transition:transform .25s cubic-bezier(.4,0,.2,1),opacity .22s;
  pointer-events:none;
}
.gc-window.gc-open { transform:scale(1) translateY(0); opacity:1; pointer-events:all; }

.gc-header {
  background:linear-gradient(105deg,#023e8a 0%,#0077b6 55%,#0096c7 100%);
  padding:13px 15px; display:flex; align-items:center; gap:10px; flex-shrink:0;
}
.gc-avatar {
  width:40px; height:40px; border-radius:50%;
  background:rgba(255,255,255,.18); border:1.5px solid rgba(255,255,255,.3);
  display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0;
}
.gc-hinfo { flex:1; min-width:0; }
.gc-hname { font-family:'Playfair Display',serif; font-size:1rem; font-weight:700; color:#fff; }
.gc-hsub  { font-size:.74rem; color:rgba(255,255,255,.78); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gc-hclose {
  background:rgba(255,255,255,.15); border:none; color:#fff; border-radius:8px;
  width:32px; height:32px; cursor:pointer; font-size:.95rem;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  transition:background .2s;
}
.gc-hclose:hover { background:rgba(255,255,255,.28); }

.gc-msgs {
  flex:1; overflow-y:auto; padding:14px 13px 8px;
  display:flex; flex-direction:column; gap:10px;
}
.gc-msgs::-webkit-scrollbar { width:4px; }
.gc-msgs::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:4px; }

.gc-row { max-width:90%; display:flex; flex-direction:column; gap:4px; }
.gc-row.gc-u { align-self:flex-end; align-items:flex-end; }
.gc-row.gc-b { align-self:flex-start; align-items:flex-start; }

.gc-bub {
  padding:9px 13px; border-radius:16px;
  font-size:.875rem; line-height:1.55; font-family:'DM Sans',sans-serif; color:#1e293b;
}
.gc-u .gc-bub {
  background:linear-gradient(135deg,#0077b6,#0096c7); color:#fff;
  border-radius:16px 16px 4px 16px;
}
.gc-b .gc-bub { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:16px 16px 16px 4px; }
.gc-b .gc-bub a { color:#0077b6; text-decoration:underline; }

.gc-typing { display:flex; align-items:center; gap:5px; padding:10px 14px; }
.gc-dot { width:7px; height:7px; border-radius:50%; background:#94a3b8; animation:gc-bop 1.2s infinite; }
.gc-dot:nth-child(2){animation-delay:.18s} .gc-dot:nth-child(3){animation-delay:.36s}
@keyframes gc-bop{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}

/* Pills */
.gc-pills { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
.gc-pill {
  display:inline-flex; align-items:center; gap:3px;
  background:#eff6ff; border:1px solid #bfdbfe; border-radius:999px;
  padding:3px 9px; font-size:.72rem; color:#1d4ed8; font-weight:500;
  font-family:'DM Sans',sans-serif;
}

/* Goto button */
.gc-goto {
  display:flex; align-items:center; justify-content:center; gap:7px;
  margin-top:8px; background:#0077b6; color:#fff;
  border:none; border-radius:11px; padding:11px 18px;
  font-family:'DM Sans',sans-serif; font-size:.9rem; font-weight:700;
  cursor:pointer; text-decoration:none; width:100%;
  transition:background .2s,transform .18s;
  box-shadow:0 4px 14px rgba(0,119,182,.3);
}
.gc-goto:hover { background:#023e8a; transform:translateY(-1px); }

/* Chips */
.gc-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.gc-chip {
  background:#f1f5f9; border:1px solid #e2e8f0; border-radius:9px;
  padding:6px 11px; font-size:.8rem; cursor:pointer; color:#1e293b;
  font-family:'DM Sans',sans-serif; transition:background .18s,border-color .18s;
  white-space:nowrap;
}
.gc-chip:hover { background:#e8f4fd; border-color:#0077b6; color:#0077b6; }

/* Planner picker grid */
.gc-picker-grid {
  display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:8px;
}
.gc-picker-card {
  display:flex; flex-direction:column; gap:2px; align-items:flex-start;
  background:#fff; border:1.5px solid #e2e8f0; border-radius:11px;
  padding:10px 12px; cursor:pointer; text-align:left;
  font-family:'DM Sans',sans-serif;
  transition:border-color .18s,background .18s,transform .18s;
}
.gc-picker-card:hover { border-color:#0077b6; background:#eff6ff; transform:translateY(-2px); }
.gc-picker-card.selected { border-color:#0077b6; background:#eff6ff; }
.gc-picker-icon { font-size:1.4rem; }
.gc-picker-label { font-size:.83rem; font-weight:700; color:#1e293b; margin-top:2px; }
.gc-picker-desc  { font-size:.72rem; color:#64748b; }

/* Input */
.gc-input-row {
  padding:10px 12px; border-top:1px solid #e2e8f0;
  display:flex; gap:8px; align-items:flex-end; flex-shrink:0; background:#fff;
}
.gc-inp {
  flex:1; border:1.5px solid #e2e8f0; border-radius:12px;
  padding:9px 13px; font-family:'DM Sans',sans-serif; font-size:.875rem;
  resize:none; outline:none; max-height:100px; line-height:1.4;
  background:#f8fafc; transition:border-color .2s,background .2s;
}
.gc-inp:focus { border-color:#0077b6; background:#fff; }
.gc-inp:disabled { opacity:.55; }
.gc-send {
  width:40px; height:40px; border-radius:12px; border:none;
  background:linear-gradient(135deg,#0077b6,#00b4d8);
  color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:1.05rem; flex-shrink:0; transition:opacity .2s,transform .18s;
}
.gc-send:hover:not(:disabled){ opacity:.9; transform:scale(1.06); }
.gc-send:disabled { opacity:.45; cursor:not-allowed; }

/* Progress bar inside header */
.gc-progress {
  height:2px; background:rgba(255,255,255,.2); flex-shrink:0;
  transition:width .3s;
}
.gc-progress-fill { height:100%; background:rgba(255,255,255,.7); border-radius:2px; transition:width .5s; }

@media(max-width:480px){
  .gc-window{ right:10px; bottom:88px; width:calc(100vw - 20px); height:calc(100vh - 108px); }
  .gc-btn{ bottom:14px; right:14px; }
}
`;

// ── DOM ─────────────────────────────────────────────────────────────
function buildDOM() {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Remove old decorative button if present
  document.querySelectorAll('.floating-chatbot').forEach(el => el.remove());

  // Toggle button
  const btn = document.createElement('button');
  btn.className = 'gc-btn';
  btn.setAttribute('aria-label', 'Chat with Genie');
  btn.title = 'Ask Genie';
  btn.innerHTML = `✈️<span class="gc-badge">✨</span>`;
  btn.onclick = () => toggleChat();
  document.body.appendChild(btn);

  // Chat window
  const win = document.createElement('div');
  win.className = 'gc-window';
  win.id = 'gc-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-label', 'Genie travel assistant');
  win.innerHTML = `
    <div class="gc-header">
      <div class="gc-avatar">🧞</div>
      <div class="gc-hinfo">
        <div class="gc-hname">Genie</div>
        <div class="gc-hsub" id="gc-status">Your AI Travel Planner</div>
      </div>
      <button class="gc-hclose" onclick="window._gcClose()" aria-label="Close">✕</button>
    </div>
    <div class="gc-progress"><div class="gc-progress-fill" id="gc-prog" style="width:0%"></div></div>
    <div class="gc-msgs" id="gc-msgs" aria-live="polite"></div>
    <div class="gc-input-row">
      <textarea class="gc-inp" id="gc-inp"
        placeholder="Where do you want to go? 🌍" rows="1"
        aria-label="Message Genie"></textarea>
      <button class="gc-send" id="gc-send" aria-label="Send">➤</button>
    </div>`;
  document.body.appendChild(win);

  // Auto-resize textarea
  const inp = document.getElementById('gc-inp');
  inp.addEventListener('input', () => {
    inp.style.height = 'auto';
    inp.style.height = Math.min(inp.scrollHeight, 100) + 'px';
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
  document.getElementById('gc-send').onclick = sendMsg;
  window._gcClose = () => toggleChat(false);
}

// ── Progress bar ────────────────────────────────────────────────────
function setProgress(pct) {
  const el = document.getElementById('gc-prog');
  if (el) el.style.width = pct + '%';
}

// ── Toggle ──────────────────────────────────────────────────────────
function toggleChat(force) {
  isOpen = force !== undefined ? force : !isOpen;
  const win = document.getElementById('gc-window');
  if (!win) return;
  win.classList.toggle('gc-open', isOpen);

  if (isOpen && messages.length === 0) {
    greet();
  }
  if (isOpen) setTimeout(() => document.getElementById('gc-inp')?.focus(), 220);
}

// ── Public API — used by hero search bar ────────────────────────────
// Called as window._gcOpen(query) to open chat + send the first message
window._gcOpen = function(query) {
  // Ensure the widget DOM exists
  if (!document.getElementById('gc-window')) buildDOM();
  // Open if closed
  if (!isOpen) toggleChat(true);
  // If a greeting is already shown, just inject & send the query
  const send = () => {
    const inp = document.getElementById('gc-inp');
    const btn = document.getElementById('gc-send');
    if (inp && btn) {
      inp.value = query;
      inp.dispatchEvent(new Event('input'));
      setTimeout(() => btn.click(), 120);
    }
  };
  // Wait for open animation, then send
  setTimeout(send, 260);
};

function greet() {
  addBot(
    `Hi! I'm Genie ✨ Tell me where you want to go, when, and what you'd love to do — I'll figure out the perfect planner and pre-fill it for you.`,
    [{label:'🏖️ Tropical beach', text:'I want a beach holiday in Bali next July for 10 days'},
     {label:'🌄 Adventure trip', text:'Adventure hiking in Patagonia, 2 weeks in October'},
     {label:'🚢 Cruise', text:'Mediterranean cruise in August, 7 nights'},
     {label:'🏨 City & Stays', text:'I want to visit Paris for 7 days in September, boutique hotel'}]
  );
  setProgress(10);
}

// ── Message builders ────────────────────────────────────────────────
function addUser(text) {
  messages.push({ role: 'user', content: text });
  append('gc-u', `<span>${esc(text)}</span>`);
}

function addBot(text, chips, pills, gotoBtn) {
  if (text) messages.push({ role: 'assistant', content: text });

  let inner = text ? `<span>${text}</span>` : '';
  if (pills?.length) {
    inner += `<div class="gc-pills">${pills.map(p =>
      `<span class="gc-pill">${p}</span>`).join('')}</div>`;
  }
  if (gotoBtn) {
    inner += `<a href="${gotoBtn.url}" class="gc-goto">${PLANNER_ICONS[gotoBtn.type] || '↗'} ${gotoBtn.label}</a>`;
  }

  const row = append('gc-b', inner);

  if (chips?.length) {
    const chipWrap = document.createElement('div');
    chipWrap.className = 'gc-chips';
    chips.forEach(c => {
      const b = document.createElement('button');
      b.className = 'gc-chip';
      b.textContent = c.label;
      b.onclick = () => { chipWrap.remove(); quickSend(c.text); };
      chipWrap.appendChild(b);
    });
    row.appendChild(chipWrap);
  }
  return row;
}

function showPlannerPicker(onSelect) {
  const types = Object.keys(PLANNER_MAP);
  const wrap = document.createElement('div');
  wrap.className = 'gc-row gc-b';

  const grid = document.createElement('div');
  grid.className = 'gc-picker-grid';

  types.forEach(type => {
    const card = document.createElement('button');
    card.className = 'gc-picker-card';
    card.innerHTML = `
      <span class="gc-picker-icon">${PLANNER_ICONS[type]}</span>
      <span class="gc-picker-label">${type}</span>
      <span class="gc-picker-desc">${PLANNER_DESCS[type]}</span>`;
    card.onclick = () => { wrap.remove(); onSelect(type); };
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  document.getElementById('gc-msgs').appendChild(wrap);
  scrollDown();
}

function typingOn() {
  const el = document.createElement('div');
  el.className = 'gc-row gc-b'; el.id = 'gc-typing';
  el.innerHTML = '<div class="gc-bub"><div class="gc-typing"><div class="gc-dot"></div><div class="gc-dot"></div><div class="gc-dot"></div></div></div>';
  document.getElementById('gc-msgs').appendChild(el);
  scrollDown();
}
function typingOff() { document.getElementById('gc-typing')?.remove(); }

function append(cls, inner) {
  const row = document.createElement('div');
  row.className = `gc-row ${cls}`;
  const bub = document.createElement('div');
  bub.className = 'gc-bub';
  bub.innerHTML = inner;
  row.appendChild(bub);
  document.getElementById('gc-msgs').appendChild(row);
  scrollDown();
  return row;
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function scrollDown() {
  const el = document.getElementById('gc-msgs');
  if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
}
function setLock(v) {
  document.getElementById('gc-inp').disabled  = v;
  document.getElementById('gc-send').disabled = v;
}
function setStatus(t) {
  const el = document.getElementById('gc-status');
  if (el) el.textContent = t;
}
function quickSend(text) {
  document.getElementById('gc-inp').value = text;
  sendMsg();
}

// ── Pill builder ────────────────────────────────────────────────────
function pillsFor(d) {
  const out = [];
  if (d.destination)  out.push(`🌍 ${d.destination}`);
  if (d.departure) {
    const modeIcon = {flight:'✈️',drive:'🚗',train:'🚂',bus:'🚌',ferry:'⛴️'}[d.travelMode] || '✈️';
    out.push(`${modeIcon} from ${d.departure}`);
  }
  if (d.startDate && d.endDate) {
    const days = Math.round((new Date(d.endDate) - new Date(d.startDate)) / 86400000);
    out.push(`📅 ${fmt(d.startDate)} → ${fmt(d.endDate)} (${days}d)`);
  } else if (d.startDate) {
    out.push(`📅 from ${fmt(d.startDate)}`);
  }
  if (d.accommodationType && d.accommodationType !== 'No preference')
    out.push(`${accomEmoji(d.accommodationType)} ${d.accommodationType}`);
  if (d.tripType)    out.push(`${PLANNER_ICONS[d.tripType] || '🏷️'} ${d.tripType}`);
  if (d.groupSize)   out.push(`👥 ${d.groupSize}`);
  if (d.travelPace)  out.push(`⚡ ${d.travelPace}`);
  if (d.budgetTier)  out.push(`💎 ${d.budgetTier}`);
  return out;
}

function fmt(iso) {
  if (!iso) return '';
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
  catch { return iso; }
}

// ── Route to planner ────────────────────────────────────────────────
function routeToPlanner(data) {
  const type = data.tripType || 'Tropical Resort';
  // Normalise legacy key
  const normType = type === 'Airbnb Getaway' ? 'City & Stays' : type;
  const url  = PLANNER_MAP[normType] || PLANNER_MAP[type] || 'tropical-trip-planner.html';

  // Save everything so the planner's loadFormData() restores it all
  const formData = {
    // Common fields
    destination:        data.destination        || '',
    departure:          data.departure          || '',
    departureLocation:  data.departure          || '',
    startDate:          data.startDate          || '',
    endDate:            data.endDate            || '',
    flexDates:          data.startDate          ? 'no' : 'yes',
    groupSize:          data.groupSize          || 'Couple',
    travelPace:         data.travelPace         || 'Balanced',
    budgetTier:         data.budgetTier         || 'Standard',
    activities:         data.activities         || '',
    email:              data.email              || '',
    // Accommodation type — pre-selects Step 3 in City & Stays planner
    propertyType:       data.accommodationType  || '',
    accommodationType:  data.accommodationType  || '',
    // Planner-specific field aliases
    destinationCity:    data.destination        || '',   // adventure / airbnb
    cruiseRegion:       data.destination        || '',   // cruise
    departurePort:      data.departure          || '',   // cruise
    dayActivity:        data.activities         || '',   // tropical
    activityType:       data.activities         || '',   // adventure
    travelMode:         data.travelMode         || 'flight', // travel mode
    tripType:           data.groupSize          || 'Couple', // "who's coming" field
  };

  localStorage.setItem('formData', JSON.stringify(formData));

  // Build a friendly summary of what was picked up
  const accomLine = data.accommodationType && data.accommodationType !== 'No preference'
    ? `${accomEmoji(data.accommodationType)} ${data.accommodationType} · ` : '';
  const daysLine = data.startDate && data.endDate
    ? `${Math.round((new Date(data.endDate)-new Date(data.startDate))/86400000)} days · ` : '';

  addBot(
    `Perfect! I've got ${accomLine}${daysLine}${data.destination} locked in. Opening the ${PLANNER_LABELS[normType] || PLANNER_LABELS[type]} with everything pre-filled ✨`,
    null,
    pillsFor(data),
    { url, type: normType, label: `Open ${PLANNER_LABELS[normType] || PLANNER_LABELS[type]} →` }
  );
  setStatus('Ready to plan! ✅');
  setProgress(100);
}

function accomEmoji(type) {
  const map = {
    'Hotel':                '🏨',
    'Boutique Hotel':       '🛎️',
    'Entire Home / Airbnb': '🏡',
    'Apartment':            '🏢',
    'Hostel':               '🎒',
    'No preference':        '',
  };
  return map[type] || '🏨';
}

// ── Main send ───────────────────────────────────────────────────────
async function sendMsg() {
  const inp  = document.getElementById('gc-inp');
  const text = inp?.value.trim();
  if (!text || generating) return;

  inp.value = '';
  inp.style.height = 'auto';
  addUser(text);
  setLock(true);
  typingOn();
  setStatus('Genie is thinking…');

  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, tripData, today })
    });

    typingOff();

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    retryCount = 0;

    // Merge extracted fields — only overwrite if new value is non-empty
    if (data.tripData) {
      Object.entries(data.tripData).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') tripData[k] = v;
      });
    }

    const status = data.status || 'collecting';
    const reply  = data.reply  || '';
    const pills  = pillsFor(tripData);

    // Progress indicator
    const prog = { collecting: 30, clarifying: 65, ready: 95 }[status] || 30;
    setProgress(prog);

    if (status === 'ready') {
      addBot(reply || `Perfect — I have everything I need! 🎉`, null, pills);
      routeToPlanner(tripData);
      setStatus('Ready! ✅');

    } else if (status === 'clarifying') {
      // Need to know trip type — show the picker
      addBot(reply, null, pills.length ? pills : null);
      setStatus('Choose your trip style');
      showPlannerPicker(selectedType => {
        tripData.tripType = selectedType;
        routeToPlanner(tripData);
      });

    } else {
      // Still collecting — just show the reply
      addBot(reply, null, pills.length ? pills : null);
      setStatus('Your AI Travel Planner');
    }

  } catch (err) {
    typingOff();
    retryCount++;

    if (retryCount <= 2) {
      addBot(`Hmm, I had a hiccup. Let me try again — or feel free to rephrase! 🙏`);
    } else {
      // After 2 failures, fall back to direct planner links
      addBot(`I'm having trouble right now. Head straight to any planner below — they'll ask you the same questions! 😊`);
      showPlannerPicker(type => {
        if (tripData.destination || tripData.startDate) {
          routeToPlanner({ ...tripData, tripType: type });
        } else {
          window.location.href = PLANNER_MAP[type];
        }
      });
    }
    console.error('[Genie]', err);
    setStatus('Your AI Travel Planner');
    setProgress(0);

  } finally {
    setLock(false);
    document.getElementById('gc-inp')?.focus();
  }
}

// ── Boot ────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildDOM);
} else {
  buildDOM();
}

})();