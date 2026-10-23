// In-memory stand-in for supabase-js v2 (only what the Core 0.1 pages use).
(function () {
  var KEY = 'fake-sb-db';
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s) { ['household_meal_plans', 'household_nutrition_prefs', 'gs_ai_usage'].forEach(function (t) { s[t] = s[t] || []; }); return s; }
    } catch (e) {}
    return {
      session: null,
      users: [{ id: 'u1', email: 'jimmy@example.com', password: 'pw' }],
      households: [{ id: 'h1', owner_id: 'u1', name: 'Nguyen Home' }, { id: 'h2', owner_id: 'u1', name: 'Lake House' }],
      household_members: [{ household_id: 'h1', user_id: 'u1', role: 'owner' }, { household_id: 'h2', user_id: 'u1', role: 'owner' }],
      user_household_context: [],
      household_tasks: [
        { id: 't1', household_id: 'h1', title: 'Change HVAC filter', status: 'todo', completed_at: null, due_at: '2026-10-20T00:00:00Z' },
        { id: 't2', household_id: 'h1', title: 'Old done task', status: 'done', completed_at: '2026-10-01T00:00:00Z', due_at: null }
      ],
      shopping_lists: [], shopping_items: [],
      household_meal_plans: [], household_nutrition_prefs: [], gs_ai_usage: [], seq: 0
    };
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  window.__fakeDb = { load: load, save: save };

  function Query(table, db) {
    this.t = table; this.db = db; this.filters = []; this.orders = []; this.lim = null;
    this.op = 'select'; this.payload = null; this.cols = '*'; this._one = null; this.ret = false;
  }
  Query.prototype.select = function (cols) { if (this.op === 'select') this.cols = cols || '*'; else this.ret = true; return this; };
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
    function visible(r) { return r.household_id === undefined || mine.indexOf(r.household_id) !== -1 || r.user_id === uid; }
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
        row.created_at = new Date(Date.now() + db.seq).toISOString();
        rows.push(row); out.push(row);
      }
      save(db);
      return { data: this._one ? out[0] : (this.ret ? out : null), error: null };
    }
    if (this.op === 'update') { rows.filter(match).forEach(function (r) { Object.assign(r, self.payload); }); save(db); return { data: null, error: null }; }
    if (this.op === 'delete') { db[this.t] = rows.filter(function (r) { return !match(r); }); save(db); return { data: null, error: null }; }
    var data = rows.filter(match).map(function (r) { return Object.assign({}, r); });
    if (this.t === 'household_members' && /households/.test(this.cols))
      data.forEach(function (r) { r.households = db.households.find(function (h) { return h.id === r.household_id; }) || null; });
    this.orders.slice().reverse().forEach(function (o) {
      data.sort(function (a, b) { var x = a[o[0]], y = b[o[0]]; if (x === y) return 0; if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1; return (x < y ? -1 : 1) * (o[1] ? 1 : -1); });
    });
    if (this.lim !== null) data = data.slice(0, this.lim);
    if (this._one === 'maybe') return { data: data[0] || null, error: null };
    if (this._one === 'one') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'expected one row' } };
    return { data: data, error: null };
  };

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
          signOut: async function () { var db = load(); db.session = null; save(db); return { error: null }; }
        },
        from: function (t) { return new Query(t, load()); },
        functions: {
          invoke: async function (name, opts) {
            var db = load(), body = (opts && opts.body) || {};
            if (!db.session) return { data: null, error: { message: 'Sign in to use this.' } };
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
