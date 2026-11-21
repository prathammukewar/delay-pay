// Delay Pay rules engine. Pure functions only: no DOM, no network, no storage.
// Every rule carries the source it came from and the month it was last checked against that source.

import { zoneOf, haversineKm, EU_OUTERMOST } from './geo.js';

export const CHECKED = '2026-09';
export const CHECKED_LABEL = 'Rules last checked September 2026';

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export const SOURCES = {
  eu261: {
    title: 'Regulation (EC) No 261/2004 (EUR-Lex)',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32004R0261',
    checked: '2026-09',
  },
  euGuidelines: {
    title: 'European Commission interpretative guidelines (2024)',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52024XC05687',
    checked: '2026-09',
  },
  euRights: {
    title: 'Your Europe: air passenger rights',
    url: 'https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm',
    checked: '2026-09',
  },
  sturgeon: {
    title: 'CJEU Sturgeon, C-402/07 and C-432/07',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:62007CJ0402',
    checked: '2026-09',
  },
  euReform: {
    title: 'Regulation (EU) 2026/2202, the EU261 reform (EUR-Lex)',
    url: 'https://eur-lex.europa.eu/eli/reg/2026/2202/oj/eng',
    checked: '2026-11',
  },
  uk261: {
    title: 'UK Regulation 261/2004 (legislation.gov.uk)',
    url: 'https://www.legislation.gov.uk/eur/2004/261/contents',
    checked: '2026-09',
  },
  caaDelays: {
    title: 'UK CAA: flight delays',
    url: 'https://www.caa.co.uk/air-passengers/travel-problems-and-rights/flight-delays-and-cancellations/delays/',
    checked: '2026-09',
  },
  dotRefunds: {
    title: '14 CFR Part 260, refunds (eCFR)',
    url: 'https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-260',
    checked: '2026-09',
  },
  dotDbc: {
    title: '14 CFR 250.5, denied boarding compensation (eCFR)',
    url: 'https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-250/section-250.5',
    checked: '2026-09',
  },
  dotWithdrawal: {
    title: 'DOT withdraws the delay compensation proposal (90 FR 51230, Nov 17, 2025)',
    url: 'https://www.federalregister.gov/documents/2025/11/17/2025-20042/airline-passenger-rights-withdrawal',
    checked: '2026-09',
  },
  dotDashboard: {
    title: 'DOT airline cancellation and delay dashboard',
    url: 'https://www.transportation.gov/airconsumer/airline-cancellation-delay-dashboard',
    checked: '2026-09',
  },
  dotTarmac: {
    title: '14 CFR 259.4, tarmac delays (eCFR)',
    url: 'https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-259/section-259.4',
    checked: '2026-09',
  },
  appr: {
    title: 'Air Passenger Protection Regulations, SOR/2019-150',
    url: 'https://laws-lois.justice.gc.ca/eng/regulations/SOR-2019-150/FullText.html',
    checked: '2026-09',
  },
  cta: {
    title: 'Canadian Transportation Agency: large and small airlines',
    url: 'https://protection-passager-passenger.otc-cta.gc.ca/en/when-an-issue-happens/large-and-small-airlines',
    checked: '2026-09',
  },
};

const src = (...ids) => ids.map((id) => SOURCES[id]);

/* ------------------------------------------------------------------ */
/* Rule tables                                                         */
/* ------------------------------------------------------------------ */

// EU261 Art. 7(1), Art. 7(2), Art. 6(1), Art. 10(2); delay compensation from Sturgeon (C-402/07, C-432/07).
export const EU261 = {
  checked: '2026-09',
  source: 'eu261',
  currency: 'EUR',
  amounts: { short: 250, mid: 400, long: 600 },
  // Art. 7(2): the airline may halve compensation when the rerouted arrival is within these limits.
  reduceIfWithinMin: { short: 120, mid: 180, long: 240 },
  // Art. 6(1): care is owed once the departure delay reaches these limits.
  careAfterMin: { short: 120, mid: 180, long: 240 },
  refundAfterMin: 300, // Art. 6(1)(iii)
  compensationDelayMin: 180, // Sturgeon: 3 hours or more at final destination
  downgradePct: { short: 30, mid: 50, long: 75 }, // Art. 10(2)
  // Art. 5(1)(c)
  cancellation: {
    noCompIfNoticeDays: 14,
    window7to14: { earlierMaxMin: 120, laterLessThanMin: 240 },
    windowUnder7: { earlierMaxMin: 60, laterLessThanMin: 120 },
  },
};

// UK261: the same regulation as retained in UK law, with sterling amounts (Art. 7(1) as amended).
export const UK261 = {
  checked: '2026-09',
  source: 'uk261',
  currency: 'GBP',
  amounts: { short: 220, mid: 350, long: 520 },
};

// US DOT. 14 CFR 250.5 (bumping), 14 CFR 260 (refunds). Caps in force since Jan 22, 2025.
export const US_DOT = {
  checked: '2026-09',
  currency: 'USD',
  dbc: {
    domestic: { lowMin: 60, highMin: 120 },
    international: { lowMin: 60, highMin: 240 },
    lowPct: 200,
    lowCap: 1075,
    highPct: 400,
    highCap: 2150,
  },
  significantChangeMin: { domestic: 180, international: 360 },
  refundDays: { card: '7 business days', other: '20 calendar days' },
};

