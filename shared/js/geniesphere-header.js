// js/geniesphere-header.js
// Shared header logic for index + dashboard pages

(function () {
  // Make sure Supabase library is loaded
  if (!window.supabase) {
    console.error("Supabase JS not found. Include it before geniesphere-header.js");
    return;
  }

  // --- Supabase client ---
  const SUPABASE_URL = "https://pbojacnagutipfhcxltj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0";

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // --- Helpers ---
  function getRedirectAfterSignOut() {
    const path = window.location.pathname || "";
    // If the page is inside /dashboard/, go one level up
    if (path.includes("/dashboard/")) {
      return "../index.html";
    }
    // Otherwise assume we are at root
    return "index.html";
  }

  function getSettingsUrl() {
    const path = window.location.pathname || "";
    if (path.includes("/dashboard/")) {
      return "../onboarding/api-key-settings.html";
    }
    return "onboarding/api-key-settings.html";
  }

  function initHamburger() {
    const drawer = document.getElementById("mobile-drawer");
    const button = document.getElementById("hamburger");
    if (!drawer || !button) return;

    const open = () => {
      drawer.style.display = "block";
      button.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      drawer.style.display = "none";
      button.setAttribute("aria-expanded", "false");
    };

    button.addEventListener("click", () => {
      button.getAttribute("aria-expanded") === "true" ? close() : open();
    });

    drawer.addEventListener("click", (e) => {
      if (e.target.tagName === "A") close();
    });
  }

  async function initAuthHeader() {
    const loginLink = document.getElementById("nav-login");
    const loginMobile = document.getElementById("nav-login-mobile");
    const userMenu = document.getElementById("user-menu");
    const nameLabel = document.getElementById("user-name-label");
    const menuToggle = document.getElementById("user-menu-toggle");
    const menuDropdown = document.getElementById("user-menu-dropdown");
    const signoutBtn = document.getElementById("user-signout-btn");

    // Optional legacy "settings" buttons (if present on some pages)
    const settingsDesktop = document.getElementById("btn-settings");
    const settingsMobile = document.getElementById("btn-settings-mobile");

    // Wire settings buttons if they exist
    const settingsUrl = getSettingsUrl();
    if (settingsDesktop) {
      settingsDesktop.addEventListener("click", () => {
        window.location.href = settingsUrl;
      });
    }
    if (settingsMobile) {
      settingsMobile.addEventListener("click", () => {
        window.location.href = settingsUrl;
      });
    }

    // If no auth-related elements exist, nothing to do
    if (!loginLink && !userMenu) return;

    let menuOpen = false;

    function closeMenu() {
      if (!menuDropdown || !menuToggle) return;
      menuOpen = false;
      menuDropdown.style.display = "none";
      menuToggle.setAttribute("aria-expanded", "false");
    }

    // Get current user
    const { data, error } = await supabaseClient.auth.getUser();
    if (error) {
      console.error("Error fetching user:", error);
    }

    const user = data?.user;

    if (user) {
      const rawName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        (user.email ? user.email.split("@")[0] : "") ||
        "Account";

      if (nameLabel) nameLabel.textContent = rawName;
      if (loginLink) loginLink.style.display = "none";
      if (loginMobile) loginMobile.style.display = "none";
      if (userMenu) userMenu.style.display = "inline-flex";

      if (menuToggle && menuDropdown) {
        menuToggle.addEventListener("click", (e) => {
          e.stopPropagation();
          menuOpen = !menuOpen;
          menuDropdown.style.display = menuOpen ? "block" : "none";
          menuToggle.setAttribute("aria-expanded", menuOpen ? "true" : "false");
        });

        document.addEventListener("click", (e) => {
          if (!menuOpen) return;
          if (!userMenu.contains(e.target)) {
            closeMenu();
          }
        });
      }

      if (signoutBtn) {
        signoutBtn.addEventListener("click", async () => {
          try {
            await supabaseClient.auth.signOut();
          } catch (e) {
            console.error("Error signing out:", e);
          }
          window.location.href = getRedirectAfterSignOut();
        });
      }
    } else {
      // Not logged in -> show login, hide user menu
      if (userMenu) userMenu.style.display = "none";
      if (loginLink) loginLink.style.display = "inline-flex";
      if (loginMobile) loginMobile.style.display = "block";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHamburger();
    initAuthHeader();
  });
})();
