// Builds the claim letter from an assessment and the passenger's details. Pure: returns strings.
import { formatMoney, formatDurationLong as formatDuration, EU_CAUSES } from './rules.js';
import { enforcerFor } from './enforcement.js';

const blank = (v, label) => (v ? v : `[${label}]`);

function niceDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}

const CAUSE_WORDS = {
  technical: 'a technical problem with the aircraft',
  crew: 'a crew shortage or crew duty limits',
  ops: 'operational reasons',
  'strike-own': 'a strike by your own staff',
  'strike-other': 'a strike by air traffic control or airport staff',
  atc: 'air traffic control restrictions',
  weather: 'bad weather',
  bird: 'a bird strike',
  security: 'a medical, security or passenger-behaviour incident',
  knockon: 'the late arrival of the aircraft from an earlier flight',
  overbooking: 'overbooking',
};

// Formal versions of the case-law points, for the letter.
const EU_CAUSE_LETTER = {
  technical:
    'The Court of Justice held in Wallentin-Hermann (C-549/07) that a technical problem is not an extraordinary circumstance unless it stems from events which, by their nature or origin, are not inherent in the normal exercise of the carrier’s activity and are beyond its actual control.',
  crew: 'Crew shortages and crew duty-time limits are part of the normal exercise of an air carrier’s activity and are not extraordinary circumstances within the meaning of Article 5(3).',
  ops: 'Operational reasons and failures of the carrier’s own systems are part of the normal exercise of an air carrier’s activity and are not extraordinary circumstances within the meaning of Article 5(3).',
  'strike-own':
    'The Court of Justice held in Airhelp v SAS (C-28/20) that a strike by the operating carrier’s own staff is not an extraordinary circumstance, and in Krüsemann (C-195/17) that the same applies to a spontaneous absence of staff.',
  knockon:
    'A delay caused by the late arrival of the aircraft from a previous flight can only be excused if that previous flight was itself affected by extraordinary circumstances and you took all reasonable measures (LE v TAP, C-74/19).',
};

