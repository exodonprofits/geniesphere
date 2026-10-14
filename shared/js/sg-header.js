import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  'https://pbojacnagutipfhcxltj.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0'
);

async function injectUserBar() {
  let userBar = document.getElementById("user-bar");

  if (!userBar) {
    userBar = document.createElement("div");
    userBar.id = "user-bar";
    userBar.className = "user-info";
    document.body.prepend(userBar);
  }

  if (!document.getElementById("logo-wrapper")) {
    const { data: { user } } = await supabase.auth.getUser();
    let role = "user";
    const { data: roleData } = await supabase
      .from("user_preferences")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (roleData?.role === "admin") role = "admin";

    const logoWrapper = document.createElement("div");
    logoWrapper.id = "logo-wrapper";
    logoWrapper.innerHTML = `
      <a href="/dashboard/${role}_dashboard.html">
        <img src="/shared/assets/logo/genie-logo.png" alt="GenieSphere Logo" class="genie-logo" />
      </a> 
    `;
    document.body.prepend(logoWrapper);
  }

  const style = document.createElement("style");
  style.textContent = `
    .navbar {
      top: 0;
      left: 0;
      padding: 0;
      width: 100%;
      height: 75px;
      background-color: #ffffff;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      position: fixed;
      z-index: 9998;
    }

    #logo-wrapper {
      position: fixed;
      top: 10px;
      left: 20px;
      z-index: 9999;
    }

    .genie-logo {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      box-shadow: 0 0 20px rgba(0, 122, 255, 0.2);
      object-fit: cover;
      cursor: pointer;
      margin-bottom: 40px;
    }

    .user-info {
      position: fixed;
      top: 25px;
      right: 20px;
      font-size: 0.95rem;
      color: #0F172A;
      z-index: 9999;
    }

    .dropdown {
      position: relative;
      display: inline-block;
      text-align: left;
    }

    .dropdown-menu {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      background-color: #ffffff;
      border: 1px solid #d0d7e2;
      border-radius: 6px;
      box-shadow: 0 0 10px rgba(0,0,0,0.05);
      min-width: 220px;
      padding: 6px 0;
      z-index: 10000;
    }

    .dropdown-menu a,
    .dropdown-menu button,
    .submenu-trigger {
      display: block;
      width: 100%;
      padding: 10px 12px;
      background: none;
      border: none;
      color: #0F172A;
      font-size: 0.95rem;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }

    .dropdown-menu a:hover,
    .dropdown-menu button:hover,
    .submenu-trigger:hover {
      background-color: #f0f4ff;
      color: #007AFF;
    }

    .submenu {
      display: none;
      padding-left: 12px;
    }

    .submenu a {
      padding: 8px 12px;
      font-size: 0.9rem;
      color: #0F172A;
      text-decoration: none;
      display: block;
    }

    .submenu a:hover {
      background-color: #f0f4ff;
      color: #007AFF;
    }

    @media (hover: hover) {
      .dropdown:hover .dropdown-menu {
        display: block;
      }
      .dropdown:hover .submenu {
        display: block;
      }
    }

    .dropdown.open .dropdown-menu {
      display: block;
    }

    .submenu-container.open .submenu {
      display: block;
    }

    .dropdown-menu button {
      all: unset;
      display: block;
      width: 100%;
      padding: 10px 12px;
      color: #0F172A;
      font-size: 0.95rem;
      text-align: left;
      cursor: pointer;
    }

    .dropdown-menu button:hover {
      background-color: #f0f4ff;
      color: #007AFF;
    }
  `;
  document.head.appendChild(style);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name || user.email;

  if (user && userBar) {
    userBar.innerHTML = `
      <div class="dropdown">
        <div class="dropdown-trigger"><span style="color:#64748b;">👤</span> ${displayName} ▼</div>
        <div class="dropdown-menu">
          <a href="/onboarding/user_profile_form.html">🧑‍💼 User Profile</a>
          <div class="submenu-container">
            <div class="submenu-trigger">⚙️ Settings ▼</div>
            <div class="submenu">
              <a href="/onboarding/change-password.html">Change Password</a>
              <a href="#">Notification Preferences</a>
            </div>
          </div>
          <button onclick="logout()">🔓 Logout</button>
        </div>
      </div>
    `;

    const submenuTrigger = userBar.querySelector(".submenu-trigger");
    const submenuContainer = userBar.querySelector(".submenu-container");

    if (submenuTrigger && submenuContainer) {
      submenuTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        submenuContainer.classList.toggle("open");
      });

      document.addEventListener("click", () => {
        submenuContainer.classList.remove("open");
      });
    }

    const dropdownTrigger = userBar.querySelector(".dropdown-trigger");
    const dropdown = userBar.querySelector(".dropdown");

    if (dropdown && dropdownTrigger) {
      dropdownTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });

      document.addEventListener("click", () => {
        dropdown.classList.remove("open");
      });
    }
  }

  // ✅ Inject navbar AFTER logo & user bar
  if (!document.getElementById("nav-bar")) {
    const navBar = document.createElement("div");
    navBar.id = "nav-bar";
    navBar.className = "navbar";
    navBar.innerHTML = `<div style="margin-left:85px; margin-top:27px;">Salon Genie</div>`;
    document.body.appendChild(navBar);
  }

  window.logout = async function () {
    await supabase.auth.signOut();
    window.location.href = "/onboarding/login.html";
  };
}

document.addEventListener("DOMContentLoaded", injectUserBar);
