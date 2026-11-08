/**
 * GenieSphere AI gateway (browser side). The only way 0.1 pages call AI.
 *
 *   const out = await GenieSphere.ai.request({
 *     task: 'meal_plan.generate', householdId, input: { people: 4, goal: 'balanced' }
 *   });
 *   // out.result, out.usage = { today, limit }
 *
 * Calls the gs-ai-gateway Edge Function through the canonical Supabase client,
 * which sends the user's session. Provider keys, prompts and daily limits live
 * server-side (supabase/functions/gs-ai-gateway). Requires gs-client.js.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};

  async function errorMessage(error) {
    // supabase-js puts the function's response on error.context for HTTP errors.
    try {
      if (error && error.context && typeof error.context.json === 'function') {
        var body = await error.context.json();
        if (body && body.error) return body.error;
      }
    } catch (ignored) { /* fall through */ }
    return (error && error.message) || 'The AI request failed. Try again.';
  }

  window.GenieSphere.ai = {
    async request(options) {
      var task = options && options.task;
      var householdId = options && options.householdId;
      if (!task || !householdId) throw new Error('AI task and household are required.');

      var result = await window.GenieSphere.getSupabase().functions.invoke('gs-ai-gateway', {
        body: { task: task, household_id: householdId, input: options.input || {} }
      });
      if (result.error) throw new Error(await errorMessage(result.error));
      if (!result.data || !result.data.ok) {
        throw new Error((result.data && result.data.error) || 'The AI request failed. Try again.');
      }
      return result.data;
    }
  };
})();
