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
  assert.strictEqual(url, 'https://pbojacnagutipfhcxltj.supabase.co');
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
  step('placeholder pages also require a session');

  assert.deepStrictEqual(errors, [], 'console errors: ' + errors.join(' | '));
  step('no console errors');
  await browser.close();
  console.log('ALL PASSED');
})().catch(async e => { console.error('FAILED:', e.message); process.exit(1); });
