/* =========================================================
   GenieSphere — Genie Settings (Suggest / Assist / Automate)
   - Persists per user + per genie_key in Supabase (genie_preferences)
   - Falls back to localStorage if no DB client found
   ========================================================= */
(function () {
  const STORAGE_PREFIX = "gs_genie_pref__";

  function getDbClient() {
    // Prefer an already-initialized client from your shared auth/bootstrap scripts.
    // IMPORTANT: Avoid using variable name "supabase" per project convention.
    return (
      window.sbClient ||
      window.dbClient ||
      window.gsClient ||
      window.genieClient ||
      null
    );
  }

  function qs(root, sel) { return root.querySelector(sel); }
  function qsa(root, sel) { return Array.from(root.querySelectorAll(sel)); }

  function setScopeVisibility(panel) {
    const scope = qs(panel, "[data-scope]");
    if (!scope) return;
    const lvl = qs(panel, 'input[name="assist_level"]:checked')?.value || "suggest";
    scope.style.display = (lvl === "automate") ? "block" : "none";
  }

  function getState(panel) {
    const assist_level = qs(panel, 'input[name="assist_level"]:checked')?.value || "suggest";
    const auto_scopes = qsa(panel, 'input[name="auto_scope"]:checked').map(i => i.value);
    return { assist_level, auto_scopes };
  }

  function applyState(panel, state) {
    const lvl = state?.assist_level || "suggest";
    const lvlInput = qs(panel, `input[name="assist_level"][value="${lvl}"]`);
    if (lvlInput) lvlInput.checked = true;

    const scopes = new Set(state?.auto_scopes || []);
    qsa(panel, 'input[name="auto_scope"]').forEach(i => { i.checked = scopes.has(i.value); });

    setScopeVisibility(panel);
  }

  async function loadFromSupabase(db, userId, genieKey) {
    const { data, error } = await db
      .from("genie_preferences")
      .select("assist_level, auto_scopes, updated_at")
      .eq("user_id", userId)
      .eq("genie_key", genieKey)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return { assist_level: data.assist_level, auto_scopes: data.auto_scopes || [] };
  }

  async function saveToSupabase(db, userId, genieKey, state) {
    const payload = {
      user_id: userId,
      genie_key: genieKey,
      assist_level: state.assist_level,
      auto_scopes: state.auto_scopes
    };

    const { error } = await db
      .from("genie_preferences")
      .upsert(payload, { onConflict: "user_id,genie_key" });

    if (error) throw error;
  }

  function loadFromLocal(genieKey) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + genieKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function saveToLocal(genieKey, state) {
    localStorage.setItem(STORAGE_PREFIX + genieKey, JSON.stringify(state));
  }

  async function getCurrentUserId(db) {
    // Support both supabase-js v2 and wrapped clients.
    // v2: db.auth.getUser()
    // Some wrappers might expose getUser() directly.
    try {
      if (db?.auth?.getUser) {
        const res = await db.auth.getUser();
        return res?.data?.user?.id || null;
      }
      if (db?.getUser) {
        const res = await db.getUser();
        return res?.data?.user?.id || null;
      }
    } catch (_) {}
    return null;
  }

  async function initPanel(panel) {
    const genieKey = panel.getAttribute("data-genie-key");
    if (!genieKey) return;

    // Wire toggle behavior
    qsa(panel, 'input[name="assist_level"]').forEach(r => {
      r.addEventListener("change", () => setScopeVisibility(panel));
    });
    setScopeVisibility(panel);

    const db = getDbClient();
    const saveBtn = qs(panel, "[data-gs-save]");
    const cancelBtn = qs(panel, "[data-gs-cancel]");

    // Load initial state
    let initial = null;

    if (db) {
      const userId = await getCurrentUserId(db);
      if (userId) {
        try {
          initial = await loadFromSupabase(db, userId, genieKey);
        } catch (e) {
          console.warn("[GenieSettings] Supabase load failed; falling back to localStorage.", e);
          initial = loadFromLocal(genieKey);
        }
      } else {
        // Not logged in; local mode
        initial = loadFromLocal(genieKey);
      }
    } else {
      initial = loadFromLocal(genieKey);
    }

    applyState(panel, initial || { assist_level: "suggest", auto_scopes: [] });

    // Save / Cancel
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const state = getState(panel);

        if (db) {
          const userId = await getCurrentUserId(db);
          if (userId) {
            try {
              await saveToSupabase(db, userId, genieKey, state);
            } catch (e) {
              console.warn("[GenieSettings] Supabase save failed; saving to localStorage instead.", e);
              saveToLocal(genieKey, state);
            }
          } else {
            saveToLocal(genieKey, state);
          }
        } else {
          saveToLocal(genieKey, state);
        }

        // Friendly micro-feedback (non-intrusive)
        saveBtn.textContent = "Saved ✓";
        setTimeout(() => { saveBtn.textContent = "Save settings"; }, 1200);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        const state = loadFromLocal(genieKey) || initial || { assist_level: "suggest", auto_scopes: [] };
        applyState(panel, state);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".genie-settings[data-genie-key]").forEach(panel => {
      initPanel(panel);
    });
  });
})();