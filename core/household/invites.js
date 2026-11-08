/**
 * Household invitations (Core). Owners invite people by a one-time link that
 * they send themselves (text, WhatsApp); no email is sent. All writes go
 * through the gs-household-invite Edge Function, which holds the service key.
 *
 *   await GenieSphere.invites.create(householdId, { email, displayName })
 *     -> { link, expiresAt }            // link is shown once; only its hash is stored
 *   await GenieSphere.invites.revoke(inviteId)
 *   await GenieSphere.invites.preview(token)
 *     -> { householdName, inviterName, email, displayName, status, hasAccount }
 *   await GenieSphere.invites.accept(token, { password, displayName })
 *     -> { householdId }                 // creates the account if needed, adds membership
 *
 * Requires gs-client.js. Tables: household_invites, household_members (0008).
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};
  var FN = 'gs-household-invite';

  async function call(body) {
    var result = await window.GenieSphere.getSupabase().functions.invoke(FN, { body: body });
    if (result.error) {
      var message = result.error.message;
      try {
        if (result.error.context && typeof result.error.context.json === 'function') {
          var payload = await result.error.context.json();
          if (payload && payload.error) message = payload.error;
        }
      } catch (ignored) { /* keep the generic message */ }
      if (result.error.name === 'FunctionsFetchError') message = 'Could not reach GenieSphere. Check your connection and try again.';
      throw new Error(message || 'Something went wrong. Try again.');
    }
    if (!result.data || !result.data.ok) throw new Error((result.data && result.data.error) || 'Something went wrong. Try again.');
    return result.data;
  }

  // The token travels in the URL fragment (#), so it is never sent to the web
  // server or leaked in a Referer header.
  function linkFor(token) {
    return window.location.origin + '/core/auth/invite.html#t=' + encodeURIComponent(token);
  }

  window.GenieSphere.invites = {
    async create(householdId, invitee) {
      var out = await call({ action: 'create', household_id: householdId, email: invitee.email, display_name: invitee.displayName });
      return { link: linkFor(out.token), expiresAt: out.expires_at, inviteId: out.invite_id };
    },
    async revoke(inviteId) { await call({ action: 'revoke', invite_id: inviteId }); },
    async preview(token) {
      var out = await call({ action: 'preview', token: token });
      return { householdName: out.household_name, inviterName: out.inviter_name, email: out.email,
        displayName: out.display_name, status: out.status, hasAccount: out.has_account };
    },
    async accept(token, details) {
      var out = await call({ action: 'accept', token: token, password: details && details.password, display_name: details && details.displayName });
      return { householdId: out.household_id };
    },
    tokenFromLocation: function () {
      var m = /[#&]t=([^&]+)/.exec(window.location.hash || '');
      return m ? decodeURIComponent(m[1]) : '';
    }
  };
})();
