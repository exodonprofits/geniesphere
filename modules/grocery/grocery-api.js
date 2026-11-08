/**
 * Grocery Genie's public interface for other modules (ARCHITECTURE.md:
 * "Nutrition emits ingredient requirements -> Grocery consumes"). Other
 * modules call this instead of writing shopping tables themselves.
 *
 *   await GenieSphere.grocery.activeListId(householdId)
 *   await GenieSphere.grocery.addItems(householdId, [{ name, quantity }])
 *     -> { added, skipped }   // skipped = already on the list (not checked off)
 *
 * Requires gs-client.js. Tables: shopping_lists, shopping_items (0004).
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};

  function db() { return window.GenieSphere.getSupabase(); }
  function key(name) { return String(name || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  // The household's current list; created on first use.
  async function activeListId(householdId) {
    var found = await db().from('shopping_lists')
      .select('id').eq('household_id', householdId).is('archived_at', null)
      .order('created_at', { ascending: true }).limit(1);
    if (found.error) throw found.error;
    if (found.data.length) return found.data[0].id;
    var created = await db().from('shopping_lists')
      .insert({ household_id: householdId, title: 'Shopping list' }).select('id').single();
    if (created.error) throw created.error;
    return created.data.id;
  }

  async function addItems(householdId, items) {
    var listId = await activeListId(householdId);
    var existing = await db().from('shopping_items')
      .select('name').eq('shopping_list_id', listId).eq('checked', false);
    if (existing.error) throw existing.error;
    var onList = {};
    (existing.data || []).forEach(function (row) { onList[key(row.name)] = true; });

    var rows = [];
    var skipped = 0;
    (items || []).forEach(function (item) {
      var name = String(item.name || '').trim().slice(0, 200);
      if (!name) return;
      if (onList[key(name)]) { skipped++; return; }
      onList[key(name)] = true;
      var quantity = String(item.quantity || '').trim().slice(0, 60);
      rows.push({ shopping_list_id: listId, household_id: householdId, name: name, quantity: quantity || null });
    });
    if (rows.length) {
      var inserted = await db().from('shopping_items').insert(rows);
      if (inserted.error) throw inserted.error;
    }
    return { added: rows.length, skipped: skipped, listId: listId };
  }

  window.GenieSphere.grocery = { activeListId: activeListId, addItems: addItems };
})();
