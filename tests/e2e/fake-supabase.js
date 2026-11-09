// In-memory stand-in for supabase-js v2 (only what the Core 0.1 pages use).
(function () {
  var KEY = 'fake-sb-db';
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s) { ['household_meal_plans', 'household_nutrition_prefs', 'gs_ai_usage', 'household_invites', 'home_maintenance_items', 'household_notifications', 'notification_prefs'].forEach(function (t) { s[t] = s[t] || []; }); return s; }
    } catch (e) {}
    return {
      session: null,
      users: [{ id: 'u1', email: 'jimmy@example.com', password: 'pw' }],
      households: [{ id: 'h1', owner_id: 'u1', name: 'Nguyen Home' }, { id: 'h2', owner_id: 'u1', name: 'Lake House' }],
      household_members: [{ household_id: 'h1', user_id: 'u1', role: 'owner', email: 'jimmy@example.com', display_name: 'Jimmy', created_at: '2026-10-01T00:00:00Z' },
        { household_id: 'h2', user_id: 'u1', role: 'owner', email: 'jimmy@example.com', display_name: 'Jimmy', created_at: '2026-10-01T00:00:00Z' }],
      user_household_context: [],
      household_tasks: [
        { id: 't1', household_id: 'h1', title: 'Change HVAC filter', status: 'todo', completed_at: null, due_at: '2026-10-20T00:00:00Z' },
        { id: 't2', household_id: 'h1', title: 'Old done task', status: 'done', completed_at: '2026-10-01T00:00:00Z', due_at: null }
      ],
      shopping_lists: [], shopping_items: [],
      household_meal_plans: [], household_nutrition_prefs: [], gs_ai_usage: [], household_invites: [], home_maintenance_items: [], household_notifications: [], notification_prefs: [], seq: 0
    };
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

  // Mirrors 0009's database triggers: a home item due within 7 days gets one
  // open household task; finishing that task reschedules the item.
  function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function plusDays(day, n) { var p = day.split('-'); return isoDay(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function homeSync(db) {
    var today = isoDay(new Date());
    db.home_maintenance_items.forEach(function (it) {
      var ref = 'home:' + it.id;
      var open = db.household_tasks.find(function (t) { return t.source_ref === ref && !t.completed_at; });
      if (it.active !== false && it.next_due <= plusDays(today, 7) && !open) {
        db.household_tasks.push({ id: 'task-' + (++db.seq), household_id: it.household_id, title: it.title, notes: null,
          due_at: it.next_due + 'T12:00:00Z', assigned_to: null, source_module: 'home', source_ref: ref, status: 'todo',
          completed_at: null, created_at: new Date().toISOString() });
      } else if (open && it.active === false) {
        db.household_tasks = db.household_tasks.filter(function (t) { return t !== open; });
      } else if (open && it.next_due > plusDays(today, 7)) {
        open.status = 'done'; open.completed_at = new Date().toISOString();
      }
    });
  }
  function homeTaskDone(db, task) {
    if (!task.source_ref || task.source_ref.indexOf('home:') !== 0 || !task.completed_at) return;
    var it = db.home_maintenance_items.find(function (i) { return 'home:' + i.id === task.source_ref; });
    if (!it) return;
    var day = isoDay(new Date(task.completed_at));
    it.last_done = day; it.next_due = plusDays(day, it.every_days);
  }
  // Mirrors 0010's notify_task_assigned trigger.
  function notifyAssigned(db, task, before, uid) {
    if (!task.assigned_to || task.completed_at || task.assigned_to === uid || before === task.assigned_to) return;
    var who = db.household_members.find(function (m) { return m.household_id === task.household_id && m.user_id === uid; });
    var ref = 'assign:' + task.id;
    var title = ((who && who.display_name) || 'Someone') + ' assigned you: ' + task.title;
    var body = task.due_at ? 'Due ' + new Date(task.due_at.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
    var ex = db.household_notifications.find(function (n) { return n.user_id === task.assigned_to && n.ref === ref; });
    if (ex) { ex.title = title; ex.body = body; ex.read_at = null; ex.created_at = new Date().toISOString(); return; }
    db.household_notifications.push({ id: 'note-' + (++db.seq), household_id: task.household_id, user_id: task.assigned_to, source_module: task.source_module || 'tasks',
      kind: 'task_assigned', title: title, body: body, link: '/core/tasks/index.html', ref: ref, read_at: null, created_at: new Date().toISOString() });
  }
  window.__fakeDb = { load: load, save: save };

  function Query(table, db) {
    this.t = table; this.db = db; this.filters = []; this.orders = []; this.lim = null;
    this.op = 'select'; this.payload = null; this.cols = '*'; this._one = null; this.ret = false;
  }
  Query.prototype.select = function (cols, opts) { if (this.op === 'select') { this.cols = cols || '*'; this.head = !!(opts && opts.head); } else this.ret = true; return this; };
  Query.prototype.eq = function (c, v) { this.filters.push(function (r) { return r[c] === v; }); return this; };
  Query.prototype.gte = function (c, v) { this.filters.push(function (r) { return r[c] >= v; }); return this; };
  Query.prototype.is = function (c, v) { this.filters.push(function (r) { return (r[c] === undefined ? null : r[c]) === v; }); return this; };
  Query.prototype.not = function (c, op, v) { var vals = v.replace(/[()]/g, '').split(','); this.filters.push(function (r) { return vals.indexOf(r[c]) === -1; }); return this; };
  Query.prototype.order = function (c, o) { this.orders.push([c, !o || o.ascending !== false]); return this; };
  Query.prototype.limit = function (n) { this.lim = n; return this; };
  Query.prototype.maybeSingle = function () { this._one = 'maybe'; return this; };
  Query.prototype.single = function () { this._one = 'one'; return this; };
  Query.prototype.insert = function (p) { this.op = 'insert'; this.payload = p; return this; };
  Query.prototype.update = function (p) { this.op = 'update'; this.payload = p; return this; };
  Query.prototype.delete = function () { this.op = 'delete'; return this; };
  Query.prototype.upsert = function (p, o) { this.op = 'upsert'; this.payload = p; this.conflict = (o && o.onConflict ? o.onConflict : 'user_id').split(','); return this; };
  Query.prototype.then = function (res, rej) { return Promise.resolve().then(this.run.bind(this)).then(res, rej); };
  Query.prototype.run = function () {
    var db = this.db, rows = db[this.t], self = this, uid = db.session && db.session.user.id;
    if (!rows) return { data: null, error: { message: 'relation ' + this.t + ' does not exist' } };
    if (!uid) return { data: null, error: { message: 'not signed in' } };
    // Approximate RLS: household-scoped tables visible only to members.
    var mine = db.household_members.filter(function (m) { return m.user_id === uid; }).map(function (m) { return m.household_id; });
    var owned = db.household_members.filter(function (m) { return m.user_id === uid && m.role === 'owner'; }).map(function (m) { return m.household_id; });
    function visible(r) {
      if (self.t === 'household_invites') return owned.indexOf(r.household_id) !== -1;
      if (self.t === 'household_notifications' || self.t === 'notification_prefs') return r.user_id === uid && mine.indexOf(r.household_id) !== -1;
      return r.household_id === undefined || mine.indexOf(r.household_id) !== -1 || r.user_id === uid;
    }
    function match(r) { return visible(r) && self.filters.every(function (f) { return f(r); }); }
    if (this.op === 'insert' || this.op === 'upsert') {
      var list = Array.isArray(this.payload) ? this.payload : [this.payload], out = [];
      for (var i = 0; i < list.length; i++) {
        var row = Object.assign({}, list[i]);
        if (row.household_id !== undefined && mine.indexOf(row.household_id) === -1) return { data: null, error: { message: 'new row violates row-level security policy' } };
        if (this.t === 'shopping_items' && !db.shopping_lists.some(function (l) { return l.id === row.shopping_list_id && l.household_id === row.household_id; }))
          return { data: null, error: { message: 'violates foreign key constraint' } };
        if (this.op === 'upsert') { var keys = this.conflict; var ex = rows.find(function (r) { return keys.every(function (k) { return r[k] === row[k]; }); }); if (ex) { Object.assign(ex, row); out.push(ex); continue; } }
        if (!row.id && this.t !== 'user_household_context') row.id = this.t + '-' + (++db.seq);
        if (this.t === 'shopping_items') { if (row.checked === undefined) row.checked = false; }
        if (this.t === 'home_maintenance_items' && row.active === undefined) row.active = true;
        row.created_at = new Date(Date.now() + db.seq).toISOString();
        rows.push(row); out.push(row);
        if (this.t === 'household_tasks') notifyAssigned(db, row, null, uid);
      }
      if (this.t === 'home_maintenance_items') homeSync(db);
      save(db);
      return { data: this._one ? out[0] : (this.ret ? out : null), error: null };
    }
    if (this.op === 'update') {
      rows.filter(match).forEach(function (r) {
        var before = r.assigned_to;
        Object.assign(r, self.payload);
        if (self.t === 'household_tasks') { homeTaskDone(db, r); notifyAssigned(db, r, before, uid); }
      });
      if (this.t === 'home_maintenance_items' || this.t === 'household_tasks') homeSync(db);
      save(db); return { data: null, error: null };
    }
    if (this.op === 'delete') { db[this.t] = rows.filter(function (r) { return !match(r); }); save(db); return { data: null, error: null }; }
    var data = rows.filter(match).map(function (r) { return Object.assign({}, r); });
    if (this.t === 'household_members' && /households/.test(this.cols))
      data.forEach(function (r) { r.households = db.households.find(function (h) { return h.id === r.household_id; }) || null; });
    this.orders.slice().reverse().forEach(function (o) {
      data.sort(function (a, b) { var x = a[o[0]], y = b[o[0]]; if (x === y) return 0; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1; return (x < y ? -1 : 1) * (o[1] ? 1 : -1); });
    });
    if (this.head) return { data: null, count: data.length, error: null };
    if (this.lim !== null) data = data.slice(0, this.lim);
    if (this._one === 'maybe') return { data: data[0] || null, error: null };
    if (this._one === 'one') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'expected one row' } };
    return { data: data, error: null };
  };

  // Mirrors supabase/functions/gs-household-invite (tokens kept in clear here).
  function fakeInvite(db, body) {
    var uid = db.session && db.session.user.id;
    function fail(message) { return { data: null, error: { message: message, context: { json: async function () { return { error: message }; } } } }; }
    function ok(data) { save(db); return { data: Object.assign({ ok: true }, data), error: null }; }
    function find(token) { return db.household_invites.find(function (i) { return i._token === token; }); }
    function statusOf(inv) {
      if (!inv) return null;
      if (inv.revoked_at) return 'revoked';
      if (inv.accepted_at) return 'accepted';
      return new Date(inv.expires_at) < new Date() ? 'expired' : 'open';
    }
    if (body.action === 'create') {
      if (!uid) return fail('Sign in to use this.');
      if (!db.household_members.some(function (m) { return m.household_id === body.household_id && m.user_id === uid && m.role === 'owner'; }))
        return fail('Only the household owner can invite people.');
      if (db.household_members.some(function (m) { return m.household_id === body.household_id && m.email === body.email; }))
        return fail(body.email + ' is already a member of this household.');
      db.household_invites.forEach(function (i) { if (i.household_id === body.household_id && i.email === body.email && !i.accepted_at && !i.revoked_at) i.revoked_at = new Date().toISOString(); });
      var token = 'tok' + (++db.seq) + 'x' + Math.random().toString(36).slice(2);
      var inv = { id: 'inv' + db.seq, household_id: body.household_id, email: body.email, display_name: body.display_name || null,
        created_by: uid, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        accepted_at: null, revoked_at: null, _token: token };
      db.household_invites.push(inv);
      return ok({ token: token, invite_id: inv.id, expires_at: inv.expires_at, emailed: !db.emailOff });
    }
    if (body.action === 'revoke') {
      var r = db.household_invites.find(function (i) { return i.id === body.invite_id; });
      if (!r || !db.household_members.some(function (m) { return m.household_id === r.household_id && m.user_id === uid && m.role === 'owner'; }))
        return fail('Invitation not found.');
      r.revoked_at = new Date().toISOString();
      return ok({});
    }
    var invite = find(body.token);
    if (!invite) return fail('This invitation link is not valid.');
    var household = db.households.find(function (h) { return h.id === invite.household_id; });
    var inviter = db.household_members.find(function (m) { return m.user_id === invite.created_by; });
    var account = db.users.find(function (u) { return u.email === invite.email; });
    if (body.action === 'preview') {
      return ok({ household_name: household.name, inviter_name: (inviter && inviter.display_name) || 'The household owner',
        email: invite.email, display_name: invite.display_name, status: statusOf(invite), has_account: !!account });
    }
    if (body.action === 'accept') {
      if (statusOf(invite) !== 'open') return fail('This invitation can no longer be used.');
      var userId;
      if (account) {
        if (!uid || uid !== account.id) return fail('Sign in as ' + invite.email + ' to join.');
        userId = account.id;
      } else {
        if (!body.password || body.password.length < 10) return fail('Use a password of at least 10 characters.');
        userId = 'u' + (++db.seq);
        db.users.push({ id: userId, email: invite.email, password: body.password });
      }
      db.household_members.push({ household_id: invite.household_id, user_id: userId, role: 'member', email: invite.email,
        display_name: body.display_name || invite.display_name || null, created_at: new Date().toISOString() });
      invite.accepted_at = new Date().toISOString();
      return ok({ household_id: invite.household_id });
    }
    return fail('Unknown action.');
  }

  window.supabase = {
    createClient: function (url, key) {
      window.__createClientCalls = (window.__createClientCalls || 0) + 1;
      window.__createClientArgs = [url, key];
      return {
        auth: {
          getSession: async function () { var db = load(); return { data: { session: db.session }, error: null }; },
          signInWithPassword: async function (c) {
            var db = load(); var u = db.users.find(function (x) { return x.email === c.email && x.password === c.password; });
            if (!u) return { data: null, error: { message: 'Invalid login credentials' } };
            db.session = { user: { id: u.id, email: u.email } }; save(db); return { data: { session: db.session }, error: null };
          },
          signOut: async function () { var db = load(); db.session = null; save(db); return { error: null }; },
          updateUser: async function (attrs) {
            var db = load(); if (!db.session) return { data: null, error: { message: 'Auth session missing!' } };
            var u = db.users.find(function (x) { return x.id === db.session.user.id; });
            if (attrs.password) u.password = attrs.password; save(db); return { data: { user: db.session.user }, error: null };
          }
        },
        from: function (t) { return new Query(t, load()); },
        functions: {
          invoke: async function (name, opts) {
            var db = load(), body = (opts && opts.body) || {};
            if (name === 'gs-household-invite') return fakeInvite(db, body);
            if (name === 'gs-password-reset') { db.resetRequests = (db.resetRequests || []).concat([body.email]); save(db); return { data: { ok: true }, error: null }; }
            if (!db.session) return { data: null, error: { message: 'Sign in to use this.' } };
            if (name === 'gs-notify') {
              var me = db.session.user;
              if (body.action !== 'test_digest' || !db.household_members.some(function (m) { return m.household_id === body.householdId && m.user_id === me.id; }))
                return { data: null, error: { message: 'Unknown request.' } };
              var horizon = plusDays(isoDay(new Date()), 7);
              var n = db.household_tasks.filter(function (t) { return t.household_id === body.householdId && !t.completed_at && t.due_at && t.due_at.slice(0, 10) <= horizon && (!t.assigned_to || t.assigned_to === me.id); }).length;
              db.testDigests = (db.testDigests || 0) + 1; save(db);
              return { data: { ok: true, email: me.email, tasks: n }, error: null };
            }
            if (name !== 'gs-ai-gateway' || body.task !== 'meal_plan.generate') return { data: null, error: { message: 'Unknown task.' } };
            var uid = db.session.user.id;
            if (!db.household_members.some(function (m) { return m.household_id === body.household_id && m.user_id === uid; }))
              return { data: null, error: { message: 'You are not a member of this household.' } };
            var today = new Date().toISOString().slice(0, 10);
            var used = db.gs_ai_usage.filter(function (u) { return u.household_id === body.household_id && u.created_at.slice(0, 10) === today; }).length;
            if (used >= 10) return { data: null, error: { message: "Your household has used today's 10 meal plans." } };
            db.gs_ai_usage.push({ id: 'u' + (++db.seq), household_id: body.household_id, user_id: uid, task: body.task, created_at: new Date().toISOString() });
            save(db);
            var names = ['Lemongrass chicken rice bowl', 'Pho ga', 'Salmon with greens', 'Tofu stir-fry', 'Shrimp spring rolls', 'Beef and broccoli', 'Vegetable curry'];
            var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(function (label, i) {
              return { day: i + 1, label: label, meals: ['breakfast', 'lunch', 'dinner'].map(function (t, j) {
                return { mealType: t, title: (j === 2 ? names[i] : (t === 'breakfast' ? 'Greek yogurt & berries' : 'Chicken salad wrap')),
                  prepTimeMinutes: 10, cookTimeMinutes: 15 + j * 5,
                  ingredients: [{ name: 'Chicken breast', amount: '300 g' }, { name: 'Jasmine rice', amount: '1 cup' }],
                  steps: ['Prep the ingredients.', 'Cook and serve.'],
                  nutrition: { calories: 450 + j * 50, protein_g: 30, carbs_g: 40, fat_g: 15 } };
              }) };
            });
            var grocery = [
              { item: 'Chicken breast', quantity: '2 lb', category: 'Protein' }, { item: 'Jasmine rice', quantity: '5 lb', category: 'Pantry' },
              { item: 'Milk', quantity: '1 gal', category: 'Dairy' }, { item: 'Bok choy', quantity: '4 heads', category: 'Produce' },
              { item: 'Lemongrass', quantity: '3 stalks', category: 'Produce' }
            ];
            // Mirror the gateway's allergen flagging for the one allergen the sample can contain.
            if ((body.input.allergies || []).indexOf('shellfish') !== -1) {
              days.forEach(function (d) { d.meals.forEach(function (m) { if (/shrimp/i.test(m.title)) m.allergenWarning = ['shrimp']; }); });
            }
            return { data: { ok: true, task: body.task, model: 'fake', prefs: body.input, result: { days: days, grocery: grocery,
              macro: { calories: 1650, protein: 110, carbs: 160, fat: 55 } }, usage: { today: used + 1, limit: 10 } }, error: null };
          }
        }
      };
    }
  };
})();