function euLetter(v, d) {
  const p = v.primary;
  const input = v.input;
  const r = v.route;
  const uk = p.id === 'uk261';
  const reg = uk ? 'UK Regulation 261/2004 (UK261)' : 'Regulation (EC) No 261/2004';
  const regShort = uk ? 'UK261' : 'Regulation 261/2004';
  const cur = p.currency;
  const money = (n) => formatMoney(n, cur);
  const flight = blank(d.flight, 'flight number');
  const date = blank(niceDate(d.date), 'date of flight');
  const ref = blank(d.ref, 'booking reference');
  const airline = input.airline && input.airline.name ? input.airline.name : '[airline]';
  const pax = d.pax || 1;
  const paras = [];

  const via = r.via.length ? ` via ${r.via.map((a) => `${a.city} (${a.code})`).join(' and ')}, all on one booking` : '';
  paras.push(
    `I was booked on flight ${flight} from ${r.from.city} (${r.from.code}) to ${r.to.city} (${r.to.code})${via} on ${date}, booking reference ${ref}.`
  );

  const bandLetter = { short: 'a', mid: 'b', long: 'c' }[p.band];
  const distance = `${Math.round(r.distanceKm).toLocaleString('en-US')} km`;
  const ev = input.event;

  if (ev === 'delay') {
    paras.push(
      `I reached my final destination ${formatDuration(input.delayMin)} after the scheduled arrival time.`
    );
    paras.push(
      uk
        ? `Under Article 6(3) and Article 7 of ${reg}, passengers who reach their final destination three hours or more late are entitled to compensation. This follows the Court of Justice’s rulings in Sturgeon (C-402/07 and C-432/07) and Nelson (C-581/10).`
        : `Under Articles 5, 6 and 7 of ${reg}, as interpreted by the Court of Justice in Sturgeon (C-402/07 and C-432/07) and Nelson (C-581/10), passengers who reach their final destination three hours or more after the scheduled arrival time are entitled to compensation.`
    );
  } else if (ev === 'cancel') {
    const c = input.cancel || {};
    const told = c.notice === '7-13' ? 'between seven and fourteen days' : 'less than seven days';
    let s = `The flight was cancelled and I was told ${told} before the scheduled departure.`;
    if (c.offered && input.delayMin != null) {
      s += ` The alternative flight offered would have reached my final destination ${formatDuration(input.delayMin)} after my original arrival time.`;
    } else if (!c.offered) {
      s += ' I was not offered a replacement flight that met the conditions of Article 5(1)(c).';
    }
    paras.push(s);
    paras.push(
      `Under Article 5(1)(c) and Article 7 of ${reg}, a cancellation notified less than two weeks before departure entitles passengers to compensation unless re-routing within the time limits in Article 5(1)(c)(ii) or (iii) was offered. It was not.`
    );
  } else if (ev === 'denied') {
    let s =
      'I was denied boarding against my will, although I held a confirmed reservation and presented myself for check-in on time.';
    if (input.delayMin != null) s += ` I reached my final destination ${formatDuration(input.delayMin)} later than planned.`;
    paras.push(s);
    paras.push(`Under Article 4(3) and Article 7 of ${reg}, you must compensate passengers denied boarding against their will immediately.`);
  } else if (ev === 'downgrade') {
    paras.push('I was placed in a lower class than the one I had paid for.');
    const priced = p.amount > 0 ? `, which is ${money(p.amount)}` : '';
    paras.push(
      `Under Article 10(2) of ${reg}, you must reimburse ${p.percent}% of the price of the ticket for that flight within seven days${priced}. Following Mennens (C-255/15), the price is the fare for that flight, excluding taxes and charges.`
    );
  }

  if (ev !== 'downgrade') {
    let s = `The great-circle distance of the journey is ${distance}, so the amount due under Article 7(1)(${bandLetter}) is ${money(p.fullAmount)} per passenger.`;
    if (p.reduced) {
      s += ` Applying the 50% reduction in Article 7(2), I claim ${money(p.amount)} per passenger.`;
    }
    paras.push(s);

    const cause = input.cause;
    const cw = CAUSE_WORDS[cause];
    if (ev !== 'denied') {
      if (EU_CAUSE_LETTER[cause]) {
        paras.push(`You told me the disruption was caused by ${cw}. ${EU_CAUSE_LETTER[cause]}`);
      } else if (cw && EU_CAUSES[cause] && EU_CAUSES[cause].ec === 'yes') {
        paras.push(
          `You attributed the disruption to ${cw}. If you rely on Article 5(3), please send me evidence that this circumstance affected my flight specifically and that you took all reasonable measures to avoid the delay. The burden of proof is on you.`
        );
      } else {
        paras.push(
          'If you intend to rely on extraordinary circumstances under Article 5(3), please send me evidence of the specific circumstances and of the reasonable measures you took to avoid them. The burden of proof is on you.'
        );
      }
    }
  }

  if (d.costs > 0) {
    paras.push(
      `While waiting I also spent ${money(d.costs)} on meals, refreshments and other care that you were required to provide under Article 9. I attach the receipts and ask you to reimburse this amount as well.`
    );
  }

  const per = p.amount;
  const total = per * pax + (d.costs || 0);
  const who = pax > 1 ? ` for the ${pax} passengers on this booking (${money(per)} each)` : '';
  const totalTxt = p.amount > 0 ? `${money(total)}${who}` : `the ${p.percent}% reimbursement`;
  paras.push(
    `Please pay ${totalTxt} by bank transfer within 14 days of this letter. Article 7(3) provides for payment in cash, by electronic bank transfer, bank orders or bank cheques. I do not agree to travel vouchers. I will send my bank details on request.`
  );

  const enf = enforcerFor(v);
  const escal = uk
    ? 'an approved alternative dispute resolution scheme or the Civil Aviation Authority'
    : enf
      ? `${enf.name}, the national enforcement body`
      : 'the national enforcement body';
  paras.push(
    `If I have not received payment or a full reply within 14 days, I will refer this to ${escal} and consider legal proceedings without further notice.`
  );

  const subject = `Compensation claim under ${regShort}: flight ${flight} on ${date}, booking ${ref}`;
  return { subject, paras, airline };
}

function apprLetter(v, d) {
  const p = v.primary;
  const input = v.input;
  const r = v.route;
  const flight = blank(d.flight, 'flight number');
  const date = blank(niceDate(d.date), 'date of flight');
  const ref = blank(d.ref, 'booking reference');
  const airline = input.airline && input.airline.name ? input.airline.name : '[airline]';
  const cad = (n) => formatMoney(n, 'CAD');
  const pax = d.pax || 1;
  const paras = [];
  paras.push(
    `I was booked on flight ${flight} from ${r.from.city} (${r.from.code}) to ${r.to.city} (${r.to.code}) on ${date}, booking reference ${ref}.`
  );
  const ev = input.event;
  if (ev === 'denied') {
    paras.push(
      `I was denied boarding against my will and reached my destination ${formatDuration(input.delayMin ?? 0)} after the arrival time on my original ticket.`
    );
    paras.push(
      `Under section 20(1) of the Air Passenger Protection Regulations (SOR/2019-150), you must pay ${cad(p.amount)} per passenger for this delay, no later than 48 hours after the denial of boarding (section 20(2)).`
    );
  } else {
    if (ev === 'cancel' && input.cancel && input.cancel.took === 'refund') {
      paras.push('The flight was cancelled with 14 days’ notice or less, and I chose a refund because the alternative did not meet my travel needs.');
      paras.push(
        `Under section 19(2) of the Air Passenger Protection Regulations (SOR/2019-150), you must pay minimum compensation of ${cad(p.amount)} per passenger in addition to the refund.`
      );
    } else {
      paras.push(
        ev === 'cancel'
          ? `The flight was cancelled with 14 days’ notice or less, and I reached my destination ${formatDuration(input.delayMin ?? 0)} after the arrival time on my original ticket.`
          : `The flight reached my destination ${formatDuration(input.delayMin ?? 0)} after the arrival time on my original ticket.`
      );
      paras.push(
        `Under section 19(1) of the Air Passenger Protection Regulations (SOR/2019-150), a ${input.airline && input.airline.caSize === 'small' ? 'small' : 'large'} carrier must pay ${cad(p.amount)} per passenger for this length of delay when the cause is within its control and not required for safety.`
      );
    }
    const cw = CAUSE_WORDS[input.cause];
    paras.push(
      cw
        ? `You told me the cause was ${cw}. If you consider it outside your control or required for safety, please explain why, as section 13(1) requires.`
        : 'You have not told me the reason for the disruption. Section 13(1) requires you to do so. If you consider it outside your control or required for safety, please explain why.'
    );
  }
  if (d.costs > 0) {
    paras.push(`I also spent ${cad(d.costs)} on food and other care while waiting. I attach the receipts and ask you to reimburse them.`);
  }
  const total = p.amount * pax + (d.costs || 0);
  paras.push(
    `I am making this request within one year of the flight, as section 19(3) requires. Please pay ${cad(total)}${pax > 1 ? ` for the ${pax} passengers on this booking` : ''} in money within 30 days, or explain why compensation is not payable, as section 19(4) requires.`
  );
  paras.push('If this is not resolved within 30 days, I will file a complaint with the Canadian Transportation Agency.');
  const subject = `Compensation request under the Air Passenger Protection Regulations: flight ${flight} on ${date}`;
  return { subject, paras, airline };
}

