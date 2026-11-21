// Delay Pay tests. No dependencies: run with `node test/test.mjs`.
// Worked examples are hand-checked against the rule tables noted next to each one.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { haversineKm, zoneOf } from '../js/geo.js';
import { loadAirports, airportByCode, COUNTRIES, METRO } from '../js/airports.js';
import { searchAirports } from '../js/airport-search.js';
import { AIRLINES, airlineByCode, searchAirlines, licenceBloc } from '../js/airlines.js';
import {
  assess,
  euBand,
  euDowngradePct,
  formatMoney,
  formatDuration,
  formatDurationLong,
  EXAMPLES,
  CHEAT_SHEET,
  FAQ,
  SOURCES,
  EU261,
  UK261,
  US_DOT,
  APPR,
  EU_CAUSES,
} from '../js/rules.js';
import { buildLetter } from '../js/letter.js';
import { enforcerFor, escalationSteps, EU_NEBS } from '../js/enforcement.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;
let group = '';
function section(name) {
  group = name;
  console.log(`\n${name}`);
}
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}
function eq(actual, expected, msg = '') {
  if (actual !== expected) throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function ok(cond, msg = 'expected truthy') {
  if (!cond) throw new Error(msg);
}
function near(actual, expected, tol, msg = '') {
  if (Math.abs(actual - expected) > tol) throw new Error(`${msg} expected ${expected} ± ${tol}, got ${actual}`);
}

const A = (code) => {
  const a = airportByCode(code);
  if (!a) throw new Error(`airport ${code} missing`);
  return a;
};
const L = (code) => {
  const a = airlineByCode(code);
  if (!a) throw new Error(`airline ${code} missing`);
  return a;
};
const H = (h, m = 0) => h * 60 + m;

function run(from, to, airline, extra) {
  return assess({
    from: A(from),
    to: A(to),
    via: (extra.via || []).map(A),
    singleBooking: extra.singleBooking,
    airline: typeof airline === 'string' ? L(airline) : airline,
    event: extra.event || 'delay',
    delayMin: extra.delayMin ?? null,
    cancel: extra.cancel || null,
    denied: extra.denied || null,
    fare: extra.fare || null,
    cause: extra.cause || 'unknown',
  });
}
const reg = (v, id) => v.results.find((r) => r.id === id);

/* ------------------------------------------------------------------ */
section('Distance');

test('haversine is zero for the same point', () => eq(haversineKm(A('JFK'), A('JFK')), 0));
test('haversine is symmetric', () => near(haversineKm(A('LHR'), A('SYD')), haversineKm(A('SYD'), A('LHR')), 1e-9));
test('JFK to LHR is about 5,540 km', () => near(haversineKm(A('JFK'), A('LHR')), 5540, 15));
test('FRA to JFK is about 6,190 km', () => near(haversineKm(A('FRA'), A('JFK')), 6190, 15));
test('LHR to SYD is about 17,000 km', () => near(haversineKm(A('LHR'), A('SYD')), 17000, 60));
test('quarter of the equator is about 10,008 km', () =>
  near(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }), 10007.5, 2));
test('antipodes are about 20,015 km apart', () =>
  near(haversineKm({ lat: 10, lon: 20 }, { lat: -10, lon: -160 }), 20015, 2));

section('EU distance bands (Art. 7(1))');
test('1,500 km exactly is the short band', () => eq(euBand(1500, false), 'short'));
test('just over 1,500 km is the middle band', () => eq(euBand(1500.1, false), 'mid'));
test('3,500 km exactly is still the middle band', () => eq(euBand(3500, false), 'mid'));
test('just over 3,500 km is the long band', () => eq(euBand(3500.1, false), 'long'));
test('an intra-EU flight over 3,500 km stays in the middle band', () => eq(euBand(9000, true), 'mid'));
test('downgrade: 30% up to 1,500 km', () => eq(euDowngradePct(1200, true, A('CDG'), A('FCO')), 30));
test('downgrade: 50% intra-EU over 1,500 km', () => eq(euDowngradePct(1765, true, A('MAD'), A('LPA')), 50));
test('downgrade: 75% mainland France to Reunion (French overseas department)', () =>
  eq(euDowngradePct(9350, true, A('CDG'), A('RUN')), 75));
test('downgrade: 75% over 3,500 km to a non-EU country', () => eq(euDowngradePct(6190, false, A('FRA'), A('JFK')), 75));

/* ------------------------------------------------------------------ */
section('Airport dataset (OurAirports)');
const { list } = loadAirports();

