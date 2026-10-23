/**
 * GenieSphere app shell: top bar, account menu and phone bottom bar.
 *
 * Use on Core and module pages, after the canonical scripts:
 *   supabase.min.js -> app-config.js -> gs-client.js -> gs-auth.js -> gs-shell.js
 * and mark the page:
 *   <body data-gs-shell="grocery">   (the key of the active nav item)
 *
 * The shell only displays navigation and who is signed in. Pages still guard
 * themselves with GenieSphere.auth.requireSession(). Styles: /shared/css/app.css.
 */
(function () {
  window.GenieSphere = window.GenieSphere || {};

  var NAV = [
    { key: 'dashboard', label: 'Dashboard', href: '/core/dashboard/index.html', icon: 'grid' },
    { key: 'grocery', label: 'Grocery', href: '/modules/grocery/index.html', icon: 'cart' },
    { key: 'nutrition', label: 'Nutrition', href: '/modules/nutrition/index.html', icon: 'leaf' },
    { key: 'home', label: 'Home', href: '/modules/home/index.html', icon: 'house' },
    { key: 'tasks', label: 'Tasks', href: '/core/tasks/index.html', icon: 'list' }
  ];

  var ACCOUNT_LINKS = [
    { key: 'notifications', label: 'Notifications', href: '/core/notifications/index.html' },
    { key: 'settings', label: 'Settings', href: '/core/settings/index.html' }
  ];

  var ICONS = {
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    cart: 'M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9.5 20h.01M16.5 20h.01',
    leaf: 'M5 19C5 11 11 5 20 5c0 9-6 15-14 15M5 19l7-7',
    house: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
    list: 'M10 6h10M10 12h10M10 18h10M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
    wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    check: 'M4 12l5 5L20 6'
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      if (name === 'text') node.textContent = attrs[name];
      else node.setAttribute(name, attrs[name]);
    });
    (children || []).forEach(function (child) { node.appendChild(child); });
    return node;
  }

  function icon(name) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'gs-icon');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  function navLink(item, active) {
    var link = el('a', { href: item.href, class: 'gs-nav-link' });
    if (item.key === active) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
    link.appendChild(icon(item.icon));
    link.appendChild(el('span', { text: item.label }));
    return link;
  }

  function accountMenu(active) {
    var wrap = el('div', { class: 'gs-account' });
    var button = el('button', {
      type: 'button', class: 'gs-account-btn',
      'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'gs-account-menu',
      'aria-label': 'Account menu'
    });
    var initial = el('span', { class: 'gs-avatar', 'aria-hidden': 'true', text: '·' });
    var label = el('span', { class: 'gs-account-label', text: 'Account' });
    button.appendChild(initial);
    button.appendChild(label);

    var menu = el('div', { id: 'gs-account-menu', class: 'gs-account-menu', hidden: '' });
    var who = el('p', { class: 'gs-account-who', text: 'Checking your session…' });
    menu.appendChild(who);
    ACCOUNT_LINKS.forEach(function (item) {
      var link = el('a', { href: item.href, class: 'gs-menu-item', text: item.label });
      if (item.key === active) link.setAttribute('aria-current', 'page');
      menu.appendChild(link);
    });
    var signOut = el('button', { type: 'button', class: 'gs-menu-item', text: 'Sign out', hidden: '' });
    menu.appendChild(signOut);

    function setOpen(open) {
      menu.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    }
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      setOpen(menu.hidden);
    });
    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !menu.hidden) { setOpen(false); button.focus(); }
    });
    signOut.addEventListener('click', function () {
      signOut.disabled = true;
      window.GenieSphere.auth.signOut().catch(function (err) {
        signOut.disabled = false;
        who.textContent = err.message || 'Could not sign out. Try again.';
      });
    });

    // Fill in who is signed in. A failure here must not break the page.
    Promise.resolve()
      .then(function () { return window.GenieSphere.auth.session(); })
      .then(function (session) {
        var email = session && session.user && session.user.email;
        if (!email) {
          who.textContent = 'You are not signed in.';
          var next = window.location.pathname + window.location.search;
          var login = el('a', {
            href: '/core/auth/login.html?next=' + encodeURIComponent(next),
            class: 'gs-menu-item', text: 'Log in'
          });
          menu.insertBefore(login, who.nextSibling);
          label.textContent = 'Log in';
          return;
        }
        who.textContent = email;
        initial.textContent = email.charAt(0).toUpperCase();
        label.textContent = email.split('@')[0];
        button.setAttribute('aria-label', 'Account menu for ' + email);
        signOut.hidden = false;
      })
      .catch(function () {
        who.textContent = 'Could not check your session.';
      });

    wrap.appendChild(button);
    wrap.appendChild(menu);
    return wrap;
  }

  function mount(active) {
    if (document.querySelector('.gs-topbar')) return;

    var brand = el('a', { href: '/core/dashboard/index.html', class: 'gs-topbar-brand', 'aria-label': 'GenieSphere dashboard' }, [
      el('img', { src: '/shared/assets/logo/geniesphere_logo_name.png', alt: 'GenieSphere', width: '146', height: '36' })
    ]);
    var topNav = el('nav', { class: 'gs-topnav', 'aria-label': 'Main' });
    NAV.forEach(function (item) { topNav.appendChild(navLink(item, active)); });

    var header = el('header', { class: 'gs-topbar' }, [
      el('div', { class: 'gs-topbar-inner' }, [brand, topNav, accountMenu(active)])
    ]);

    var bottomNav = el('nav', { class: 'gs-bottomnav', 'aria-label': 'Main' });
    NAV.forEach(function (item) { bottomNav.appendChild(navLink(item, active)); });

    document.body.insertBefore(header, document.body.firstChild);
    document.body.appendChild(bottomNav);
    document.body.classList.add('gs-has-shell');
  }

  window.GenieSphere.shell = { mount: mount, nav: NAV, icon: icon, fillIcons: fillIcons };

  // Fill <span data-gs-icon="cart"></span> placeholders with the shared icons.
  function fillIcons(root) {
    (root || document).querySelectorAll('[data-gs-icon]').forEach(function (node) {
      var name = node.getAttribute('data-gs-icon');
      if (ICONS[name] && !node.firstChild) node.appendChild(icon(name));
    });
  }

  function autoMount() {
    var active = document.body.getAttribute('data-gs-shell');
    if (active !== null) mount(active);
    fillIcons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
