// In-memory stand-in for supabase-js v2 (only what the Core 0.1 pages use).
(function () {
  var KEY = 'fake-sb-db';
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch (e) {}
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
      shopping_lists: [], shopping_items: [], seq: 0
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
  Query.prototype.is = function (c, v) { this.filters.push(function (r) { return (r[c] === undefined ? null : r[c]) === v; }); return this; };
  Query.prototype.not = function (c, op, v) { var vals = v.replace(/[()]/g, '').split(','); this.filters.push(function (r) { return vals.indexOf(r[c]) === -1; }); return this; };
  Query.prototype.order = function (c, o) { this.orders.push([c, !o || o.ascending !== false]); return this; };
  Query.prototype.limit = function (n) { this.lim = n; return this; };
  Query.prototype.maybeSingle = function () { this._one = 'maybe'; return this; };
  Query.prototype.single = function () { this._one = 'one'; return this; };
  Query.prototype.insert = function (p) { this.op = 'insert'; this.payload = p; return this; };
  Query.prototype.update = function (p) { this.op = 'update'; this.payload = p; return this; };
  Query.prototype.delete = function () { this.op = 'delete'; return this; };
  Query.prototype.upsert = function (p) { this.op = 'upsert'; this.payload = p; return this; };
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
        if (this.op === 'upsert') { var ex = rows.find(function (r) { return r.user_id === row.user_id; }); if (ex) { Object.assign(ex, row); out.push(ex); continue; } }
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
        from: function (t) { return new Query(t, load()); }
      };
    }
  };
})();
