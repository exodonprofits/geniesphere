/**
 * Nutrition: estimate a meal from a photo (ADR-025).
 *
 *   GenieSphere.mealPhoto.mount(sectionEl, householdId)   // builds the card
 *   await GenieSphere.mealPhoto.shrink(file)               // -> JPEG data URL, max 768 px
 *   await GenieSphere.mealPhoto.estimate(householdId, dataUrl) -> { result, usage }
 *
 * The photo is shrunk in the browser, sent once through the AI gateway
 * (task "nutrition.photo_estimate") and never stored, here or on the server.
 * Results are ranges; each item's portion can be scaled or removed and the
 * totals follow. Allergens are flagged only as "may contain", never "safe".
 *
 * Requires gs-client.js, core/ai/ai-gateway.js and gs-shell.js (icons).
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  var GS = window.GenieSphere;
  var MAX_SIDE = 768;
  var STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(name) { var s = el('span', 'gs-panel-icon'); s.setAttribute('data-gs-icon', name); return s; }
  function round(n) { return Math.round(n); }
  function range(lo, hi) { lo = round(lo); hi = round(hi); return lo === hi ? lo + ' kcal' : lo + '–' + hi + ' kcal'; }
  function times(m) { return (m === 0.25 ? '¼' : m === 0.5 ? '½' : m === 0.75 ? '¾' : String(m)) + '×'; }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That photo could not be opened. Try a JPEG or PNG.')); };
      img.src = url;
    });
  }

  // Phone photos are 3-5 MB; the model looks at ~512 px anyway.
  async function shrink(file) {
    if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Choose a photo of the meal.');
    var loaded = await loadImage(file);
    try {
      var w = loaded.img.naturalWidth, h = loaded.img.naturalHeight;
      var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      canvas.getContext('2d').drawImage(loaded.img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      URL.revokeObjectURL(loaded.url);
    }
  }

  async function estimate(householdId, dataUrl) {
    var out = await GS.ai.request({ task: 'nutrition.photo_estimate', householdId: householdId, input: { image: dataUrl } });
    return { result: out.result || {}, usage: out.usage || null };
  }

  function mount(section, householdId) {
    section.textContent = '';
    var head = el('div', 'gs-panel-head');
    var left = el('div', 'gs-panel-head-left');
    left.appendChild(icon('camera'));
    var titles = el('div');
    titles.appendChild(el('h2', 'gs-panel-title', 'Snap a meal'));
    titles.appendChild(el('p', 'gs-panel-sub', 'Take a photo of a plate to estimate its calories. The photo isn’t saved.'));
    left.appendChild(titles);
    head.appendChild(left);

    var actions = el('div', 'gs-snap-actions');
    function picker(label, primary, capture) {
      var lab = el('label', 'gs-btn' + (primary ? ' gs-btn-primary' : ''));
      var input = el('input', 'gs-sr-only');
      input.type = 'file'; input.accept = 'image/*';
      if (capture) input.setAttribute('capture', 'environment');
      lab.appendChild(input);
      lab.appendChild(document.createTextNode(label));
      input.addEventListener('change', function () {
        var f = input.files && input.files[0];
        input.value = '';
        if (f) run(f);
      });
      return lab;
    }
    var takeBtn = picker('Take photo', true, true);
    var chooseBtn = picker('Choose photo', false, false);
    actions.appendChild(takeBtn); actions.appendChild(chooseBtn);
    head.appendChild(actions);

    var body = el('div', 'gs-panel-body gs-snap-body');
    body.hidden = true;
    section.appendChild(head); section.appendChild(body);
    GS.shell.fillIcons(section);

    var busy = false, preview = null;

    function setBusy(on) {
      busy = on;
      [takeBtn, chooseBtn].forEach(function (b) { b.classList.toggle('is-disabled', on); b.querySelector('input').disabled = on; });
    }

    async function run(file) {
      if (busy) return;
      setBusy(true);
      body.hidden = false; body.textContent = '';
      if (preview) URL.revokeObjectURL(preview);
      preview = URL.createObjectURL(file);
      var wrap = el('div', 'gs-snap-result');
      var img = el('img', 'gs-snap-photo'); img.src = preview; img.alt = 'Your meal photo';
      wrap.appendChild(img);
      var wait = el('div', 'gs-snap-wait');
      wait.appendChild(el('span', 'gs-spinner'));
      wait.appendChild(el('span', null, 'Looking at your meal…'));
      wrap.appendChild(wait);
      body.appendChild(wrap);
      body.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      try {
        var dataUrl = await shrink(file);
        var out = await estimate(householdId, dataUrl);
        wrap.removeChild(wait);
        render(wrap, out.result, out.usage);
      } catch (e) {
        wait.textContent = '';
        wait.className = 'gs-snap-error';
        wait.textContent = e.message || 'Couldn’t read that photo. Try again.';
      } finally {
        setBusy(false);
      }
    }

    function render(wrap, r, usage) {
      var info = el('div', 'gs-snap-info');
      wrap.appendChild(info);
      if (!r.isFood) {
        info.appendChild(el('p', 'gs-snap-dish', 'That doesn’t look like a meal'));
        info.appendChild(el('p', 'gs-snap-note', 'Try again from above, with the whole plate in the frame.'));
        return;
      }
      var items = (r.items || []).map(function (it) { return { it: it, m: 1 }; });

      info.appendChild(el('p', 'gs-snap-dish', r.dish || 'Your meal'));
      var total = el('p', 'gs-snap-total');
      info.appendChild(total);
      var meta = el('p', 'gs-snap-macros');
      info.appendChild(meta);
      var conf = el('span', 'gs-pill ' + (r.confidence === 'high' ? 'ok' : r.confidence === 'medium' ? 'accent' : 'warn'),
        r.confidence === 'high' ? 'Clear photo' : r.confidence === 'medium' ? 'Rough estimate' : 'Low confidence');
      info.appendChild(conf);

      if (r.allergens && r.allergens.length) {
        var warn = el('div', 'gs-snap-allergen');
        var strong = el('strong', null, 'May contain ' + r.allergens.join(', ') + '.');
        warn.appendChild(strong);
        warn.appendChild(document.createTextNode(' That’s on your household’s allergy list. A photo can’t show what’s inside a dish, so check before eating.'));
        wrap.appendChild(warn);
      }

      var list = el('ul', 'gs-snap-items');
      wrap.appendChild(list);

      function update() {
        var lo = 0, hi = 0, p = 0, c = 0, f = 0;
        items.forEach(function (x) {
          if (!x.m) return;
          lo += x.it.kcalLow * x.m; hi += x.it.kcalHigh * x.m;
          p += x.it.proteinG * x.m; c += x.it.carbsG * x.m; f += x.it.fatG * x.m;
        });
        total.textContent = range(lo, hi);
        meta.textContent = 'Protein ' + round(p) + ' g · Carbs ' + round(c) + ' g · Fat ' + round(f) + ' g';
      }

      items.forEach(function (x) {
        var li = el('li', 'gs-snap-item');
        var main = el('div', 'gs-snap-item-main');
        main.appendChild(el('span', 'gs-snap-item-name', x.it.name));
        var sub = el('span', 'gs-snap-item-sub');
        main.appendChild(sub);
        li.appendChild(main);

        var step = el('div', 'gs-snap-step');
        step.setAttribute('role', 'group');
        step.setAttribute('aria-label', 'Portion of ' + x.it.name);
        var less = el('button', 'gs-snap-step-btn', '−'); less.type = 'button'; less.setAttribute('aria-label', 'Less ' + x.it.name);
        var amt = el('span', 'gs-snap-step-val');
        var more = el('button', 'gs-snap-step-btn', '+'); more.type = 'button'; more.setAttribute('aria-label', 'More ' + x.it.name);
        var drop = el('button', 'gs-snap-drop', 'Remove'); drop.type = 'button';
        step.appendChild(less); step.appendChild(amt); step.appendChild(more);
        li.appendChild(step); li.appendChild(drop);

        function paint() {
          li.classList.toggle('is-removed', !x.m);
          amt.textContent = x.m ? times(x.m) : '0×';
          less.disabled = !x.m || x.m === STEPS[0];
          more.disabled = !x.m || x.m === STEPS[STEPS.length - 1];
          drop.textContent = x.m ? 'Remove' : 'Undo';
          sub.textContent = x.m
            ? (x.it.portion ? x.it.portion + (x.m !== 1 ? ' × ' + times(x.m).replace('×', '') : '') + ' · ' : '') + range(x.it.kcalLow * x.m, x.it.kcalHigh * x.m)
            : 'Not counted';
          update();
        }
        less.addEventListener('click', function () { x.m = STEPS[Math.max(0, STEPS.indexOf(x.m) - 1)]; paint(); });
        more.addEventListener('click', function () { x.m = STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(x.m) + 1)]; paint(); });
        drop.addEventListener('click', function () { x.m = x.m ? 0 : 1; paint(); });
        paint();
        list.appendChild(li);
      });
      update();

      var foot = el('p', 'gs-snap-note');
      foot.textContent = (r.note ? r.note + ' ' : '') + 'Photo estimates are often off by 20–40%. Not medical advice.';
      wrap.appendChild(foot);
      if (usage) wrap.appendChild(el('p', 'gs-hint', usage.today + ' of ' + usage.limit + ' meal photos used today.'));
    }
  }

  GS.mealPhoto = { mount: mount, shrink: shrink, estimate: estimate };
})();
