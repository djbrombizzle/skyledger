import { test, expect } from '@playwright/test';

async function waitForGameReady(page) {
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() => {
      try {
        return !!(typeof S !== 'undefined' && S && S.pilot === 'Test');
      } catch (e) {
        return false;
      }
    });
    if (ready) return;
    await page.waitForTimeout(2000);
  }
  throw new Error('Game did not finish loading');
}

test('sports charter filter and board integration', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sky_supa_url', 'off');
    localStorage.setItem('sky_supa_anon', 'off');
    localStorage.setItem('skyledger_theme', 'light');
    localStorage.setItem('skyledger_save_v1', JSON.stringify({
      pilot: 'Test',
      base: 'KTEB',
      created: Date.now(),
      cash: 5000000,
      rep: 10000,
      flights: 0,
      hours: 0,
      nm: 0,
      fleet: [{ id: 'f1', type: 'bbj', tail: 'NTEST1', loc: 'KTEB', owned: true, busy: false, cond: 95, hours: 100 }],
      board: [],
      active: null,
      ledger: [],
      operator: null,
      fbos: [],
      role: 'both',
      lastFbo: 0,
      lastBoard: 0,
      maxTier: 5,
      grades: [],
      tierQual: 0,
      demand: {},
      lastEco: 0,
      used: [],
      lastUsed: 0,
      account: { realName: '', company: '' },
      wxWatch: [],
      pirepCode: 'TEST01',
    }));
  });

  await page.goto('/index.html');
  await waitForGameReady(page);

  const injected = await page.evaluate(() => {
    const charter = {
      id: 'pw-sports-1',
      dep: 'KTEB',
      arr: 'KSEA',
      dist: 2400,
      cls: 'ulr',
      tier: 5,
      cat: 'sports',
      pax: 72,
      payout: 85000,
      demand: 1.25,
      mktD: 1.1,
      client: 'NE — @ Seahawks',
      expires: Date.now() + 18 * 3600e3,
      surge: false,
      hot: true,
      sportsEvent: {
        league: 'nfl',
        gameId: 'pw-test-1',
        team: 'NE',
        leg: 'inbound',
        legLabel: 'Team inbound',
        gameStart: Date.now() + 20 * 3600e3,
        name: 'NE @ SEA',
        icon: '🏈',
        venueIcao: 'KSEA',
        windowClose: Date.now() + 18 * 3600e3,
      },
    };
    S.board.push(charter);
    boardFilter.flags = 'sports';
    nav('board');
    return S.board.filter(c => c.sportsEvent).length;
  });
  expect(injected).toBeGreaterThan(0);

  await page.waitForTimeout(500);
  const hasSportsOption = await page.locator('select option[value="sports"]').count();
  expect(hasSportsOption).toBeGreaterThan(0);

  const rowText = await page.locator('.board-row').first().innerText();
  expect(rowText).toMatch(/NE|Seahawks|sports/i);
});
