/** Shared authentication/session helpers. */
(function () {
  window.GenieSphere = window.GenieSphere || {};

  window.GenieSphere.auth = {
    async session() {
      const supabase = window.GenieSphere.getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },

    async requireSession(options = {}) {
      const session = await this.session();
      if (!session && options.redirect !== false) {
        const next = window.location.pathname + window.location.search;
        window.location.href = (options.loginPath || '/core/auth/login.html') + '?next=' + encodeURIComponent(next);
      }
      return session;
    },

    async signOut() {
      const supabase = window.GenieSphere.getSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = '/core/auth/login.html';
    }
  };
})();
