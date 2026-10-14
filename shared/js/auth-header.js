// /shared/js/auth-header.js
// Rental Genie / GenieSphere shared header auth controller
// Standardized: one place controls "Log in" vs "User menu" across pages.
// Backward-compatible: supports BOTH legacy Rental Genie header IDs and newer enterprise IDs.
//
// How it works:
// 1) Prefer a real Supabase session if a client is available (window.getSbClient / window.GSClient.getAsync).
// 2) Fallback to a small cached user object saved at login time (gs_auth_user_v1).
// 3) Update header + mobile drawer UI consistently.
// 4) Wire sign-out buttons (desktop + mobile) once.

(function () {
  "use strict";

  const KEY_USER = "gs_auth_user_v1";

  // Defaults (can be overridden via GSAuthHeader.init)
  let LOGIN_URL = "/onboarding/login.html";
  let ACCOUNT_URL = "/account.html";
  let AFTER_LOGOUT_URL = "/index.html";

  function safeParse(s) { try { return JSON.parse(s); } catch (_) { return null; } }

  function getCachedUser() {
    try { const a = localStorage.getItem(KEY_USER); if (a) return safeParse(a); } catch (_) {}
    try { const b = sessionStorage.getItem(KEY_USER); if (b) return safeParse(b); } catch (_) {}
    return null;
  }

  function setCachedUser(user, preferSession) {
    const payload = JSON.stringify(user || null);
    try { localStorage.removeItem(KEY_USER); } catch (_) {}
    try { sessionStorage.removeItem(KEY_USER); } catch (_) {}
    try { (preferSession ? sessionStorage : localStorage).setItem(KEY_USER, payload); } catch (_) {}
  }

  function clearCachedUser() {
    try { localStorage.removeItem(KEY_USER); } catch (_) {}
    try { sessionStorage.removeItem(KEY_USER); } catch (_) {}
  }

  function displayNameFromUser(u) {
    if (!u) return "";
    return (
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      u.full_name ||
      u.name ||
      u.username ||
      (u.email ? String(u.email).split("@")[0] : "") ||
      "Account"
    );
  }

  function $(id) { return document.getElementById(id); }
  // NOTE: many of our header elements are hidden by default via CSS (display:none).
  // Setting style.display="" does NOT override that, so we must explicitly set a visible display.
  function show(el, display) {
    if (!el) return;
    // Allow pages to specify a preferred display via data-gs-display.
    const pref = display || el.getAttribute("data-gs-display");
    if (pref) { el.style.display = pref; return; }
    // Reasonable defaults by element type.
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "A" || tag === "SPAN") el.style.display = "inline-block";
    else if (tag === "BUTTON") el.style.display = "inline-flex";
    else el.style.display = "block";
  }
  function hide(el) { if (el) el.style.display = "none"; }

  // --- Legacy Rental Genie IDs (enterprise-template.html currently uses these) ---
  const LEGACY = {
    navLogin: "nav-login",
    userMenu: "userMenu",
    userMenuBtn: "userMenuBtn",
    userMenuDropdown: "userMenuDropdown",
    usernameLabel: "usernameLabel",
    logoutBtn: "logoutBtn",
    mobileLogin: "mobileLogin",
    mobileAccountLink: "mobileAccountLink",
    mobileUsernameLabel: "mobileUsernameLabel",
    mobileLogoutContainer: "mobileLogoutContainer",
    mobileLogoutBtn: "mobileLogoutBtn",
  };

  // --- Newer Enterprise IDs (if/when you migrate markup) ---
  const ENTERPRISE = {
    authAction: "user-auth-action",
    nameLabel: "user-name-label",
    signoutBtn: "user-signout-btn",
    menuToggle: "user-menu-toggle",
    menuDropdown: "user-menu-dropdown",
    mobileAuthAction: "mobile-auth-action",
    mobileNameLabel: "mobile-user-name-label",
    mobileSignoutBtn: "mobile-signout-btn",
  };

  let _wired = false;

  async function getSupabaseUserIfAvailable() {
    // Prefer the real client session when available.
    try {
      if (typeof window.getSbClient === "function") {
        const c = await window.getSbClient();
        if (c?.auth?.getUser) {
          const { data } = await c.auth.getUser();
          if (data?.user) return data.user;
        }
        if (c?.auth?.getSession) {
          const { data } = await c.auth.getSession();
          if (data?.session?.user) return data.session.user;
        }
      }
    } catch (_) {}

    // Back-compat: some pages expose GSClient.getAsync()
    try {
      if (window.GSClient && typeof window.GSClient.getAsync === "function") {
        const c = await window.GSClient.getAsync();
        if (c?.auth?.getUser) {
          const { data } = await c.auth.getUser();
          if (data?.user) return data.user;
        }
        if (c?.auth?.getSession) {
          const { data } = await c.auth.getSession();
          if (data?.session?.user) return data.session.user;
        }
      }
    } catch (_) {}

    return null;
  }

  function setLoggedOutUI() {
    // Legacy header
    const navLogin = $(LEGACY.navLogin);
    const userMenu = $(LEGACY.userMenu);
    const usernameLabel = $(LEGACY.usernameLabel);

    show(navLogin, "inline-block");
    hide(userMenu);
    if (usernameLabel) usernameLabel.textContent = "User";

    // Legacy mobile drawer
    const mobileLogin = $(LEGACY.mobileLogin);
    const mobileAccountLink = $(LEGACY.mobileAccountLink);
    const mobileUsernameLabel = $(LEGACY.mobileUsernameLabel);
    const mobileLogoutContainer = $(LEGACY.mobileLogoutContainer);

    show(mobileLogin, "block");
    hide(mobileAccountLink);
    hide(mobileLogoutContainer);
    if (mobileUsernameLabel) mobileUsernameLabel.textContent = "User";

    // Enterprise header
    const nameEl = $(ENTERPRISE.nameLabel);
    const loginBtn = $(ENTERPRISE.authAction);
    const logoutBtn = $(ENTERPRISE.signoutBtn);

    if (nameEl) nameEl.textContent = "Log in";
    if (loginBtn) {
      loginBtn.textContent = "Log in / Sign up";
      loginBtn.onclick = () => {
        const next = encodeURIComponent(location.pathname + location.search + location.hash);
        location.href = LOGIN_URL + "?next=" + next;
      };
    }
    hide(logoutBtn);

    // Enterprise mobile
    const mName = $(ENTERPRISE.mobileNameLabel);
    const mAuth = $(ENTERPRISE.mobileAuthAction);
    const mOut = $(ENTERPRISE.mobileSignoutBtn);

    if (mName) mName.textContent = "Log in";
    if (mAuth) {
      mAuth.textContent = "Log in / Sign up";
      mAuth.onclick = () => {
        const next = encodeURIComponent(location.pathname + location.search + location.hash);
        location.href = LOGIN_URL + "?next=" + next;
      };
    }
    hide(mOut);
  }

  function setLoggedInUI(user) {
    const disp = displayNameFromUser(user);

    // Legacy header
    const navLogin = $(LEGACY.navLogin);
    const userMenu = $(LEGACY.userMenu);
    const usernameLabel = $(LEGACY.usernameLabel);

    hide(navLogin);
    show(userMenu, "inline-block");
    if (usernameLabel) usernameLabel.textContent = disp;

    // Legacy mobile drawer
    const mobileLogin = $(LEGACY.mobileLogin);
    const mobileAccountLink = $(LEGACY.mobileAccountLink);
    const mobileUsernameLabel = $(LEGACY.mobileUsernameLabel);
    const mobileLogoutContainer = $(LEGACY.mobileLogoutContainer);

    hide(mobileLogin);
    show(mobileAccountLink, "block");
    show(mobileLogoutContainer, "block");
    if (mobileUsernameLabel) mobileUsernameLabel.textContent = disp;

    // Enterprise header
    const nameEl = $(ENTERPRISE.nameLabel);
    const loginBtn = $(ENTERPRISE.authAction);
    const logoutBtn = $(ENTERPRISE.signoutBtn);

    if (nameEl) nameEl.textContent = disp;
    if (loginBtn) {
      loginBtn.textContent = "Account";
      loginBtn.onclick = () => { location.href = ACCOUNT_URL; };
    }
    show(logoutBtn);

    // Enterprise mobile
    const mName = $(ENTERPRISE.mobileNameLabel);
    const mAuth = $(ENTERPRISE.mobileAuthAction);
    const mOut = $(ENTERPRISE.mobileSignoutBtn);

    if (mName) mName.textContent = disp;
    if (mAuth) {
      mAuth.textContent = "Account";
      mAuth.onclick = () => { location.href = ACCOUNT_URL; };
    }
    show(mOut);
  }

  async function signOutEverywhere() {
    clearCachedUser();
    try {
      const c =
        (typeof window.getSbClient === "function" ? await window.getSbClient() : null) ||
        (window.GSClient && typeof window.GSClient.getAsync === "function" ? await window.GSClient.getAsync() : null);

      if (c?.auth?.signOut) await c.auth.signOut();
    } catch (_) {}

    setLoggedOutUI();
    location.href = AFTER_LOGOUT_URL;
  }

  function wireLegacyDropdown() {
    const toggle = $(LEGACY.userMenuBtn);
    const dd = $(LEGACY.userMenuDropdown);
    if (!toggle || !dd) return;

    function close() {
      dd.style.display = "none";
      toggle.setAttribute("aria-expanded", "false");
    }
    function open() {
      dd.style.display = "block";
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = dd.style.display === "block";
      isOpen ? close() : open();
    });

    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target) && !toggle.contains(e.target)) close();
    });
  }

  function wireEnterpriseDropdown() {
    const toggle = $(ENTERPRISE.menuToggle);
    const dd = $(ENTERPRISE.menuDropdown);
    if (!toggle || !dd) return;

    function close() {
      dd.style.display = "none";
      toggle.setAttribute("aria-expanded", "false");
    }
    function open() {
      dd.style.display = "block";
      toggle.setAttribute("aria-expanded", "true");
    }

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = dd.style.display === "block";
      isOpen ? close() : open();
    });

    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target) && !toggle.contains(e.target)) close();
    });
  }

  function wireSignOutButtons() {
    const ids = [
      LEGACY.logoutBtn,
      LEGACY.mobileLogoutBtn,
      ENTERPRISE.signoutBtn,
      ENTERPRISE.mobileSignoutBtn,
    ];

    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.onclick = (e) => {
        e?.preventDefault?.();
        signOutEverywhere();
      };
    });
  }

  async function refreshHeader() {
    // Prefer live session, fallback to cached
    const sbUser = await getSupabaseUserIfAvailable();
    const cached = getCachedUser();

    const user = sbUser || cached;

    // Keep cached user in sync if we have a live user
    if (sbUser) {
      setCachedUser({ id: sbUser.id, email: sbUser.email, user_metadata: sbUser.user_metadata || {} });
    }

    if (user) setLoggedInUI(user);
    else setLoggedOutUI();
  }

  function ensureWired() {
    if (_wired) return;
    _wired = true;
    wireLegacyDropdown();
    wireEnterpriseDropdown();
    wireSignOutButtons();
  }

  window.GSAuthHeader = {
    init(opts){
      try{
        if (opts?.loginUrl) LOGIN_URL = opts.loginUrl;
        if (opts?.accountUrl) ACCOUNT_URL = opts.accountUrl;
        if (opts?.afterLogoutUrl) AFTER_LOGOUT_URL = opts.afterLogoutUrl;
      } catch (_) {}
      ensureWired();
      refreshHeader();
    },
    setCachedUser,
    clearCachedUser,
    refreshHeader,
    // helper for debugging
    _debug: { KEY_USER }
  };

  // Auto-init (safe)
  document.addEventListener("DOMContentLoaded", () => {
    ensureWired();
    refreshHeader();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === KEY_USER) refreshHeader();
  });
})();
