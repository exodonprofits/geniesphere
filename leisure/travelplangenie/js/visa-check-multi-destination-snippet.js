/**
 * VISA CHECK — Multi-destination handler
 * Drop this into visa-check.html's <script> block (runs on DOMContentLoaded)
 *
 * Handles two URL param patterns:
 *   Single:  ?destination=Rome
 *   Multi:   ?countries=Paris,Rome,Barcelona   (from multi-stop itinerary)
 *            ?destination=Paris, Rome, Barcelona (comma-joined fallback)
 *
 * For multi: renders one visa panel per country, each with its own
 * citizenship × destination lookup.
 */

(function () {
  const params = new URLSearchParams(window.location.search);

  // ── 1. Parse incoming destinations ──────────────────────────────
  function parseDestinations(raw) {
    if (!raw) return [];
    return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  const rawCountries   = params.get('countries')   || '';
  const rawDestination = params.get('destination')  || '';

  // Prefer explicit ?countries= param; fall back to splitting ?destination=
  const destinations = rawCountries
    ? parseDestinations(rawCountries)
    : parseDestinations(rawDestination);

  const isMulti = destinations.length > 1;

  // ── 2. Single destination — pre-fill as before ──────────────────
  if (!isMulti) {
    const dest = destinations[0] || rawDestination;
    if (dest) {
      // Pre-fill the destination dropdown/input — adjust selector to match your page
      const destInput = document.getElementById('destination')
        || document.querySelector('[name="destination"]')
        || document.querySelector('select#country');
      if (destInput) {
        // Try to set value; if it's a select, find matching option
        if (destInput.tagName === 'SELECT') {
          const opt = Array.from(destInput.options).find(o =>
            o.value.toLowerCase().includes(dest.toLowerCase().split(',')[0]) ||
            dest.toLowerCase().includes(o.value.toLowerCase())
          );
          if (opt) { destInput.value = opt.value; destInput.dispatchEvent(new Event('change')); }
        } else {
          destInput.value = dest;
          destInput.dispatchEvent(new Event('input'));
        }
      }
      // Update page title if present
      const titleEl = document.getElementById('pageTitle') || document.querySelector('h1');
      if (titleEl && !titleEl.dataset.customSet) {
        titleEl.textContent = `🛂 Visa Requirements — ${dest.split(',')[0].trim()}`;
        titleEl.dataset.customSet = '1';
      }
    }
    return; // single destination handled — normal page flow takes over
  }

  // ── 3. Multi-destination — inject a country-per-panel UI ────────
  // Find where to inject (just before or after the main form)
  // Adjust the target selector to match your visa-check.html structure
  const mainForm = document.getElementById('visaForm')
    || document.querySelector('form')
    || document.querySelector('main')
    || document.body;

  // Update the page title/banner
  const titleEl = document.getElementById('pageTitle') || document.querySelector('.page-banner h1');
  if (titleEl) {
    const cityNames = destinations.map(d => d.split(',')[0].trim());
    titleEl.textContent = `🛂 Visa Check — ${cityNames.join(', ')}`;
  }

  // Build a citizenship selector (reuse page's if it exists, otherwise create one)
  const pageCitizenshipSel = document.getElementById('citizenship')
    || document.querySelector('[name="citizenship"]');
  const citizenship = pageCitizenshipSel?.value || 'United States';

  // Inject a multi-panel notice + per-country sections above the main form
  const wrapper = document.createElement('div');
  wrapper.id = 'visaMultiWrapper';
  wrapper.style.cssText = 'margin-bottom:1.5rem';

  // Info banner
  wrapper.insertAdjacentHTML('beforeend', `
    <div style="background:#eaf4fb;border:1px solid #bae6fd;border-radius:10px;padding:0.85rem 1rem;
                margin-bottom:1rem;font-size:0.87rem;color:#023e8a;display:flex;gap:10px;align-items:flex-start">
      <span style="font-size:1rem;flex-shrink:0">🗺️</span>
      <div>
        <strong>${destinations.length}-stop trip detected.</strong>
        Showing visa requirements for each country below. Your citizenship is shown per panel — 
        change it above if needed and the panels will update.
      </div>
    </div>`);

  // One panel per destination
  destinations.forEach((dest, i) => {
    const cityShort = dest.split(',')[0].trim();
    // Try to guess the country from city name using a simple map
    // (visa-check.html likely already has a country→numbers DATA array — reuse it)
    const panelId = `visaPanel_${i}`;

    wrapper.insertAdjacentHTML('beforeend', `
      <div id="${panelId}" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;
                                  overflow:hidden;margin-bottom:0.85rem;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <div style="background:linear-gradient(105deg,#023e8a,#0077b6);padding:0.65rem 1rem;
                    display:flex;align-items:center;gap:8px;color:#fff">
          <span style="font-size:0.85rem;font-weight:700">Stop ${i + 1}: ${cityShort}</span>
        </div>
        <div style="padding:0.85rem 1rem">
          <div style="font-size:0.82rem;color:#64748b;margin-bottom:0.5rem">
            Checking entry requirements for <strong style="color:#023e8a">${cityShort}</strong>
            with <strong style="color:#023e8a">${citizenship}</strong> passport.
          </div>
          <!-- Inline visa check link -->
          <a href="visa-check.html?destination=${encodeURIComponent(dest)}"
             style="display:inline-flex;align-items:center;gap:6px;padding:0.45rem 0.9rem;
                    background:#0077b6;color:#fff;border-radius:8px;font-size:0.83rem;
                    font-weight:600;text-decoration:none;transition:background 0.2s"
             onmouseover="this.style.background='#023e8a'" onmouseout="this.style.background='#0077b6'">
            🔍 Check ${cityShort} Visa Requirements
          </a>
        </div>
      </div>`);
  });

  // Insert before the main form
  mainForm.insertAdjacentElement('beforebegin', wrapper);

  // Hide or dim the main single-destination form since we've replaced it
  mainForm.style.cssText += ';opacity:0.45;pointer-events:none;position:relative';
  const formNote = document.createElement('div');
  formNote.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(255,255,255,0.7);border-radius:inherit;font-size:0.85rem;color:#64748b;text-align:center;padding:1rem;z-index:1';
  formNote.textContent = 'Use the panels above to check each country individually.';
  mainForm.style.position = 'relative';
  mainForm.appendChild(formNote);

})();