test('has over 3,000 airports', () => ok(list.length > 3000, `only ${list.length}`));
test('codes are unique three-letter IATA codes', () => {
  const seen = new Set();
  for (const a of list) {
    ok(/^[A-Z]{3}$/.test(a.code), `bad code ${a.code}`);
    ok(!seen.has(a.code), `duplicate ${a.code}`);
    seen.add(a.code);
  }
});
test('coordinates are in range and numeric', () => {
  for (const a of list) {
    ok(Number.isFinite(a.lat) && a.lat >= -90 && a.lat <= 90, `lat ${a.code}`);
    ok(Number.isFinite(a.lon) && a.lon >= -180 && a.lon <= 180, `lon ${a.code}`);
  }
});
test('every airport has a name, a city and a known country', () => {
  for (const a of list) {
    ok(a.name && a.city, `name/city ${a.code}`);
    ok(COUNTRIES[a.country], `country ${a.country} for ${a.code}`);
  }
});
test('major airports are present', () => {
  for (const c of ['JFK', 'LHR', 'CDG', 'FRA', 'AMS', 'MAD', 'YYZ', 'YVR', 'ORD', 'LAX', 'DXB', 'SIN', 'HND', 'SYD', 'GRU', 'TFS', 'FNC', 'PDL', 'RUN', 'PTP'])
    ok(airportByCode(c), c);
});
test('metro codes point at real airports', () => {
  for (const [metro, codes] of Object.entries(METRO)) for (const c of codes) ok(airportByCode(c), `${metro} -> ${c}`);
});
test('lookups are case-insensitive', () => eq(airportByCode('jfk').code, 'JFK'));

section('Rules zones');
const zoneCases = [
  ['FRA', 'EU'], ['GVA', 'EU'], ['KEF', 'EU'], ['OSL', 'EU'], ['TFS', 'EU'], ['FNC', 'EU'], ['PDL', 'EU'],
  ['RUN', 'EU'], ['PTP', 'EU'], ['FDF', 'EU'], ['CAY', 'EU'], ['DZA', 'EU'], ['SBH', 'EU'], ['MLN', 'EU'],
  ['LHR', 'UK'], ['EDI', 'UK'], ['BFS', 'UK'],
  ['JFK', 'US'], ['SJU', 'US'], ['HNL', 'US'],
  ['YYZ', 'CA'],
  ['PPT', 'OTHER'], ['NOU', 'OTHER'], ['AUA', 'OTHER'], ['CUR', 'OTHER'], ['FAE', 'OTHER'], ['GOH', 'OTHER'],
  ['JER', 'OTHER'], ['IOM', 'OTHER'], ['GIB', 'OTHER'], ['ECN', 'OTHER'], ['IST', 'OTHER'], ['DXB', 'OTHER'],
];
for (const [code, zone] of zoneCases) test(`${code} is ${zone}`, () => eq(zoneOf(A(code)), zone));

/* ------------------------------------------------------------------ */
section('Airlines');
test('codes are unique', () => {
  const seen = new Set();
  for (const a of AIRLINES) {
    ok(!seen.has(a.code), `duplicate ${a.code}`);
    seen.add(a.code);
  }
});
test('every airline has a licence bloc', () => AIRLINES.forEach((a) => ok(a.bloc, a.code)));
test('BA is a UK carrier', () => eq(L('BA').bloc, 'UK'));
test('Lufthansa is an EU carrier', () => eq(L('LH').bloc, 'EU'));
test('SWISS, Norwegian and Icelandair count as EU carriers', () => {
  eq(L('LX').bloc, 'EU');
  eq(L('DY').bloc, 'EU');
  eq(L('FI').bloc, 'EU');
});
test('Delta is a US carrier, Air Canada Canadian, Emirates other', () => {
  eq(L('DL').bloc, 'US');
  eq(L('AC').bloc, 'CA');
  eq(L('EK').bloc, 'OTHER');
});
test('easyJet UK and easyJet Europe hold different licences', () => {
  eq(L('U2').bloc, 'UK');
  eq(L('EC').bloc, 'EU');
});
test('Canadian airlines carry a size', () =>
  AIRLINES.filter((a) => a.country === 'CA').forEach((a) => ok(a.caSize === 'large' || a.caSize === 'small', a.code)));
test('licenceBloc maps countries', () => {
  eq(licenceBloc('IE'), 'EU');
  eq(licenceBloc('CH'), 'EU');
  eq(licenceBloc('GB'), 'UK');
  eq(licenceBloc('TR'), 'OTHER');
});
test('search "ryanair" puts Ryanair first', () => eq(searchAirlines('ryanair')[0].code, 'FR'));
test('search "easyjet" finds all three licences', () => {
  const codes = searchAirlines('easyjet').map((a) => a.code);
  ['U2', 'EC', 'DS'].forEach((c) => ok(codes.includes(c), c));
});
test('search by code "BA"', () => eq(searchAirlines('BA')[0].code, 'BA'));
test('search ignores accents: "wideroe"', () => eq(searchAirlines('wideroe')[0].code, 'WF'));

section('Airport search');
test('"LHR" finds Heathrow first', () => eq(searchAirports('LHR')[0].code, 'LHR'));
test('"london" leads with Heathrow', () => eq(searchAirports('london')[0].code, 'LHR'));
test('"NYC" finds JFK, LaGuardia and Newark', () => {
  const codes = searchAirports('NYC').map((a) => a.code);
  ['JFK', 'LGA', 'EWR'].forEach((c) => ok(codes.includes(c), c));
});
test('"tenerife" finds TFS', () => ok(searchAirports('tenerife').some((a) => a.code === 'TFS')));
test('"zurich" finds ZRH', () => eq(searchAirports('zurich')[0].code, 'ZRH'));
test('"sao paulo" without accents finds GRU', () => ok(searchAirports('sao paulo').some((a) => a.code === 'GRU')));
test('"bergamo" finds BGY through the search words', () => eq(searchAirports('bergamo')[0].code, 'BGY'));
test('empty query returns nothing', () => eq(searchAirports('  ').length, 0));
test('results are capped', () => ok(searchAirports('a', 8).length <= 8));

