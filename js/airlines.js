// Airlines people actually fly, with the country that issued their operating licence.
// That country decides "EU carrier / UK carrier / other" for flights into the EU or UK.
// Groups with several licences (easyJet, Ryanair, Wizz Air, Norwegian) are listed per licence:
// the booking confirmation names the airline that operates the flight.
// Canadian carrier size (large/small) follows the Canadian Transportation Agency's list.
// checked: '2026-09'

import { EU27, EEA_CH } from './geo.js';

// [IATA code, name, licence country, extra search words, options]
const ROWS = [
  // EU, EEA and Swiss licences
  ['A3', 'Aegean Airlines', 'GR'],
  ['OA', 'Olympic Air', 'GR'],
  ['AF', 'Air France', 'FR'],
  ['TO', 'Transavia France', 'FR'],
  ['HV', 'Transavia', 'NL'],
  ['KL', 'KLM', 'NL', 'royal dutch'],
  ['WA', 'KLM Cityhopper', 'NL'],
  ['LH', 'Lufthansa', 'DE'],
  ['CL', 'Lufthansa CityLine', 'DE'],
  ['VL', 'Lufthansa City Airlines', 'DE'],
  ['EN', 'Air Dolomiti', 'IT'],
  ['EW', 'Eurowings', 'DE'],
  ['4Y', 'Discover Airlines', 'DE'],
  ['DE', 'Condor', 'DE'],
  ['X3', 'TUIfly (Germany)', 'DE', 'tui'],
  ['OR', 'TUI fly Netherlands', 'NL', 'tui'],
  ['TB', 'TUI fly Belgium', 'BE', 'tui'],
  ['6B', 'TUI fly Nordic', 'SE', 'tui'],
  ['LX', 'SWISS', 'CH', 'swiss international air lines'],
  ['WK', 'Edelweiss Air', 'CH'],
  ['2L', 'Helvetic Airways', 'CH'],
  ['OS', 'Austrian Airlines', 'AT'],
  ['SN', 'Brussels Airlines', 'BE'],
  ['IB', 'Iberia', 'ES'],
  ['I2', 'Iberia Express', 'ES'],
  ['YW', 'Air Nostrum (Iberia Regional)', 'ES'],
  ['VY', 'Vueling', 'ES'],
  ['UX', 'Air Europa', 'ES'],
  ['V7', 'Volotea', 'ES'],
  ['NT', 'Binter', 'ES', 'binter canarias'],
  ['EI', 'Aer Lingus', 'IE'],
  ['FR', 'Ryanair', 'IE', 'ryanair dac'],
  ['AL', 'Malta Air (Ryanair)', 'MT', 'ryanair'],
  ['RR', 'Buzz (Ryanair)', 'PL', 'ryanair'],
  ['LW', 'Lauda Europe (Ryanair)', 'MT', 'ryanair laudamotion'],
  ['EC', 'easyJet Europe', 'AT', 'easyjet'],
  ['DS', 'easyJet Switzerland', 'CH', 'easyjet'],
  ['W6', 'Wizz Air', 'HU', 'wizzair'],
  ['W4', 'Wizz Air Malta', 'MT', 'wizzair'],
  ['DY', 'Norwegian', 'NO', 'norwegian air shuttle'],
  ['D8', 'Norwegian Air Sweden', 'SE', 'norwegian'],
  ['SK', 'SAS Scandinavian Airlines', 'SE', 'scandinavian'],
  ['AY', 'Finnair', 'FI'],
  ['BT', 'airBaltic', 'LV'],
  ['LO', 'LOT Polish Airlines', 'PL'],
  ['QS', 'Smartwings', 'CZ', 'travel service czech'],
  ['TP', 'TAP Air Portugal', 'PT'],
  ['S4', 'Azores Airlines', 'PT', 'sata'],
  ['SP', 'SATA Air Açores', 'PT', 'sata azores'],
  ['AZ', 'ITA Airways', 'IT', 'alitalia'],
  ['NO', 'Neos', 'IT'],
  ['FB', 'Bulgaria Air', 'BG'],
  ['RO', 'TAROM', 'RO'],
  ['OU', 'Croatia Airlines', 'HR'],
  ['CY', 'Cyprus Airways', 'CY'],
  ['KM', 'KM Malta Airlines', 'MT', 'air malta'],
  ['LG', 'Luxair', 'LU'],
  ['WF', 'Widerøe', 'NO', 'wideroe'],
  ['FI', 'Icelandair', 'IS'],
  ['N0', 'Norse Atlantic Airways', 'NO', 'norse'],
  ['SS', 'Corsair', 'FR'],
  ['BF', 'French bee', 'FR'],
  ['TX', 'Air Caraïbes', 'FR', 'air caraibes'],
  ['UU', 'Air Austral', 'FR'],
  ['XK', 'Air Corsica', 'FR'],
  ['WX', 'CityJet', 'IE'],

  // UK licences
  ['BA', 'British Airways', 'GB'],
  ['CJ', 'BA CityFlyer', 'GB', 'british airways'],
  ['VS', 'Virgin Atlantic', 'GB'],
  ['U2', 'easyJet (UK)', 'GB', 'easyjet'],
  ['LS', 'Jet2', 'GB', 'jet2.com'],
  ['BY', 'TUI Airways (UK)', 'GB', 'tui'],
  ['RK', 'Ryanair UK', 'GB', 'ryanair'],
  ['W9', 'Wizz Air UK', 'GB', 'wizzair'],
  ['LM', 'Loganair', 'GB'],

  // US licences
  ['AA', 'American Airlines', 'US'],
  ['DL', 'Delta Air Lines', 'US'],
  ['UA', 'United Airlines', 'US'],
  ['WN', 'Southwest Airlines', 'US'],
  ['B6', 'JetBlue', 'US'],
  ['AS', 'Alaska Airlines', 'US'],
  ['HA', 'Hawaiian Airlines', 'US'],
  ['NK', 'Spirit Airlines', 'US'],
  ['F9', 'Frontier Airlines', 'US'],
  ['G4', 'Allegiant Air', 'US'],
  ['SY', 'Sun Country Airlines', 'US'],
  ['MX', 'Breeze Airways', 'US'],
  ['OO', 'SkyWest Airlines', 'US', 'united express delta connection american eagle alaska'],
  ['YX', 'Republic Airways', 'US', 'american eagle delta connection united express'],
  ['MQ', 'Envoy Air', 'US', 'american eagle'],
  ['9E', 'Endeavor Air', 'US', 'delta connection'],
  ['OH', 'PSA Airlines', 'US', 'american eagle'],
  ['QX', 'Horizon Air', 'US', 'alaska'],

  // Canadian licences (size under the Air Passenger Protection Regulations)
  ['AC', 'Air Canada', 'CA', '', { caSize: 'large' }],
  ['RV', 'Air Canada Rouge', 'CA', 'rouge', { caSize: 'large' }],
  ['QK', 'Jazz (Air Canada Express)', 'CA', 'air canada express', { caSize: 'large' }],
  ['WS', 'WestJet', 'CA', '', { caSize: 'large' }],
  ['TS', 'Air Transat', 'CA', 'transat', { caSize: 'large' }],
  ['PD', 'Porter Airlines', 'CA', 'porter', { caSize: 'large' }],
  ['F8', 'Flair Airlines', 'CA', 'flair', { caSize: 'large' }],
  ['WG', 'Sunwing', 'CA', '', { caSize: 'large' }],
  ['4N', 'Air North', 'CA', 'yukon', { caSize: 'small' }],
  ['PB', 'PAL Airlines', 'CA', 'provincial', { caSize: 'small' }],
  ['8P', 'Pacific Coastal Airlines', 'CA', '', { caSize: 'small' }],
  ['5T', 'Canadian North', 'CA', '', { caSize: 'small' }],
  ['MO', 'Calm Air', 'CA', '', { caSize: 'small' }],

  // Everyone else
  ['TK', 'Turkish Airlines', 'TR'],
  ['PC', 'Pegasus Airlines', 'TR'],
  ['XQ', 'SunExpress', 'TR'],
  ['VF', 'AJet', 'TR', 'anadolujet'],
  ['JU', 'Air Serbia', 'RS'],
  ['ME', 'Middle East Airlines', 'LB', 'mea'],
  ['LY', 'El Al', 'IL'],
  ['IZ', 'Arkia', 'IL'],
  ['6H', 'Israir', 'IL'],
  ['MS', 'EgyptAir', 'EG'],
  ['AT', 'Royal Air Maroc', 'MA'],
  ['3O', 'Air Arabia Maroc', 'MA'],
  ['TU', 'Tunisair', 'TN'],
  ['BJ', 'Nouvelair', 'TN'],
  ['AH', 'Air Algérie', 'DZ', 'air algerie'],
  ['EK', 'Emirates', 'AE'],
  ['EY', 'Etihad Airways', 'AE'],
  ['FZ', 'flydubai', 'AE'],
  ['G9', 'Air Arabia', 'AE'],
  ['QR', 'Qatar Airways', 'QA'],
  ['GF', 'Gulf Air', 'BH'],
  ['WY', 'Oman Air', 'OM'],
  ['OV', 'SalamAir', 'OM'],
  ['SV', 'Saudia', 'SA', 'saudi arabian airlines'],
  ['XY', 'flynas', 'SA'],
  ['F3', 'flyadeal', 'SA'],
  ['RJ', 'Royal Jordanian', 'JO'],
  ['KU', 'Kuwait Airways', 'KW'],
  ['J9', 'Jazeera Airways', 'KW'],
  ['AI', 'Air India', 'IN', 'vistara'],
  ['IX', 'Air India Express', 'IN'],
  ['6E', 'IndiGo', 'IN'],
  ['SG', 'SpiceJet', 'IN'],
  ['QP', 'Akasa Air', 'IN'],
  ['UL', 'SriLankan Airlines', 'LK'],
  ['PK', 'Pakistan International Airlines', 'PK', 'pia'],
  ['BG', 'Biman Bangladesh Airlines', 'BD'],
  ['SQ', 'Singapore Airlines', 'SG'],
  ['TR', 'Scoot', 'SG'],
  ['CX', 'Cathay Pacific', 'HK'],
  ['UO', 'HK Express', 'HK'],
  ['HX', 'Hong Kong Airlines', 'HK'],
  ['JL', 'Japan Airlines', 'JP', 'jal'],
  ['NH', 'ANA All Nippon Airways', 'JP'],
  ['MM', 'Peach', 'JP'],
  ['KE', 'Korean Air', 'KR'],
  ['OZ', 'Asiana Airlines', 'KR'],
  ['7C', 'Jeju Air', 'KR'],
  ['LJ', 'Jin Air', 'KR'],
  ['CA', 'Air China', 'CN'],
  ['MU', 'China Eastern', 'CN'],
  ['CZ', 'China Southern', 'CN'],
  ['HU', 'Hainan Airlines', 'CN'],
  ['3U', 'Sichuan Airlines', 'CN'],
  ['MF', 'Xiamen Airlines', 'CN'],
  ['BR', 'EVA Air', 'TW'],
  ['CI', 'China Airlines', 'TW'],
  ['JX', 'Starlux Airlines', 'TW'],
  ['TG', 'Thai Airways', 'TH'],
  ['FD', 'Thai AirAsia', 'TH'],
  ['PG', 'Bangkok Airways', 'TH'],
  ['VN', 'Vietnam Airlines', 'VN'],
  ['VJ', 'Vietjet', 'VN'],
  ['MH', 'Malaysia Airlines', 'MY'],
  ['AK', 'AirAsia', 'MY'],
  ['D7', 'AirAsia X', 'MY'],
  ['OD', 'Batik Air Malaysia', 'MY', 'malindo'],
  ['GA', 'Garuda Indonesia', 'ID'],
  ['PR', 'Philippine Airlines', 'PH'],
  ['5J', 'Cebu Pacific', 'PH'],
  ['QF', 'Qantas', 'AU'],
  ['JQ', 'Jetstar', 'AU'],
  ['VA', 'Virgin Australia', 'AU'],
  ['NZ', 'Air New Zealand', 'NZ'],
  ['FJ', 'Fiji Airways', 'FJ'],
  ['ET', 'Ethiopian Airlines', 'ET'],
  ['KQ', 'Kenya Airways', 'KE'],
  ['SA', 'South African Airways', 'ZA'],
  ['WB', 'RwandAir', 'RW'],
  ['AM', 'Aeroméxico', 'MX', 'aeromexico'],
  ['Y4', 'Volaris', 'MX'],
  ['VB', 'Viva Aerobus', 'MX'],
  ['CM', 'Copa Airlines', 'PA'],
  ['AV', 'Avianca', 'CO'],
  ['LA', 'LATAM Airlines', 'CL', 'lan'],
  ['JJ', 'LATAM Airlines Brasil', 'BR', 'tam'],
  ['G3', 'GOL', 'BR'],
  ['AD', 'Azul', 'BR'],
  ['AR', 'Aerolíneas Argentinas', 'AR', 'aerolineas'],
  ['KC', 'Air Astana', 'KZ'],
  ['HY', 'Uzbekistan Airways', 'UZ'],
  ['J2', 'Azerbaijan Airlines', 'AZ', 'azal'],
];