function usLetter(v, d) {
  const p = v.primary;
  const input = v.input;
  const r = v.route;
  const flight = blank(d.flight, 'flight number');
  const date = blank(niceDate(d.date), 'date of flight');
  const ref = blank(d.ref, 'confirmation code');
  const airline = input.airline && input.airline.name ? input.airline.name : '[airline]';
  const usd = (n) => formatMoney(n, 'USD');
  const paras = [];
  paras.push(
    `I was booked on flight ${flight} from ${r.from.city} (${r.from.code}) to ${r.to.city} (${r.to.code}) on ${date}, confirmation code ${ref}.`
  );
  let subject;
  if (p.letter.kind === 'us-dbc') {
    paras.push(
      `I was involuntarily denied boarding${input.delayMin != null ? ` and the substitute transportation reached my destination ${formatDuration(input.delayMin)} after my original arrival time` : ''}.`
    );
    const exact = p.upTo
      ? `up to ${usd(p.amount)}`
      : `${usd(p.amount)}`;
    paras.push(
      `Under 14 CFR 250.5, I am owed ${p.percent}% of my one-way fare to my destination or first stopover, capped at ${usd(p.percent === 200 ? 1075 : 2150)}: ${exact}. Under 14 CFR 250.8 this should have been paid on the day, in cash or by check.`
    );
    paras.push(`Please pay ${exact} by check or to my original form of payment within 14 days. I do not accept a travel voucher in its place.`);
    subject = `Denied boarding compensation under 14 CFR 250.5: flight ${flight} on ${date}`;
  } else {
    paras.push('The flight was cancelled or significantly changed, and I did not accept the alternative you offered.');
    paras.push(
      'Under 14 CFR 260.6, I am entitled to a full refund of the ticket price, including taxes and fees, and of any unused ancillary fees, paid to my original form of payment. The rule requires this within 7 business days for card purchases and 20 calendar days for other payments.'
    );
    paras.push('Please process the refund now. I do not accept a travel credit or voucher in its place.');
    subject = `Refund request under 14 CFR 260.6: flight ${flight} on ${date}`;
  }
  paras.push('If this is not resolved promptly, I will file a complaint with the US Department of Transportation.');
  return { subject, paras, airline };
}

/**
 * @param {object} v assessment from rules.assess()
 * @param {object} d passenger details from the letter form
 * @returns {{subject: string, body: string}}
 */
export function buildLetter(v, d) {
  const p = v.primary;
  if (!p || !p.letter) return { subject: '', body: '' };
  const kind = p.letter.kind;
  const built = kind === 'appr' ? apprLetter(v, d) : kind.startsWith('us') ? usLetter(v, d) : euLetter(v, d);
  const name = blank(d.name, 'your full name');
  const today = niceDate(new Date().toISOString().slice(0, 10));
  const lines = [];
  lines.push(`To: ${built.airline} Customer Relations`);
  lines.push(`Date: ${today}`);
  lines.push(`Subject: ${built.subject}`);
  lines.push('');
  lines.push('Dear Sir or Madam,');
  lines.push('');
  built.paras.forEach((para) => {
    lines.push(para);
    lines.push('');
  });
  if ((d.pax || 1) > 1) {
    lines.push(`Passengers: ${name}, [names of the other passengers]`);
    lines.push('');
  }
  lines.push('Yours faithfully,');
  lines.push('');
  lines.push(name);
  if (d.address) lines.push(d.address);
  lines.push(blank(d.email, 'your email'));
  return { subject: built.subject, body: lines.join('\n') };
}