/* ------------------------------------------------------------------ */
section('Worked example: JFK to LHR on British Airways, 4 hours late');
{
  // 5,540 km > 3,500 km, arriving in the UK on a UK carrier: UK261 Art 3(1)(b)(i), Art 7(1)(c) = £520.
  // 4h is not less than 4h, so no 50% cut.
  const v = run('JFK', 'LHR', 'BA', { delayMin: H(4) });
  test('UK261 applies and pays £520', () => {
    eq(v.primary.id, 'uk261');
    eq(v.primary.amount, 520);
    eq(v.primary.currency, 'GBP');
    eq(v.primary.reduced, false);
  });
  test('EU261 does not apply (neither end in the EU)', () => eq(reg(v, 'eu261').applies, false));
  test('US rules apply but pay no cash for a delay', () => {
    eq(reg(v, 'us').applies, true);
    eq(reg(v, 'us').amount, 0);
  });
  test('cause unknown means "probably owed"', () => eq(v.primary.strength, 'likely'));
  test('a technical cause makes it a strong claim', () =>
    eq(run('JFK', 'LHR', 'BA', { delayMin: H(4), cause: 'technical' }).primary.strength, 'strong'));
  test('3h30 late is halved to £260', () => {
    const w = run('JFK', 'LHR', 'BA', { delayMin: H(3, 30) });
    eq(w.primary.amount, 260);
    eq(w.primary.reduced, true);
  });
  test('the same flight on Delta is not covered by UK261', () => {
    const w = run('JFK', 'LHR', 'DL', { delayMin: H(5) });
    eq(reg(w, 'uk261').applies, false);
    eq(w.primary.id, 'us');
  });
}

section('Worked example: FRA to JFK on Delta, 3.5 hours late');
{
  // Departing the EU: any airline (Art 3(1)(a)). 6,190 km: band (c) €600. 3 to 4h late: 50% = €300
  // (Sturgeon, para 63, applying Art 7(2)(c)).
  const v = run('FRA', 'JFK', 'DL', { delayMin: H(3, 30), cause: 'technical' });
  test('EU261 pays €300', () => {
    eq(v.primary.id, 'eu261');
    eq(v.primary.amount, 300);
    eq(v.primary.fullAmount, 600);
    eq(v.primary.reduced, true);
  });
  test('technical fault keeps it strong (Wallentin-Hermann)', () => eq(v.primary.strength, 'strong'));
  test('4 hours late pays the full €600', () => eq(run('FRA', 'JFK', 'DL', { delayMin: H(4) }).primary.amount, 600));
  test('2h59 late pays nothing', () => eq(run('FRA', 'JFK', 'DL', { delayMin: H(2, 59) }).primary.amount, 0));
  test('exactly 3 hours late counts', () => eq(run('FRA', 'JFK', 'DL', { delayMin: H(3) }).primary.amount, 300));
  test('weather makes it a long shot but keeps the amount', () => {
    const w = run('FRA', 'JFK', 'DL', { delayMin: H(5), cause: 'weather' });
    eq(w.primary.amount, 600);
    eq(w.primary.strength, 'weak');
  });
  test('ATC restrictions: long shot', () => eq(run('FRA', 'JFK', 'DL', { delayMin: H(5), cause: 'atc' }).primary.strength, 'weak'));
  test('airline staff strike: strong (Airhelp v SAS)', () =>
    eq(run('FRA', 'JFK', 'DL', { delayMin: H(5), cause: 'strike-own' }).primary.strength, 'strong'));
  test('knock-on delay: probably owed', () =>
    eq(run('FRA', 'JFK', 'DL', { delayMin: H(5), cause: 'knockon' }).primary.strength, 'likely'));
}

