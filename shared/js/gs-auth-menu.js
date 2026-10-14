(async function initAuthHeader(){
    const userMenu = document.getElementById('user-menu');
    const toggle   = document.getElementById('user-menu-toggle');
    const dropdown = document.getElementById('user-menu-dropdown');
    const nameLbl  = document.getElementById('user-name-label');
    const authBtn  = document.getElementById('user-auth-action');
    const signout  = document.getElementById('user-signout-btn');

    function closeDropdown(){ dropdown.style.display='none'; toggle.setAttribute('aria-expanded','false'); }
    function openDropdown(){ dropdown.style.display='block'; toggle.setAttribute('aria-expanded','true'); }

    toggle.addEventListener('click', (e)=>{
      e.stopPropagation();
      const isOpen = dropdown.style.display === 'block';
      isOpen ? closeDropdown() : openDropdown();
    });
    document.addEventListener('click', ()=> closeDropdown());

    // Nav buttons inside dropdown
    dropdown.addEventListener('click', (e)=>{
      const btn = e.target.closest('.dropdown-nav');
      if(!btn) return;
      const target = btn.getAttribute('data-target');
      if(target) window.location.href = target;
    });

    // Hamburger + drawer (kept for legacy, hidden on mobile)
    const hamb = document.getElementById('hamburger');
    const drawer = document.getElementById('mobile-drawer');
    if(hamb && drawer){
      hamb.addEventListener('click',(e)=>{
        e.stopPropagation();
        const open = drawer.style.display === 'block';
        drawer.style.display = open ? 'none' : 'block';
        hamb.setAttribute('aria-expanded', open ? 'false' : 'true');
      });
      document.addEventListener('click', ()=>{ drawer.style.display='none'; hamb.setAttribute('aria-expanded','false'); });
      drawer.addEventListener('click', (e)=> e.stopPropagation());
    }

    // Supabase session
    let client;
    try{
      client = await getClient();
    }catch(err){
      console.warn(err);
      nameLbl.textContent = 'Log in';
      authBtn.textContent = 'Log in / Sign up';
      signout.style.display = 'none';
      return;
    }

    async function refreshUser(){
      const { data } = await client.auth.getUser();
      const user = data?.user;
      if(user){
        const email = user.email || '';
        const shortEmail = email.includes('@') ? email.split('@')[0] : email;
        const label = user.user_metadata?.full_name || shortEmail || 'Account';

        nameLbl.textContent = label;
        authBtn.style.display = 'none';
        signout.style.display = 'block';
      }
      else{
        nameLbl.textContent = 'Log in';
        authBtn.style.display = 'block';
        signout.style.display = 'none';
      }
    }
    await refreshUser();

    client.auth.onAuthStateChange(async ()=> refreshUser());

    // Login / signup
    authBtn.addEventListener('click', ()=>{
      window.location.href = '../login.html?redirect=' + encodeURIComponent(window.location.pathname);
    });

    // Logout
    signout.addEventListener('click', async ()=>{
      await client.auth.signOut();
      window.location.href = '../login.html?redirect=' + encodeURIComponent(window.location.pathname);
    });
  })();