/** Licence bloc for a country code: 'EU' | 'UK' | 'US' | 'CA' | 'OTHER'. */
export function licenceBloc(cc) {
  if (!cc) return null;
  if (EU27.has(cc) || EEA_CH.has(cc)) return 'EU';
  if (cc === 'GB') return 'UK';
  if (cc === 'US') return 'US';
  if (cc === 'CA') return 'CA';
  return 'OTHER';
}

export const AIRLINES = ROWS.map(([code, name, country, extra = '', opts = {}]) => ({
  code,
  name,
  country,
  bloc: licenceBloc(country),
  extra,
  caSize: opts.caSize || null,
}));

const byCode = new Map(AIRLINES.map((a) => [a.code, a]));

export function airlineByCode(code) {
  return byCode.get(String(code || '').toUpperCase()) || null;
}

const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Search airlines by IATA code or name. Exact code first, then name prefix, then anywhere. */
export function searchAirlines(query, limit = 8) {
  const q = fold(query);
  if (!q) return [];
  const scored = [];
  for (const a of AIRLINES) {
    const name = fold(a.name);
    const extra = fold(a.extra);
    let score = -1;
    if (fold(a.code) === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.split(/[\s()-]+/).some((w) => w.startsWith(q))) score = 60;
    else if (extra.split(' ').some((w) => w.startsWith(q))) score = 40;
    else if (name.includes(q)) score = 20;
    if (score >= 0) scored.push({ a, score });
  }
  scored.sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name));
  return scored.slice(0, limit).map((s) => s.a);
}