section('Worked example: Ryanair intra-EU cancellation, 5 days notice');
{
  // DUB-BCN is 1,486 km: band (a) €250. Under 7 days' notice with no rerouting: full compensation.
  const v = run('DUB', 'BCN', 'FR', { event: 'cancel', cancel: { notice: '<7', offered: false, took: 'refund' }, cause: 'crew' });
  test('distance is just under 1,500 km', () => near(v.route.distanceKm, 1486, 5));
  test('EU261 pays €250', () => {
    eq(v.primary.id, 'eu261');
    eq(v.primary.amount, 250);
    eq(v.primary.strength, 'strong');
  });
  test('DUB to ATH on Ryanair pays €400 (intra-EU over 1,500 km)', () =>
    eq(run('DUB', 'ATH', 'FR', { event: 'cancel', cancel: { notice: '<7', offered: false, took: 'refund' } }).primary.amount, 400));
  // Art 5(1)(c)(iii): no compensation if rerouted leaving no more than 1h early and arriving less than 2h late.
  test('rerouting 1h30 late with under 7 days notice: nothing owed', () =>
    eq(run('DUB', 'BCN', 'FR', { event: 'cancel', cancel: { notice: '<7', offered: true, departEarlierMin: 0, took: 'reroute' }, delayMin: H(1, 30) }).primary.amount, 0));
  test('rerouting exactly 2h late is not "less than 2 hours": compensation, halved to €125 (Art 7(2)(a))', () => {
    const w = run('DUB', 'BCN', 'FR', { event: 'cancel', cancel: { notice: '<7', offered: true, departEarlierMin: 60, took: 'reroute' }, delayMin: H(2) });
    eq(w.primary.amount, 125);
    eq(w.primary.reduced, true);
  });
  test('rerouting 2h30 late: full €250', () =>
    eq(run('DUB', 'BCN', 'FR', { event: 'cancel', cancel: { notice: '<7', offered: true, departEarlierMin: 0, took: 'reroute' }, delayMin: H(2, 30) }).primary.amount, 250));
  test('rerouting that left 1 to 2h early breaks the exemption: €125', () =>
    eq(run('DUB', 'BCN', 'FR', { event: 'cancel', cancel: { notice: '<7', offered: true, departEarlierMin: 120, took: 'reroute' }, delayMin: H(1) }).primary.amount, 125));
  // Art 5(1)(c)(ii): 7 to 14 days, rerouting up to 2h early and less than 4h late is exempt.
  test('7 to 13 days, rerouted 2h early and 3h59 late: nothing owed', () =>
    eq(run('DUB', 'ATH', 'FR', { event: 'cancel', cancel: { notice: '7-13', offered: true, departEarlierMin: 120, took: 'reroute' }, delayMin: H(3, 59) }).primary.amount, 0));
  test('7 to 13 days, rerouted 4h late: €400', () =>
    eq(run('DUB', 'ATH', 'FR', { event: 'cancel', cancel: { notice: '7-13', offered: true, departEarlierMin: 0, took: 'reroute' }, delayMin: H(4) }).primary.amount, 400));
  test('14+ days notice: nothing owed (Art 5(1)(c)(i))', () =>
    eq(run('DUB', 'BCN', 'FR', { event: 'cancel', cancel: { notice: '14+', offered: false, took: 'refund' } }).primary.amount, 0));
  test('weather cancellation: long shot', () =>
    eq(run('DUB', 'BCN', 'FR', { event: 'cancel', cancel: { notice: '<7', offered: false, took: 'refund' }, cause: 'weather' }).primary.strength, 'weak'));
}

section('Worked example: US domestic cancellation');
{
  // No federal cash compensation; 14 CFR 260.6 refund when the passenger does not accept the alternative.
  const v = run('ORD', 'LAX', 'AA', { event: 'cancel', cancel: { notice: '<7', offered: true, departEarlierMin: 0, took: 'refund' }, delayMin: H(5), cause: 'weather' });
  test('only US rules apply', () => {
    eq(v.results.filter((r) => r.applies).map((r) => r.id).join(','), 'us');
  });
  test('no cash, but a refund', () => {
    eq(v.primary.amount, 0);
    eq(v.primary.basis, 'refund');
    eq(v.headline.amountText, 'REFUND');
  });
  test('a refund letter is offered', () => eq(v.primary.letter.kind, 'us-refund'));
  test('taking the new flight means no refund letter', () => {
    const w = run('ORD', 'LAX', 'AA', { event: 'cancel', cancel: { notice: '<7', offered: true, departEarlierMin: 0, took: 'reroute' }, delayMin: H(5) });
    eq(w.primary.letter, null);
    eq(w.headline.amountText, '$0');
  });
  test('a 5-hour domestic delay pays $0', () => {
    const w = run('ORD', 'LGA', 'UA', { delayMin: H(5) });
    eq(w.primary.id, 'us');
    eq(w.primary.amount, 0);
    eq(w.headline.amountText, '$0');
  });
  test('the notes mention the withdrawn delay compensation proposal', () =>
    ok(v.primary.notes.some((n) => /withdrew/.test(n.text))));
}

