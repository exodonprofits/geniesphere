import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  'https://pbojacnagutipfhcxltj.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0'
);

async function injectUserBar() {
  // Step 1: Inject user bar (top right)
  let userBar = document.getElementById("user-bar");
  if (!userBar) {
    userBar = document.createElement("div");
    userBar.id = "user-bar";
    userBar.className = "user-info";
    document.body.prepend(userBar);
  }

  // Step 2: Inject logo (top left)
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

  // Step 3: Inject navbar (below logo/user)
  if (!document.getElementById("nav-bar")) {
    const navBar = document.createElement("div");
    navBar.id = "nav-bar";
    navBar.className = "navbar";
    navBar.innerHTML = `
      <div style="padding: 0 20px; line-height: 75px; font-weight: bold;">
        🧭 GenieSphere Navigation Bar
      </div>
    `;
    document.body.appendChild(navBar);
  }

  // Step 4: Add styles
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
      z-index: 9999;
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
      top: 10px;
      right: 20px;
      font-size: 0.95rem;
      color: #0F172A;
      z-index: 9999;
    }

    .user-info button {
      background: none;
      border: none;
      cursor: pointer;
      font-weight: bold;
    }

    .dropdown {
      display: none;
      position: absolute;
      top: 25px;
      right: 0;
      background-color: white;
      border: 1px solid #ccc;
      padding: 8px;
      border-radius: 6px;
      z-index: 10000;
    }

    .user-info:hover .dropdown {
      display: block;
    }

    .dropdown a, .dropdown button {
      display: block;
      text-decoration: none;
      color: #333;
      padding: 5px;
    }

    .dropdown button:hover {
      background-color: #f0f0f0;
    }
  `;
  document.head.appendChild(style);

  // Step 5: Inject user name & logout
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0];

    userBar.innerHTML = `
      <div>
        👋 Hello, <strong>${name}</strong>
        <div class="dropdown">
          <a href="/profile-settings.html">⚙️ Settings</a>
          <button onclick="logout()">🚪 Logout</button>
        </div>
      </div>
    `;
  }
}

window.logout = async function () {
  await supabase.auth.signOut();
  location.href = "/login.html";
};

injectUserBar();
