#!/usr/bin/env node
/**
 * Validates sports charter data, timing windows, and board-volume rules.
 * Run: node scripts/test-sports-charters.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function sportsGameWindows(league, gameStart, gameEnd) {
  if (league === 'pga') {
    return {
      inboundOpen: gameStart - 24 * 3600e3,
      inboundClose: gameStart - 4 * 3600e3,
      outboundOpen: gameEnd,
      outboundClose: gameEnd + 24 * 3600e3,
    };
  }
  return {
    inboundOpen: gameStart - 36 * 3600e3,
    inboundClose: gameStart - 2 * 3600e3,
    outboundOpen: gameEnd,
    outboundClose: gameEnd + 24 * 3600e3,
  };
}

function mlbMarquee(ev, comp) {
  const d = new Date(comp.date || ev.date);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 5 || dow === 6) return true;
  const bcast = [].concat(comp.broadcasts || [], ev.broadcasts || []);
  return bcast.some(b => {
    const names = (b.names || []).join('') + (b.market || '') + (b.type || '');
    return /espn|fox|tbs|tnt|nbc|abc|mlbn|prime|national/i.test(names);
  });
}

function sportsTeamsForGame(g) {
  if (g.league === 'pga') return ['tour'];
  if (g.neutralSite) return [g.homeAbbr, g.awayAbbr].filter(Boolean);
  return g.awayAbbr ? [g.awayAbbr] : [];
}

function sportsCharterTargets(games, now = Date.now()) {
  const out = [];
  for (const g of games) {
    if (g.outboundClose <= now || g.inboundOpen > now + 14 * 864e5) continue;
    for (const team of sportsTeamsForGame(g)) {
      if (now >= g.inboundOpen && now < g.inboundClose) out.push({ game: g, leg: 'inbound', team });
      if (now >= g.outboundOpen && now < g.outboundClose) out.push({ game: g, leg: 'outbound', team });
    }
  }
  return out;
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK:', msg);
  }
}

// --- ICAO validation ---
const airports = JSON.parse(fs.readFileSync(path.join(root, 'data/airports.json'), 'utf8'));
const aptSet = new Set(airports.map(a => a[0]));
const teams = JSON.parse(fs.readFileSync(path.join(root, 'data/sports-teams.json'), 'utf8'));
const venues = JSON.parse(fs.readFileSync(path.join(root, 'data/sports-venues.json'), 'utf8'));
const cities = JSON.parse(fs.readFileSync(path.join(root, 'data/sports-cities.json'), 'utf8'));

for (const [league, map] of Object.entries(teams)) {
  for (const [abbr, t] of Object.entries(map)) {
    const hub = typeof t === 'string' ? t : t.hub;
    assert(aptSet.has(hub), `team hub ${league}/${abbr} → ${hub}`);
  }
}
for (const [id, v] of Object.entries(venues)) {
  assert(aptSet.has(v.icao), `venue ${id} → ${v.icao}`);
}
for (const [cs, icao] of Object.entries(cities)) {
  assert(aptSet.has(icao), `city ${cs} → ${icao}`);
}

// --- Window timing ---
const kickoff = Date.parse('2026-09-10T20:00:00Z');
const gameEnd = kickoff + 3.5 * 3600e3;
const win = sportsGameWindows('nfl', kickoff, gameEnd);
assert(win.inboundClose === kickoff - 2 * 3600e3, 'NFL inbound closes 2h before kickoff');
assert(win.inboundOpen === kickoff - 36 * 3600e3, 'NFL inbound opens 36h before kickoff');
assert(win.outboundOpen === gameEnd, 'outbound opens at game end');
assert(win.outboundClose === gameEnd + 24 * 3600e3, 'outbound closes 24h after game end');

const pgaStart = Date.parse('2026-06-25T12:00:00Z');
const pgaEnd = Date.parse('2026-06-29T18:00:00Z');
const pgaWin = sportsGameWindows('pga', pgaStart, pgaEnd);
assert(pgaWin.inboundOpen === pgaStart - 24 * 3600e3, 'PGA inbound opens 24h before');
assert(pgaWin.inboundClose === pgaStart - 4 * 3600e3, 'PGA inbound closes 4h before');

// --- Target generation ---
const mockGame = {
  id: 'test1',
  league: 'nfl',
  name: 'NE @ SEA',
  homeAbbr: 'SEA',
  awayAbbr: 'NE',
  neutralSite: false,
  gameStart: kickoff,
  gameEnd,
  ...win,
};
const midInbound = kickoff - 20 * 3600e3;
const targets = sportsCharterTargets([mockGame], midInbound);
assert(targets.length === 1 && targets[0].leg === 'inbound' && targets[0].team === 'NE', 'away-team inbound only');

const neutralGame = { ...mockGame, id: 'test2', neutralSite: true };
const neutralTargets = sportsCharterTargets([neutralGame], midInbound);
assert(neutralTargets.length === 2, 'neutral site charters both teams');

const afterKickoff = kickoff + 4 * 3600e3;
const outTargets = sportsCharterTargets([mockGame], afterKickoff);
assert(outTargets.length === 1 && outTargets[0].leg === 'outbound', 'outbound after game');

// --- MLB filter ---
assert(mlbMarquee({ date: '2026-07-11T00:00:00Z' }, { date: '2026-07-11T00:00:00Z' }), 'Saturday MLB is marquee');
assert(!mlbMarquee({ date: '2026-07-07T00:00:00Z' }, { date: '2026-07-07T00:00:00Z', broadcasts: [] }), 'Tuesday unbroadcast MLB skipped');

// --- Volume cap logic ---
const MAX = 40;
const board = Array.from({ length: 35 }, (_, i) => ({ sportsEvent: { gameId: 'a' + i } }));
const canAdd = board.filter(c => c.sportsEvent).length < MAX;
assert(canAdd, 'board under sports cap can add more');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll sports charter tests passed');
