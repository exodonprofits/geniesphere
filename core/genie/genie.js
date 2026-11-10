/**
 * Genie, the household assistant (Core service, ADR-022). Phase 1: brain, not
 * hands. Genie reads the household's data, answers, and proposes actions; a
 * person approves each one, and the change is made here with that person's
 * own permissions (RLS), never by the AI.
 *
 *   GenieSphere.genie.briefing(openTasks, now)             -> { lines, counts }   // no AI
 *   await GenieSphere.genie.ask(householdId, messages)    -> { reply, proposals, usage }
 *   await GenieSphere.genie.apply(householdId, proposal, members) -> { text, undo }   // members from household.members()
 *   GenieSphere.genie.ACTIONS                              // what Genie may propose
 *
 * Proposal shapes (from the gateway, task "genie.chat"):
 *   { type: 'task.add', title, dueDate?, assignee? }        assignee = member display name
 *   { type: 'task.assign', taskId, title, assignee }
 *   { type: 'grocery.add', items: [{ name, quantity? }] }
 *   { type: 'draft', channel: 'text'|'email', to?, subject?, body }   // copied or opened, never sent
 *
 * Requires gs-client.js, core/ai/ai-gateway.js, core/tasks/tasks.js and
 * modules/grocery/grocery-api.js.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  var DAY = 864e5;

  var ACTIONS = [
    ['Answer', 'questions about your tasks, homes, vehicles, groceries and meal plans'],
    ['Suggest', 'tasks with a due date and who should do them'],
    ['Assign', 'open tasks to someone in the household'],
    ['Add', 'items to the grocery list'],
    ['Draft', 'a text or email to a vendor; you send it yourself']
  ];

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function dayOf(task) {
    if (!task.due_at) return null;
    var s = String(task.due_at).slice(0, 10).split('-');
    return new Date(+s[0], +s[1] - 1, +s[2]);
  }
  function localDay(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function short(d) { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }

  function memberName(m) { return String(m.name || m.email || 'Someone').split('@')[0]; }
  function findMember(members, name) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    return (members || []).find(function (m) {
      return memberName(m).toLowerCase() === n || String(m.email || '').toLowerCase() === n;
    }) || null;
  }

  window.GenieSphere.genie = {
    ACTIONS: ACTIONS,
    memberName: memberName,

    // What needs attention this week, from data already on the page.
    briefing: function (tasks, now) {
      var today = startOfDay(now || new Date());
      var weekEnd = new Date(today.getTime() + 7 * DAY);
      var overdue = [], week = [], unassigned = 0;
      (tasks || []).forEach(function (t) {
        if (t.completed_at) return;
        var d = dayOf(t);
        if (!d || d > weekEnd) return;
        if (!t.assigned_to) unassigned++;
        (d < today ? overdue : week).push({ task: t, day: d });
      });
      function byDay(a, b) { return a.day - b.day; }
      overdue.sort(byDay); week.sort(byDay);
      var lines = overdue.map(function (x) {
        var n = Math.round((today - x.day) / DAY);
        return { task: x.task, tone: 'overdue', when: n === 1 ? 'Overdue since yesterday' : n + ' days overdue' };
      }).concat(week.map(function (x) {
        var n = Math.round((x.day - today) / DAY);
        return { task: x.task, tone: 'week', when: n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : 'Due ' + short(x.day) };
      }));
      return { lines: lines, counts: { overdue: overdue.length, week: week.length, unassigned: unassigned } };
    },

    async ask(householdId, messages) {
      var out = await window.GenieSphere.ai.request({
        task: 'genie.chat', householdId: householdId,
        input: { messages: (messages || []).slice(-12), today: localDay(new Date()) }
      });
      var r = out.result || {};
      return { reply: String(r.reply || ''), proposals: Array.isArray(r.proposals) ? r.proposals : [], usage: out.usage || null };
    },

    // Runs one approved proposal with the signed-in person's permissions.
    async apply(householdId, p, members) {
      var GS = window.GenieSphere;
      if (p.type === 'task.add') {
        var who = findMember(members, p.assignee);
        var task = await GS.tasks.add(householdId, { title: p.title, dueDate: p.dueDate || null, assignedTo: who ? who.userId : null });
        return { text: 'Added to Tasks' + (who ? ' for ' + memberName(who) : ''), undo: function () { return GS.tasks.remove(task.id); } };
      }
      if (p.type === 'task.assign') {
        var to = findMember(members, p.assignee);
        if (!to) throw new Error('Genie couldn’t find “' + p.assignee + '” in the household.');
        await GS.tasks.assign(p.taskId, to.userId);
        return { text: 'Assigned to ' + memberName(to), undo: function () { return GS.tasks.assign(p.taskId, null); } };
      }
      if (p.type === 'grocery.add') {
        var res = await GS.grocery.addItems(householdId, p.items || []);
        return { text: 'Added ' + res.added + ' to the grocery list' + (res.skipped ? ' (' + res.skipped + ' already on it)' : ''), undo: null };
      }
      throw new Error('Genie can’t do that yet.');
    }
  };
})();
