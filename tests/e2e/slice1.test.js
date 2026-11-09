const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const BASE = 'http://127.0.0.1:8765';
const FAKE = path.join(__dirname, 'fake-supabase.js');
const OUT = process.env.E2E_OUT || require('os').tmpdir();

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/shared/vendor/supabase.min.js', r => r.fulfill({ path: FAKE, contentType: 'application/javascript' }));
  // Keep the run offline and deterministic: the Inter webfont is cosmetic.
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const step = (s) => console.log('✓ ' + s);
  // Fixed local time (a Wednesday) so the Nutrition week logic is deterministic.
  await page.clock.setFixedTime(new Date(2026, 10, 11, 12, 0, 0));

  // 1. Signed out → dashboard redirects to login with next
  await page.goto(BASE + '/core/dashboard/index.html');
  await page.waitForURL(/\/core\/auth\/login\.html\?next=/);
  assert.ok(page.url().includes('next=%2Fcore%2Fdashboard%2Findex.html'), page.url());
  step('signed-out dashboard redirects to login with next=' + new URL(page.url()).searchParams.get('next'));

  // 2. Wrong password
  await page.fill('#email', 'jimmy@example.com');
  await page.fill('#password', 'nope');
  await page.click('#submit');
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('gs-error'));
  assert.match(await page.textContent('#status'), /Invalid login credentials/);
  step('wrong password shows error and stays on login');

  // 3. Correct password → back to dashboard
  await page.fill('#password', 'pw');
  await page.click('#submit');
  await page.waitForURL(BASE + '/core/dashboard/index.html');
  await page.waitForFunction(() => document.querySelector('#household-name').textContent.length > 0);
  assert.strictEqual(await page.textContent('#household-name'), 'Lake House');
  assert.match(await page.textContent('#greeting'), /^Good (morning|afternoon|evening)$/);
  assert.strictEqual(await page.isVisible('#switcher-wrap'), true);
  await page.waitForSelector('#tasks li');
  assert.match(await page.textContent('#tasks'), /^No open tasks\./);
  assert.strictEqual(await page.evaluate(() => window.__createClientCalls), 1);
  const [url, key] = await page.evaluate(() => window.__createClientArgs);
  assert.strictEqual(url, 'https://nxgtefbqizvihwikqnaw.supabase.co');
  assert.ok(key.startsWith('eyJ'));
  step('login returns to dashboard; default household = first by name; one client from app-config values');

  // 4. Switch household → persists, shows open tasks only
  await page.selectOption('#switcher', 'h1');
  await page.waitForFunction(() => document.querySelector('#household-name').textContent === 'Nguyen Home');
  await page.waitForFunction(() => document.querySelector('#tasks li') && !/No open/.test(document.querySelector('#tasks').textContent));
  const tasks = await page.$$eval('#tasks li', lis => lis.map(li => li.textContent));
  assert.deepStrictEqual(tasks.length, 1);
  assert.match(tasks[0], /Change HVAC filter/);
  const ctx = await page.evaluate(() => JSON.parse(localStorage.getItem('fake-sb-db')).user_household_context);
  assert.deepStrictEqual(ctx.map(c => [c.user_id, c.household_id]), [['u1', 'h1']]);
  await page.screenshot({ path: path.join(OUT, 'dashboard.png'), fullPage: true });
  step('household switch saved to user_household_context; done tasks hidden');

  // 5. Grocery
  await page.click('a.gs-module[href="/modules/grocery/index.html"]');
  await page.waitForURL(BASE + '/modules/grocery/index.html');
  await page.waitForFunction(() => document.querySelector('#household-name').textContent === 'Nguyen Home');
  await page.waitForSelector('#items li');
  assert.strictEqual(await page.textContent('#items'), 'The list is empty.');
  const add = async (n, q) => { await page.fill('#item-name', n); await page.fill('#item-qty', q || ''); await page.click('#add-form button'); await page.waitForFunction(x => document.querySelector('#items').textContent.includes(x), n); };
  await add('Milk', '1 gal'); await add('Eggs', '12'); await add('Bread');
  assert.strictEqual(await page.textContent('#summary'), '3 to get · 0 checked');
  await page.check('input[aria-label="Got Milk"]');
  await page.waitForFunction(() => document.querySelector('#summary').textContent === '2 to get · 1 checked');
  const order = await page.$$eval('#items li .gs-grow', els => els.map(e => [e.textContent, e.classList.contains('gs-done')]));
  assert.deepStrictEqual(order, [['Eggs', false], ['Bread', false], ['Milk', true]]);
  assert.strictEqual(await page.isVisible('#clear-checked'), true);
  // empty name is not added
  await page.fill('#item-name', '   '); await page.click('#add-form button');
  assert.strictEqual((await page.$$('#items li')).length, 3);
  // XSS-ish name renders as text
  await add('<img src=x onerror=alert(1)>');
  assert.strictEqual(await page.$$eval('#items img', i => i.length), 0);
  await page.screenshot({ path: path.join(OUT, 'grocery.png'), fullPage: true });
  await page.click('#clear-checked');
  await page.waitForFunction(() => !document.querySelector('#items').textContent.includes('Milk'));
  await page.click('button[aria-label="Remove Eggs"]');
  await page.waitForFunction(() => !document.querySelector('#items').textContent.includes('Eggs'));
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('fake-sb-db')));
  assert.strictEqual(db.shopping_lists.length, 1);
  assert.strictEqual(db.shopping_lists[0].household_id, 'h1');
  assert.ok(db.shopping_items.every(i => i.household_id === 'h1' && i.shopping_list_id === db.shopping_lists[0].id));
  step('grocery: one list created per household; add/check/order/clear/remove work; markup in names stays text');

  // 6. Reload keeps the same list
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#items').textContent.includes('Bread'));
  assert.strictEqual((await page.evaluate(() => JSON.parse(localStorage.getItem('fake-sb-db')).shopping_lists.length)), 1);
  step('reload reuses the existing list');

  // 6b. Nutrition: preferences -> plan through the AI gateway -> saved -> grocery
  await page.goto(BASE + '/modules/nutrition/index.html');
  await page.waitForSelector('#prefs-panel:not([hidden])');
  await page.waitForFunction(() => /10 of 10 plans left today/.test(document.querySelector('#usage').textContent));
  assert.strictEqual(await page.getAttribute('#week-switch [data-week="this"]', 'aria-pressed'), 'true', 'midweek defaults to this week');
  assert.match(await page.textContent('#generate'), /Plan the week of Nov 9/);
  assert.strictEqual(await page.isVisible('#edit-prefs'), false, '"Change preferences" hidden while editing');
  await page.fill('#p-people', '4');
  await page.check('#p-cuisine input[value="Vietnamese"]');
  await page.check('#p-allergies input[value="shellfish"]');
  await page.click('#generate');
  await page.waitForSelector('#plan-view:not([hidden])');
  assert.strictEqual((await page.$$('#day-tabs .gs-day-tab')).length, 7);
  assert.strictEqual(await page.textContent('#day-tabs [aria-selected="true"]'), 'Wed 11', 'opens on today');
  assert.strictEqual((await page.$$('#meals .gs-meal')).length, 3);
  assert.strictEqual(await page.textContent('#grocery-title'), '5 items for the week');
  await page.click('#day-tabs [aria-label="Friday"]');
  await page.waitForFunction(() => /Shrimp/.test(document.querySelector('#meals').textContent));
  assert.match(await page.textContent('#meals .gs-meal-warning'), /may contain shrimp/);
  let fdb = await page.evaluate(() => JSON.parse(localStorage.getItem('fake-sb-db')));
  assert.strictEqual(fdb.household_meal_plans.length, 1);
  const hh = fdb.household_meal_plans[0].household_id;
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(fdb.household_meal_plans[0].week_start));
  assert.strictEqual(new Date(fdb.household_meal_plans[0].week_start + 'T00:00:00').getDay(), 1, 'week_start is a Monday');
  assert.deepStrictEqual(fdb.household_nutrition_prefs.map(p => [p.household_id, p.prefs.people, p.prefs.cuisine, p.prefs.allergies]),
    [[hh, 4, ['Vietnamese'], ['shellfish']]]);
  assert.strictEqual(fdb.gs_ai_usage.length, 1);
  await page.waitForFunction(() => /9 of 10 plans left today/.test(document.querySelector('#usage').textContent));
  step('nutrition: prefs saved per household, 7-day plan via gateway, one usage row, allergen flagged on the meal');

  await page.click('#add-grocery');
  await page.waitForFunction(() => /^Added \d+ items? to the grocery list/.test(document.querySelector('#grocery-status').textContent));
  const firstAdd = await page.textContent('#grocery-status');
  await page.click('#add-grocery');
  await page.waitForFunction(t => document.querySelector('#grocery-status').textContent !== t, firstAdd);
  assert.match(await page.textContent('#grocery-status'), /^Added 0 items to the grocery list\. 5 were already on it\./);
  fdb = await page.evaluate(() => JSON.parse(localStorage.getItem('fake-sb-db')));
  const names = fdb.shopping_items.filter(i => i.household_id === hh && !i.checked).map(i => i.name.toLowerCase());
  assert.strictEqual(names.length, new Set(names).size, 'no duplicate grocery items');
  step('nutrition -> grocery: ' + firstAdd.replace(/ Open the list.*/, '') + ' second add skips all 5');

  await page.reload();
  await page.waitForSelector('#plan-view:not([hidden])');

  // Sunday: the page opens on next week (no plan yet); "This week" still shows the saved plan.
  await page.clock.setFixedTime(new Date(2026, 10, 15, 18, 0, 0));
  await page.reload();
  await page.waitForSelector('#prefs-panel:not([hidden])');
  assert.strictEqual(await page.getAttribute('#week-switch [data-week="next"]', 'aria-pressed'), 'true', 'Sunday defaults to next week');
  assert.match(await page.textContent('#week-switch [data-week="next"]'), /Nov 16/);
  assert.match(await page.textContent('#generate'), /Plan the week of Nov 16/);
  assert.strictEqual(await page.inputValue('#p-people'), '4', 'saved preferences prefilled');
  await page.click('#week-switch [data-week="this"]');
  await page.waitForSelector('#plan-view:not([hidden])');
  assert.strictEqual(await page.textContent('#day-tabs [aria-selected="true"]'), 'Sun 15');
  assert.strictEqual(await page.textContent('#plan-week'), 'Week of November 9');
  await page.click('#week-switch [data-week="next"]');
  await page.waitForSelector('#prefs-panel:not([hidden])');
  step('week switch: midweek plans this week, Sunday opens next week; saved week reachable with "This week"');
  await page.clock.setFixedTime(new Date(2026, 10, 11, 12, 0, 0));

  await page.goto(BASE + '/core/dashboard/index.html');
  await page.waitForFunction(() => /Tonight: /.test(document.querySelector('#brief-lines').textContent));
  assert.strictEqual(await page.textContent('#nutrition-pill'), 'Planned');
  step('plan persists on reload; dashboard briefing shows tonight’s dinner');

  // 6c. Invite flow: owner creates a link, invitee joins, link is single-use.
  await page.goto(BASE + '/core/settings/index.html');
  await page.waitForSelector('#members li');
  assert.strictEqual(await page.isVisible('#invite-panel'), true, 'owner sees the invite form');
  assert.strictEqual(await page.textContent('#member-count'), '1 member');
  await page.fill('#i-email', 'not-an-email');
  await page.click('#invite-btn');
  await page.waitForFunction(() => /valid|Enter their email/.test(document.querySelector('#status').textContent));
  await page.fill('#i-name', 'Lan');
  await page.fill('#i-email', 'Lan@Example.com');
  await page.click('#invite-btn');
  await page.waitForSelector('#invite-result:not([hidden])');
  assert.match(await page.textContent('#invite-result-title'), /^Invitation sent to Lan/);
  assert.strictEqual(await page.isVisible('#invite-link-row'), false, 'link hidden when the email went out');
  await page.click('#show-link');
  assert.strictEqual(await page.isVisible('#invite-link-row'), true);
  const inviteLink = await page.inputValue('#invite-link');
  assert.match(inviteLink, /\/core\/auth\/invite\.html#t=/, 'token travels in the fragment');
  assert.match(await page.textContent('#pending'), /lan@example\.com/);
  await page.evaluate(() => { const d = window.__fakeDb.load(); d.session = null; window.__fakeDb.save(d); });
  await page.goto(inviteLink);
  await page.waitForSelector('#join:not([hidden])');
  assert.match(await page.textContent('#join-title'), /^Join /);
  assert.strictEqual(await page.inputValue('#email'), 'lan@example.com');
  assert.strictEqual(await page.inputValue('#name'), 'Lan');
  await page.fill('#password', 'short');
  await page.fill('#password2', 'short');
  await page.click('#join-btn');
  await page.waitForFunction(() => /at least 10/.test(document.querySelector('#join-status').textContent));
  await page.fill('#password', 'blue house 42');
  await page.fill('#password2', 'blue house 4');
  await page.click('#join-btn');
  await page.waitForFunction(() => /don’t match/.test(document.querySelector('#join-status').textContent));
  await page.fill('#password2', 'blue house 42');
  await page.click('#join-btn');
  await page.waitForURL(BASE + '/core/dashboard/index.html');
  await page.goto(BASE + '/core/settings/index.html');
  await page.waitForFunction(() => document.querySelectorAll('#members li').length === 2);
  assert.strictEqual(await page.isVisible('#invite-panel'), false, 'members do not see the invite form');
  assert.strictEqual(await page.isVisible('#member-note'), true);
  await page.evaluate(() => { const d = window.__fakeDb.load(); d.session = null; window.__fakeDb.save(d); });
  await page.goto(BASE + '/core/auth/login.html');
  await page.goto(inviteLink);
  await page.waitForSelector('#invalid:not([hidden])');
  assert.match(await page.textContent('#invalid-reason'), /already been used/);
  await page.goto(BASE + '/core/auth/invite.html');
  await page.waitForSelector('#invalid:not([hidden])');
  assert.match(await page.textContent('#invalid-reason'), /incomplete/);
  // Forgot password -> reset email requested; reset page sets a new password.
  await page.goto(BASE + '/core/auth/login.html');
  await page.fill('#email', 'lan@example.com');
  await page.click('#forgot-link');
  await page.waitForURL(/forgot\.html\?email=lan%40example\.com/);
  assert.strictEqual(await page.inputValue('#email'), 'lan@example.com');
  await page.click('#submit');
  await page.waitForSelector('#sent:not([hidden])');
  assert.deepStrictEqual(await page.evaluate(() => window.__fakeDb.load().resetRequests), ['lan@example.com']);
  await page.goto(BASE + '/core/auth/reset.html#error=access_denied&error_code=otp_expired');
  await page.waitForSelector('#invalid:not([hidden])');
  await page.evaluate(() => { const d = window.__fakeDb.load(); const u = d.users.find(x => x.email === 'lan@example.com'); d.session = { user: { id: u.id, email: u.email } }; window.__fakeDb.save(d); });
  await page.goto('about:blank');
  await page.goto(BASE + '/core/auth/reset.html#access_token=x&type=recovery');
  await page.waitForSelector('#choose:not([hidden])');
  assert.strictEqual(await page.textContent('#who'), 'lan@example.com');
  await page.fill('#password', 'new phrase 2026'); await page.fill('#password2', 'new phrase 2026');
  await page.click('#submit');
  await page.waitForURL(BASE + '/core/dashboard/index.html');
  assert.strictEqual(await page.evaluate(() => window.__fakeDb.load().users.find(x => x.email === 'lan@example.com').password), 'new phrase 2026');
  step('forgot password: reset email requested from login; expired link refused; new password saved');

  // Back to the owner for the remaining steps.
  await page.evaluate(() => { const d = window.__fakeDb.load(); d.session = { user: { id: 'u1', email: 'jimmy@example.com' } }; window.__fakeDb.save(d); });
  step('invite: owner creates a one-time link, invitee sets a password and joins as member; link cannot be reused');

  // 7. Signed-in user on login page is forwarded; open redirect blocked
  for (const bad of ['//evil.example.com/x', '/\\evil.example.com/x', '/%09/evil.example.com/x']) {
    await page.goto(BASE + '/core/auth/login.html?next=' + bad);
    await page.waitForURL(BASE + '/core/dashboard/index.html');
  }
  await page.goto(BASE + '/core/auth/login.html?next=/modules/grocery/index.html');
  await page.waitForURL(BASE + '/modules/grocery/index.html');
  step('login forwards signed-in users; //, /\\ and tab-prefixed next ignored, same-site next honoured');

  // 8. App shell on every Core and module page
  const shellPages = [
    ['/core/dashboard/index.html', 'Dashboard'], ['/modules/grocery/index.html', 'Grocery'],
    ['/modules/nutrition/index.html', 'Nutrition'], ['/modules/home/index.html', 'Home'],
    ['/core/tasks/index.html', 'Tasks'], ['/core/notifications/index.html', null],
    ['/core/settings/index.html', null]
  ];
  for (const [url, activeLabel] of shellPages) {
    await page.goto(BASE + url);
    await page.waitForSelector('.gs-topbar .gs-account-btn');
    assert.strictEqual(page.url(), BASE + url, 'shell page redirected: ' + url);
    const active = await page.$$eval('.gs-topnav [aria-current="page"]', els => els.map(e => e.textContent));
    assert.deepStrictEqual(active, activeLabel ? [activeLabel] : [], 'active nav on ' + url);
  }
  step('shell mounts on all 7 Core/module pages with the right active item');

  await page.goto(BASE + '/core/dashboard/index.html');
  await page.waitForFunction(() => document.querySelector('.gs-avatar').textContent === 'J');
  assert.strictEqual(await page.isVisible('#gs-account-menu'), false);
  await page.click('.gs-account-btn');
  assert.strictEqual(await page.getAttribute('.gs-account-btn', 'aria-expanded'), 'true');
  assert.strictEqual(await page.textContent('.gs-account-who'), 'jimmy@example.com');
  await page.keyboard.press('Escape');
  assert.strictEqual(await page.isVisible('#gs-account-menu'), false);
  step('account menu shows the signed-in email, opens and closes with Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.strictEqual(await page.isVisible('.gs-bottomnav'), true);
  assert.strictEqual(await page.isVisible('.gs-topnav'), false);
  assert.strictEqual(await page.$$eval('.gs-bottomnav a', els => els.length), 5);
  await page.screenshot({ path: path.join(OUT, 'shell-mobile.png') });
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.screenshot({ path: path.join(OUT, 'shell-desktop.png') });
  step('phone width swaps the top nav for a 5-item bottom bar');

  // 8b. Home Genie -> Core tasks -> dashboard
  await page.goto(BASE + '/modules/home/index.html');
  await page.waitForSelector('#asset-form');
  await page.fill('#as-name', 'Main house');
  await page.click('#as-btn');
  await page.waitForSelector('#setup-panel:not([hidden])');
  const setupRows = await page.$$('#setup-list li');
  await (await setupRows[0].$('[data-role=last]')).selectOption('400');
  await page.click('#start-btn');
  await page.waitForFunction(() => /Main house is set up/.test(document.querySelector('#status').textContent));
  assert.ok(await page.$$eval('.gs-asset li.gs-upkeep', els => els.length) >= 1, 'house has items');

  await page.click('#kind [data-kind=vehicle]');
  await page.fill('#as-name', 'F-150');
  await page.fill('#as-desc', '2021 Ford F-150');
  await page.selectOption('#as-usage', 'business');
  await page.fill('#as-owner', 'Victoria Nails');
  await page.click('#as-btn');
  await page.waitForSelector('#setup-panel:not([hidden]) [data-role=expires]');
  const regRow = await page.$('#setup-list li:has-text("Registration")');
  const expiry = await regRow.$eval('[data-role=expires]', s => s.options[1].value);
  await (await regRow.$('[data-role=expires]')).selectOption(expiry);
  await page.click('#start-btn');
  await page.waitForFunction(() => /F-150 is set up/.test(document.querySelector('#status').textContent));
  assert.ok(/Business · Victoria Nails/.test(await page.textContent('.gs-asset:has-text("F-150") .gs-asset-sub')), 'business label');
  await page.waitForSelector('#filter:not([hidden])');
  await page.click('#filter button:has-text("Business")');
  assert.strictEqual(await page.$$eval('.gs-asset', els => els.length), 1, 'filter shows business only');
  const homeTasks = await page.evaluate(() => window.__fakeDb.load().household_tasks.filter(t => t.source_module === "home").map(t => t.title));
  assert.ok(homeTasks.some(t => / · Main house$/.test(t)), "house task names the house: " + homeTasks.join(", "));
  assert.ok(homeTasks.some(t => t === "Registration / plate sticker · F-150"), "registration expiring this month gets a task: " + homeTasks.join(", "));
  step('Home: a house and a business vehicle, renewal by expiry month, tasks name the asset, filter by use');

  await page.goto(BASE + '/core/tasks/index.html');
  await page.waitForSelector('#open .gs-task');
  assert.ok(await page.$('#open .gs-task .gs-task-source'), 'home task shows its source pill');
  await page.fill('#t-title', 'Book window cleaning');
  await page.click('#add-btn');
  await page.waitForFunction(() => /Added: Book/.test(document.querySelector('#status').textContent));
  const homeBox = await page.$('#open .gs-task:has(.gs-task-source) input[type=checkbox]');
  await homeBox.click();
  await page.waitForFunction(() => /Home Genie scheduled the next one/.test(document.querySelector('#status').textContent));
  await page.waitForSelector('#done-panel:not([hidden]) #done .gs-task');
  step('Tasks page: manual add, Home task completes and reschedules');

  await page.goto(BASE + '/core/dashboard/index.html');
  await page.waitForFunction(() => /Upkeep: 1 home · 1 vehicle/.test(document.body.textContent));
  assert.notStrictEqual(await page.textContent('#home-pill'), 'Not set up');
  step('dashboard shows live upkeep for homes and vehicles');

  // 8c. Notifications: assigning someone else notifies them, not you; inbox, badge, prefs, test summary.
  await page.evaluate(() => {
    const d = window.__fakeDb.load();
    const hid = d.household_members.find(m => m.user_id === 'u1').household_id;
    d.household_members.push({ household_id: hid, user_id: 'u7', role: 'member', email: 'jenny@example.com', display_name: 'Jenny', created_at: '2026-11-01T00:00:00Z' });
    d.household_notifications.push({ id: 'n-seed', household_id: hid, user_id: 'u1', source_module: 'tasks', kind: 'task_assigned',
      title: 'Jenny assigned you: Call the plumber', body: 'Due Wed, Nov 12', link: '/core/tasks/index.html', ref: 'assign:x', read_at: null, created_at: new Date().toISOString() });
    window.__fakeDb.save(d);
  });
  await page.goto(BASE + '/core/tasks/index.html');
  await page.waitForSelector('#open .gs-task');
  await page.waitForFunction(() => { const b = document.querySelector('.gs-badge'); return b && !b.hidden && b.textContent === '1'; });
  const firstWho = await page.$('#open .gs-task select.gs-task-who');
  await firstWho.selectOption('u7');
  await page.waitForFunction(() => window.__fakeDb.load().household_notifications.some(n => n.user_id === 'u7' && n.kind === 'task_assigned'));
  assert.strictEqual(await page.evaluate(() => window.__fakeDb.load().household_notifications.filter(n => n.user_id === 'u1').length), 1, 'assigning someone else does not notify you');
  step('assigning a task notifies the assignee; avatar shows 1 unread');

  await page.click('.gs-account-btn');
  await page.click('#gs-account-menu a:has-text("Notifications")');
  await page.waitForURL(BASE + '/core/notifications/index.html');
  await page.waitForSelector('#inbox .gs-note-unread');
  assert.strictEqual(await page.$$eval('#inbox .gs-note', els => els.length), 1, 'only my notifications are listed');
  await page.click('#read-all');
  await page.waitForSelector('#inbox .gs-note:not(.gs-note-unread)');
  await page.waitForFunction(() => document.querySelector('.gs-badge').hidden);
  await page.waitForSelector('#p-weekly:not([disabled])');
  await page.click('label.gs-pref:has(#p-weekly)');
  await page.waitForFunction(() => /Weekly summary off/.test(document.querySelector('#status').textContent));
  await page.reload();
  await page.waitForSelector('#p-weekly:not([disabled])');
  assert.strictEqual(await page.isChecked('#p-weekly'), false, 'weekly summary preference saved');
  assert.strictEqual(await page.isChecked('#p-assigned'), true);
  await page.click('#test-btn');
  await page.waitForFunction(() => /Sent to jimmy@example\.com/.test(document.querySelector('#test-note').textContent));
  step('Notifications: inbox, mark all read clears the badge, email prefs persist, test summary sends');

  // 9. Sign out from the shell
  await page.click('.gs-account-btn');
  await page.click('#gs-account-menu button:has-text("Sign out")');
  await page.waitForURL(/\/core\/auth\/login\.html/);
  await page.goto(BASE + '/modules/grocery/index.html');
  await page.waitForURL(/\/core\/auth\/login\.html\?next=%2Fmodules%2Fgrocery%2Findex\.html/);
  step('sign out → login; grocery requires a session');
  for (const url of ['/core/tasks/index.html', '/modules/home/index.html']) {
    await page.goto(BASE + url);
    await page.waitForURL(/\/core\/auth\/login\.html\?next=/);
  }
  step('Tasks and Home require a session');

  assert.deepStrictEqual(errors, [], 'console errors: ' + errors.join(' | '));
  step('no console errors');
  await browser.close();
  console.log('ALL PASSED');
})().catch(async e => { console.error('FAILED:', e.message); process.exit(1); });
