/**
 * Household tasks (Core service). One task list per household; modules add
 * tasks with a source_module (e.g. Home Genie maintenance, created by the
 * database), people add their own on the Tasks page.
 *
 *   await GenieSphere.tasks.listOpen(householdId)        -> [task]
 *   await GenieSphere.tasks.listDone(householdId, days)  -> [task] completed in the last `days`
 *   await GenieSphere.tasks.add(householdId, { title, dueDate?, assignedTo? })
 *   await GenieSphere.tasks.complete(taskId)
 *   await GenieSphere.tasks.reopen(taskId)
 *   await GenieSphere.tasks.assign(taskId, userId|null)
 *   await GenieSphere.tasks.remove(taskId)                // own (manual) tasks only
 *   GenieSphere.tasks.bucket(task, now)                   -> 'overdue'|'week'|'later'|'nodate'
 *
 * Task: { id, title, notes, due_at, assigned_to, source_module, source_ref,
 *         status, completed_at, created_at }
 * Requires gs-client.js. Table: household_tasks (RLS: household members).
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  var COLS = 'id, title, notes, due_at, assigned_to, source_module, source_ref, status, completed_at, created_at, created_by';
  function db() { return window.GenieSphere.getSupabase(); }
  function check(res) { if (res.error) throw res.error; return res.data; }

  // A date-only due date is stored at noon UTC, so it shows on the same day
  // in every US time zone.
  function dueAt(dateStr) { return dateStr ? dateStr + 'T12:00:00Z' : null; }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  window.GenieSphere.tasks = {
    async listOpen(householdId) {
      return check(await db().from('household_tasks').select(COLS)
        .eq('household_id', householdId).is('completed_at', null)
        .order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }));
    },
    async listDone(householdId, days) {
      var since = new Date(Date.now() - (days || 14) * 864e5).toISOString();
      return check(await db().from('household_tasks').select(COLS)
        .eq('household_id', householdId).gte('completed_at', since)
        .order('completed_at', { ascending: false }).limit(30));
    },
    async add(householdId, t) {
      var title = String(t.title || '').trim().slice(0, 200);
      if (!title) throw new Error('Give the task a name.');
      return check(await db().from('household_tasks').insert({
        household_id: householdId, title: title, due_at: dueAt(t.dueDate || null),
        assigned_to: t.assignedTo || null, status: 'todo'
      }).select(COLS).single());
    },
    async complete(taskId) {
      check(await db().from('household_tasks').update({ status: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', taskId));
    },
    async reopen(taskId) {
      check(await db().from('household_tasks').update({ status: 'todo', completed_at: null, updated_at: new Date().toISOString() }).eq('id', taskId));
    },
    async assign(taskId, userId) {
      check(await db().from('household_tasks').update({ assigned_to: userId || null, updated_at: new Date().toISOString() }).eq('id', taskId));
    },
    async remove(taskId) {
      check(await db().from('household_tasks').delete().eq('id', taskId));
    },
    bucket: function (task, now) {
      if (!task.due_at) return 'nodate';
      var today = startOfDay(now || new Date());
      var due = startOfDay(new Date(task.due_at));
      var days = Math.round((due - today) / 864e5);
      if (days < 0) return 'overdue';
      if (days <= 7) return 'week';
      return 'later';
    }
  };
})();
