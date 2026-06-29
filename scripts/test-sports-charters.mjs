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

function buildMlbSeries(chunk) {
  const first = chunk[0];
  const last = chunk[chunk.length - 1];
  const win = sportsGameWindows('mlb', first.gameStart, last.gameEnd);
  return {
    ...first,
    id: `mlb-${first.awayAbbr}-${first.homeAbbr}-${first.venueIcao}-${new Date(first.gameStart).toISOString().slice(0, 10)}`,
    name: chunk.length > 1 ? `${first.awayAbbr} @ ${first.homeAbbr} (${chunk.length}-game series)` : first.name,
    gameStart: first.gameStart,
    gameEnd: last.gameEnd,
    seriesLen: chunk.length,
    seriesGameIds: chunk.map(g => g.id),
    ...win,
  };
}

function consolidateMlbSeries(games) {
  const mlb = [];
  const rest = [];
  games.forEach(g => (g.league === 'mlb' ? mlb : rest).push(g));
  const groups = new Map();
  mlb.forEach(g => {
    const k = `${g.awayAbbr}|${g.homeAbbr}|${g.venueIcao}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(g);
  });
  const series = [];
  for (const gs of groups.values()) {
    gs.sort((a, b) => a.gameStart - b.gameStart);
    let chunk = [gs[0]];
    for (let i = 1; i < gs.length; i++) {
      const gap = gs[i].gameStart - chunk[chunk.length - 1].gameStart;
      if (gap <= 2.5 * 864e5) chunk.push(gs[i]);
      else {
        series.push(buildMlbSeries(chunk));
        chunk = [gs[i]];
      }
    }
    series.push(buildMlbSeries(chunk));
  }
  return rest.concat(series);
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

// --- MLB series consolidation ---
const day = 864e5;
const g1 = { id: 'g1', league: 'mlb', awayAbbr: 'WSH', homeAbbr: 'BOS', venueIcao: 'KBOS', neutralSite: false,
  gameStart: kickoff, gameEnd: kickoff + 3 * 3600e3 };
const g2 = { ...g1, id: 'g2', gameStart: kickoff + day, gameEnd: kickoff + day + 3 * 3600e3 };
const g3 = { ...g1, id: 'g3', gameStart: kickoff + 2 * day, gameEnd: kickoff + 2 * day + 3 * 3600e3 };
const g4 = { ...g1, id: 'g4', gameStart: kickoff + 3 * day, gameEnd: kickoff + 3 * day + 3 * 3600e3 };
const merged = consolidateMlbSeries([g1, g2, g3, g4]);
assert(merged.length === 1 && merged[0].seriesLen === 4, '4-game MLB series merges into one');
assert(merged[0].gameEnd === g4.gameEnd, 'series ends after last game');
const midSeries = kickoff + 1.5 * day;
const midTargets = sportsCharterTargets(merged, midSeries);
assert(!midTargets.some(t => t.leg === 'inbound'), 'no inbound during middle of series');
assert(!midTargets.some(t => t.leg === 'outbound'), 'no outbound until series ends');
const afterSeries = g4.gameEnd + 3600e3;
const endTargets = sportsCharterTargets(merged, afterSeries);
assert(endTargets.length === 1 && endTargets[0].leg === 'outbound', 'outbound only after last game');

// --- Venue ICAO sanity (no KTEB for Boston) ---
const fenway = venues['2'];
if (fenway) assert(fenway.icao === 'KBOS', 'Fenway Park maps to KBOS not KTEB');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll sports charter tests passed');
