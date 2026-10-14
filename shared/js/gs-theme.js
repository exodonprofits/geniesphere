// Dropdown "Appearance" -> open the same theme modal (mobile-friendly)
  (function(){
    const openFromDropdown = document.getElementById('dropdown-open-appearance');
    const openThemeBtn = document.getElementById('openThemeBtn');
    if(openFromDropdown && openThemeBtn){
      openFromDropdown.addEventListener('click', ()=>{
        openThemeBtn.click();
      });
    }
  })();

// Theme Switcher (shared)
  (function ThemeSwitcher(){
    const STORAGE_KEY = 'geniesphere_theme';
    const THEMES = ['theme-calm','theme-future','theme-nature','theme-dark'];
    const DEFAULT_THEME = 'theme-dark';

    const overlay = document.getElementById('themeOverlay');
    const openBtn = document.getElementById('openThemeBtn');
    const closeBtn = document.getElementById('closeThemeBtn');
    const doneBtn = document.getElementById('doneThemeBtn');
    const resetBtn = document.getElementById('resetThemeBtn');
    const themeGrid = document.getElementById('themeGrid');

    function saveTheme(theme){ try { localStorage.setItem(STORAGE_KEY, theme); } catch(_){ } }
    function getTheme(){ try { return localStorage.getItem(STORAGE_KEY); } catch(_){ return null; } }

    function updateSelected(theme){
      if(!themeGrid) return;
      themeGrid.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('selected', btn.getAttribute('data-theme') === theme);
      });
    }

    function applyTheme(theme){
      THEMES.forEach(t => document.body.classList.remove(t));
      document.body.classList.add(theme);
      updateSelected(theme);
    }

    function openModal(){
      if(!overlay) return;
      overlay.classList.add('open');
      overlay.style.display = 'flex';
      const first = themeGrid?.querySelector('.theme-option');
      setTimeout(()=> first && first.focus(), 40);
    }
    function closeModal(){
      if(!overlay) return;
      overlay.classList.remove('open');
      overlay.style.display = 'none';
      openBtn && openBtn.focus();
    }

    const saved = getTheme();
    const theme = (saved && THEMES.includes(saved)) ? saved : DEFAULT_THEME;
    applyTheme(theme);

    if(openBtn) openBtn.addEventListener('click', openModal);
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    if(doneBtn) doneBtn.addEventListener('click', closeModal);

    if(overlay){
      overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeModal(); });
    }
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && overlay?.classList.contains('open')) closeModal(); });

    if(themeGrid){
      themeGrid.addEventListener('click', (e)=>{
        const btn = e.target.closest('.theme-option');
        if(!btn) return;
        const next = btn.getAttribute('data-theme');
        if(!THEMES.includes(next)) return;
        applyTheme(next);
        saveTheme(next);
      });
    }

    if(resetBtn){
      resetBtn.addEventListener('click', ()=>{
        applyTheme(DEFAULT_THEME);
        saveTheme(DEFAULT_THEME);
      });
    }
  })();
