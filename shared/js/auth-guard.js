
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

  const supabaseUrl = 'https://pbojacnagutipfhcxltj.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0';
  const supabase = createClient(supabaseUrl, supabaseKey);

  async function initAuthGuard() {
    let { data: { user } } = await supabase.auth.getUser();

    // Auto sign in as demo user if no session
    if (!user) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'demo@geniesphere.com',
        password: 'demo1234'
      });

      if (error) {
        console.error("Demo login failed:", error.message);
        return;
      }

      user = data.user;
    }

    // Get user preferences
    const { data: prefs, error: prefErr } = await supabase
      .from("user_preferences")
      .select("role, agents")
      .eq("user_id", user.id)
      .maybeSingle();

    if (prefErr || !prefs) {
      console.error("Error loading preferences:", prefErr?.message || "No preferences found");
      return;
    }

    const role = prefs.role || "user";
    const currentPage = window.location.pathname.split('/').pop();

    // Restrict demo user access to sensitive pages
    const restrictedForDemo = [
      "admin_dashboard.html",
      "manage-users.html",
      "edit-agent.html",
      "view-logs.html"
    ];

    if (role === "demo") {
      // Inject a banner
      const demoBanner = document.createElement("div");
      demoBanner.innerHTML = `
        <div class="bg-yellow-100 text-yellow-800 text-sm text-center py-2">
          ⚠️ You're in <strong>Demo Mode</strong>. Some features are limited.
          <a href="../onboarding/login.html" class="underline text-blue-600">Log in</a> for full access.
        </div>
      `;
      document.body.prepend(demoBanner);

      if (restrictedForDemo.includes(currentPage)) {
        alert("🔒 This feature is only available to registered users.");
        window.location.href = "../dashboard.html";
        return;
      }
    }

    // Optional redirect for admin
    if (role === "admin" && currentPage === "login.html") {
      window.location.href = "../admin_dashboard.html";
    }

    // Store role and user info globally if needed
    window.genieUser = {
      id: user.id,
      role,
      agents: prefs.agents || []
    };
  }

  initAuthGuard();

