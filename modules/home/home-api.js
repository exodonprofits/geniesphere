/**
 * Home Genie: recurring home maintenance (module service).
 *
 *   GenieSphere.home.CATALOG                       common upkeep, with default frequency
 *   GenieSphere.home.FREQUENCIES                   [[days, label]]
 *   await GenieSphere.home.list(householdId)       -> [item] sorted by next_due
 *   await GenieSphere.home.add(householdId, [{ key?, title, everyDays, lastDone? | daysAgo? }])
 *   await GenieSphere.home.update(itemId, { everyDays })
 *   await GenieSphere.home.markDone(item)          // done today, next one rescheduled
 *   await GenieSphere.home.remove(itemId)
 *   GenieSphere.home.status(item, now)             -> { tone, label }
 *
 * Tasks are not created here: the database (0009) adds a household task a
 * week before each item is due (source_module 'home'), and completing that
 * task, here or on the Tasks page, reschedules the item. Core tasks stay the
 * one task list (CLAUDE.md: modules use Core services).
 * Requires gs-client.js. Table: home_maintenance_items (RLS: household members).
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  function db() { return window.GenieSphere.getSupabase(); }
  function check(res) { if (res.error) throw res.error; return res.data; }
  var COLS = 'id, template_key, title, every_days, next_due, last_done, active, created_at';

  var CATALOG = [
    { key: 'hvac_filter', title: 'Replace HVAC air filter', every: 90, hint: 'Better air, lower energy bills', common: true },
    { key: 'smoke_test', title: 'Test smoke and CO alarms', every: 30, hint: 'Press the test button on each one', common: true },
    { key: 'smoke_batteries', title: 'Replace smoke and CO alarm batteries', every: 365, hint: 'Many people do it when clocks change', common: true },
    { key: 'furnace_service', title: 'Furnace service', every: 365, hint: 'Book before the first cold snap', common: true },
    { key: 'ac_service', title: 'AC service', every: 365, hint: 'Book in spring, before the heat' },
    { key: 'gutters', title: 'Clean gutters', every: 180, hint: 'Spring and late fall', common: true },
    { key: 'water_heater', title: 'Flush water heater', every: 365, hint: 'Removes sediment, extends its life', common: true },
    { key: 'dryer_vent', title: 'Clean dryer vent', every: 365, hint: 'A leading cause of house fires', common: true },
    { key: 'fridge_filter', title: 'Replace fridge water filter', every: 180, hint: 'Check the model in the door' },
    { key: 'sump_pump', title: 'Test sump pump', every: 90, hint: 'Pour a bucket of water into the pit' },
    { key: 'dishwasher_filter', title: 'Clean dishwasher filter', every: 30, hint: 'Twist out, rinse, put back' },
    { key: 'outdoor_faucets', title: 'Winterize outdoor faucets', every: 365, hint: 'Before the first freeze' }
  ];
  var FREQUENCIES = [[30, 'Every month'], [90, 'Every 3 months'], [180, 'Every 6 months'], [365, 'Every year'], [730, 'Every 2 years']];

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(dateStr, days) {
    var p = dateStr.split('-');
    return iso(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + days));
  }
  function today() { return iso(new Date()); }

  // Setup asks roughly when each job was last done (days ago, mid-range).
  // null = not sure. "Over a year ago" makes anything up to yearly due now.
  var LAST_DONE = [
    [null, 'Last done: not sure'],
    [15, 'Within the last month'],
    [60, '1–3 months ago'],
    [135, '3–6 months ago'],
    [270, '6–12 months ago'],
    [400, 'Over a year ago']
  ];

  window.GenieSphere.home = {
    CATALOG: CATALOG,
    FREQUENCIES: FREQUENCIES,
    LAST_DONE: LAST_DONE,
    frequencyLabel: function (days) {
      var f = FREQUENCIES.find(function (x) { return x[0] === days; });
      return f ? f[1] : 'Every ' + days + ' days';
    },
    async list(householdId) {
      return check(await db().from('home_maintenance_items').select(COLS)
        .eq('household_id', householdId).eq('active', true).order('next_due', { ascending: true }));
    },
    // New items: next due = last done + frequency (an exact lastDone, or an
    // approximate daysAgo, which is not stored as a date); with neither, the
    // first ones are spread out (1, 2, 3... weeks) so they don't all land at once.
    async add(householdId, items) {
      var t = today();
      var spread = 0;
      var rows = items.map(function (it) {
        var every = Number(it.everyDays) || 365;
        var next = it.lastDone ? addDays(it.lastDone, every)
          : it.daysAgo != null ? addDays(t, every - Number(it.daysAgo))
          : addDays(t, 7 * (++spread));
        if (next < t) next = t;
        return { household_id: householdId, template_key: it.key || null, title: String(it.title).trim().slice(0, 120),
          every_days: every, last_done: it.lastDone || null, next_due: next };
      });
      return check(await db().from('home_maintenance_items').insert(rows).select(COLS));
    },
    async update(itemId, changes) {
      var row = { updated_at: new Date().toISOString() };
      if (changes.everyDays) row.every_days = Number(changes.everyDays);
      if (changes.nextDue) row.next_due = changes.nextDue;
      check(await db().from('home_maintenance_items').update(row).eq('id', itemId));
    },
    async markDone(item) {
      var t = today();
      check(await db().from('home_maintenance_items').update({
        last_done: t, next_due: addDays(t, item.every_days), updated_at: new Date().toISOString()
      }).eq('id', item.id));
    },
    async remove(itemId) {
      check(await db().from('home_maintenance_items').update({ active: false, updated_at: new Date().toISOString() }).eq('id', itemId));
    },
    status: function (item, now) {
      var t = iso(now || new Date());
      var p = item.next_due.split('-');
      var due = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      var p2 = t.split('-');
      var days = Math.round((due - new Date(Number(p2[0]), Number(p2[1]) - 1, Number(p2[2]))) / 864e5);
      var when = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (days < 0) return { tone: 'urgent', label: 'Overdue · ' + when, days: days };
      if (days === 0) return { tone: 'warn', label: 'Due today', days: days };
      if (days <= 7) return { tone: 'warn', label: 'Due in ' + days + (days === 1 ? ' day' : ' days'), days: days };
      return { tone: 'ok', label: 'Next ' + when, days: days };
    },
    addDays: addDays,
    today: today
  };
})();
