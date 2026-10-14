// Keyword → card mapping for Personal
(function(){
  const f=document.getElementById('ask-form-personal'), i=document.getElementById('ask-input-personal');
  if(!f||!i) return;

  const R=[
    {k:['bill','due','utility','subscription'], id:'link-utilities'},
    {k:['calendar','event','birthday','appointment'], id:'link-calendar'},
    {k:['grocer','meal','nutrition','lunch','dinner'], id:'link-nutrition'},
    {k:['habit','workout','mindfulness'], id:'link-wellness'},
    {k:['car','oil','maintenance','tire'], id:'link-carcare'},
    {k:['receipt','warranty'], id:'link-receipts'},
    {k:['passport','id','license'], id:'link-ids'},
    {k:['budget','spending'], id:'link-budget'},
    {k:['repair','project'], id:'link-repairs'},
    {k:['chore','cleaning'], id:'link-cleaning'},
    {k:['homework','school'], id:'link-homework'},
    {k:['activity','rides','practice'], id:'link-activities'},
    {k:['packing','pack'], id:'link-packing'},
    {k:['visa','travel doc'], id:'link-docs'},
    {k:['trip','itinerary'], id:'link-itin'},
    {k:['insurance','policy'], id:'link-policies'},
    {k:['emergency','roadside'], id:'link-road'},
    {k:['remind','reminder'], id:'link-reminders'},
    {k:['party','event'], id:'link-events'},
    {k:['photo','album'], id:'link-photo'},
    {k:['cards','message','greeting'], id:'link-cards'},
    {k:['english'], id:'link-english'},
    {k:['vietnamese'], id:'link-vietnamese'}
  ];

  function go(id){ const t=document.getElementById(id); if(t){ t.scrollIntoView({behavior:'smooth',block:'start'}); t.focus?.(); } }

  f.addEventListener('submit', e=>{
    e.preventDefault();
    const q=i.value.toLowerCase().trim();
    for(const r of R){ if(r.k.some(w=>q.includes(w))) return go(r.id); }
    go('link-household'); // sensible fallback
  });
})();
