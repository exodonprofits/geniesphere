/**
 * Nutrition: estimate a meal from a photo (ADR-025).
 *
 *   GenieSphere.mealPhoto.mount(sectionEl, householdId)   // builds the card
 *   await GenieSphere.mealPhoto.shrink(file)               // -> JPEG data URL, max 768 px
 *   await GenieSphere.mealPhoto.estimate(householdId, dataUrl) -> { result, usage }
 *
 * The photo is shrunk in the browser, sent once through the AI gateway
 * (task "nutrition.photo_estimate") and never stored, here or on the server.
 * "Scan a plate" opens a full-screen live camera with a guide frame (https
 * only; otherwise the phone's camera app). Results are ranges; each item's
 * portion can be scaled or removed and the totals follow. Allergens are flagged only as "may contain", never "safe".
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
      return toJpeg(loaded.img, 0, 0, loaded.img.naturalWidth, loaded.img.naturalHeight);
    } finally {
      URL.revokeObjectURL(loaded.url);
    }
  }

  async function estimate(householdId, dataUrl) {
    var out = await GS.ai.request({ task: 'nutrition.photo_estimate', householdId: householdId, input: { image: dataUrl } });
    return { result: out.result || {}, usage: out.usage || null };
  }

  // Draws (part of) an image or video frame onto a canvas, max MAX_SIDE px.
  function toJpeg(source, sx, sy, sw, sh) {
    var scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    canvas.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  function canScan() {
    return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function fileButton(label, cls, capture, onFile) {
    var lab = el('label', cls);
    var input = el('input', 'gs-sr-only');
    input.type = 'file'; input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    lab.appendChild(input);
    lab.appendChild(document.createTextNode(label));
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.value = '';
      if (f) onFile(f);
    });
    return lab;
  }

  // ── Full-screen plate scanner: live camera, guide frame, scan line ──
  // The camera runs only while the scanner is open and stops the moment a
  // frame is taken. Only the square inside the guide frame is sent.
  function openScanner(opts) {
    var stream = null, closed = false, lastFocus = document.activeElement;
    var root = el('div', 'gs-scan');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Scan a plate');
    var video = el('video', 'gs-scan-video');
    video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true; video.autoplay = true;
    var still = el('img', 'gs-scan-still'); still.alt = ''; still.hidden = true;
    var shade = el('div', 'gs-scan-shade');
    var frame = el('div', 'gs-scan-frame');
    ['tl', 'tr', 'bl', 'br'].forEach(function (c) { frame.appendChild(el('span', 'gs-scan-corner gs-scan-' + c)); });
    var line = el('div', 'gs-scan-line'); frame.appendChild(line);
    var top = el('div', 'gs-scan-top');
    var close = el('button', 'gs-scan-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close scanner');
    top.appendChild(el('span', 'gs-scan-title', 'Scan a plate'));
    top.appendChild(close);
    var hint = el('p', 'gs-scan-hint', 'Starting the camera…');
    var bar = el('div', 'gs-scan-bar');
    var choose = fileButton('Library', 'gs-scan-side', false, function (f) { stop(); finish(); opts.onFile(f); });
    var shutter = el('button', 'gs-scan-shutter'); shutter.type = 'button'; shutter.setAttribute('aria-label', 'Scan this plate'); shutter.disabled = true;
    shutter.appendChild(el('span'));
    bar.appendChild(choose); bar.appendChild(shutter); bar.appendChild(el('span', 'gs-scan-side'));
    var err = el('div', 'gs-scan-error'); err.hidden = true;
    [video, still, shade, frame, top, hint, bar, err].forEach(function (n) { root.appendChild(n); });
    document.body.appendChild(root);
    document.documentElement.classList.add('gs-scan-open');

    function stop() {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      video.srcObject = null;
    }
    function finish() {
      if (closed) return;
      closed = true; stop();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      root.remove();
      document.documentElement.classList.remove('gs-scan-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) { if (e.key === 'Escape') finish(); }
    function onHide() { if (document.visibilityState === 'hidden' && !root.classList.contains('is-scanning')) finish(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    close.addEventListener('click', finish);

    function fail(message) {
      stop();
      root.classList.remove('is-scanning');
      root.classList.add('is-error');
      err.hidden = false; err.textContent = '';
      err.appendChild(el('p', null, message));
      var row = el('div', 'gs-scan-error-actions');
      if (!still.hidden) {
        var again = el('button', 'gs-btn gs-btn-primary', 'Scan again'); again.type = 'button';
        again.addEventListener('click', function () { finish(); openScanner(opts); });
        row.appendChild(again);
      } else {
        row.appendChild(fileButton('Use camera app', 'gs-btn gs-btn-primary', true, function (f) { finish(); opts.onFile(f); }));
      }
      row.appendChild(fileButton('Choose photo', 'gs-btn', false, function (f) { finish(); opts.onFile(f); }));
      err.appendChild(row);
    }

    // Maps the on-screen guide square onto the video's own pixels (object-fit: cover).
    function cropRect() {
      var vw = video.videoWidth, vh = video.videoHeight;
      var vr = video.getBoundingClientRect(), fr = frame.getBoundingClientRect();
      var scale = Math.max(vr.width / vw, vr.height / vh);
      var dx = (vr.width - vw * scale) / 2, dy = (vr.height - vh * scale) / 2;
      var sx = (fr.left - vr.left - dx) / scale, sy = (fr.top - vr.top - dy) / scale, ss = fr.width / scale;
      sx = Math.max(0, sx); sy = Math.max(0, sy); ss = Math.min(ss, vw - sx, vh - sy);
      return { sx: sx, sy: sy, ss: ss };
    }

    shutter.addEventListener('click', async function () {
      if (!stream || !video.videoWidth) return;
      var c = cropRect();
      var dataUrl = toJpeg(video, c.sx, c.sy, c.ss, c.ss);
      stop();
      still.src = dataUrl; still.hidden = false;
      root.classList.add('is-scanning');
      shutter.disabled = true;
      hint.textContent = 'Scanning your plate…';
      try {
        var out = await opts.analyze(dataUrl);
        if (closed) return;
        finish();
        opts.onResult(dataUrl, out);
      } catch (e) {
        if (!closed) fail(e.message || 'Couldn’t read that photo. Try again.');
      }
    });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then(function (s) {
        if (closed) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; video.srcObject = s;
        return video.play().catch(function () { /* autoplay with muted+playsinline */ });
      })
      .then(function () {
        if (closed || !stream) return;
        hint.textContent = 'Fit the whole plate inside the frame';
        shutter.disabled = false;
        shutter.focus();
      })
      .catch(function (e) {
        if (closed) return;
        fail(e && e.name === 'NotAllowedError'
          ? 'Camera access is off for this site. You can allow it in Settings, or use the camera app instead.'
          : 'The camera isn’t available right now. Use the camera app or choose a photo instead.');
      });
  }

  function mount(section, householdId) {
    section.textContent = '';
    var head = el('div', 'gs-panel-head');
    var left = el('div', 'gs-panel-head-left');
    left.appendChild(icon('camera'));
    var titles = el('div');
    titles.appendChild(el('h2', 'gs-panel-title', 'Snap a meal'));
    titles.appendChild(el('p', 'gs-panel-sub', 'Scan a plate to estimate its calories. The photo isn’t saved.'));
    left.appendChild(titles);
    head.appendChild(left);

    var actions = el('div', 'gs-snap-actions');
    var takeBtn;
    if (canScan()) {
      takeBtn = el('button', 'gs-btn gs-btn-primary gs-snap-scan', 'Scan a plate');
      takeBtn.type = 'button';
      takeBtn.addEventListener('click', function () {
        if (busy) return;
        openScanner({ analyze: function (d) { return estimate(householdId, d); }, onResult: showResult, onFile: run });
      });
    } else {
      takeBtn = fileButton('Take photo', 'gs-btn gs-btn-primary', true, run);
    }
    var chooseBtn = fileButton('Choose photo', 'gs-btn', false, run);
    actions.appendChild(takeBtn); actions.appendChild(chooseBtn);
    head.appendChild(actions);

    var body = el('div', 'gs-panel-body gs-snap-body');
    body.hidden = true;
    section.appendChild(head); section.appendChild(body);
    GS.shell.fillIcons(section);

    var busy = false, preview = null;

    function setBusy(on) {
      busy = on;
      [takeBtn, chooseBtn].forEach(function (b) {
        b.classList.toggle('is-disabled', on);
        var i = b.querySelector('input'); if (i) i.disabled = on; else b.disabled = on;
      });
    }

    function startCard(src) {
      body.hidden = false; body.textContent = '';
      var wrap = el('div', 'gs-snap-result');
      var img = el('img', 'gs-snap-photo'); img.src = src; img.alt = 'Your meal photo';
      wrap.appendChild(img);
      body.appendChild(wrap);
      return wrap;
    }

    // Result from the scanner: the scanning already happened full screen.
    function showResult(dataUrl, out) {
      if (preview) { URL.revokeObjectURL(preview); preview = null; }
      var wrap = startCard(dataUrl);
      render(wrap, out.result, out.usage);
      body.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    // A photo file (library, camera app, or no live camera): shrink, then scan in the card.
    async function run(file) {
      if (busy) return;
      setBusy(true);
      if (preview) URL.revokeObjectURL(preview);
      preview = URL.createObjectURL(file);
      var wrap = startCard(preview);
      var wait = el('div', 'gs-snap-wait');
      wait.appendChild(el('span', 'gs-spinner'));
      wait.appendChild(el('span', null, 'Scanning your plate…'));
      wrap.appendChild(wait);
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