section('US denied boarding (14 CFR 250.5)');
{
  const bump = (from, to, airline, late, fare) =>
    run(from, to, airline, { event: 'denied', denied: { voluntary: false }, delayMin: late, fare: fare ? { amount: fare, currency: 'USD' } : null, cause: 'overbooking' });
  test('domestic, replacement within 1 hour: $0', () => eq(bump('ORD', 'LAX', 'AA', 60, 300).primary.amount, 0));
  test('domestic, 61 minutes: 200% of $300 = $600', () => eq(bump('ORD', 'LAX', 'AA', 61, 300).primary.amount, 600));
  test('domestic, 1h59: still 200%', () => eq(bump('ORD', 'LAX', 'AA', 119, 300).primary.amount, 600));
  test('domestic, 2 hours: 400% of $300 = $1,200', () => eq(bump('ORD', 'LAX', 'AA', 120, 300).primary.amount, 1200));
  test('domestic, 200% capped at $1,075', () => eq(bump('ORD', 'LAX', 'AA', 90, 600).primary.amount, 1075));
  test('domestic, 400% capped at $2,150', () => eq(bump('ORD', 'LAX', 'AA', 150, 800).primary.amount, 2150));
  test('international, 3 hours: 200% of $500 = $1,000', () => eq(bump('JFK', 'CDG', 'AA', 180, 500).primary.amount, 1000));
  test('international, 4 hours: 400% of $500 = $2,000', () => eq(bump('JFK', 'CDG', 'AA', 240, 500).primary.amount, 2000));
  test('no fare given: shows the cap as "up to"', () => {
    const v = bump('ORD', 'LAX', 'AA', 150, null);
    eq(v.primary.amount, 2150);
    eq(v.primary.upTo, true);
  });
  test('volunteers get nothing fixed', () =>
    eq(run('ORD', 'LAX', 'AA', { event: 'denied', denied: { voluntary: true }, delayMin: 300 }).primary.amount, 0));
  test('only departures from the US count', () =>
    eq(run('CUN', 'ORD', 'AA', { event: 'denied', denied: { voluntary: false }, delayMin: 300, fare: { amount: 300, currency: 'USD' } }).primary.amount, 0));
}

section('Worked example: Canada, large airline, 7 hours late, within its control');
{
  // APPR s.19(1)(a)(ii): 6 to 9 hours, large carrier: C$700.
  const v = run('YYZ', 'YVR', 'AC', { delayMin: H(7), cause: 'crew' });
  test('APPR pays C$700', () => {
    eq(v.primary.id, 'appr');
    eq(v.primary.amount, 700);
    eq(v.primary.currency, 'CAD');
    eq(v.primary.strength, 'strong');
  });
  test('bands: 2h59 = 0, 3h = 400, 6h = 700, 9h = 1,000', () => {
    eq(run('YYZ', 'YVR', 'AC', { delayMin: H(2, 59), cause: 'crew' }).results.find((r) => r.id === 'appr').amount, 0);
    eq(run('YYZ', 'YVR', 'AC', { delayMin: H(3), cause: 'crew' }).primary.amount, 400);
    eq(run('YYZ', 'YVR', 'AC', { delayMin: H(6), cause: 'crew' }).primary.amount, 700);
    eq(run('YYZ', 'YVR', 'AC', { delayMin: H(9), cause: 'crew' }).primary.amount, 1000);
  });
  test('small airline: C$125 at 3h, C$500 at 9h', () => {
    eq(run('YYZ', 'YHZ', 'PB', { delayMin: H(3), cause: 'crew' }).primary.amount, 125);
    eq(run('YYZ', 'YHZ', 'PB', { delayMin: H(9), cause: 'crew' }).primary.amount, 500);
  });
  test('mechanical problem: "required for safety", a long shot', () =>
    eq(run('YYZ', 'YVR', 'AC', { delayMin: H(7), cause: 'technical' }).primary.strength, 'weak'));
  test('weather: outside their control, a long shot', () =>
    eq(run('YYZ', 'YVR', 'AC', { delayMin: H(7), cause: 'weather' }).primary.strength, 'weak'));
  test('cancellation with a refund: C$400 large, C$125 small (s.19(2))', () => {
    eq(run('YYZ', 'YVR', 'AC', { event: 'cancel', cancel: { notice: '<7', offered: false, took: 'refund' }, cause: 'crew' }).primary.amount, 400);
    eq(run('YYZ', 'YHZ', 'PB', { event: 'cancel', cancel: { notice: '<7', offered: false, took: 'refund' }, cause: 'crew' }).primary.amount, 125);
  });
  test('cancellation announced 14+ days ahead: nothing', () =>
    eq(run('YYZ', 'YVR', 'AC', { event: 'cancel', cancel: { notice: '14+', offered: false, took: 'refund' }, cause: 'crew' }).results.find((r) => r.id === 'appr').amount, 0));
  test('denied boarding: C$900 under 6h, C$1,800 at 6h, C$2,400 at 9h (s.20)', () => {
    const d = (m) => run('YUL', 'YYZ', 'AC', { event: 'denied', denied: { voluntary: false }, delayMin: m, cause: 'overbooking' }).primary.amount;
    eq(d(H(5, 59)), 900);
    eq(d(H(6)), 1800);
    eq(d(H(9)), 2400);
  });
  test('unknown Canadian-bound airline defaults to large', () => {
    const w = assess({ from: A('YYZ'), to: A('YVR'), airline: { name: 'Mystery Air', bloc: 'CA', caSize: null }, event: 'delay', delayMin: H(4), cause: 'crew' });
    eq(w.primary.amount, 400);
  });
}

