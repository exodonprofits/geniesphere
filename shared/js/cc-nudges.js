/**
 * cc-nudges.js — Credit Card Genie: Agentic Nudges Engine
 * GenieSphere | Phase 1
 *
 * What it does:
 *   1. Reads cards + transactions + reward rules from Supabase + localStorage
 *   2. Generates prioritized nudge objects (due dates, missed rewards,
 *      utilization alerts, 5% quarter windows, annual fees)
 *   3. Writes to:
 *        - localStorage  gs_cc_nudges_v1:<userId>   (CC Hub consumes this)
 *        - localStorage  gs_household_reminders_v1  (Household Quick Peek consumes this)
 *
 * Usage (call from any CC page after data loads):
 *   await CCNudges.run({ client, userId, cards, txns });
 *
 * The household page already listens for storage events on
 * gs_household_reminders_v1 and re-renders automatically.
 */

const CCNudges = (function () {

  // ── Storage keys ──────────────────────────────────────────────
  const NUDGES_KEY_PREFIX    = 'gs_cc_nudges_v1:';
  const HOUSEHOLD_KEY        = 'gs_household_reminders_v1';
  const RULES_KEY_PREFIX     = 'gs_cc_rules_v1:';
  const NUDGE_TTL_MS         = 4 * 60 * 60 * 1000; // re-run at most every 4 hrs

  // ── Chase Freedom / Discover 5% rotating categories (sample) ──
  // Format: { q: 1|2|3|4, year: 2026, categories: [...], cards: ['freedom','discover'] }
  // You can extend this array each year. Cards matched by card_name substring.
  const ROTATING_QUARTERS = [
    { q: 1, year: 2026, months: [1,2,3],  categories: ['Grocery Stores', 'Drug Stores', 'Exxon', 'Mobil'],           cards: ['freedom','discover'] },
    { q: 2, year: 2026, months: [4,5,6],  categories: ['Gas Stations', 'Home Improvement', 'EV Charging'],            cards: ['freedom','discover'] },
    { q: 3, year: 2026, months: [7,8,9],  categories: ['Restaurants', 'PayPal', 'Wholesalers'],                       cards: ['freedom','discover'] },
    { q: 4, year: 2026, months: [10,11,12],categories: ['Amazon', 'Walmart', 'Target', 'PayPal'],                     cards: ['freedom','discover'] },
  ];

  // ── Helpers ────────────────────────────────────────────────────
  function safe(fn, fallback) {
    try { return fn(); } catch (_) { return fallback; }
  }

  function readJSON(key) {
    return safe(() => JSON.parse(localStorage.getItem(key) || 'null'), null);
  }

  function writeJSON(key, val) {
    safe(() => localStorage.setItem(key, JSON.stringify(val)));
  }

  function money(n) {
    return Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  function isoToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  // Compute the next due date for a card (same logic as tracker page)
  function nextDueDate(card) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (card.due_date || card.next_due_date) {
      const raw = card.due_date || card.next_due_date;
      const d = new Date(raw + 'T00:00:00');
      if (!isNaN(d)) return d;
    }

    const day = Number(card.due_day);
    if (!Number.isFinite(day) || day <= 0) return null;

    const y = today.getFullYear();
    const m = today.getMonth();
    const clamp = (yr, mo, dd) => {
      const dt = new Date(yr, mo, dd);
      return dt.getMonth() !== mo ? new Date(yr, mo + 1, 0) : dt;
    };
    let due = clamp(y, m, day);
    if (due < today) due = clamp(y, m + 1, day);
    return due;
  }

  // ── Reward rule reader (mirrors rewards page) ──────────────────
  function readRules(userId) {
    const key = RULES_KEY_PREFIX + (userId || 'anon');
    return safe(() => JSON.parse(localStorage.getItem(key) || '{}'), {});
  }

  function getRate(rules, cardId, catKey) {
    const byCard = rules[cardId] || {};
    const specific = Number(byCard[catKey]);
    if (Number.isFinite(specific) && specific > 0) return specific / 100;
    const other = Number(byCard['other']);
    if (Number.isFinite(other) && other > 0) return other / 100;
    return 0.02;
  }

  function normalizeCategory(raw) {
    const s = String(raw || '').trim().toLowerCase();
    const map = [
      ['dining',    ['restaurant','dining','food','cafe','coffee']],
      ['grocery',   ['grocery','supermarket','market','costco','walmart','target']],
      ['gas',       ['gas','fuel','shell','exxon','chevron','bp']],
      ['travel',    ['travel','airline','hotel','uber','lyft','rental','booking']],
      ['amazon',    ['amazon','amzn']],
      ['drugstore', ['drug','pharmacy','cvs','walgreens']],
      ['streaming', ['netflix','spotify','hulu','disney','streaming']],
      ['online',    ['online','shop','ecommerce','etsy','ebay']],
    ];
    for (const [key, words] of map) {
      if (words.some(w => s.includes(w))) return key;
    }
    return s || 'other';
  }

  function bestCardRate(rules, cards, catKey) {
    let best = null;
    for (const c of cards) {
      const r = getRate(rules, c.id, catKey);
      if (!best || r > best.rate) best = { card: c, rate: r };
    }
    return best;
  }

  // ── Nudge factories ────────────────────────────────────────────

  /**
   * Priority levels:
   *   1 = critical  (due today / overdue)
   *   2 = urgent    (due in 1-3 days)
   *   3 = important (due in 4-7 days / high utilization / annual fee soon)
   *   4 = info      (missed rewards / 5% quarter reminder)
   *   5 = tip       (low-priority suggestions)
   */

  function makeDueNudges(cards) {
    const nudges = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const card of cards) {
      if (card.is_active === false) continue;
      const due = nextDueDate(card);
      if (!due) continue;

      const diff = daysBetween(today, due);
      if (diff > 14) continue; // only surface within 2 weeks

      const name  = card.card_name || card.nickname || 'Card';
      const minDue = Number(card.minimum_due || card.minimum_payment || 0);
      const bal    = Number(card.balance || card.statement_balance || 0);
      const amount = minDue > 0 ? minDue : bal;
      const dueStr = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      let priority, headline, detail, emoji;
      if (diff <= 0) {
        priority = 1; emoji = '🚨';
        headline = `${name} payment is due TODAY`;
        detail   = amount > 0 ? `Minimum due: ${money(amount)}` : 'Check your statement amount.';
      } else if (diff <= 3) {
        priority = 2; emoji = '⏰';
        headline = `${name} due in ${diff} day${diff > 1 ? 's' : ''} (${dueStr})`;
        detail   = amount > 0 ? `Min due: ${money(amount)}` : 'Amount unknown — check statement.';
      } else {
        priority = 3; emoji = '📅';
        headline = `${name} due ${dueStr}`;
        detail   = amount > 0 ? `Min due: ${money(amount)}` : '';
      }

      nudges.push({
        id:       `due_${card.id}`,
        type:     'due_date',
        priority,
        emoji,
        headline,
        detail,
        cardId:   card.id,
        cardName: name,
        dueDate:  due.toISOString().slice(0, 10),
        amount,
        action:   { label: '💳 View Card', href: '/household/credit-card-tracker.html' },
        createdAt: new Date().toISOString(),
      });
    }
    return nudges;
  }

  function makeUtilNudges(cards) {
    const nudges = [];
    for (const card of cards) {
      const bal = Number(card.balance || card.current_balance || 0);
      const lim = Number(card.credit_limit || card.limit || 0);
      if (!lim || !Number.isFinite(bal)) continue;

      const util = bal / lim;
      if (util < 0.5) continue; // only nudge when >= 50%

      const name = card.card_name || card.nickname || 'Card';
      const pct  = Math.round(util * 100);

      let priority, emoji, headline, detail;
      if (util >= 0.9) {
        priority = 2; emoji = '🔴';
        headline = `${name} is at ${pct}% utilization — very high`;
        detail   = `Balance ${money(bal)} of ${money(lim)} limit. High utilization can hurt your credit score.`;
      } else if (util >= 0.7) {
        priority = 3; emoji = '🟡';
        headline = `${name} at ${pct}% utilization`;
        detail   = `Balance ${money(bal)} of ${money(lim)} limit. Aim to stay under 30% for best credit health.`;
      } else {
        priority = 4; emoji = '🟠';
        headline = `${name} at ${pct}% utilization`;
        detail   = `Consider a payment before your statement closes.`;
      }

      nudges.push({
        id:       `util_${card.id}`,
        type:     'utilization',
        priority,
        emoji,
        headline,
        detail,
        cardId:   card.id,
        cardName: name,
        utilPct:  pct,
        action:   { label: '📊 View Rewards', href: '/household/credit-card-rewards.html' },
        createdAt: new Date().toISOString(),
      });
    }
    return nudges;
  }

  function makeMissedRewardsNudges(cards, txns, rules) {
    if (!txns.length || !cards.length) return [];

    const now       = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Only look at this month's charges
    const charges = txns.filter(t => {
      const d = new Date(t.posted_date + 'T00:00:00');
      return d >= startMonth && d <= now && Number(t.amount) > 0 && t.credit_card_id;
    });

    if (!charges.length) return [];

    let totalMissed = 0;
    let missedCount = 0;

    for (const t of charges) {
      const cat      = normalizeCategory(t.category || t.description);
      const usedRate = getRate(rules, t.credit_card_id, cat);
      const best     = bestCardRate(rules, cards, cat);
      if (!best || !best.card) continue;
      if (best.card.id !== t.credit_card_id && best.rate > usedRate) {
        const delta = Number(t.amount) * (best.rate - usedRate);
        totalMissed += delta;
        missedCount++;
      }
    }

    if (totalMissed < 1) return []; // not worth surfacing under $1

    return [{
      id:       'missed_rewards_mtd',
      type:     'missed_rewards',
      priority: 4,
      emoji:    '💸',
      headline: `${money(totalMissed)} in missed rewards this month`,
      detail:   `${missedCount} transaction${missedCount > 1 ? 's' : ''} used a lower-earning card. See which card to use per category.`,
      totalMissed,
      missedCount,
      action:   { label: '🏷️ Best Card', href: '/household/credit-card-optimizer.html' },
      createdAt: new Date().toISOString(),
    }];
  }

  function makeRotatingQuarterNudges(cards) {
    if (!cards.length) return [];

    const today = new Date();
    const nudges = [];

    for (const q of ROTATING_QUARTERS) {
      const monthsInQ = q.months; // e.g. [4,5,6] for Q2
      const currentMonth = today.getMonth() + 1; // 1-indexed

      // Is this quarter active right now?
      const isActive = q.year === today.getFullYear() && monthsInQ.includes(currentMonth);

      // Is this quarter starting within the next 14 days?
      const qStartDate = new Date(q.year, monthsInQ[0] - 1, 1);
      const daysToStart = daysBetween(today, qStartDate);
      const isUpcoming = daysToStart > 0 && daysToStart <= 14;

      if (!isActive && !isUpcoming) continue;

      // Do any of the user's cards match?
      const matchedCards = cards.filter(c => {
        const name = (c.card_name || c.nickname || '').toLowerCase();
        return q.cards.some(k => name.includes(k));
      });
      if (!matchedCards.length) continue;

      const cardNames = matchedCards.map(c => c.card_name || c.nickname).join(', ');
      const catList   = q.categories.slice(0, 3).join(', ');

      if (isActive) {
        nudges.push({
          id:       `rotating_active_${q.year}_q${q.q}`,
          type:     'rotating_quarter',
          priority: 3,
          emoji:    '🔄',
          headline: `5% quarter is active — ${catList}`,
          detail:   `Use ${cardNames} for ${catList} through ${new Date(q.year, monthsInQ[monthsInQ.length - 1], 0).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Remember to activate it!`,
          action:   { label: '🏷️ Best Card', href: '/household/credit-card-optimizer.html' },
          createdAt: new Date().toISOString(),
        });
      } else if (isUpcoming) {
        nudges.push({
          id:       `rotating_upcoming_${q.year}_q${q.q}`,
          type:     'rotating_quarter',
          priority: 4,
          emoji:    '📆',
          headline: `5% quarter starts in ${daysToStart} day${daysToStart > 1 ? 's' : ''}`,
          detail:   `${cardNames}: ${catList} will earn 5% starting ${qStartDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Activate early!`,
          action:   { label: '🏷️ Best Card', href: '/household/credit-card-optimizer.html' },
          createdAt: new Date().toISOString(),
        });
      }
    }
    return nudges;
  }

  function makeAnnualFeeNudges(cards) {
    const nudges = [];
    for (const card of cards) {
      // Look for annual_fee_date or annual_fee_month columns (if they exist)
      const feeDate = card.annual_fee_date || card.fee_date || null;
      if (!feeDate) continue;

      const fee  = Number(card.annual_fee || card.annual_fee_amount || 0);
      const name = card.card_name || card.nickname || 'Card';
      const d    = new Date(feeDate + 'T00:00:00');
      if (isNaN(d)) continue;

      const diff = daysBetween(new Date(), d);
      if (diff < 0 || diff > 30) continue;

      nudges.push({
        id:       `annual_fee_${card.id}`,
        type:     'annual_fee',
        priority: diff <= 7 ? 2 : 3,
        emoji:    '💳',
        headline: `${name} annual fee in ${diff} day${diff !== 1 ? 's' : ''}${fee ? ` — ${money(fee)}` : ''}`,
        detail:   `Review if the card's benefits still justify the fee. Cancel or downgrade before the charge posts.`,
        cardId:   card.id,
        cardName: name,
        feeAmount: fee,
        action:   { label: '💳 View Cards', href: '/household/credit-card-tracker.html' },
        createdAt: new Date().toISOString(),
      });
    }
    return nudges;
  }

  // ── Household reminders bridge ─────────────────────────────────
  // Merges CC nudges into the household reminders key so the
  // household Quick Peek "Bills due soon" and badge pills update
  // automatically via the storage event listener.

  function bridgeToHousehold(nudges) {
    const existing = safe(
      () => JSON.parse(localStorage.getItem(HOUSEHOLD_KEY) || '[]'),
      []
    );

    // Remove old CC-sourced entries (prefixed with cc_)
    const filtered = existing.filter(r => !String(r.id || '').startsWith('cc_'));

    // Add new CC entries
    const ccEntries = nudges
      .filter(n => ['due_date', 'annual_fee'].includes(n.type))
      .map(n => ({
        id:      'cc_' + n.id,
        type:    'bill',
        title:   n.headline,
        due_at:  n.dueDate || n.createdAt,
        source:  'credit_card_genie',
      }));

    const merged = [...ccEntries, ...filtered];
    writeJSON(HOUSEHOLD_KEY, merged);

    // Dispatch storage event so household page re-renders if open in same tab
    safe(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key:      HOUSEHOLD_KEY,
        newValue: JSON.stringify(merged),
      }));
    });
  }

  // ── Should we re-run? (throttle) ──────────────────────────────
  function shouldRun(userId) {
    const key  = NUDGES_KEY_PREFIX + (userId || 'anon');
    const prev = readJSON(key);
    if (!prev || !prev.generatedAt) return true;
    return (Date.now() - new Date(prev.generatedAt).getTime()) > NUDGE_TTL_MS;
  }

  // ── Main entry point ───────────────────────────────────────────
  /**
   * @param {object} opts
   * @param {string}   opts.userId
   * @param {Array}    opts.cards   — from credit_cards table
   * @param {Array}    opts.txns    — from credit_card_transactions table
   * @param {boolean}  [opts.force] — skip TTL check and always re-run
   * @returns {Array}  nudges array (also written to localStorage)
   */
  async function run({ userId, cards = [], txns = [], force = false } = {}) {
    if (!force && !shouldRun(userId)) {
      // Return cached nudges
      const cached = readJSON(NUDGES_KEY_PREFIX + (userId || 'anon'));
      return cached?.nudges || [];
    }

    const rules = readRules(userId);

    const allNudges = [
      ...makeDueNudges(cards),
      ...makeUtilNudges(cards),
      ...makeMissedRewardsNudges(cards, txns, rules),
      ...makeRotatingQuarterNudges(cards),
      ...makeAnnualFeeNudges(cards),
    ].sort((a, b) => a.priority - b.priority || 0);

    // Write nudges to CC-specific key
    const payload = {
      nudges,
      generatedAt: new Date().toISOString(),
      cardCount:   cards.length,
      txnCount:    txns.length,
    };
    // fix: use allNudges not nudges
    payload.nudges = allNudges;
    writeJSON(NUDGES_KEY_PREFIX + (userId || 'anon'), payload);

    // Bridge bill/fee nudges to household reminders
    bridgeToHousehold(allNudges);

    return allNudges;
  }

  /**
   * Read cached nudges without re-running (useful for rendering)
   */
  function getCached(userId) {
    const cached = readJSON(NUDGES_KEY_PREFIX + (userId || 'anon'));
    return cached?.nudges || [];
  }

  /**
   * Clear nudge cache (call after card data changes)
   */
  function invalidate(userId) {
    safe(() => localStorage.removeItem(NUDGES_KEY_PREFIX + (userId || 'anon')));
  }

  // ── Public API ─────────────────────────────────────────────────
  return { run, getCached, invalidate, NUDGES_KEY_PREFIX };

})();

// Make available as ES module AND as global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CCNudges;
}
