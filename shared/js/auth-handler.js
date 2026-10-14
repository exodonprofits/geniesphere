
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Only initialize Supabase once
if (!window.supabase) {
  window.supabase = createClient(
    'https://pbojacnagutipfhcxltj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib2phY25hZ3V0aXBmaGN4bHRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDkwODAsImV4cCI6MjA2MzU4NTA4MH0.ZLCcAzTYljoZycpBGwMtthP5VyAJ4schuIvt4HibGc0'
  );
}


// Attach auth redirect check
window.checkAuthAndRedirect = async function (e) {
  e.preventDefault();
  const { data: { user } } = await window.supabase.auth.getUser();
  if (user) {
    window.location.href = 'trip-dashboard.html';
  } else {
    window.location.href = 'login.html';
  }
};

// Attach logout event once the page is fully loaded
window.addEventListener('load', () => {
  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await window.supabase.auth.signOut();
      window.location.href = 'login.html';
    });
  }
});
