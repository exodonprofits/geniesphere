/**
 * Browser-facing AI gateway contract.
 * Provider secrets must remain server-side.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};

  window.GenieSphere.ai = {
    async request({ task, module, input, context = {} }) {
      if (!task || !module) throw new Error('AI task and module are required.');

      // Replace with a Supabase Edge Function or other server-side endpoint.
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, module, input, context })
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status}`);
      }
      return response.json();
    }
  };
})();