section('Scope edge cases');
test('JFK to CDG on Air France: EU261 €600 (arriving on an EU carrier)', () => {
  const v = run('JFK', 'CDG', 'AF', { delayMin: H(5) });
  eq(v.primary.id, 'eu261');
  eq(v.primary.amount, 600);
});
test('JFK to CDG on American: no EU261', () => eq(reg(run('JFK', 'CDG', 'AA', { delayMin: H(5) }), 'eu261').applies, false));
test('JFK to CDG on BA: UK261 covers a UK airline flying into the EU (Art 3(1)(b)(ii))', () => {
  const v = run('JFK', 'CDG', 'BA', { delayMin: H(5) });
  eq(v.primary.id, 'uk261');
  eq(v.primary.amount, 520);
});
test('Paris to Reunion is intra-EU: €400 even at 9,000+ km', () => {
  const v = run('CDG', 'RUN', 'UU', { delayMin: H(3, 30) });
  ok(v.route.distanceKm > 9000);
  eq(v.primary.amount, 400);
  eq(v.primary.reduced, false);
});
test('Madrid to Gran Canaria 3h10 late: €400', () => eq(run('MAD', 'LPA', 'IB', { delayMin: H(3, 10) }).primary.amount, 400));
test('Geneva to New York: Switzerland applies EU261, €600', () => eq(run('GVA', 'JFK', 'UA', { delayMin: H(5) }).primary.amount, 600));
test('Reykjavik to New York 3h30 late: €300', () => eq(run('KEF', 'JFK', 'FI', { delayMin: H(3, 30) }).primary.amount, 300));
test('Oslo to Bangkok on Thai 4h late: €600', () => eq(run('OSL', 'BKK', 'TG', { delayMin: H(4) }).primary.amount, 600));
test('Ercan (northern Cyprus) to Istanbul: not covered', () => {
  const v = run('ECN', 'IST', 'PC', { delayMin: H(5) });
  eq(v.primary, null);
  eq(v.headline.status, 'Not covered');
});
test('Gatwick to Tenerife on easyJet UK: UK261 £350', () => {
  const v = run('LGW', 'TFS', 'U2', { delayMin: H(3) });
  eq(v.primary.id, 'uk261');
  eq(v.primary.amount, 350);
  eq(reg(v, 'eu261').applies, false);
});
test('Tenerife to Gatwick on easyJet UK: EU261 €400 leads, UK261 also listed', () => {
  const v = run('TFS', 'LGW', 'U2', { delayMin: H(3) });
  eq(v.primary.id, 'eu261');
  eq(v.primary.amount, 400);
  ok(v.others.some((o) => o.id === 'uk261'));
  ok(/can’t be paid twice/.test(v.othersText));
});
test('Toronto to Frankfurt on Lufthansa, 10h, crew: APPR leads, EU261 also covers', () => {
  const v = run('YYZ', 'FRA', 'LH', { delayMin: H(10), cause: 'crew' });
  eq(v.primary.id, 'appr');
  eq(v.primary.amount, 1000);
  eq(reg(v, 'eu261').amount, 600);
});
test('Toronto to Frankfurt on Lufthansa, technical: EU261 leads (APPR treats it as safety)', () =>
  eq(run('YYZ', 'FRA', 'LH', { delayMin: H(10), cause: 'technical' }).primary.id, 'eu261'));
test('Toronto via Frankfurt to Delhi on one booking: no EU261 (C-451/20)', () => {
  const v = run('YYZ', 'DEL', 'AC', { via: ['FRA'], delayMin: H(6), singleBooking: true, cause: 'crew' });
  eq(reg(v, 'eu261').applies, false);
  ok(/C-451\/20/.test(reg(v, 'eu261').scope.why));
  eq(v.primary.id, 'appr');
});
test('Barcelona via Frankfurt to New York: distance runs first to last airport', () => {
  const v = run('BCN', 'JFK', 'LH', { via: ['FRA'], delayMin: H(4) });
  near(v.route.distanceKm, haversineKm(A('BCN'), A('JFK')), 0.001);
  eq(v.primary.amount, 600);
});
test('separate bookings with a connection get a warning', () => {
  const v = run('BCN', 'JFK', 'LH', { via: ['FRA'], delayMin: H(4), singleBooking: false });
  ok(v.primary.notes.some((n) => /Separate bookings/.test(n.text)));
});
test('unknown airline licensed in the EU flying into the EU is covered', () => {
  const v = assess({ from: A('JFK'), to: A('CDG'), airline: { name: 'Some Air', bloc: 'EU' }, event: 'delay', delayMin: H(5), cause: 'unknown' });
  eq(v.primary.id, 'eu261');
});
test('Miami to Guadeloupe on Air Caraibes: EU261 (outermost region, EU carrier)', () =>
  eq(run('MIA', 'PTP', 'TX', { delayMin: H(5) }).primary.id, 'eu261'));

section('EU denied boarding and downgrades');
test('bumped Amsterdam to Dubai, replacement 5h late: €600', () =>
  eq(run('AMS', 'DXB', 'KL', { event: 'denied', denied: { voluntary: false }, delayMin: H(5), cause: 'overbooking' }).primary.amount, 600));
test('bumped Amsterdam to Dubai, replacement 3h late: halved to €300 (Art 7(2)(c))', () =>
  eq(run('AMS', 'DXB', 'KL', { event: 'denied', denied: { voluntary: false }, delayMin: H(3), cause: 'overbooking' }).primary.amount, 300));
test('volunteering gets no fixed compensation', () =>
  eq(run('AMS', 'DXB', 'KL', { event: 'denied', denied: { voluntary: true }, delayMin: H(5) }).results.find((r) => r.id === 'eu261').amount, 0));
