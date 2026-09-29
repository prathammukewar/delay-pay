// Airport search: IATA code, metro code, city or airport name. Pure, no DOM.
import { loadAirports, METRO, countryName } from './airports.js';

export const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Busiest airports first when scores tie, so "London" leads with Heathrow and "New York" with JFK.
const BUSY = (
  'ATL DXB DFW LHR HND DEN IST LAX ORD CDG AMS DEL MAD FRA JFK SIN ICN CLT BCN LAS MCO SEA IAH ' +
  'PHX EWR MIA SFO BOM PVG PEK KUL CGK BKK HKG DOH MUC FCO LGW YYZ MEX SZX CAN CTU MNL SAW MSP ' +
  'BOS DTW PHL LGA NRT ORY DUB ZRH CPH OSL ARN HEL VIE BRU LIS PMI AGP ATH MXP BER MAN STN LTN ' +
  'EDI BHX GLA DUS HAM WAW PRG BUD OTP YVR YUL YYC AUH JED RUH CAI TLV SYD MEL AKL JNB GRU EZE ' +
  'BOG LIM SCL CUN IAD DCA BWI MDW FLL SAN SLC HNL PDX AUS BNA TPA MSY RDU STL TFS LPA ACE ALC ' +
  'NCE LYS VCE NAP BGY OPO FAO KRK LCY GVA BSL ORK BFS'
).split(' ');
const busyRank = new Map(BUSY.map((c, i) => [c, i]));
const rankOf = (code) => (busyRank.has(code) ? busyRank.get(code) : 9999);

let index = null;
function getIndex() {
  if (index) return index;
  const { list } = loadAirports();
  index = list.map((a) => ({
    a,
    code: a.code.toLowerCase(),
    city: fold(a.city),
    name: fold(a.name),
    words: fold(`${a.name} ${a.city} ${a.extra}`).split(/[\s/,().'-]+/).filter(Boolean),
    country: fold(countryName(a.country)),
  }));
  return index;
}

/**
 * Returns up to `limit` airports for a query, best match first.
 * Large airports win ties so "London" shows Heathrow before London, Ontario.
 */
export function searchAirports(query, limit = 8) {
  const q = fold(query);
  if (!q) return [];
  const idx = getIndex();
  const { byCode } = loadAirports();
  const scored = new Map();
  const add = (a, score) => {
    const prev = scored.get(a.code);
    if (prev === undefined || score > prev) scored.set(a.code, score);
  };

  const upper = q.toUpperCase();
  if (METRO[upper]) {
    METRO[upper].forEach((code, i) => {
      const a = byCode.get(code);
      if (a) add(a, 95 - i);
    });
  }

  for (const e of idx) {
    let s = -1;
    if (e.code === q) s = 100;
    else if (e.city === q) s = 90;
    else if (e.city.startsWith(q)) s = 80;
    else if (e.name.startsWith(q)) s = 75;
    else if (q.length >= 2 && e.words.some((w) => w.startsWith(q))) s = 60;
    else if (q.length >= 3 && (e.name.includes(q) || e.city.includes(q))) s = 40;
    else if (q.length >= 4 && e.country.startsWith(q)) s = 20;
    if (s >= 0) add(e.a, s + (e.a.large ? 5 : 0) + (busyRank.has(e.a.code) ? 3 : 0));
  }

  return [...scored.entries()]
    .sort((x, y) => y[1] - x[1] || rankOf(x[0]) - rankOf(y[0]) || x[0].localeCompare(y[0]))
    .slice(0, limit)
    .map(([code]) => byCode.get(code));
}