// Canada APPR, SOR/2019-150, s. 19 (delay and cancellation) and s. 20 (denied boarding).
export const APPR = {
  checked: '2026-09',
  currency: 'CAD',
  large: [
    { fromMin: 180, amount: 400 },
    { fromMin: 360, amount: 700 },
    { fromMin: 540, amount: 1000 },
  ],
  small: [
    { fromMin: 180, amount: 125 },
    { fromMin: 360, amount: 250 },
    { fromMin: 540, amount: 500 },
  ],
  refundInstead: { large: 400, small: 125 },
  deniedBoarding: [
    { fromMin: 0, amount: 900 },
    { fromMin: 360, amount: 1800 },
    { fromMin: 540, amount: 2400 },
  ],
  noticeDays: 14,
  claimWithinYears: 1,
  replyWithinDays: 30,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SYMBOL = { EUR: '€', GBP: '£', USD: '$', CAD: 'C$' };
// Rough rates, only used to decide which rule to show first. Never shown to anyone.
const APPROX_EUR = { EUR: 1, GBP: 1.17, USD: 0.88, CAD: 0.63 };

export function formatMoney(amount, currency) {
  const n = Math.round(amount * 100) / 100;
  const s = Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${SYMBOL[currency] || ''}${s}`;
}

export function formatDuration(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${h}h ${String(m).padStart(2, '0')}`;
}

/** "3 hours 30 minutes", for letters. */
export function formatDurationLong(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = h ? `${h} hour${h === 1 ? '' : 's'}` : '';
  const ms = m ? `${m} minute${m === 1 ? '' : 's'}` : '';
  return [hs, ms].filter(Boolean).join(' ') || '0 minutes';
}

const km = (d) => `${Math.round(d).toLocaleString('en-US')} km`;

/**
 * EU261 distance band. Intra-EU flights over 1,500 km are always the middle band, however long.
 * @returns {'short'|'mid'|'long'}
 */
export function euBand(distanceKm, intra) {
  if (distanceKm <= 1500) return 'short';
  if (intra) return 'mid';
  if (distanceKm <= 3500) return 'mid';
  return 'long';
}

const FRENCH_DOM = new Set(['GP', 'GF', 'MQ', 'RE', 'YT']);

/** Art. 10(2) downgrade percentage. Flights between mainland Europe and the French overseas departments get 75%. */
export function euDowngradePct(distanceKm, intra, from, to) {
  if (distanceKm <= 1500) return 30;
  const domLink =
    intra &&
    (FRENCH_DOM.has(from.country) !== FRENCH_DOM.has(to.country)) &&
    !(EU_OUTERMOST.has(from.country) && EU_OUTERMOST.has(to.country));
  if (domLink) return 75;
  if (intra || distanceKm <= 3500) return 50;
  return 75;
}

/* ------------------------------------------------------------------ */
/* Causes                                                              */
/* ------------------------------------------------------------------ */

// How EU and UK law treat each cause the airline might give.
// 'no'   : not an extraordinary circumstance, they have to pay
// 'yes'  : usually extraordinary, they can refuse
// 'maybe': depends on facts they must prove
export const EU_CAUSES = {
  unknown: {
    ec: 'maybe',
    note: 'The airline hasn’t named a cause. If it wants to refuse, it has to prove extraordinary circumstances and show it took every reasonable step to avoid the delay. That burden is on them, not you.',
  },
  technical: {
    ec: 'no',
    note: 'Technical faults don’t get them off the hook. The EU Court of Justice ruled in Wallentin-Hermann (C-549/07) that problems found during maintenance or caused by failing to maintain a plane are part of an airline’s normal business. Only rare cases count, like a hidden manufacturing defect the maker or authorities flag.',
  },
  crew: {
    ec: 'no',
    note: 'Crew shortages and crew running out of hours are the airline’s own problem. That is not an extraordinary circumstance.',
  },
  ops: {
    ec: 'no',
    note: '“Operational reasons” and the airline’s own IT failures are part of running an airline. They are not extraordinary circumstances.',
  },
  'strike-own': {
    ec: 'no',
    note: 'A strike by the airline’s own staff doesn’t let it off. The EU Court of Justice said so for a pilots’ strike in Airhelp v SAS (C-28/20, 2021) and for a wildcat walkout in Krüsemann (C-195/17, 2018).',
  },
  'strike-other': {
    ec: 'yes',
    note: 'Strikes by air traffic controllers or airport staff are outside the airline’s control, so they usually count as extraordinary and the airline can refuse. Ask them to show the strike actually hit your flight.',
  },
  atc: {
    ec: 'yes',
    note: 'Air traffic control limits and airport closures usually count as extraordinary circumstances, so they can refuse. They still have to show that decision caused your delay.',
  },
  weather: {
    ec: 'yes',
    note: 'Weather is usually an extraordinary circumstance, so they can refuse. It has to be weather that actually stopped your flight. If other flights left on time, ask them to prove it.',
  },
  bird: {
    ec: 'yes',
    note: 'A bird strike counts as an extraordinary circumstance (Pešková, C-315/15), so they can refuse. But if the plane sat around longer than the checks needed, you can argue the extra time.',
  },
  security: {
    ec: 'yes',
    note: 'Medical emergencies, security alerts and removing a disruptive passenger usually count as extraordinary circumstances, so they can refuse.',
  },
  knockon: {
    ec: 'maybe',
    note: 'A late incoming plane only excuses them if that earlier flight was itself hit by an extraordinary event (LE v TAP, C-74/19). Ask them what delayed the earlier flight. “Knock-on delay” on its own is not a reason.',
  },
  overbooking: {
    ec: 'no',
    note: 'Overbooking is a business choice. It never counts as an extraordinary circumstance.',
  },
};

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export function describeRoute(input) {
  const from = input.from;
  const to = input.to;
  const via = (input.via || []).filter(Boolean);
  const distanceKm = haversineKm(from, to);
  const points = [from, ...via, to];
  const zones = points.map(zoneOf);
  const fromZone = zones[0];
  const toZone = zones[zones.length - 1];
  const allUS = zones.every((z) => z === 'US');
  return {
    from,
    to,
    via,
    distanceKm,
    fromZone,
    toZone,
    viaZones: zones.slice(1, -1),
    singleBooking: input.singleBooking !== false,
    intraEU: fromZone === 'EU' && toZone === 'EU',
    intraUK: fromZone === 'UK' && toZone === 'UK',
    usDomestic: allUS,
    touchesUS: zones.includes('US'),
    touchesCA: zones.includes('CA'),
    touchesEU: zones.includes('EU'),
    touchesUK: zones.includes('UK'),
  };
}

/* ------------------------------------------------------------------ */
/* EU261 and UK261                                                     */
/* ------------------------------------------------------------------ */

function euStyleScope(kind, route, airline) {
  const Z = kind; // 'EU' or 'UK'
  const home = kind === 'EU' ? 'the EU' : 'the UK';
  const place = (a) => `${a.city}`;
  const bloc = airline ? airline.bloc : null;
  const carrierOk = kind === 'EU' ? bloc === 'EU' : bloc === 'UK' || bloc === 'EU';
  if (route.fromZone === Z) {
    return {
      applies: true,
      basis: 'departure',
      why:
        kind === 'EU'
          ? `Your trip started in ${place(route.from)}, inside the EU rules zone, so EU261 covers it on any airline.`
          : `Your trip started in ${place(route.from)}, in the UK, so UK261 covers it on any airline.`,
    };
  }
  if (route.toZone === Z) {
    if (carrierOk) {
      return {
        applies: true,
        basis: 'arrival',
        why:
          kind === 'EU'
            ? `You flew into the EU on an airline licensed in the EU, Iceland, Norway or Switzerland, so EU261 covers it (Art. 3(1)(b)). Those three apply the rules through the EEA and EU-Swiss agreements.`
            : `You flew into the UK on a UK or EU airline, so UK261 covers it.`,
      };
    }
    if (bloc === null) {
      return {
        applies: false,
        maybe: true,
        why:
          kind === 'EU'
            ? 'Flights into the EU are only covered when the airline is licensed in the EU, EEA or Switzerland. Pick the airline to find out.'
            : 'Flights into the UK are only covered on UK or EU airlines. Pick the airline to find out.',
      };
    }
    return {
      applies: false,
      why:
        kind === 'EU'
          ? `Flights into the EU from outside are only covered on EU, EEA or Swiss airlines, and ${airline.name} isn’t one.`
          : `Flights into the UK from outside are only covered on UK or EU airlines, and ${airline.name} isn’t one.`,
    };
  }
  if (kind === 'UK' && route.toZone === 'EU' && route.fromZone !== 'EU' && bloc === 'UK') {
    return {
      applies: true,
      basis: 'arrival',
      why: `You flew into the EU on a UK airline. UK261 covers that too (Art. 3(1)(b)(ii) of the UK version).`,
    };
  }
  const viaIdx = route.viaZones.indexOf(Z);
  if (viaIdx >= 0) {
    const hub = route.via[viaIdx];
    if (route.singleBooking) {
      return {
        applies: false,
        viaNote: true,
        why:
          kind === 'EU'
            ? `Your trip started and ended outside the EU. On one booking, changing planes in ${hub.city} doesn’t bring it under EU261: only the first and last airports count (Airhelp v Austrian, C-451/20).`
            : `Your trip started and ended outside the UK. On one booking, changing planes in ${hub.city} doesn’t bring it under UK261, which treats the trip as a whole (Art. 3(1A)).`,
      };
    }
    return {
      applies: false,
      hubLeg: hub,
      why: `You changed planes in ${hub.city} on separate bookings, so the flight out of ${hub.city} is a trip of its own and ${kind === 'EU' ? 'EU261' : 'UK261'} covers it. Check that flight on its own, starting in ${hub.code}.`,
    };
  }
  return { applies: false, why: `Nothing on this trip starts in ${home}.` };
}

function euStyle(kind, input, route) {
  const T = kind === 'EU' ? EU261 : { ...EU261, ...UK261 };
  const law = kind === 'EU' ? 'EU261' : 'UK261';
  const scope = euStyleScope(kind, route, input.airline);
  // The UK text has no intra-UK wording in Art. 7(1)(b), so only the EU version uses it.
  const intra = kind === 'EU' ? route.intraEU : false;
  const band = euBand(route.distanceKm, intra);
  const full = T.amounts[band];
  const cur = T.currency;
  const money = (n) => formatMoney(n, cur);
  const res = {
    id: kind === 'EU' ? 'eu261' : 'uk261',
    short: law,
    name: kind === 'EU' ? 'EU261' : 'UK261',
    lawName:
      kind === 'EU'
        ? 'Regulation (EC) No 261/2004'
        : 'Regulation (EC) No 261/2004 as it forms part of UK domestic law (UK261)',
    applies: scope.applies,
    scope,
    currency: cur,
    band,
    maxAmount: full,
    amount: 0,
    fullAmount: full,
    reduced: false,
    strength: 'none',
    notes: [],
    care: [],
    sources: kind === 'EU' ? src('eu261', 'euGuidelines', 'sturgeon', 'euReform') : src('uk261', 'caaDelays'),
    letter: null,
  };
  if (!scope.applies) {
    res.notes.push({ tone: 'info', text: scope.why });
    return res;
  }

  const bandText = {
    short: `${km(route.distanceKm)} is 1,500 km or less, so the amount is ${money(T.amounts.short)}.`,
    mid: intra
      ? `${km(route.distanceKm)} inside ${kind === 'EU' ? 'the EU' : 'the UK'}, over 1,500 km, so the amount is ${money(T.amounts.mid)}.`
      : `${km(route.distanceKm)} is between 1,500 and 3,500 km, so the amount is ${money(T.amounts.mid)}.`,
    long: `${km(route.distanceKm)} is over 3,500 km, so the amount is ${money(T.amounts.long)}.`,
  }[band];
  const artBand = { short: 'Art. 7(1)(a)', mid: 'Art. 7(1)(b)', long: 'Art. 7(1)(c)' }[band];
  const cause = EU_CAUSES[input.cause] || EU_CAUSES.unknown;
  const notes = [{ tone: 'good', text: scope.why }];
  const ev = input.event;
  let owed = 0;
  let reduced = false;
  let strengthCap = 'strong';
  let basisText = '';

  if (ev === 'delay') {
    const d = input.delayMin ?? 0;
    if (d < T.compensationDelayMin) {
      notes.push({
        tone: 'warn',
        text: `Cash compensation starts at 3 hours late at your final destination. You were ${formatDuration(d)} late, so there’s no cash under ${law}. You may still have been owed meals and drinks at the airport.`,
      });
      strengthCap = 'none';
    } else {
      owed = full;
      if (band === 'long' && d < 240) {
        owed = full / 2;
        reduced = true;
        notes.push({
          tone: 'info',
          text: `${km(route.distanceKm)} is over 3,500 km, which puts you in the ${money(full)} band. Between 3 and 4 hours late on a flight that long, the airline can pay half, so ${money(owed)}. At 4 hours or more it’s the full ${money(full)}.`,
        });
      } else {
        notes.push({ tone: 'info', text: bandText });
      }
      notes.push({
        tone: 'good',
        text: `The EU Court of Justice ruled in Sturgeon (C-402/07, 2009) that reaching your final destination 3 hours or more late earns the same compensation as a cancellation. Arrival means the moment the doors open (Germanwings, C-452/13).`,
      });
      basisText = 'delay';
    }
  } else if (ev === 'cancel') {
    const c = input.cancel || {};
    const W = T.cancellation;
    const later = input.delayMin;
    if (c.notice === '14+') {
      notes.push({
        tone: 'warn',
        text: `They told you at least 14 days ahead, so no compensation is due (Art. 5(1)(c)(i)). You still get the choice of a full refund or another flight.`,
      });
      strengthCap = 'none';
    } else {
      const win = c.notice === '7-13' ? W.window7to14 : W.windowUnder7;
      const escaped =
        c.offered &&
        later !== null &&
        later !== undefined &&
        (c.departEarlierMin ?? 0) <= win.earlierMaxMin &&
        later < win.laterLessThanMin;
      if (escaped) {
        const noticeTxt = c.notice === '7-13' ? '7 to 13 days' : 'under 7 days';
        notes.push({
          tone: 'warn',
          text: `With ${noticeTxt}’ notice, they only escape paying if the new flight left no more than ${win.earlierMaxMin / 60} hour${win.earlierMaxMin === 60 ? '' : 's'} early and got you there less than ${win.laterLessThanMin / 60} hours late. Yours did both, so no compensation is due (Art. 5(1)(c)).`,
        });
        strengthCap = 'none';
      } else {
        owed = full;
        notes.push({ tone: 'info', text: bandText });
        if (c.offered && later !== null && later !== undefined && later <= T.reduceIfWithinMin[band]) {
          owed = full / 2;
          reduced = true;
          notes.push({
            tone: 'info',
            text: `The new flight got you there within ${T.reduceIfWithinMin[band] / 60} hours of your original arrival, so the airline can cut the payment in half to ${money(owed)} (Art. 7(2)).`,
          });
        } else if (c.offered && (later === null || later === undefined)) {
          notes.push({
            tone: 'info',
            text: `If the flight they offered would have landed within ${T.reduceIfWithinMin[band] / 60} hours of your original arrival, they can pay half (Art. 7(2)). Add how late it got you there to see.`,
          });
        }
        notes.push({
          tone: 'good',
          text: `Cancelled with under 14 days’ notice and no close-enough replacement: that’s compensation under Art. 5(1)(c) and Art. 7. If a travel agent sold you the ticket and never passed the news on, it still counts as not being told (Krijgsman, C-302/16).`,
        });
        basisText = 'cancel';
      }
    }
  } else if (ev === 'denied') {
    const voluntary = input.denied && input.denied.voluntary;
    if (voluntary) {
      notes.push({
        tone: 'warn',
        text: `Volunteers get whatever deal they agreed at the gate instead of fixed compensation (Art. 4(1)). You still get a refund or another flight.`,
      });
      strengthCap = 'none';
    } else {
      owed = full;
      notes.push({ tone: 'info', text: bandText });
      const later = input.delayMin;
      if (later !== null && later !== undefined && later <= T.reduceIfWithinMin[band]) {
        owed = full / 2;
        reduced = true;
        notes.push({
          tone: 'info',
          text: `The replacement got you there within ${T.reduceIfWithinMin[band] / 60} hours of your original arrival, so they can pay half: ${money(owed)} (Art. 7(2)).`,
        });
      }
      notes.push({
        tone: 'good',
        text: `Bumped against your will means compensation straight away (Art. 4(3)), plus a refund or rerouting and care while you wait. They can only refuse boarding without paying for reasons like health, safety, security or missing travel documents.`,
      });
      basisText = 'denied';
    }
  } else if (ev === 'downgrade') {
    const pct = euDowngradePct(route.distanceKm, intra, route.from, route.to);
    res.percent = pct;
    const fare = input.fare;
    if (fare && fare.amount > 0) {
      owed = Math.round(fare.amount * pct) / 100;
      res.currency = fare.currency;
    }
    notes.push({
      tone: 'good',
      text: `A downgrade means they refund ${pct}% of the price of that flight within 7 days (Art. 10(2)). The price means the fare for that flight alone, without taxes and charges (Mennens, C-255/15).`,
    });
    if (!(fare && fare.amount > 0)) {
      notes.push({ tone: 'info', text: `Add what you paid for that flight to see the exact amount.` });
    }
    basisText = 'downgrade';
  }

  // Extraordinary circumstances (not relevant to downgrades or bumping).
  let strength = owed > 0 || (ev === 'downgrade' && res.percent) ? strengthCap : 'none';
  if ((ev === 'delay' || ev === 'cancel') && owed > 0) {
    if (cause.ec === 'yes') {
      strength = 'weak';
      notes.push({ tone: 'warn', text: cause.note });
    } else if (cause.ec === 'maybe') {
      strength = 'likely';
      notes.push({ tone: 'info', text: cause.note });
    } else {
      notes.push({ tone: 'good', text: cause.note });
    }
  }
  if (kind === 'UK' && owed > 0 && (input.cause === 'atc' || input.cause === 'strike-other')) {
    notes.push({
      tone: 'info',
      text: 'Example: after the NATS air traffic control failure on 8 September 2026, the CAA said the delays it caused, knock-on ones included, were likely extraordinary circumstances. Care was still owed.',
    });
  }
  if (ev === 'denied' && owed > 0 && input.cause === 'security') {
    strength = 'likely';
    notes.push({
      tone: 'info',
      text: 'If they refused you for a genuine safety or security reason, they don’t have to pay. If it was really about a full plane, they do.',
    });
  }

  res.amount = owed;
  res.reduced = reduced;
  res.strength = strength;
  res.basis = basisText;
  res.ruleTag = ev === 'downgrade' ? `${law} · Art. 10(2)` : `${law} · ${artBand}`;
  res.notes = notes;
  res.care = euCare(kind, ev, band, input);
  if (owed > 0 || ev === 'downgrade') res.letter = { kind: kind === 'EU' ? 'eu' : 'uk' };
  res.notes.push(...deadlineNotes(kind, route));
  return res;
}

function euCare(kind, ev, band, input) {
  const T = EU261;
  const limit = T.careAfterMin[band] / 60;
  const limitTxt =
    band === 'short'
      ? 'at 2 hours'
      : band === 'mid'
        ? 'at 3 hours'
        : 'at 4 hours';
  const items = [];
  if (ev === 'delay') {
    items.push({
      tone: 'good',
      text: `Meals and drinks in proportion to the wait, starting ${limitTxt} past departure time on a flight this length (Art. 6 and 9). Usually a voucher. If they gave you nothing, keep receipts and claim them back.`,
    });
    items.push({ tone: 'good', text: 'Two phone calls, emails or messages, free.' });
    items.push({
      tone: 'good',
      text: 'A hotel and transport to it if the new departure is the next day.',
    });
    items.push({
      tone: 'good',
      text: 'Delayed 5 hours or more and don’t want to fly any more? A full refund, plus a flight back to where you started if you were mid-trip.',
    });
    void limit;
  } else if (ev === 'cancel' || ev === 'denied') {
    items.push({
      tone: 'good',
      text: 'Your choice of a full refund within 7 days, or another flight to your destination at the earliest opportunity or on a later date you pick (Art. 8).',
    });
    items.push({
      tone: 'good',
      text: 'Meals and drinks while you wait for the new flight, plus two calls or emails (Art. 9).',
    });
    items.push({ tone: 'good', text: 'A hotel and transport to it if you have to wait overnight.' });
  } else {
    items.push({
      tone: 'good',
      text: 'The refund is on top of flying. You don’t lose any other rights, and upgrades never cost you extra.',
    });
  }
  if (ev !== 'downgrade') {
    items.push({
      tone: 'info',
      text: 'Care is owed even when the cause was extraordinary, like weather. Only the cash compensation can be refused.',
    });
  }
  if (kind === 'UK') {
    items.push({ tone: 'info', text: 'UK261 gives the same care rights as EU261.' });
  }
  return items;
}

// Limitation periods we could confirm from an enforcement body or European Consumer Centre.
// EU law leaves the deadline to national law (Cuadrench More v KLM, C-139/11).
export const EU_DEADLINES = {
  DE: { years: 3, who: 'the Luftfahrt-Bundesamt' },
  DK: { years: 3, who: 'ECC Denmark' },
  FR: { years: 5, who: 'service-public.fr' },
  ES: { years: 5, who: 'AESA' },
};

const COUNTRY_NAMES = { DE: 'Germany', DK: 'Denmark', FR: 'France', ES: 'Spain' };

function deadlineNotes(kind, route) {
  if (kind === 'UK') {
    return [
      {
        tone: 'info',
        text: 'Deadline: 6 years to take it to court in England and Wales, 5 in Scotland, counted from the flight (CAA). Don’t wait that long, though: ADR schemes want you within 12 months of the airline’s final answer.',
      },
    ];
  }
  const a = route.fromZone === 'EU' ? route.from : route.to;
  const cc = ['GP', 'GF', 'MQ', 'RE', 'YT', 'MF', 'BL'].includes(a.country) ? 'FR' : a.country;
  const known = EU_DEADLINES[cc];
  const text = known
    ? `Deadline: ${known.years} years if you claim in ${COUNTRY_NAMES[cc]} (per ${known.who}). Each country sets its own limit and some are shorter, so claim now while your boarding pass and receipts are handy.`
    : 'Deadline: each country sets its own (Moré, C-139/11). It’s 3 years in Germany and Denmark and 5 in France and Spain, and some are shorter. Claim now, while your boarding pass and receipts are handy.';
  return [
    { tone: 'info', text },
    {
      tone: 'info',
      text: 'Coming later: the EU261 reform (Regulation 2026/2202) is now law but only applies from 23 October 2027. It keeps the 3-hour rule and the €250, €400 and €600 amounts and adds a 9-month deadline to claim. Today’s rules apply until then.',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* US DOT                                                              */
/* ------------------------------------------------------------------ */

function usDot(input, route) {
  const D = US_DOT;
  const applies = route.touchesUS;
  const res = {
    id: 'us',
    short: 'US DOT',
    name: 'US DOT rules',
    lawName: '14 CFR Parts 250 and 260',
    applies,
    currency: 'USD',
    amount: 0,
    maxAmount: 0,
    fullAmount: 0,
    strength: 'none',
    notes: [],
    care: [],
    sources: src('dotRefunds', 'dotDbc', 'dotWithdrawal'),
    letter: null,
  };
  if (!applies) return res;
  const intl = !route.usDomestic;
  const scKey = intl ? 'international' : 'domestic';
  const scHours = D.significantChangeMin[scKey] / 60;
  const ev = input.event;
  const notes = [];
  const care = [];

  if (ev === 'denied') {
    const departsUS = route.fromZone === 'US';
    if (!departsUS) {
      notes.push({
        tone: 'info',
        text: 'US bumping compensation only covers flights leaving a US airport.',
      });
    } else if (input.denied && input.denied.voluntary) {
      notes.push({
        tone: 'warn',
        text: 'Volunteers get whatever deal they took at the gate. Fixed US bump pay is for people denied boarding against their will.',
      });
    } else {
      const bands = intl ? D.dbc.international : D.dbc.domestic;
      const late = input.delayMin;
      const fare = input.fare && input.fare.currency === 'USD' ? input.fare.amount : null;
      let pct = 0;
      let cap = 0;
      if (late === null || late === undefined) {
        pct = D.dbc.highPct;
        cap = D.dbc.highCap;
      } else if (late <= bands.lowMin) {
        pct = 0;
      } else if (late < bands.highMin) {
        pct = D.dbc.lowPct;
        cap = D.dbc.lowCap;
      } else {
        pct = D.dbc.highPct;
        cap = D.dbc.highCap;
      }
      res.maxAmount = D.dbc.highCap;
      if (pct === 0) {
        notes.push({
          tone: 'warn',
          text: 'They got you there within an hour of your original arrival, so no bump pay is due.',
        });
      } else {
        const amt = fare ? Math.min((fare * pct) / 100, cap) : cap;
        res.amount = Math.round(amt * 100) / 100;
        res.upTo = !fare;
        res.percent = pct;
        res.strength = late === null || late === undefined ? 'likely' : 'strong';
        res.basis = 'dbc';
        const lowTxt = intl ? '1 to 4 hours' : '1 to 2 hours';
        const highTxt = intl ? 'over 4 hours' : '2 hours or more';
        notes.push({
          tone: 'good',
          text: `Bumped involuntarily from a US airport: ${pct}% of your one-way fare, capped at ${formatMoney(cap, 'USD')}. The bands are 200% (max $1,075) if the replacement lands ${lowTxt} late and 400% (max $2,150) if it’s ${highTxt} late${intl ? ' on international trips' : ''} (14 CFR 250.5).`,
        });
        if (!fare) {
          notes.push({ tone: 'info', text: 'Add your one-way fare in dollars to see the exact number. We’re showing the cap.' });
        }
        notes.push({
          tone: 'good',
          text: 'They must pay the same day in cash or by check, or within 24 hours if you leave before it’s ready. You can turn down a voucher and insist on money (14 CFR 250.8).',
        });
        notes.push({
          tone: 'info',
          text: 'No pay is due if a smaller plane was swapped in for safety or operational reasons, or if you missed the check-in deadline.',
        });
        res.letter = { kind: 'us-dbc' };
      }
    }
  } else {
    notes.push({
      tone: 'warn',
      text: 'No US law makes airlines pay cash for a delay or cancellation. DOT floated a rule for it in December 2024 and withdrew it on November 17, 2025.',
    });
    if (ev === 'cancel') {
      const tookRefund = !input.cancel || input.cancel.took === 'refund';
      if (tookRefund) {
        notes.push({
          tone: 'good',
          text: `You didn’t take a new flight, so you’re owed a full cash refund, whatever the cause, weather included (14 CFR 260.6). It’s due within ${D.refundDays.card} on a card, ${D.refundDays.other} otherwise, back to how you paid, with no fee.`,
        });
        res.basis = 'refund';
        res.letter = { kind: 'us-refund' };
      } else {
        notes.push({
          tone: 'info',
          text: 'You flew on the new flight, so there’s no refund for the ticket. Fees for extras you paid for and didn’t get, like a seat upgrade or wifi, have to be refunded (14 CFR 260).',
        });
      }
    } else if (ev === 'delay') {
      const d = input.delayMin ?? 0;
      if (d >= D.significantChangeMin[scKey]) {
        notes.push({
          tone: 'good',
          text: `A ${scHours}-hour-plus delay on ${intl ? 'an international' : 'a domestic'} trip is a “significant change”. If you chose not to fly, you’re owed a full refund (14 CFR 260.2 and 260.6).`,
        });
      } else {
        notes.push({
          tone: 'info',
          text: `If a delay reaches ${scHours} hours (${intl ? 'international' : 'domestic'}) and you decide not to fly, you’re owed a full refund.`,
        });
      }
    } else if (ev === 'downgrade') {
      notes.push({
        tone: 'good',
        text: 'A downgrade counts as a significant change, so you can turn it down and get a full refund (14 CFR 260.2). If you flew anyway, ask for the fare difference. That part isn’t spelled out in federal rules.',
      });
    }
  }

  if (ev === 'delay' || ev === 'cancel') {
    care.push({
      tone: 'good',
      text: 'Nine big US airlines (Alaska, Allegiant, American, Delta, Frontier, Hawaiian, JetBlue, Southwest, United) promise a meal voucher once a delay they caused hits 3 hours, and all but Frontier promise a hotel for an overnight wait. These are promises in their customer service plans, not law.',
      link: { label: 'DOT dashboard', url: SOURCES.dotDashboard.url },
    });
    care.push({
      tone: 'good',
      text: 'Stuck on the plane? Food and water within 2 hours, and a chance to get off by 3 hours (domestic) or 4 hours (international), unless safety or air traffic control stops it (14 CFR 259.4).',
    });
    care.push({
      tone: 'good',
      text: `Cancelled or changed by ${scHours}+ hours and you’d rather not fly: a full refund, not a voucher, unless you agree to one.`,
    });
  } else if (ev === 'denied') {
    care.push({ tone: 'good', text: 'A seat on the next flight, and bump pay on the spot if you didn’t volunteer.' });
    care.push({ tone: 'good', text: 'If you don’t use the ticket, a refund for it.' });
  } else {
    care.push({ tone: 'good', text: 'A full refund if you refuse the downgrade and don’t fly.' });
  }
  res.notes = notes;
  res.care = care;
  if (res.amount > 0 && res.strength === 'none') res.strength = 'strong';
  res.ruleTag = ev === 'denied' ? 'US DOT · 14 CFR 250.5' : 'US DOT · 14 CFR 260';
  return res;
}

/* ------------------------------------------------------------------ */
/* Canada APPR                                                         */
/* ------------------------------------------------------------------ */

// How the APPR treats each cause the airline might give.
// 'control' : within the airline's control, compensation due (s. 12)
// 'safety'  : within its control but required for safety, no compensation (s. 11).
//             The Canada Transportation Act puts mechanical malfunctions here (s. 86.11(1)(b)(ii)).
// 'outside' : outside its control, no compensation and no meals or hotel (s. 10). Includes labour
//             disruptions within the carrier, weather, air traffic control, security, wildlife strikes.
export const APPR_CAUSES = {
  unknown: 'unknown',
  technical: 'safety',
  crew: 'control',
  ops: 'control',
  'strike-own': 'outside',
  'strike-other': 'outside',
  atc: 'outside',
  weather: 'outside',
  bird: 'outside',
  security: 'outside',
  knockon: 'unknown',
  overbooking: 'control',
};

function appr(input, route) {
  const A = APPR;
  const applies = route.touchesCA;
  const res = {
    id: 'appr',
    short: 'APPR',
    name: 'Canada APPR',
    lawName: 'Air Passenger Protection Regulations (SOR/2019-150)',
    applies,
    currency: 'CAD',
    amount: 0,
    maxAmount: 0,
    fullAmount: 0,
    strength: 'none',
    notes: [],
    care: [],
    sources: src('appr', 'cta'),
    letter: null,
  };
  if (!applies) return res;
  const size = (input.airline && input.airline.caSize) || 'large';
  const table = A[size];
  const ev = input.event;
  const notes = [
    {
      tone: 'good',
      text: 'Canada’s rules cover every flight to, from or within Canada, connections included, whatever the airline.',
    },
  ];
  const cat = APPR_CAUSES[input.cause] || 'unknown';
  const pick = (rows, min) => rows.reduce((acc, r) => (min >= r.fromMin ? r.amount : acc), 0);
  const cad = (n) => formatMoney(n, 'CAD');
  res.maxAmount = ev === 'denied' ? A.deniedBoarding[A.deniedBoarding.length - 1].amount : ev === 'downgrade' ? 0 : table[table.length - 1].amount;

  let amount = 0;
  if (ev === 'delay' || ev === 'cancel') {
    const d = input.delayMin;
    if (ev === 'cancel' && input.cancel && input.cancel.notice === '14+') {
      notes.push({
        tone: 'warn',
        text: 'They told you more than 14 days ahead, so there’s no compensation under Canada’s rules (s. 12(3)(d)). You still get rebooked or refunded.',
      });
    } else if (ev === 'cancel' && input.cancel && input.cancel.took === 'refund') {
      amount = A.refundInstead[size];
      notes.push({
        tone: 'info',
        text: `You took a refund instead of a new flight, so the fixed amount is ${cad(amount)} on a ${size} airline, on top of the refund (s. 19(2)).`,
      });
    } else if (d !== null && d !== undefined) {
      amount = pick(table, d);
      if (amount === 0) {
        notes.push({ tone: 'warn', text: 'Compensation starts at 3 hours late at the destination on your ticket.' });
      } else {
        notes.push({
          tone: 'info',
          text: `${formatDuration(d)} late on a ${size} airline: ${cad(amount)}. The steps are ${table.map((r) => cad(r.amount)).join(', ')} at 3, 6 and 9 hours late (s. 19(1)).`,
        });
      }
    } else {
      notes.push({ tone: 'info', text: 'Add how late you got there to see the amount.' });
    }
    if (size === 'large') {
      notes.push({
        tone: 'info',
        text: 'Large means 2 million passengers or more in each of the last two years. Air Canada (with Jazz and Rouge), WestJet, Sunwing, Air Transat, Porter and Flair all count, and so do regional partners flying for them.',
      });
    }
  } else if (ev === 'denied') {
    if (input.denied && input.denied.voluntary) {
      notes.push({ tone: 'warn', text: 'Volunteers get whatever they agreed to in writing, not the fixed amounts (s. 15).' });
    } else {
      const d = input.delayMin ?? 0;
      amount = pick(A.deniedBoarding, d);
      notes.push({
        tone: 'good',
        text: `Bumped against your will: ${cad(amount)}, based on how late you reached your destination (${A.deniedBoarding.map((r) => cad(r.amount)).join(', ')} for under 6, 6 to 9 and 9+ hours). Same for large and small airlines, and it’s due within 48 hours (s. 20).`,
      });
    }
  } else if (ev === 'downgrade') {
    notes.push({
      tone: 'info',
      text: 'Canada has no fixed payout for downgrades. If they rebooked you into a lower class after a delay or cancellation, they must refund the price difference for that part of the trip (s. 18.1(2)).',
    });
  }

  let strength = amount > 0 ? 'strong' : 'none';
  if (amount > 0) {
    if (cat === 'outside') {
      strength = 'weak';
      notes.push({
        tone: 'warn',
        text: 'In Canada, weather, air traffic control, security, wildlife strikes and labour disputes, the airline’s own staff included, count as outside the airline’s control (s. 10). That means no compensation and no meals or hotel. You’re still owed a new flight within 48 hours, or a refund if they can’t manage that (s. 18).',
      });
    } else if (cat === 'safety') {
      strength = 'weak';
      notes.push({
        tone: 'warn',
        text: 'Mechanical problems usually fall under “required for safety”, which pays no compensation but does get you meals and a hotel. The exception is anything caught in scheduled maintenance: that stays within their control and pays. Ask the airline exactly what failed.',
      });
    } else if (cat === 'unknown') {
      strength = 'likely';
      notes.push({
        tone: 'info',
        text: 'The airline has to tell you the reason (s. 13). Compensation depends on it being within their control and not required for safety.',
      });
    } else {
      notes.push({ tone: 'good', text: 'That’s within the airline’s control, so compensation is due (s. 12).' });
    }
  }
  if (amount > 0) {
    notes.push({
      tone: 'info',
      text: `Deadline: file with the airline within ${A.claimWithinYears} year. It has ${A.replyWithinDays} days to pay or explain why not (s. 19(3) and (4)).`,
    });
    notes.push({
      tone: 'info',
      text: 'A proposed overhaul published in December 2024 would make compensation the default unless the airline proves an exception. It isn’t in force yet, so the rules above still apply.',
    });
    res.letter = { kind: 'appr' };
  }
  res.amount = amount;
  res.strength = strength;
  res.notes = notes;
  res.ruleTag = ev === 'denied' ? 'APPR · s. 20' : 'APPR · s. 19';
  res.care =
    ev === 'downgrade'
      ? [{ tone: 'good', text: 'A refund of the fare difference if the lower class came from a rebooking.' }]
      : [
          {
            tone: 'good',
            text: 'Food and drink in reasonable amounts and a way to get in touch once you’ve waited 2 hours past departure, if the cause was within their control (safety reasons included) and they told you less than 12 hours ahead (s. 14).',
          },
          {
            tone: 'good',
            text: 'A hotel or similar, and transport there and back, if you have to wait overnight, on the same conditions.',
          },
          {
            tone: 'good',
            text: 'Within their control: a seat on the next available flight. A large airline has to find you one on its own or a partner’s flight leaving within 9 hours, and failing that, on any airline within 48 hours. If the new plan is no use to you, a refund (s. 17).',
          },
          {
            tone: 'info',
            text: 'Outside their control (weather and the like): a new flight within 48 hours, or your choice of a refund if they can’t do that (s. 18). No meals or hotel required.',
          },
          { tone: 'info', text: 'Updates every 30 minutes until a new departure time is set (s. 13).' },
        ];
  return res;
}

/* ------------------------------------------------------------------ */
/* Main entry                                                          */
/* ------------------------------------------------------------------ */

const STRENGTH_ORDER = { strong: 3, likely: 2, weak: 1, none: 0 };
const STRENGTH_LABEL = { strong: 'Owed', likely: 'Probably owed', weak: 'Long shot', none: 'Not owed' };

/**
 * Assess a disrupted journey.
 * @param {object} input see README for the shape
 */
export function assess(input) {
  const route = describeRoute(input);
  const results = [euStyle('EU', input, route), euStyle('UK', input, route), appr(input, route), usDot(input, route)];
  for (const r of results) {
    r.strengthLabel = r.basis === 'refund' && r.amount === 0 ? 'Refund due' : STRENGTH_LABEL[r.strength];
    r.approxEur = (r.amount || r.maxAmount || 0) * (APPROX_EUR[r.currency] || 1);
  }
  const applicable = results.filter((r) => r.applies);
  // Which rulebook belongs to the country the trip left from. EU261 and UK261 step back for arrivals
  // when the passenger got compensation where they departed (Art. 3(1)(b)), and Canada's rules say
  // no double payment (Canada Transportation Act s. 86.11(3)), so the departure rulebook leads.
  const homeZone = { eu261: 'EU', uk261: 'UK', appr: 'CA', us: 'US' };
  const isHome = (r) => (homeZone[r.id] === route.fromZone ? 1 : 0);
  const paying = applicable
    .filter((r) => r.amount > 0 || (r.percent && r.letter))
    .sort(
      (a, b) =>
        STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength] ||
        isHome(b) - isHome(a) ||
        b.amount * (APPROX_EUR[b.currency] || 1) - a.amount * (APPROX_EUR[a.currency] || 1)
    );
  let primary = paying[0] || null;
  if (!primary) {
    primary =
      applicable.find((r) => r.id === 'eu261' || r.id === 'uk261') ||
      applicable.find((r) => r.id === 'appr') ||
      applicable.find((r) => r.id === 'us') ||
      null;
  }
  const others = applicable.filter((r) => r !== primary && (r.amount > 0 || r.letter));

  // Also-covered text.
  let othersText = '';
  if (others.length && primary) {
    const list = others
      .map((o) => (o.amount > 0 ? `${o.name} (${formatMoney(o.amount, o.currency)})` : o.name))
      .join(' and ');
    othersText = `This trip is also covered by ${list}. You can’t be paid twice for the same disruption, so claim the one that pays more.`;
  }

  const notes = [];
  if (!route.singleBooking && route.via.length && primary) {
    primary.notes.unshift({
      tone: 'warn',
      text: 'Separate bookings are separate trips. For the right answer, check the flight that went wrong on its own, with its own From and To airports.',
    });
  }
  if (!applicable.length) {
    const hub = results.find((r) => r.scope && (r.scope.hubLeg || r.scope.viaNote));
    notes.push({
      tone: 'warn',
      text: 'None of the four rulebooks we check covers this trip: EU261, UK261, Canada’s APPR and the US DOT rules. The countries involved may have their own laws, and the airline’s own conditions of carriage may promise something.',
    });
    if (hub) notes.push({ tone: 'info', text: hub.scope.why });
    const maybe = results.find((r) => r.scope && r.scope.maybe);
    if (maybe) notes.push({ tone: 'info', text: maybe.scope.why });
  } else {
    // Surface hub-leg hints under the primary too.
    for (const r of results) {
      if (!r.applies && r.scope && (r.scope.hubLeg || r.scope.viaNote || r.scope.maybe) && primary && !primary.notes.some((n) => n.text === r.scope.why)) {
        primary.notes.push({ tone: 'info', text: r.scope.why });
      }
    }
  }

  const headline = makeHeadline(input, route, primary);
  const share = makeShare(input, primary);
  return {
    input,
    route,
    results,
    primary,
    others,
    othersText,
    notes,
    care: [],
    headline,
    share,
  };
}

function airlineName(input) {
  return input.airline && input.airline.name ? input.airline.name.replace(/\s*\(.*\)$/, '') : 'The airline';
}

function makeHeadline(input, route, p) {
  if (!p) {
    return {
      status: 'Not covered',
      amountText: '€0',
      amountLabel: 'No compensation rule covers this trip',
      line: 'None of the four rulebooks we check covers this trip.',
    };
  }
  const who = airlineName(input);
  if (p.amount > 0) {
    const money = formatMoney(p.amount, p.currency);
    const status =
      p.strength === 'strong'
        ? 'You are owed'
        : p.strength === 'likely'
          ? 'You are probably owed'
          : 'Worth a try, but a long shot';
    const perPax = p.upTo ? `up to ${money}` : money;
    let line = `${who} owes you ${perPax} under ${p.name}.`;
    if (p.strength === 'weak') {
      line =
        p.id === 'appr'
          ? `${perPax} under ${p.name}, but only if the cause was within the airline’s control after all.`
          : `${perPax} under ${p.name}, but only if the cause wasn’t an extraordinary circumstance.`;
    }
    if (p.basis === 'downgrade') line = `${who} owes you ${p.percent}% of that flight’s fare back under ${p.name}.`;
    if (p.id === 'us' && p.basis === 'dbc') line = `${who} owes you ${perPax} in bump pay under US DOT rules.`;
    const tail = p.basis === 'denied' || p.basis === 'dbc' ? '' : ' That’s per passenger, kids included.';
    return {
      status: p.upTo ? `${status} up to` : status,
      amountText: money,
      amountLabel: `${p.upTo ? 'Up to ' : ''}${money}`,
      line: `${line}${tail}`,
    };
  }
  if (p.basis === 'downgrade' || p.percent) {
    return {
      status: 'You are owed',
      amountText: `${p.percent}%`,
      amountLabel: `${p.percent} percent of the fare`,
      line: `${who} owes you ${p.percent}% of that flight’s fare back under ${p.name}.`,
    };
  }
  if (p.id === 'us') {
    const refund = p.basis === 'refund';
    return {
      status: refund ? 'No cash rule, but' : 'No cash rule',
      amountText: refund ? 'REFUND' : '$0',
      amountLabel: refund ? 'Refund' : 'Zero dollars',
      line: refund
        ? 'US law pays nothing for the cancellation itself, but you’re owed every cent of your ticket back.'
        : 'US law pays nothing for delays. Here’s what you can still get.',
    };
  }
  const cur = p.currency;
  return {
    status: 'Not owed this time',
    amountText: formatMoney(0, cur),
    amountLabel: 'Zero',
    line: `No compensation under ${p.name} for this one. You may still be owed the things below.`,
  };
}

function makeShare(input, p) {
  if (!p || p.amount <= 0) return null;
  const money = formatMoney(p.amount, p.currency);
  const what = {
    delay: `a ${Math.floor((input.delayMin ?? 0) / 60)}-hour flight delay`,
    cancel: 'a cancelled flight',
    denied: 'getting bumped off a flight',
    downgrade: 'a downgraded seat',
  }[input.event];
  const reason = {
    delay: `for a ${Math.floor((input.delayMin ?? 0) / 60)}-hour delay`,
    cancel: 'for a cancelled flight',
    denied: 'for getting bumped',
    downgrade: 'for a downgrade',
  }[input.event];
  return {
    text: `Turns out the airline owes me ${p.upTo ? 'up to ' : ''}${money} for ${what}. Most people never claim it.`,
    top: p.upTo ? 'The airline owes me up to' : 'The airline owes me',
    line: `${reason[0].toUpperCase()}${reason.slice(1)}`,
  };
}

/* ------------------------------------------------------------------ */
/* Content that depends on the rules                                   */
/* ------------------------------------------------------------------ */

const ap = (code, name, city, country, lat, lon) => ({ code, name, city, country, lat, lon });

// Example flights for the departures board. Amounts come from assess(), never typed in by hand.
export const EXAMPLES = [
  {
    status: 'LATE 4H',
    input: {
      from: ap('LHR', 'London Heathrow', 'London', 'GB', 51.471, -0.462),
      to: ap('JFK', 'John F. Kennedy International', 'New York', 'US', 40.64, -73.779),
      airline: { code: 'BA', name: 'British Airways', bloc: 'UK' },
      event: 'delay',
      delayMin: 250,
      cause: 'technical',
    },
  },
  {
    status: 'CANCELLED',
    input: {
      from: ap('BCN', 'Barcelona', 'Barcelona', 'ES', 41.297, 2.078),
      to: ap('FCO', 'Rome Fiumicino', 'Rome', 'IT', 41.8, 12.239),
      airline: { code: 'FR', name: 'Ryanair', bloc: 'EU' },
      event: 'cancel',
      cancel: { notice: '<7', offered: false, took: 'refund' },
      delayMin: null,
      cause: 'crew',
    },
  },
  {
    status: 'LATE 7H',
    input: {
      from: ap('YYZ', 'Toronto Pearson', 'Toronto', 'CA', 43.677, -79.631),
      to: ap('YVR', 'Vancouver', 'Vancouver', 'CA', 49.194, -123.184),
      airline: { code: 'AC', name: 'Air Canada', bloc: 'CA', caSize: 'large' },
      event: 'delay',
      delayMin: 420,
      cause: 'crew',
    },
  },
  {
    status: 'BUMPED',
    input: {
      from: ap('AMS', 'Amsterdam Schiphol', 'Amsterdam', 'NL', 52.309, 4.764),
      to: ap('DXB', 'Dubai International', 'Dubai', 'AE', 25.253, 55.364),
      airline: { code: 'KL', name: 'KLM', bloc: 'EU' },
      event: 'denied',
      denied: { voluntary: false },
      delayMin: 600,
      cause: 'overbooking',
    },
  },
  {
    status: 'LATE 3H',
    input: {
      from: ap('MAD', 'Madrid Barajas', 'Madrid', 'ES', 40.472, -3.561),
      to: ap('LPA', 'Gran Canaria', 'Gran Canaria', 'ES', 27.932, -15.387),
      airline: { code: 'IB', name: 'Iberia', bloc: 'EU' },
      event: 'delay',
      delayMin: 190,
      cause: 'unknown',
    },
  },
  {
    status: 'LATE 5H',
    zeroLabel: '$0',
    input: {
      from: ap('ORD', 'Chicago O’Hare', 'Chicago', 'US', 41.979, -87.905),
      to: ap('LGA', 'LaGuardia', 'New York', 'US', 40.777, -73.873),
      airline: { code: 'UA', name: 'United Airlines', bloc: 'US' },
      event: 'delay',
      delayMin: 300,
      cause: 'crew',
    },
  },
];

export const CHEAT_SHEET = {
  title: 'What the airline owes you',
  columns: [
    {
      name: 'EU261',
      where: 'Leaving the EU, Iceland, Norway or Switzerland on any airline, or arriving on an EU airline',
      rows: [
        ['Up to 1,500 km, 3h+ late', '€250'],
        ['1,500 to 3,500 km, or inside the EU over 1,500 km', '€400'],
        ['Over 3,500 km, 4h+ late', '€600'],
        ['Over 3,500 km, 3 to 4h late', '€300'],
        ['Under 3h late', '€0', true],
      ],
      fine: 'Same amounts for cancellations with under 14 days’ notice and for being bumped. Weather and air traffic control can let them off. Technical faults and their own strikes can’t.',
    },
    {
      name: 'UK261',
      where: 'Leaving the UK on any airline, or arriving on a UK or EU airline',
      rows: [
        ['Up to 1,500 km, 3h+ late', '£220'],
        ['1,500 to 3,500 km', '£350'],
        ['Over 3,500 km, 4h+ late', '£520'],
        ['Over 3,500 km, 3 to 4h late', '£260'],
      ],
      fine: 'Up to 6 years to claim (5 in Scotland). Complaints go to an approved ADR scheme or the CAA.',
    },
    {
      name: 'Canada APPR',
      where: 'Any flight to, from or within Canada, when the cause was within the airline’s control',
      rows: [
        ['3 to 6h late', 'C$400'],
        ['6 to 9h late', 'C$700'],
        ['9h+ late', 'C$1,000'],
        ['Bumped, 9h+ late', 'C$2,400'],
      ],
      fine: 'Amounts are for large airlines. Small ones pay C$125, C$250 and C$500. Bumping pays C$900 to C$2,400 whatever the size. Claim within 1 year.',
    },
    {
      name: 'United States',
      where: 'Flights to, from or within the US',
      rows: [
        ['Delays and cancellations', '$0', true],
        ['Cancelled, or moved 3h+ (6h+ international), and you don’t fly', 'Refund'],
        ['Bumped, replacement lands 1 to 2h late (1 to 4h international)', '200%'],
        ['Bumped, later than that', '400%'],
      ],
      fine: 'Bump pay is a multiple of your one-way fare, capped at $1,075 and $2,150, and due the same day. Card refunds are due within 7 business days.',
    },
  ],
  footer: [
    'Delay counts at your final destination, when the doors open',
    'Every passenger claims separately, kids included',
    'General information, not legal advice',
  ],
};

export const FAQ = [
  [
    'Is this really free? What’s the catch?',
    [
      'No catch. The law already says what you’re owed, and the letter says it back to the airline. AirHelp’s own price list takes 35% of your compensation, VAT included, plus another 15% if it goes to court. Flightright charges 20 to 30% plus VAT. You can send the same claim yourself in two minutes.',
    ],
  ],
  [
    'The airline offered me a voucher. Should I take it?',
    [
      'Only if you want it. Under EU and UK rules, compensation is paid in money unless you sign up for vouchers (Art. 7(3)). In the US, refunds for cancelled flights have to be cash unless you agree otherwise. A voucher worth more than the cash can be a fair deal, but it’s your call, not theirs.',
    ],
  ],
  [
    'What counts as “extraordinary circumstances”?',
    [
      'Things the airline couldn’t control and couldn’t have avoided with reasonable steps: bad weather, air traffic control restrictions, security alerts, bird strikes, strikes by airport or air traffic staff. Technical faults, crew shortages, overbooking and strikes by the airline’s own staff don’t count. The airline has to prove it, and it still has to feed you and find you a hotel either way.',
    ],
  ],
  [
    'My flight had a connection. What counts?',
    [
      'If it was all one booking, what matters is how late you reached your final destination, and the distance is measured from your first airport to your last. Missing a connection because the first flight was late counts. Separate bookings are separate trips.',
    ],
  ],
  [
    'Can everyone on my booking claim?',
    [
      'Yes. Compensation is per passenger, and that includes children with their own seat. A family of four on a long-haul flight that lands 4 hours late in Europe can be owed €2,400 between them.',
    ],
  ],
  [
    'Why doesn’t the US pay for delays?',
    [
      'Because no federal law says it must. The Department of Transportation proposed cash compensation in December 2024 and withdrew the idea in November 2025. What you do get: a refund if you don’t fly after a cancellation or a big change, bump pay if you’re denied boarding, and whatever the airline promised in its customer service plan.',
    ],
  ],
  [
    'Is EU261 about to change?',
    [
      'Yes, but not until 23 October 2027. After 13 years of arguing, the EU signed a reform on 16 September 2026 and published it on 2 October as Regulation 2026/2202. It keeps the 3-hour threshold and the €250, €400 and €600 amounts, gives you 9 months to claim, and changes the cancellation and half-payment rules.',
      'Until 23 October 2027 the 2004 rules are still the law, and that’s what this site applies.',
    ],
  ],
  [
    'What about Canada and the UK?',
    [
      'Canada proposed new rules in December 2024 that would make compensation the default unless the airline proves an exception. They haven’t been finalized, so the current three categories still apply.',
      'The UK is working on a bill that would let the government rewrite passenger rights by regulation later. For now UK261 is unchanged.',
    ],
  ],
  [
    'What happens to my data?',
    [
      'Nothing. There’s no server behind this page. The check, the letter and the share image are all made in your browser, and closing the tab wipes them.',
    ],
  ],
];
