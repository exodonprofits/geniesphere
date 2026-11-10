/**
 * Genie conversation UI (Core, ADR-022 / ADR-023). One implementation, used by
 * the Genie page and by the floating Genie sheet on every other page.
 *
 *   var chat = GenieSphere.genieChat.mount({ body, foot?, scroller?, page? })
 *   GenieSphere.genieChat.openSheet()      // floating sheet (built once)
 *   GenieSphere.genieChat.closeSheet()
 *
 * The conversation follows the person across pages in sessionStorage and is
 * gone when the browser tab closes; nothing is stored on the server. Only the
 * text is kept: proposal cards are shown once, when Genie makes them.
 *
 * After an approved proposal (or its undo) it fires
 *   window 'gs:data-changed'  { detail: { kind: 'tasks' | 'grocery' } }
 * so the page underneath can refresh its own list.
 *
 * Requires gs-client.js, gs-auth.js, household.js, gs-shell.js, ai-gateway.js,
 * tasks.js, grocery-api.js and genie.js.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  var GS = window.GenieSphere;
  var STORE = 'gs.genie.chat.v1';
  var KEEP = 24;

  var SUGGESTIONS = {
    grocery: ['What do I need for this week’s dinners?', 'Add milk, eggs and bananas'],
    nutrition: ['What’s for dinner this week?', 'Add this week’s dinner basics to groceries'],
    home: ['What upkeep is coming up?', 'Draft a text to book the furnace service'],
    tasks: ['What’s overdue?', 'Who has the most on their plate?'],
    _: ['What’s due this week?', 'Plan Saturday’s chores for the family', 'Draft a text to book the furnace service', 'Add milk, eggs and bananas to groceries']
  };
  var KIND = {
    'task.add': ['list', 'New task'], 'task.assign': ['list', 'Assign'],
    'grocery.add': ['cart', 'Grocery list'], 'draft': ['mail', 'Draft']
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(name) { var s = el('span', 'gs-genie-ico'); s.setAttribute('data-gs-icon', name); return s; }
  function dueText(iso) {
    if (!iso) return 'No date';
    var p = iso.split('-');
    return 'Due ' + new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function changed(kind) {
    try { window.dispatchEvent(new CustomEvent('gs:data-changed', { detail: { kind: kind } })); } catch (e) { /* old browser */ }
  }
  function kindOf(p) { return p.type === 'grocery.add' ? 'grocery' : 'tasks'; }

  // ── Session memory (this browser tab only) ──
  function loadHistory(householdId) {
    try {
      var s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      return s && s.householdId === householdId && Array.isArray(s.messages) ? s.messages : [];
    } catch (e) { return []; }
  }
  function saveHistory(householdId, messages) {
    try { sessionStorage.setItem(STORE, JSON.stringify({ householdId: householdId, messages: messages.slice(-KEEP) })); } catch (e) { /* private mode */ }
  }

  // Household, members and the signed-in person, loaded once per page.
  var ctxPromise = null;
  function context() {
    if (!ctxPromise) {
      ctxPromise = (async function () {
        var session = await GS.auth.session();
        if (!session) return null;
        var ctx = await GS.household.current();
        if (!ctx) return { ctx: null };
        var members = await GS.household.members(ctx.householdId);
        var me = members.find(function (m) { return m.userId === session.user.id; });
        return { ctx: ctx, members: members, me: me };
      })();
      ctxPromise.catch(function () { ctxPromise = null; });
    }
    return ctxPromise;
  }

  function mount(opts) {
    var G = GS.genie;
    var body = opts.body, foot = opts.foot || opts.body, scroller = opts.scroller || null;
    var state = { ctx: null, members: [], history: [], busy: false };

    var chat = el('div', 'gs-genie-chat'); chat.setAttribute('aria-live', 'polite');
    var suggest = el('div', 'gs-genie-suggest');
    var form = el('form', 'gs-genie-ask'); form.noValidate = true;
    var inputId = 'gs-genie-input-' + Math.random().toString(36).slice(2, 8);
    var label = el('label', 'gs-sr-only', 'Ask Genie'); label.htmlFor = inputId;
    var input = el('textarea', 'gs-input gs-genie-input');
    input.id = inputId; input.rows = 1; input.maxLength = 1000; input.placeholder = 'Ask Genie anything…';
    var send = el('button', 'gs-btn gs-btn-primary gs-genie-send', 'Ask');
    send.type = 'submit'; send.setAttribute('aria-label', 'Send');
    var usage = el('p', 'gs-hint gs-genie-usage');
    form.appendChild(label); form.appendChild(input); form.appendChild(send);
    body.appendChild(chat); body.appendChild(suggest);
    foot.appendChild(form); foot.appendChild(usage);

    function toEnd(node) {
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
      else node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function bubble(role, text) {
      var wrap = el('div', 'gs-genie-msg gs-genie-' + role);
      if (role === 'genie') wrap.appendChild(icon('sparkle'));
      var b = el('div', 'gs-genie-bubble');
      String(text || '').split(/\n{2,}/).forEach(function (para) { b.appendChild(el('p', null, para)); });
      wrap.appendChild(b);
      chat.appendChild(wrap);
      GS.shell.fillIcons(wrap);
      toEnd(wrap);
      return b;
    }

    function proposalCard(p) {
      var kind = KIND[p.type] || ['sparkle', 'Suggestion'];
      var card = el('div', 'gs-genie-card gs-genie-card-' + p.type.replace('.', '-'));
      var head = el('div', 'gs-genie-card-head');
      head.appendChild(icon(kind[0]));
      head.appendChild(el('span', 'gs-genie-card-kind', p.type === 'draft' ? (p.channel === 'email' ? 'Draft email' : 'Draft text') : kind[1]));
      card.appendChild(head);

      if (p.type === 'task.add') {
        card.appendChild(el('p', 'gs-genie-card-title', p.title));
        card.appendChild(el('p', 'gs-genie-card-meta', dueText(p.dueDate) + ' · ' + (p.assignee || 'Anyone')));
      } else if (p.type === 'task.assign') {
        card.appendChild(el('p', 'gs-genie-card-title', p.title));
        card.appendChild(el('p', 'gs-genie-card-meta', 'Give it to ' + p.assignee));
      } else if (p.type === 'grocery.add') {
        var ul = el('ul', 'gs-genie-card-items');
        (p.items || []).forEach(function (it) { ul.appendChild(el('li', null, it.name + (it.quantity ? ' · ' + it.quantity : ''))); });
        card.appendChild(ul);
      } else if (p.type === 'draft') {
        if (p.to) card.appendChild(el('p', 'gs-genie-card-meta', 'To: ' + p.to));
        if (p.subject) card.appendChild(el('p', 'gs-genie-card-title', p.subject));
        card.appendChild(el('p', 'gs-genie-draft', p.body));
      }

      var cfoot = el('div', 'gs-genie-card-foot');
      var note = el('span', 'gs-genie-card-note');
      if (p.type === 'draft') {
        var copy = el('button', 'gs-btn gs-btn-primary gs-btn-sm', 'Copy');
        copy.type = 'button';
        copy.addEventListener('click', async function () {
          try { await navigator.clipboard.writeText((p.subject ? p.subject + '\n\n' : '') + p.body); note.textContent = 'Copied. Paste it wherever you send it.'; }
          catch (e) { note.textContent = 'Select the text above to copy it.'; }
        });
        var open = el('a', 'gs-btn gs-btn-sm', p.channel === 'email' ? 'Open in Mail' : 'Open in Messages');
        open.href = p.channel === 'email'
          ? 'mailto:?subject=' + encodeURIComponent(p.subject || '') + '&body=' + encodeURIComponent(p.body)
          : 'sms:?&body=' + encodeURIComponent(p.body);
        cfoot.appendChild(copy); cfoot.appendChild(open);
      } else {
        var ok = el('button', 'gs-btn gs-btn-primary gs-btn-sm', 'Approve');
        var no = el('button', 'gs-btn gs-btn-sm', 'Dismiss');
        ok.type = no.type = 'button';
        ok.addEventListener('click', async function () {
          ok.disabled = no.disabled = true; note.textContent = 'Saving…';
          try {
            var res = await G.apply(state.ctx.householdId, p, state.members);
            card.classList.add('gs-genie-card-done');
            cfoot.textContent = '';
            cfoot.appendChild(el('span', 'gs-genie-card-ok', '✓ ' + res.text));
            if (res.undo) {
              var undo = el('button', 'gs-btn gs-btn-sm', 'Undo');
              undo.type = 'button';
              undo.addEventListener('click', async function () {
                undo.disabled = true;
                try { await res.undo(); cfoot.textContent = ''; cfoot.appendChild(el('span', 'gs-genie-card-note', 'Undone.')); changed(kindOf(p)); }
                catch (e) { undo.disabled = false; note.textContent = e.message || 'Could not undo.'; cfoot.appendChild(note); }
              });
              cfoot.appendChild(undo);
            }
            changed(kindOf(p));
          } catch (e) {
            ok.disabled = no.disabled = false; note.textContent = e.message || 'Could not save. Try again.';
          }
        });
        no.addEventListener('click', function () { card.classList.add('gs-genie-card-dismissed'); cfoot.textContent = ''; cfoot.appendChild(el('span', 'gs-genie-card-note', 'Dismissed.')); });
        cfoot.appendChild(ok); cfoot.appendChild(no);
      }
      cfoot.appendChild(note);
      card.appendChild(cfoot);
      return card;
    }

    async function ask(text) {
      text = String(text || '').trim();
      if (!text || state.busy || !state.ctx) return;
      state.busy = true; send.disabled = true; suggest.hidden = true;
      bubble('me', text);
      state.history.push({ role: 'user', content: text });
      saveHistory(state.ctx.householdId, state.history);
      input.value = ''; autosize();
      var thinking = bubble('genie', 'Thinking…');
      thinking.parentNode.classList.add('gs-genie-thinking');
      try {
        var out = await G.ask(state.ctx.householdId, state.history);
        thinking.parentNode.remove();
        var b = bubble('genie', out.reply || 'Here’s what I’d suggest.');
        out.proposals.forEach(function (p) { b.appendChild(proposalCard(p)); });
        GS.shell.fillIcons(b);
        toEnd(b);
        state.history.push({ role: 'assistant', content: out.reply });
        saveHistory(state.ctx.householdId, state.history);
        if (out.usage) usage.textContent = out.usage.today + ' of ' + out.usage.limit + ' questions used today.';
      } catch (e) {
        thinking.parentNode.remove();
        bubble('genie', e.message || 'Genie couldn’t answer just now. Try again in a moment.').parentNode.classList.add('gs-genie-error');
      } finally {
        state.busy = false; send.disabled = false;
      }
    }

    function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; }

    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
    });
    (SUGGESTIONS[opts.page] || SUGGESTIONS._).forEach(function (s) {
      var c = el('button', 'gs-genie-chip', s); c.type = 'button';
      c.addEventListener('click', function () { ask(s); });
      suggest.appendChild(c);
    });

    send.disabled = true;
    var ready = context().then(function (c) {
      if (!c) { bubble('genie', 'Sign in to talk to Genie.'); return; }
      if (!c.ctx) { bubble('genie', 'You are not part of a household yet. Ask the household owner to add you.'); suggest.hidden = true; return; }
      state.ctx = c.ctx; state.members = c.members;
      bubble('genie', 'Hi' + (c.me ? ' ' + G.memberName(c.me) : '') + '. I know your tasks, homes, vehicles, grocery list and meal plans. Ask me anything about the household, or ask me to plan something. I’ll suggest, and you approve.');
      state.history = loadHistory(c.ctx.householdId);
      state.history.forEach(function (m) { bubble(m.role === 'user' ? 'me' : 'genie', m.content); });
      if (state.history.length) suggest.hidden = true;
      send.disabled = false;
    }).catch(function (e) {
      bubble('genie', e.message || 'Could not load Genie.').parentNode.classList.add('gs-genie-error');
    });

    return { ready: ready, focus: function () { input.focus(); }, ask: ask };
  }

  // ── Floating sheet ──
  var sheet = null, sheetChat = null, lastFocus = null;

  function syncViewport() {
    // Keep the sheet inside the visible area when the phone keyboard is up.
    if (!sheet || !window.visualViewport) return;
    sheet.style.setProperty('--gs-vvh', window.visualViewport.height + 'px');
    sheet.style.setProperty('--gs-vvt', window.visualViewport.offsetTop + 'px');
  }

  function buildSheet() {
    sheet = el('div', 'gs-genie-sheet');
    sheet.hidden = true;
    var backdrop = el('div', 'gs-genie-sheet-backdrop');
    var panel = el('div', 'gs-genie-sheet-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Genie');

    var head = el('div', 'gs-genie-sheet-head');
    var mark = el('span', 'gs-panel-icon gs-genie-mark'); mark.setAttribute('data-gs-icon', 'sparkle');
    var titles = el('div', 'gs-genie-sheet-titles');
    titles.appendChild(el('p', 'gs-genie-sheet-title', 'Genie'));
    titles.appendChild(el('p', 'gs-genie-sheet-sub', 'Suggests. Nothing changes until you approve.'));
    var full = el('a', 'gs-genie-sheet-full', 'Full page'); full.href = '/core/genie/index.html';
    var close = el('button', 'gs-genie-sheet-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close Genie'); close.textContent = '×';
    head.appendChild(mark); head.appendChild(titles); head.appendChild(full); head.appendChild(close);

    var bodyEl = el('div', 'gs-genie-sheet-body');
    var footEl = el('div', 'gs-genie-sheet-foot');
    panel.appendChild(head); panel.appendChild(bodyEl); panel.appendChild(footEl);
    sheet.appendChild(backdrop); sheet.appendChild(panel);
    document.body.appendChild(sheet);
    GS.shell.fillIcons(head);

    backdrop.addEventListener('click', closeSheet);
    close.addEventListener('click', closeSheet);
    // On the document: after Approve the clicked button is gone and focus is on <body>.
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewport);
      window.visualViewport.addEventListener('scroll', syncViewport);
    }
    sheetChat = mount({ body: bodyEl, foot: footEl, scroller: bodyEl, page: document.body.getAttribute('data-gs-shell') });
  }

  function openSheet() {
    if (!sheet) buildSheet();
    lastFocus = document.activeElement;
    syncViewport();
    sheet.hidden = false;
    document.documentElement.classList.add('gs-genie-open');
    var body = sheet.querySelector('.gs-genie-sheet-body');
    body.scrollTop = body.scrollHeight;
    // A phone keyboard popping up on open hides the conversation; desktop gets focus.
    if (window.matchMedia('(min-width: 721px)').matches) sheetChat.ready.then(sheetChat.focus);
    else sheet.querySelector('.gs-genie-sheet-close').focus();
  }

  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    document.documentElement.classList.remove('gs-genie-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  GS.genieChat = { mount: mount, openSheet: openSheet, closeSheet: closeSheet };
})();
