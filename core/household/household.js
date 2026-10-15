/**
 * Core household context: which household the signed-in user is working in.
 * Depends on gs-client.js (GenieSphere.getSupabase) and gs-auth.js.
 *
 * GenieSphere.household.current() resolves to
 *   { householdId, name, role, households: [{ id, name, role }] }
 * or null when the user belongs to no household.
 * The choice is stored per user in public.user_household_context.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};

  let cached = null;

  async function listMemberships(supabase, userId) {
    const { data, error } = await supabase
      .from('household_members')
      .select('household_id, role, households ( id, name )')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || [])
      .filter(function (row) { return row.households; })
      .map(function (row) {
        return { id: row.household_id, name: row.households.name, role: row.role };
      })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  async function savedHouseholdId(supabase, userId) {
    const { data, error } = await supabase
      .from('user_household_context')
      .select('household_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? data.household_id : null;
  }

  window.GenieSphere.household = {
    async current() {
      if (cached) return cached;
      const session = await window.GenieSphere.auth.requireSession();
      if (!session) return null;
      const supabase = window.GenieSphere.getSupabase();
      const userId = session.user.id;

      const households = await listMemberships(supabase, userId);
      if (!households.length) return null;

      const saved = await savedHouseholdId(supabase, userId);
      const chosen = households.find(function (h) { return h.id === saved; }) || households[0];
      cached = { householdId: chosen.id, name: chosen.name, role: chosen.role, households: households };
      return cached;
    },

    async setCurrent(householdId) {
      const session = await window.GenieSphere.auth.requireSession();
      if (!session) return;
      const supabase = window.GenieSphere.getSupabase();
      const { error } = await supabase
        .from('user_household_context')
        .upsert({ user_id: session.user.id, household_id: householdId, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' });
      if (error) throw error;
      cached = null;
    }
  };
})();
