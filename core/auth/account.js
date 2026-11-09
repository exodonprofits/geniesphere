/**
 * Account self-service (Core): password reset by email.
 *
 *   await GenieSphere.account.requestPasswordReset(email)
 *     // always resolves the same way whether or not the email has an account
 *   await GenieSphere.account.setNewPassword(password)
 *     // on /core/auth/reset.html, after the emailed link signed the user in
 *
 * The reset email is sent by the gs-password-reset Edge Function from
 * invites@geniesphere.com (supabase/functions/_shared/email.ts).
 * Requires gs-client.js.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};

  window.GenieSphere.account = {
    async requestPasswordReset(email) {
      var result = await window.GenieSphere.getSupabase().functions.invoke('gs-password-reset', { body: { email: email } });
      if (result.error) {
        if (result.error.name === 'FunctionsFetchError') throw new Error('Could not reach GenieSphere. Check your connection and try again.');
        var message = 'Something went wrong. Try again.';
        try {
          var payload = result.error.context && await result.error.context.json();
          if (payload && payload.error) message = payload.error;
        } catch (ignored) { /* keep the generic message */ }
        throw new Error(message);
      }
    },
    async setNewPassword(password) {
      var result = await window.GenieSphere.getSupabase().auth.updateUser({ password: password });
      if (result.error) throw result.error;
    }
  };
})();
