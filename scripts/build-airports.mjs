#!/usr/bin/env node
/**
 * Build Skyledger airport DB from OurAirports (hard-surface runways >= 1500 ft).
 * Output: data/airports.json — array of [icao,name,lat,lon,cls,region,rwy_ft]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIN_RUNWAY_FT = 1500;
const HARD = new Set(['ASP', 'CON', 'PEM', 'BIT', 'BRI', 'MAC', 'GRE', 'CLA']);

const NA = new Set(['US', 'CA', 'MX', 'GL', 'BM', 'BS', 'KY', 'PR', 'VI', 'GP', 'MQ']);
const SA = new Set(['BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR', 'GF']);
const EU = new Set(['GB', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'IE', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'GR', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'IS', 'AL', 'MK', 'RS', 'BA', 'ME', 'MD', 'UA', 'BY', 'RU', 'TR']);
const ME = new Set(['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'YE', 'JO', 'LB', 'IL', 'IQ', 'IR', 'SY']);
const AS = new Set(['CN', 'JP', 'KR', 'IN', 'TH', 'SG', 'MY', 'ID', 'PH', 'VN', 'HK', 'MO', 'TW', 'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA', 'MN', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'AF', 'NP']);
const OC = new Set(['AU', 'NZ', 'PG', 'FJ', 'NC', 'PF', 'WS', 'TO', 'VU', 'SB', 'GU', 'AS', 'MP', 'FM', 'PW', 'MH', 'KI', 'NR', 'TV', 'CK']);

function regionFor(cc) {
  if (NA.has(cc)) return 'NA';
  if (SA.has(cc)) return 'SA';
  if (EU.has(cc)) return 'EU';
  if (ME.has(cc)) return 'ME';
  if (AS.has(cc)) return 'AS';
  if (OC.has(cc)) return 'OC';
  return 'AF';
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { q = !q; continue; }
    if (c === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function clsFor(rwy, aptType) {
  if (aptType === 'large_airport' || rwy >= 8000) return 'i';
  if (rwy >= 5000 || aptType === 'medium_airport') return 'm';
  return 's';
}

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row;
  });
}

const airportsPath = process.argv[2] || '/tmp/airports.csv';
const runwaysPath = process.argv[3] || '/tmp/runways.csv';
const outPath = path.join(__dirname, '../data/airports.json');

const runways = readCsv(runwaysPath);
const maxRwy = new Map(); // airport_ident -> max hard runway ft

for (const r of runways) {
  const ident = r.airport_ident;
  const surface = (r.surface || '').toUpperCase().trim();
  const len = parseInt(r.length_ft, 10) || 0;
  if (!ident || len < MIN_RUNWAY_FT) continue;
  const hard = HARD.has(surface) || /^ASP|CON|PEM|BIT/i.test(surface);
  if (!hard) continue;
  maxRwy.set(ident, Math.max(maxRwy.get(ident) || 0, len));
}

const airports = readCsv(airportsPath);
const out = [];
const seen = new Set();

for (const a of airports) {
  const type = a.type;
  if (!['small_airport', 'medium_airport', 'large_airport'].includes(type)) continue;
  const icao = (a.ident || '').toUpperCase();
  if (!icao || icao.length < 3 || icao.length > 4) continue;
  const rwy = maxRwy.get(icao);
  if (!rwy || rwy < MIN_RUNWAY_FT) continue;
  if (seen.has(icao)) continue;
  seen.add(icao);
  const lat = parseFloat(a.latitude_deg);
  const lon = parseFloat(a.longitude_deg);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const name = (a.name || icao).replace(/"/g, '').slice(0, 48);
  const cc = (a.iso_country || '').toUpperCase();
  const region = regionFor(cc);
  const cls = clsFor(rwy, type);
  out.push([icao, name, +lat.toFixed(3), +lon.toFixed(3), cls, region, rwy]);
}

out.sort((a, b) => a[0].localeCompare(b[0]));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${out.length} airports to ${outPath}`);
