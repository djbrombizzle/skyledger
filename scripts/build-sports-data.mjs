#!/usr/bin/env node
/**
 * Build / validate sports team hubs and venue ICAO mappings.
 * Output: data/sports-teams.json, data/sports-venues.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const airportsPath = path.join(root, 'data/airports.json');

const CITY_ICAO = {
  'atlanta|GA': 'KFTY', 'tampa|FL': 'KTPA', 'miami|FL': 'KOPF', 'dallas|TX': 'KDAL',
  'houston|TX': 'KHOU', 'denver|CO': 'KAPA', 'phoenix|AZ': 'KSDL', 'seattle|WA': 'KBFI',
  'los angeles|CA': 'KVNY', 'las vegas|NV': 'KLAS', 'san francisco|CA': 'KOAK',
  'chicago|IL': 'KPWK', 'detroit|MI': 'KDET', 'minneapolis|MN': 'KFCM', 'green bay|WI': 'KGRB',
  'kansas city|MO': 'KMKC', 'indianapolis|IN': 'KIND', 'cleveland|OH': 'KBKL', 'cincinnati|OH': 'KLUK',
  'baltimore|MD': 'KBWI', 'philadelphia|PA': 'KPNE', 'pittsburgh|PA': 'KPIT', 'buffalo|NY': 'KBUF',
  'foxborough|MA': 'KBED', 'boston|MA': 'KBED', 'east rutherford|NJ': 'KTEB', 'new orleans|LA': 'KNEW',
  'nashville|TN': 'KBNA', 'jacksonville|FL': 'KCRG', 'charlotte|NC': 'KCLT', 'washington|DC': 'KDCA',
  'landover|MD': 'KDCA', 'arlington|TX': 'KDAL', 'glendale|AZ': 'KIWA', 'santa clara|CA': 'KOAK',
  'inglewood|CA': 'KVNY', 'orchard park|NY': 'KBUF', 'cromwell|CT': 'KHFD', 'augusta|GA': 'KAGS',
  'tucson|AZ': 'KTUS', 'san diego|CA': 'KMYF', 'milwaukee|WI': 'KMKE', 'memphis|TN': 'KMEM',
  'oklahoma city|OK': 'KOKC', 'orlando|FL': 'KORL', 'portland|OR': 'KPDX', 'sacramento|CA': 'KMCC',
  'san antonio|TX': 'KSAT', 'st. louis|MO': 'KSTL', 'toronto|ON': 'CYTZ', 'salt lake city|UT': 'KSLC',
  'brooklyn|NY': 'KTEB', 'new york|NY': 'KTEB', 'oakland|CA': 'KOAK', 'anaheim|CA': 'KSNA',
};

const TEAM_HUBS = {
  nfl: {
    ARI:'KIWA', ATL:'KFTY', BAL:'KBWI', BUF:'KBUF', CAR:'KCLT', CHI:'KPWK', CIN:'KLUK', CLE:'KBKL',
    DAL:'KDAL', DEN:'KAPA', DET:'KDET', GB:'KGRB', HOU:'KHOU', IND:'KIND', JAX:'KCRG', KC:'KMKC',
    LAC:'KVNY', LAR:'KVNY', LV:'KVGT', MIA:'KOPF', MIN:'KFCM', NE:'KBED', NO:'KNEW', NYG:'KTEB',
    NYJ:'KTEB', PHI:'KPNE', PIT:'KPIT', SEA:'KBFI', SF:'KOAK', TB:'KTPA', TEN:'KBNA', WAS:'KDCA', WSH:'KDCA',
  },
  nba: {
    ATL:'KFTY', BOS:'KBED', BKN:'KTEB', CHA:'KCLT', CHI:'KPWK', CLE:'KBKL', DAL:'KDAL', DEN:'KAPA',
    DET:'KDET', GS:'KOAK', GSW:'KOAK', HOU:'KHOU', IND:'KIND', LAC:'KVNY', LAL:'KVNY', MEM:'KMEM',
    MIA:'KOPF', MIL:'KMKE', MIN:'KFCM', NOP:'KNEW', NY:'KTEB', NYK:'KTEB', OKC:'KOKC', ORL:'KORL',
    PHI:'KPNE', PHX:'KSDL', POR:'KPDX', SAC:'KMCC', SA:'KSAT', SAS:'KSAT', TOR:'CYTZ', UTA:'KSLC',
    WAS:'KDCA', WSH:'KDCA',
  },
  mlb: {
    ARI:'KIWA', ATL:'KFTY', BAL:'KBWI', BOS:'KBED', CHC:'KPWK', CHW:'KMDW', CIN:'KLUK', CLE:'KBKL',
    COL:'KAPA', CWS:'KMDW', DET:'KDET', HOU:'KHOU', KC:'KMKC', LAA:'KSNA', LAD:'KVNY', MIA:'KOPF',
    MIL:'KMKE', MIN:'KFCM', NYM:'KTEB', NYY:'KTEB', OAK:'KOAK', PHI:'KPNE', PIT:'KPIT', SD:'KMYF',
    SDP:'KMYF', SEA:'KBFI', SF:'KOAK', STL:'KSTL', TB:'KTPA', TEX:'KDAL', TOR:'CYTZ', WSH:'KDCA',
  },
  ncaaf: {
    ALA:'KTCL', ARK:'KXNA', AUB:'KAUO', CLEM:'KCEU', FLA:'KGNV', FSU:'KTLH', GA:'KAHN', LSU:'KBTR',
    MIA:'KOPF', MICH:'KARB', ND:'KSBM', OSU:'KOSU', OU:'KOUN', PSU:'KUNV', TEN:'KTYS', TEX:'KAUS',
    UGA:'KAHN', USC:'KVNY', UTAH:'KSLC', WASH:'KBFI', WISC:'KMSN', ORE:'KEUG', IOWA:'KIOW',
    MSU:'KLAN', NEB:'KLNK', UCLA:'KVNY', STAN:'KSQL', TEXAM:'KCLL', OKST:'KSWO', TCU:'KFTW',
    BAY:'KACT', TTU:'KLBB', KSU:'KMHK', WVU:'KCKB', LOU:'KSDF', UK:'KLEX', UF:'KGNV', SC:'KCAE',
    MISS:'KMEM', ARIZ:'KTUS', ASU:'KIWA', BYU:'KPVU', CIN:'KLUK', HOU:'KHOU',
    UCF:'KORL', USF:'KTPA', MEM:'KMEM', NAVY:'KANP', ARMY:'KSWF', AFA:'KCOS', ND:'KSBM',
  },
  ncaab: {
    DUKE:'KRDU', UNC:'KRDU', UK:'KLEX', KU:'KICT', GONZ:'KGEG', UCLA:'KVNY', UCONN:'KHFD',
    PUR:'KLAF', HOU:'KHOU', TEN:'KTYS', AUB:'KAUO', ALA:'KTCL', ARIZ:'KTUS', BAY:'KACT',
    CREI:'KOMA', ISU:'KDSM', MARQ:'KMKE', MSU:'KLAN', OSU:'KOSU', SYR:'KSYR', VILL:'KPNE',
    XAV:'KLUK', ZAGA:'KGEG', IU:'KIND', LOU:'KSDF', MICH:'KARB', MSU:'KLAN', PUR:'KLAF',
  },
};

const VENUE_ICAO = {
  '5348': { icao: 'KFTY', name: 'Mercedes-Benz Stadium', city: 'Atlanta', state: 'GA' },
  '3886': { icao: 'KTEB', name: 'MetLife Stadium', city: 'East Rutherford', state: 'NJ' },
  '3628': { icao: 'KTEB', name: 'MetLife Stadium', city: 'East Rutherford', state: 'NJ' },
  '4246': { icao: 'KTPA', name: 'Raymond James Stadium', city: 'Tampa', state: 'FL' },
  '6501': { icao: 'KOPF', name: 'Hard Rock Stadium', city: 'Miami Gardens', state: 'FL' },
  '3891': { icao: 'KAPA', name: 'Empower Field', city: 'Denver', state: 'CO' },
  '3624': { icao: 'KBFI', name: 'Lumen Field', city: 'Seattle', state: 'WA' },
  '6502': { icao: 'KLAS', name: 'Allegiant Stadium', city: 'Las Vegas', state: 'NV' },
  '3890': { icao: 'KOAK', name: "Levi's Stadium", city: 'Santa Clara', state: 'CA' },
  '6504': { icao: 'KVNY', name: 'SoFi Stadium', city: 'Inglewood', state: 'CA' },
  '6506': { icao: 'KSDL', name: 'Footprint Center', city: 'Phoenix', state: 'AZ' },
  '6507': { icao: 'KIND', name: 'Lucas Oil Stadium', city: 'Indianapolis', state: 'IN' },
  '6508': { icao: 'KMKC', name: 'Arrowhead Stadium', city: 'Kansas City', state: 'MO' },
  '6509': { icao: 'KCLT', name: 'Bank of America Stadium', city: 'Charlotte', state: 'NC' },
  '6510': { icao: 'KBWI', name: 'M&T Bank Stadium', city: 'Baltimore', state: 'MD' },
  '6511': { icao: 'KPNE', name: 'Lincoln Financial Field', city: 'Philadelphia', state: 'PA' },
  '6512': { icao: 'KBUF', name: 'Highmark Stadium', city: 'Orchard Park', state: 'NY' },
  '6513': { icao: 'KDET', name: 'Ford Field', city: 'Detroit', state: 'MI' },
  '3627': { icao: 'KDAL', name: 'AT&T Stadium', city: 'Arlington', state: 'TX' },
  '6500': { icao: 'KHOU', name: 'NRG Stadium', city: 'Houston', state: 'TX' },
  '6521': { icao: 'KIWA', name: 'State Farm Stadium', city: 'Glendale', state: 'AZ' },
  '6522': { icao: 'KGRB', name: 'Lambeau Field', city: 'Green Bay', state: 'WI' },
  '6523': { icao: 'KCRG', name: 'EverBank Stadium', city: 'Jacksonville', state: 'FL' },
  '6524': { icao: 'KNEW', name: 'Caesars Superdome', city: 'New Orleans', state: 'LA' },
  '6525': { icao: 'KBNA', name: 'Nissan Stadium', city: 'Nashville', state: 'TN' },
  '6526': { icao: 'KDCA', name: 'FedExField', city: 'Landover', state: 'MD' },
  '6527': { icao: 'KBED', name: 'Gillette Stadium', city: 'Foxborough', state: 'MA' },
  '6528': { icao: 'KFCM', name: 'U.S. Bank Stadium', city: 'Minneapolis', state: 'MN' },
  '6529': { icao: 'KMDW', name: 'Soldier Field', city: 'Chicago', state: 'IL' },
  '6530': { icao: 'KPWK', name: 'Soldier Field', city: 'Chicago', state: 'IL' },
  '6531': { icao: 'KLUK', name: 'Paycor Stadium', city: 'Cincinnati', state: 'OH' },
  '6532': { icao: 'KBKL', name: 'Cleveland Browns Stadium', city: 'Cleveland', state: 'OH' },
  'tpc-river-highlands': { icao: 'KHFD', name: 'TPC River Highlands', city: 'Cromwell', state: 'CT' },
  'travelers-championship': { icao: 'KHFD', name: 'TPC River Highlands', city: 'Cromwell', state: 'CT' },
  'the-masters': { icao: 'KAGS', name: 'Augusta National Golf Club', city: 'Augusta', state: 'GA' },
  'memorial-tournament': { icao: 'KLCK', name: 'Muirfield Village Golf Club', city: 'Dublin', state: 'OH' },
};

function loadAirports() {
  const rows = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
  const byIcao = Object.fromEntries(rows.map(a => [a[0], { lat: a[2], lon: a[3], region: a[5] }]));
  return byIcao;
}

function validate(teams, venues, apt) {
  let err = 0;
  for (const [league, map] of Object.entries(teams)) {
    for (const [abbr, t] of Object.entries(map)) {
      if (!apt[t.hub]) { console.error(`Missing hub ${t.hub} for ${league}/${abbr}`); err++; }
    }
  }
  for (const [id, v] of Object.entries(venues)) {
    if (!apt[v.icao]) { console.error(`Missing venue ICAO ${v.icao} for ${id}`); err++; }
  }
  for (const [cs, icao] of Object.entries(CITY_ICAO)) {
    if (!apt[icao]) { console.error(`Missing city ICAO ${icao} for ${cs}`); err++; }
  }
  return err;
}

async function enrichFromEspn(teams, venues) {
  const paths = [
    ['nfl', 'football/nfl'], ['nba', 'basketball/nba'], ['mlb', 'baseball/mlb'],
    ['ncaaf', 'football/college-football?groups=80'], ['ncaab', 'basketball/mens-college-basketball'],
  ];
  for (const [league, path] of paths) {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams`);
      const d = await r.json();
      const list = d.sports?.[0]?.leagues?.[0]?.teams || [];
      if (!teams[league]) teams[league] = {};
      for (const t of list) {
        const team = t.team;
        const abbr = team.abbreviation;
        if (!teams[league][abbr]) {
          const hub = TEAM_HUBS[league]?.[abbr] || 'KTEB';
          teams[league][abbr] = { hub, name: team.displayName };
        }
      }
    } catch (e) { console.warn('ESPN teams fetch failed', league); }
  }
  const now = new Date();
  for (let i = 0; i < 10; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i);
    const dt = d.toISOString().slice(0, 10).replace(/-/g, '');
    for (const path of ['football/nfl', 'basketball/nba', 'baseball/mlb', 'football/college-football?groups=80']) {
      try {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path.split('?')[0]}/scoreboard?dates=${dt}${path.includes('?') ? '&' + path.split('?')[1] : ''}`);
        const data = await r.json();
        for (const ev of data.events || []) {
          const v = ev.competitions?.[0]?.venue;
          if (!v?.id) continue;
          const key = String(v.id);
          if (venues[key]) continue;
          const cs = `${(v.address?.city || '').toLowerCase()}|${(v.address?.state || '').toUpperCase()}`;
          const icao = CITY_ICAO[cs] || 'KTEB';
          venues[key] = { icao, name: v.fullName, city: v.address?.city || '', state: v.address?.state || '' };
        }
      } catch (e) {}
    }
  }
}

async function main() {
  const apt = loadAirports();
  const teams = {};
  for (const [league, map] of Object.entries(TEAM_HUBS)) {
    teams[league] = {};
    for (const [abbr, val] of Object.entries(map)) {
      teams[league][abbr] = typeof val === 'string' ? { hub: val, name: abbr } : { ...val };
    }
  }
  const venues = JSON.parse(JSON.stringify(VENUE_ICAO));
  await enrichFromEspn(teams, venues);
  const errs = validate(teams, venues, apt);
  const outTeams = path.join(root, 'data/sports-teams.json');
  const outVenues = path.join(root, 'data/sports-venues.json');
  const outCities = path.join(root, 'data/sports-cities.json');
  fs.writeFileSync(outTeams, JSON.stringify(teams, null, 2) + '\n');
  fs.writeFileSync(outVenues, JSON.stringify(venues, null, 2) + '\n');
  fs.writeFileSync(outCities, JSON.stringify(CITY_ICAO, null, 2) + '\n');
  console.log('Wrote', outTeams, Object.keys(teams).map(k => k + ':' + Object.keys(teams[k]).length).join(', '));
  console.log('Wrote', outVenues, Object.keys(venues).length, 'venues');
  if (errs) { console.error(errs, 'validation errors'); process.exit(1); }
  console.log('OK');
}

main();
