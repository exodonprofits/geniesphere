/**
 * Notifications (Core service). Notifications are created by the database
 * (e.g. a task assigned to you) and by the gs-notify Edge Function (weekly
 * summary); browsers only read them and mark them read (migration 0010).
 *
 *   await GenieSphere.notifications.list(limit?)          -> [notification], newest first, all households
 *   await GenieSphere.notifications.unreadCount()         -> number
 *   await GenieSphere.notifications.markRead(id)
 *   await GenieSphere.notifications.markAllRead()
 *   await GenieSphere.notifications.prefs(householdId)    -> { weeklyDigest, assignedEmail }
 *   await GenieSphere.notifications.savePrefs(householdId, { weeklyDigest, assignedEmail })
 *   await GenieSphere.notifications.sendTestDigest(householdId) -> { email, tasks }
 *
 * Notification: { id, household_id, kind, title, body, link, source_module, read_at, created_at }
 * Requires gs-client.js and gs-auth.js.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  var COLS = 'id, household_id, kind, title, body, link, source_module, read_at, created_at';
  function db() { return window.GenieSphere.getSupabase(); }
  function check(res) { if (res.error) throw res.error; return res.data; }
  async function me() {
    var session = await window.GenieSphere.auth.session();
    if (!session) throw new Error('Sign in again.');
    return session.user.id;
  }

  window.GenieSphere.notifications = {
    async list(limit) {
      return check(await db().from('household_notifications').select(COLS)
        .eq('user_id', await me()).order('created_at', { ascending: false }).limit(limit || 50));
    },
    async unreadCount() {
      var res = await db().from('household_notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', await me()).is('read_at', null);
      if (res.error) throw res.error;
      return res.count || 0;
    },
    async markRead(id) {
      check(await db().from('household_notifications').update({ read_at: new Date().toISOString() })
        .eq('id', id).is('read_at', null));
    },
    async markAllRead() {
      check(await db().from('household_notifications').update({ read_at: new Date().toISOString() })
        .eq('user_id', await me()).is('read_at', null));
    },
    async prefs(householdId) {
      var row = check(await db().from('notification_prefs').select('weekly_digest, assigned_email')
        .eq('household_id', householdId).eq('user_id', await me()).maybeSingle());
      return { weeklyDigest: row ? row.weekly_digest !== false : true, assignedEmail: row ? row.assigned_email !== false : true };
    },
    async savePrefs(householdId, p) {
      check(await db().from('notification_prefs').upsert({
        household_id: householdId, user_id: await me(),
        weekly_digest: !!p.weeklyDigest, assigned_email: !!p.assignedEmail, updated_at: new Date().toISOString()
      }, { onConflict: 'household_id,user_id' }));
    },
    async sendTestDigest(householdId) {
      var result = await db().functions.invoke('gs-notify', { body: { action: 'test_digest', householdId: householdId } });
      if (result.error) {
        var message = result.error.message;
        try {
          if (result.error.context && typeof result.error.context.json === 'function') {
            var payload = await result.error.context.json();
            if (payload && payload.error) message = payload.error;
          }
        } catch (e) { /* keep the generic message */ }
        if (result.error.name === 'FunctionsFetchError') message = 'Could not reach GenieSphere. Check your connection and try again.';
        throw new Error(message);
      }
      if (!result.data || !result.data.ok) throw new Error((result.data && result.data.error) || 'Something went wrong. Try again.');
      return result.data;
    }
  };
})();
