/**
 * GenieSphere - Save selected agents after signup
 *
 * Expected query params (from onboarding wizard):
 *   ?area=business&agents=rental-genie,hvac-genie,email-genie
 *
 * Call after a successful signUp/signIn where you have a user object.
 */

async function GSSaveAgentPreferences({ client, user, redirectOnDone }){
  try{
    const params = new URLSearchParams(window.location.search);
    const agentsParam = (params.get('agents') || '').trim();
    const area = (params.get('area') || '').trim();

    if(!agentsParam) {
      if (redirectOnDone) redirectOnDone({ area, agents: [] });
      return { ok:true, inserted:0 };
    }

    const agentKeys = agentsParam
      .split(',')
      .map(s=>s.trim())
      .filter(Boolean)
      .slice(0, 50);

    const rows = agentKeys.map(k=>({
      user_id: user.id,
      agent_key: k,
      enabled: true
    }));

    // Upsert prevents duplicates if user refreshes
    const { error } = await client
      .from('user_agent_preferences')
      .upsert(rows, { onConflict: 'user_id,agent_key' });

    if(error) throw error;

    if (redirectOnDone) redirectOnDone({ area, agents: agentKeys });
    return { ok:true, inserted: rows.length };
  }catch(err){
    console.warn('Save agent preferences failed:', err);
    if (redirectOnDone) redirectOnDone({ area: null, agents: [] });
    return { ok:false, error: err };
  }
}