test('downgrade LHR to JFK on a £1,000 fare: 75% = £750', () => {
  const v = run('LHR', 'JFK', 'BA', { event: 'downgrade', fare: { amount: 1000, currency: 'GBP' } });
  eq(v.primary.id, 'uk261');
  eq(v.primary.amount, 750);
});
test('downgrade Paris to Rome on €200: 30% = €60', () =>
  eq(run('CDG', 'FCO', 'AF', { event: 'downgrade', fare: { amount: 200, currency: 'EUR' } }).primary.amount, 60));
test('downgrade Paris to Reunion on €800: 75% = €600', () =>
  eq(run('CDG', 'RUN', 'AF', { event: 'downgrade', fare: { amount: 800, currency: 'EUR' } }).primary.amount, 600));
test('downgrade without a fare shows the percentage', () => {
  const v = run('MAD', 'LPA', 'IB', { event: 'downgrade' });
  eq(v.primary.percent, 50);
  eq(v.headline.amountText, '50%');
});

section('Headline and share text');
test('share text has the amount and no personal details', () => {
  const v = run('FRA', 'JFK', 'LH', { delayMin: H(5) });
  ok(/€600/.test(v.share.text));
  ok(!/FRA|JFK|LH/.test(v.share.text));
});
test('no share for a zero result', () => eq(run('ORD', 'LGA', 'UA', { delayMin: H(5) }).share, null));

section('Money and time formatting');
test('formatMoney', () => {
  eq(formatMoney(600, 'EUR'), '€600');
  eq(formatMoney(520, 'GBP'), '£520');
  eq(formatMoney(1000, 'CAD'), 'C$1,000');
  eq(formatMoney(2150, 'USD'), '$2,150');
  eq(formatMoney(62.5, 'EUR'), '€62.50');
});
test('formatDuration', () => {
  eq(formatDuration(210), '3h 30');
  eq(formatDuration(240), '4 hours');
  eq(formatDurationLong(210), '3 hours 30 minutes');
  eq(formatDurationLong(61), '1 hour 1 minute');
});

section('Rule tables match the law');
test('EU261 amounts are 250 / 400 / 600 (Art 7(1))', () => {
  eq(EU261.amounts.short, 250);
  eq(EU261.amounts.mid, 400);
  eq(EU261.amounts.long, 600);
});
test('UK261 amounts are 220 / 350 / 520', () => {
  eq(UK261.amounts.short, 220);
  eq(UK261.amounts.mid, 350);
  eq(UK261.amounts.long, 520);
});
test('US caps are $1,075 and $2,150; significant change 3h / 6h', () => {
  eq(US_DOT.dbc.lowCap, 1075);
  eq(US_DOT.dbc.highCap, 2150);
  eq(US_DOT.significantChangeMin.domestic, 180);
  eq(US_DOT.significantChangeMin.international, 360);
});
test('APPR: 400/700/1,000 large, 125/250/500 small, 900/1,800/2,400 bumped', () => {
  eq(APPR.large.map((r) => r.amount).join(), '400,700,1000');
  eq(APPR.small.map((r) => r.amount).join(), '125,250,500');
  eq(APPR.deniedBoarding.map((r) => r.amount).join(), '900,1800,2400');
});
test('every source is https and has a checked month', () => {
  for (const [id, s] of Object.entries(SOURCES)) {
    ok(s.url.startsWith('https://'), id);
    ok(/^20\d\d-(0[1-9]|1[0-2])$/.test(s.checked) && s.checked >= '2026-09', id);
  }
});
test('reform note names the regulation and the date it applies', () => {
  ok(SOURCES.euReform.url.includes('2026/2202'), 'eur-lex link');
  const faq = FAQ.find(([q]) => q.includes('EU261 about to change'));
  ok(faq && faq[1].join(' ').includes('23 October 2027'), 'faq date');
});
test('every cause has a note', () => Object.entries(EU_CAUSES).forEach(([k, c]) => ok(c.note && c.ec, k)));

section('Board examples and cheat sheet');
test('board examples produce the advertised amounts', () => {
  const got = EXAMPLES.map((ex) => {
    const v = assess(ex.input);
    return v.primary && v.primary.amount > 0 ? formatMoney(v.primary.amount, v.primary.currency) : '0';
  });
  eq(got.join(' '), '£520 €250 C$700 €600 €400 0');
});
test('cheat sheet has four columns', () => eq(CHEAT_SHEET.columns.length, 4));
test('FAQ entries have questions and answers', () => FAQ.forEach(([q, a]) => ok(q && a && a.length, q)));

