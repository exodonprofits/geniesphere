/**
 * Home Genie: recurring upkeep for the household's places and vehicles
 * (module service).
 *
 *   GenieSphere.home.catalogFor(asset)               upkeep to offer for a place or vehicle
 *   GenieSphere.home.FREQUENCIES / LAST_DONE / USES
 *   GenieSphere.home.expiryOptions()                 [[date|null, label]] for renewals
 *   await GenieSphere.home.listAssets(householdId)   -> [asset] places first, then vehicles
 *   await GenieSphere.home.addAsset(householdId, { kind, name, description?, usage, ownerLabel? })
 *   await GenieSphere.home.removeAsset(assetId)      // stops tracking it and its upkeep
 *   await GenieSphere.home.list(householdId)         -> [item] sorted by next_due
 *   await GenieSphere.home.add(householdId, assetId, [{ key?, title, everyDays, renewal?, leadDays?,
 *                                                      lastDone? | daysAgo? | nextDue? }])
 *   await GenieSphere.home.update(itemId, { everyDays, nextDue })
 *   await GenieSphere.home.markDone(item)            // done today (renewal: next period), rescheduled
 *   await GenieSphere.home.remove(itemId)
 *   GenieSphere.home.status(item, now)               -> { tone, label, days }
 *
 * Asset: { id, kind 'place'|'vehicle', name, description, usage 'personal'|'business', owner_label }
 * Item:  { id, asset_id, template_key, title, every_days, next_due, last_done, is_renewal, lead_days }
 *
 * Tasks are not created here: the database (0009, 0011) adds a household task
 * `lead_days` before each item is due (a week; a renewal about a month), titled
 * "Oil change · F-150", and completing that task, here or on the Tasks page,
 * reschedules the item. Core tasks stay the one task list (CLAUDE.md).
 * Requires gs-client.js. Tables: household_assets, home_maintenance_items (RLS: members).
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  function db() { return window.GenieSphere.getSupabase(); }
  function check(res) { if (res.error) throw res.error; return res.data; }
  var COLS = 'id, asset_id, template_key, title, every_days, next_due, last_done, is_renewal, lead_days, active, created_at';
  var ASSET_COLS = 'id, kind, name, description, usage, owner_label, created_at';

  var PLACE_CATALOG = [
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
  var VEHICLE_CATALOG = [
    { key: 'oil_change', title: 'Oil change', every: 180, hint: 'Or at the mileage on the sticker, whichever comes first', common: true },
    { key: 'tire_rotation', title: 'Rotate tires', every: 180, hint: 'Often done with the oil change', common: true },
    { key: 'engine_air_filter', title: 'Replace engine air filter', every: 365, hint: 'Ask at the oil change', common: true },
    { key: 'cabin_filter', title: 'Replace cabin air filter', every: 365, hint: 'Musty smell from the vents means it’s overdue' },
    { key: 'wipers', title: 'Replace wiper blades', every: 365, hint: 'Before winter' },
    { key: 'brake_check', title: 'Brake inspection', every: 365, hint: 'Most shops check them free with a tire rotation', common: true },
    { key: 'battery_test', title: 'Test the battery', every: 365, hint: 'Cold mornings finish off weak batteries' },
    { key: 'registration', title: 'Registration / plate sticker', every: 365, hint: 'Expiry month is on the sticker', common: true, renewal: true, lead: 45 },
    { key: 'insurance', title: 'Insurance renewal', every: 182, hint: 'Every 6 months for most auto policies', common: true, renewal: true, lead: 30 },
    { key: 'emissions', title: 'Emissions test', every: 730, hint: 'Illinois: every 2 years for most cars 4+ years old; due before the sticker', renewal: true, lead: 45 }
  ];
  var FREQUENCIES = [[30, 'Every month'], [90, 'Every 3 months'], [182, 'Every 6 months'], [180, 'Every 6 months'], [365, 'Every year'], [730, 'Every 2 years']];
  // Rental properties are managed in Rental Genie, not here (ADR-021).
  var USES = [['personal', 'Personal'], ['business', 'Business']];

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(dateStr, days) {
    var p = dateStr.split('-');
    return iso(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + days));
  }
  function today() { return iso(new Date()); }
  function parse(d) { var p = d.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }

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
    FREQUENCIES: FREQUENCIES.filter(function (f) { return f[0] !== 182; }),
    LAST_DONE: LAST_DONE,
    USES: USES,
    usageLabel: function (asset) {
      var u = USES.find(function (x) { return x[0] === asset.usage; });
      return (u ? u[1] : 'Personal') + (asset.owner_label ? ' · ' + asset.owner_label : '');
    },
    catalogFor: function (asset) {
      if (asset.kind === 'vehicle') return VEHICLE_CATALOG;
      return PLACE_CATALOG;
    },
    findTemplate: function (key) {
      return PLACE_CATALOG.concat(VEHICLE_CATALOG).find(function (c) { return c.key === key; }) || null;
    },
    // Renewals: the end of one of the next 12 months (stickers and policies run to month end).
    expiryOptions: function () {
      var now = new Date(), out = [[null, 'Expires: not sure']];
      for (var i = 0; i < 12; i++) {
        var end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
        out.push([iso(end), 'Expires ' + end.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })]);
      }
      return out;
    },
    frequencyLabel: function (days) {
      var f = FREQUENCIES.find(function (x) { return x[0] === days; });
      return f ? f[1] : 'Every ' + days + ' days';
    },

    async listAssets(householdId) {
      var rows = check(await db().from('household_assets').select(ASSET_COLS)
        .eq('household_id', householdId).eq('active', true).order('created_at', { ascending: true }));
      return rows.sort(function (a, b) { return (a.kind === b.kind ? 0 : a.kind === 'place' ? -1 : 1); });
    },
    async addAsset(householdId, a) {
      var row = {
        household_id: householdId, kind: a.kind === 'vehicle' ? 'vehicle' : 'place',
        name: String(a.name || '').trim().slice(0, 60), description: (a.description || '').trim().slice(0, 80) || null,
        usage: a.usage === 'business' ? 'business' : 'personal',
        owner_label: a.usage !== 'personal' ? ((a.ownerLabel || '').trim().slice(0, 80) || null) : null
      };
      if (!row.name) throw new Error('Give it a name, e.g. “Lake house” or “F-150”.');
      var out = check(await db().from('household_assets').insert(row).select(ASSET_COLS));
      return out[0];
    },
    // The database stops tracking its upkeep too (0011 trigger).
    async removeAsset(assetId) {
      check(await db().from('household_assets').update({ active: false, updated_at: new Date().toISOString() }).eq('id', assetId));
    },

    async list(householdId) {
      return check(await db().from('home_maintenance_items').select(COLS)
        .eq('household_id', householdId).eq('active', true).order('next_due', { ascending: true }));
    },
    // New items: next due = an expiry date (renewals), or last done + frequency
    // (an exact lastDone, or an approximate daysAgo, not stored as a date);
    // with none of these, the first ones are spread out (1, 2, 3... weeks).
    async add(householdId, assetId, items) {
      var t = today();
      var spread = 0;
      var rows = items.map(function (it) {
        var every = Number(it.everyDays) || 365;
        var next = it.nextDue ? it.nextDue
          : it.lastDone ? addDays(it.lastDone, every)
          : it.daysAgo != null ? addDays(t, every - Number(it.daysAgo))
          : addDays(t, 7 * (++spread));
        if (next < t) next = t;
        return { household_id: householdId, asset_id: assetId, template_key: it.key || null, title: String(it.title).trim().slice(0, 120),
          every_days: every, last_done: it.lastDone || null, next_due: next,
          is_renewal: !!it.renewal, lead_days: it.renewal ? Math.min(Math.max(Number(it.leadDays) || 30, 7), 60) : 7 };
      });
      return check(await db().from('home_maintenance_items').insert(rows).select(COLS));
    },
    async update(itemId, changes) {
      var row = { updated_at: new Date().toISOString() };
      if (changes.everyDays) row.every_days = Number(changes.everyDays);
      if (changes.nextDue) row.next_due = changes.nextDue;
      check(await db().from('home_maintenance_items').update(row).eq('id', itemId));
    },
    // Done today. A renewal moves on by one period from its expiry date, not
    // from today (renewing a sticker early doesn't change its month).
    nextAfterDone: function (item) {
      var t = today();
      if (!item.is_renewal) return addDays(t, item.every_days);
      var next = addDays(item.next_due, item.every_days);
      while (next <= t) next = addDays(next, item.every_days);
      return next;
    },
    async markDone(item) {
      check(await db().from('home_maintenance_items').update({
        last_done: today(), next_due: this.nextAfterDone(item), updated_at: new Date().toISOString()
      }).eq('id', item.id));
    },
    async remove(itemId) {
      check(await db().from('home_maintenance_items').update({ active: false, updated_at: new Date().toISOString() }).eq('id', itemId));
    },
    status: function (item, now) {
      var due = parse(item.next_due);
      var days = Math.round((due - parse(iso(now || new Date()))) / 864e5);
      var when = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      var lead = item.lead_days || 7;
      if (item.is_renewal) {
        if (days < 0) return { tone: 'urgent', label: 'Expired · ' + when, days: days };
        if (days <= lead) return { tone: 'warn', label: days === 0 ? 'Expires today' : 'Expires in ' + days + (days === 1 ? ' day' : ' days'), days: days };
        return { tone: 'ok', label: 'Expires ' + when, days: days };
      }
      if (days < 0) return { tone: 'urgent', label: 'Overdue · ' + when, days: days };
      if (days === 0) return { tone: 'warn', label: 'Due today', days: days };
      if (days <= 7) return { tone: 'warn', label: 'Due in ' + days + (days === 1 ? ' day' : ' days'), days: days };
      return { tone: 'ok', label: 'Next ' + when, days: days };
    },
    addDays: addDays,
    today: today
  };
})();
