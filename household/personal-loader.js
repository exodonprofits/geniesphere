// Inject Quick Start + Quick Actions and (optionally) reorder sections by JSON.
(async function(){
  const data = await fetch('shared/data/personal-agents.json', {cache:'no-store'}).then(r=>r.json()).catch(()=>null);
  if(!data) return;

  const form = document.getElementById('ask-form-personal'); // personal form ids
  const input = document.getElementById('ask-input-personal'); // matches page ids
  if(!form || !input) return;

  // Quick Start under the Ask box
  let qs = document.getElementById('quick-start');
  if(!qs){ qs = document.createElement('div'); qs.id='quick-start'; qs.style.display='grid';
           qs.style.gridTemplateColumns='repeat(auto-fit,minmax(180px,1fr))'; qs.style.gap='12px';
           form.insertAdjacentElement('afterend', qs); }
  qs.innerHTML='';
  data.quick_start.forEach(x=>{
    const b=document.createElement('button');
    b.type='button'; b.className='btn'; b.textContent=`${x.icon} ${x.title}`;
    b.onclick=()=> document.getElementById(x.target)?.scrollIntoView({behavior:'smooth',block:'start'});
    qs.appendChild(b);
  });

  // Quick Action chips
  let qa=document.getElementById('quick-actions');
  if(!qa){ qa=document.createElement('div'); qa.id='quick-actions';
           qa.style.display='flex'; qa.style.flexWrap='wrap'; qa.style.gap='8px';
           qs.insertAdjacentElement('afterend', qa); }
  qa.innerHTML='';
  data.quick_actions.forEach(a=>{
    const c=document.createElement('button');
    c.type='button'; c.className='btn ghost'; c.style.padding='6px 10px'; c.style.fontSize='14px';
    c.textContent=a.label;
    c.onclick=()=>{ input.value=a.fill; form.requestSubmit?form.requestSubmit():form.submit(); };
    qa.appendChild(c);
  });

  // Optional: reorder sections if you wrap groups with <section data-section-title="...">
  const wraps=[...document.querySelectorAll('section[data-section-title]')];
  if(wraps.length){
    const map=Object.fromEntries(wraps.map(w=>[w.getAttribute('data-section-title'), w]));
    const parent=wraps[0].parentElement;
    data.sections.forEach(s=>{ const w=map[s.title]; if(w) parent.appendChild(w); });
  }
})();