section('Claim letters');
const details = { name: 'Sam Rivera', email: 'sam@example.com', flight: 'LH400', date: '2026-09-12', ref: 'ABC123', pax: 1, costs: 0 };
test('EU letter cites Art 7(1)(c), Sturgeon and the amount', () => {
  const { subject, body } = buildLetter(run('FRA', 'JFK', 'LH', { delayMin: H(5), cause: 'technical' }), details);
  ok(/Regulation 261\/2004/.test(subject));
  ok(/Article 7\(1\)\(c\)/.test(body));
  ok(/Sturgeon/.test(body));
  ok(/€600/.test(body));
  ok(/Wallentin-Hermann/.test(body));
  ok(/Luftfahrt-Bundesamt/.test(body));
  ok(/12 September 2026/.test(body));
  ok(/5 hours/.test(body));
});
test('EU letter totals several passengers and costs', () => {
  const { body } = buildLetter(run('FRA', 'JFK', 'LH', { delayMin: H(5) }), { ...details, pax: 3, costs: 40 });
  ok(/€1,840/.test(body), 'expected 3 x 600 + 40');
});
test('EU letter with a halved amount says so', () => {
  const { body } = buildLetter(run('FRA', 'JFK', 'LH', { delayMin: H(3, 30) }), details);
  ok(/50% reduction/.test(body));
  ok(/€300/.test(body));
});
test('UK letter cites UK261 in pounds', () => {
  const { subject, body } = buildLetter(run('JFK', 'LHR', 'BA', { delayMin: H(4) }), details);
  ok(/UK261/.test(subject));
  ok(/£520/.test(body));
  ok(/Article 6\(3\)/.test(body));
});
test('APPR letter cites section 19', () => {
  const { body } = buildLetter(run('YYZ', 'YVR', 'AC', { delayMin: H(7), cause: 'crew' }), details);
  ok(/section 19\(1\)/.test(body));
  ok(/C\$700/.test(body));
  ok(/30 days/.test(body));
});
test('US bump letter cites 14 CFR 250.5', () => {
  const v = run('ORD', 'LAX', 'AA', { event: 'denied', denied: { voluntary: false }, delayMin: 150, fare: { amount: 300, currency: 'USD' } });
  ok(/14 CFR 250\.5/.test(buildLetter(v, details).body));
});
test('US refund letter cites 14 CFR 260.6', () => {
  const v = run('ORD', 'LAX', 'AA', { event: 'cancel', cancel: { notice: '<7', offered: false, took: 'refund' } });
  ok(/14 CFR 260\.6/.test(buildLetter(v, details).body));
});
test('missing details become clear placeholders', () => {
  const { body } = buildLetter(run('FRA', 'JFK', 'LH', { delayMin: H(5) }), { pax: 1 });
  ok(/\[flight number\]/.test(body));
  ok(/\[your full name\]/.test(body));
});

section('Enforcement');
test('every EU, EEA and Swiss country except Liechtenstein has a body', () => {
  const need = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'NO', 'CH'];
  need.forEach((c) => ok(EU_NEBS[c] && EU_NEBS[c].url.startsWith('https://'), c));
});
test('departing Frankfurt goes to the LBA', () => eq(enforcerFor(run('FRA', 'JFK', 'LH', { delayMin: H(5) })).country, 'DE'));
test('arriving in Paris from New York goes to France', () => eq(enforcerFor(run('JFK', 'CDG', 'AF', { delayMin: H(5) })).country, 'FR'));
test('Reunion departures go to France', () => eq(enforcerFor(run('RUN', 'CDG', 'AF', { delayMin: H(5) })).country, 'FR'));
test('three escalation steps for each rulebook', () => {
  eq(escalationSteps(run('FRA', 'JFK', 'LH', { delayMin: H(5) })).length, 3);
  eq(escalationSteps(run('JFK', 'LHR', 'BA', { delayMin: H(5) })).length, 3);
  eq(escalationSteps(run('YYZ', 'YVR', 'AC', { delayMin: H(7), cause: 'crew' })).length, 3);
  eq(escalationSteps(run('ORD', 'LAX', 'AA', { event: 'cancel', cancel: { notice: '<7', offered: false, took: 'refund' } })).length, 3);
});

/* ------------------------------------------------------------------ */
section('Site hygiene');
const TEXT_EXT = new Set(['.html', '.css', '.js', '.mjs', '.md', '.txt', '.xml', '.svg', '.json']);
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (TEXT_EXT.has(extname(name)) || name === 'LICENSE') out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const EM_DASH = String.fromCharCode(0x2014);
const banned = [['Cla', 'ude'], ['Anthr', 'opic'], ['gener', 'ated'], ['Chat', 'GPT']].map((p) => p.join(''));
test('no em dashes anywhere', () => {
  const bad = files.filter((f) => readFileSync(f, 'utf8').includes(EM_DASH));
  eq(bad.length, 0, `em dash in ${bad.join(', ')}`);
});
test('no mention of the tools used to build it', () => {
  const bad = [];
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    for (const w of banned) if (t.includes(w)) bad.push(`${f}: ${w}`);
    // "AI" is also Air India's airline code, so only check the prose files.
    if (/\.(html|md)$/.test(f) && /\bAI\b/.test(t)) bad.push(`${f}: AI`);
  }
  eq(bad.length, 0, bad.join('; '));
});
test('index.html shows when the rules were checked', () =>
  ok(readFileSync(join(ROOT, 'index.html'), 'utf8').includes('Rules last checked September 2026')));
test('no absolute site-root paths in index.html', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  ok(!/(src|href)="\/(?!\/)/.test(html), 'found a root-relative path');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
