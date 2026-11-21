// Page wiring. All the legal logic lives in rules.js; this file only reads the form and paints results.
import { AUTHOR_NAME, AUTHOR_URL, REPO_URL, SITE_URL, GOATCOUNTER } from './config.js';
import { airportByCode, countryName } from './airports.js';
import { searchAirports } from './airport-search.js';
import { searchAirlines, airlineByCode } from './airlines.js';
import { createCombobox } from './combobox.js';
import { setFlaps } from './flaps.js';
import { assess, formatMoney, EXAMPLES, CHEAT_SHEET, FAQ, CHECKED_LABEL } from './rules.js';
import { buildLetter } from './letter.js';
import { escalationSteps } from './enforcement.js';
import { drawShareCard, fontsReady, canvasToBlob } from './sharecard.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const shortUrl = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/* ---------- Footer links from config ---------- */
function wireConfig() {
  const a = $('#author-link');
  a.href = AUTHOR_URL;
  a.textContent = `Made by ${AUTHOR_NAME}`;
  $('#source-link').href = REPO_URL;
  $('#issue-link').href = `${REPO_URL}/issues`;
  if (GOATCOUNTER) {
    const s = document.createElement('script');
    s.async = true;
    s.src = '//gc.zgo.at/count.js';
    s.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
    document.head.appendChild(s);
  }
}

/* ---------- Theme ---------- */
function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function paintThemeButton() {
  const btn = $('#theme-btn');
  const dark = currentTheme() === 'dark';
  btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  btn.querySelector('use').setAttribute('href', dark ? '#i-sun' : '#i-moon');
}

function wireTheme() {
  paintThemeButton();
  $('#theme-btn').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('delaypay-theme', next);
    } catch {
      /* private mode: the toggle still works for this visit */
    }
    paintThemeButton();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintThemeButton);
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    toast('Copy failed. Select the text and copy it by hand.');
  }
}

/* ---------- Hero board ---------- */
function paintBoard() {
  const body = $('#board-rows');
  body.textContent = '';
  const rows = EXAMPLES.map((ex) => {
    const v = assess(ex.input);
    const amount = v.primary && v.primary.amount > 0 ? formatMoney(v.primary.amount, v.primary.currency) : ex.zeroLabel;
    return { route: `${ex.input.from.code}-${ex.input.to.code}`, status: ex.status, amount, zero: !(v.primary && v.primary.amount > 0) };
  });
  const cells = [];
  for (const r of rows) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    td2.className = 'col-flight';
    const td3 = document.createElement('td');
    td3.className = 'owed';
    tr.append(td1, td2, td3);
    body.appendChild(tr);
    cells.push([td1, r.route, '', 7], [td2, r.status, 'red', 11], [td3, r.amount, r.zero ? 'red' : 'amber', 6]);
  }
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cells.forEach(([el, text, tone, width], i) => {
    const padded = el.classList.contains('owed') ? text.padStart(width, ' ') : text.padEnd(width, ' ');
    setFlaps(el, padded, { tone, animate, label: text });
    if (i === 0) el.dataset.first = '1';
  });
  const clock = $('#board-clock');
  const tick = () => {
    const d = new Date();
    clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 30000);
}

/* ---------- Form state ---------- */
const state = {
  from: null,
  to: null,
  via: [],
  airline: null,
  airlineText: '',
  lastVerdict: null,
  lastInput: null,
};

const describeAirport = (a) => ({
  code: a.code,
  name: a.name,
  sub: `${a.city}, ${countryName(a.country)}`,
});
const displayAirport = (a) => `${a.city} (${a.code})`;

const describeAirline = (a) => ({ code: a.code, name: a.name, sub: `Licensed in ${countryName(a.country)}` });
const displayAirline = (a) => `${a.name} (${a.code})`;

function makeAirportCombo(input, onPick) {
  return createCombobox({
    input,
    search: (q) => searchAirports(q, 8),
    describe: describeAirport,
    display: displayAirport,
    status: $('#combo-status'),
    emptyText: 'No airport matches. Try the city or the three-letter code.',
    onChange: (item) => onPick(item),
  });
}

let comboFrom;
let comboTo;
let comboAirline;
const viaCombos = [];

function pickedLine(el, a) {
  el.textContent = a ? `${a.name} · ${a.city}, ${countryName(a.country)}` : '';
}

function addVia(prefill) {
  if (viaCombos.length >= 3) return;
  const idx = viaCombos.length;
  const row = document.createElement('div');
  row.className = 'via-row';
  const id = `via-${idx}-${Date.now()}`;
  row.innerHTML = `
    <div class="field">
      <label class="label" for="${id}">Connection ${idx + 1}</label>
      <div class="combo">
        <input type="text" id="${id}" placeholder="Where you changed planes">
        <button type="button" class="combo-clear" tabindex="-1" aria-label="Clear connection airport"><svg aria-hidden="true"><use href="#i-x"/></svg></button>
      </div>
    </div>
    <button type="button" class="icon-btn" aria-label="Remove connection ${idx + 1}" style="margin-top:26px"><svg aria-hidden="true"><use href="#i-x"/></svg></button>`;
  $('#via-list').appendChild(row);
  const combo = makeAirportCombo($('input', row), () => {
    state.via = viaCombos.map((c) => c.value).filter(Boolean);
    refreshStub();
  });
  const entry = { combo, row };
  viaCombos.push(entry);
  $('.icon-btn', row).addEventListener('click', () => {
    const i = viaCombos.indexOf(entry);
    viaCombos.splice(i, 1);
    row.remove();
    state.via = viaCombos.map((c) => c.combo.value).filter(Boolean);
    $('#booking-wrap').hidden = viaCombos.length === 0;
    $('#add-via').hidden = false;
    refreshStub();
    $('#add-via').focus();
  });
  if (prefill) combo.setSilently(prefill);
  $('#booking-wrap').hidden = false;
  $('#add-via').hidden = viaCombos.length >= 3;
  if (!prefill) $('input', row).focus();
}

function viaAirports() {
  return viaCombos.map((v) => v.combo.value).filter(Boolean);
}

function radio(name) {
  const r = document.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : null;
}

function minutes(hId, mId) {
  const h = $(hId).value;
  const m = $(mId).value;
  if (h === '' && m === '') return null;
  const total = (parseInt(h || '0', 10) || 0) * 60 + (parseInt(m || '0', 10) || 0);
  return Math.max(0, total);
}

function currentAirline() {
  if (state.airline) return state.airline;
  const text = $('#airline').value.trim();
  if (!text) return null;
  const bloc = radio('licence');
  return { code: '', name: text, country: null, bloc: bloc || null, caSize: null, unknown: true };
}

function readInput() {
  const event = radio('event');
  const airline = currentAirline();
  const caSizeAnswer = radio('casize');
  const fareVal = parseFloat($('#fare').value);
  const input = {
    from: state.from,
    to: state.to,
    via: viaAirports(),
    singleBooking: $('#single-booking').checked,
    airline: airline
      ? { ...airline, caSize: airline.caSize || (needsCaSize() ? caSizeAnswer : null) }
      : null,
    event,
    cause: $('#cause').value,
    delayMin: null,
    cancel: null,
    denied: null,
    fare: Number.isFinite(fareVal) && fareVal > 0 ? { amount: fareVal, currency: $('#fare-cur').value } : null,
  };
  if (event === 'delay') input.delayMin = minutes('#delay-h', '#delay-m');
  if (event === 'cancel') {
    const offered = radio('offered') === 'yes';
    input.cancel = {
      notice: radio('notice'),
      offered,
      departEarlierMin: offered ? parseInt($('#depart-early').value, 10) : null,
      took: offered ? radio('took') : 'refund',
    };
    input.delayMin = offered ? minutes('#re-h', '#re-m') : null;
  }
  if (event === 'denied') {
    input.denied = { voluntary: radio('voluntary') === 'yes' };
    input.delayMin = minutes('#dn-h', '#dn-m');
  }
  return input;
}

function touchesZone(zone) {
  const all = [state.from, state.to, ...viaAirports()].filter(Boolean);
  return all.some((a) => (zone === 'CA' ? a.country === 'CA' : false));
}

function needsCaSize() {
  if (!touchesZone('CA')) return false;
  const a = currentAirline();
  return !!a && !a.caSize;
}

function showEventFields() {
  const ev = radio('event');
  $('#delay-wrap').hidden = ev !== 'delay';
  $('#cancel-wrap').hidden = ev !== 'cancel';
  $('#denied-wrap').hidden = ev !== 'denied';
  $('#reroute-wrap').hidden = radio('offered') !== 'yes';
  const usDeparture = state.from && (state.from.country === 'US' || ['PR', 'VI', 'GU', 'AS', 'MP'].includes(state.from.country));
  const showFare = ev === 'downgrade' || (ev === 'denied' && usDeparture);
  $('#fare-wrap').hidden = !showFare;
  $('#fare-label').textContent =
    ev === 'downgrade' ? 'What did you pay for the downgraded flight?' : 'What did you pay for that flight, one way?';
  $('#fare-hint').textContent =
    ev === 'downgrade'
      ? 'Just that flight, not the whole trip. Under EU and UK rules taxes and airport charges don’t count, so use the fare.'
      : 'US bump pay is a multiple of your one-way fare, taxes and fees included.';
  if (showFare && !$('#fare').value) {
    const cur = usDeparture ? 'USD' : state.from?.country === 'GB' ? 'GBP' : state.from?.country === 'CA' ? 'CAD' : 'EUR';
    $('#fare-cur').value = cur;
  }
  $('#casize-wrap').hidden = !needsCaSize();
}

function refreshStub() {
  const f = state.from;
  const t = state.to;
  const setCode = (el, cityEl, a, fallback) => {
    el.textContent = a ? a.code : '---';
    el.classList.toggle('empty', !a);
    cityEl.textContent = a ? a.city : fallback;
  };
  setCode($('#stub-from'), $('#stub-from-city'), f, 'From');
  setCode($('#stub-to'), $('#stub-to-city'), t, 'To');
  const a = currentAirline();
  $('#stub-airline').textContent = a ? (a.code || a.name) : '-';
  if (f && t) {
    const v = assess({ ...readInput(), event: 'delay', delayMin: 600, cause: 'unknown' });
    $('#stub-dist').textContent = `${Math.round(v.route.distanceKm).toLocaleString('en-US')} km`;
    const names = v.results.filter((r) => r.applies).map((r) => r.short);
    $('#stub-rules').textContent = names.length ? names.join(' + ') : 'None';
    const best = v.results.filter((r) => r.applies && r.maxAmount > 0).sort((x, y) => y.approxEur - x.approxEur)[0];
    $('#stub-top').textContent = best ? formatMoney(best.maxAmount, best.currency) : '$0 cash';
  } else {
    $('#stub-dist').textContent = '-';
    $('#stub-rules').textContent = '-';
    $('#stub-top').textContent = '-';
  }
  showEventFields();
}

/* ---------- Verdict rendering ---------- */

// Size the big flap tiles so the whole amount fits on one line at any width.
function sizeFlaps(el) {
  const n = Number(el.dataset.len || 4);
  const avail = el.clientWidth || 300;
  const size = Math.max(40, Math.min(132, Math.floor(avail / (n * 0.78 + (n - 1) * 0.05 + 0.1))));
  el.style.setProperty('--flap-size', `${size}px`);
}
window.addEventListener('resize', () => {
  const el = document.querySelector('.vamount');
  if (el) sizeFlaps(el);
});
const ICON = { good: '#i-check', warn: '#i-warn', info: '#i-info' };

function noteItem(n) {
  const li = document.createElement('li');
  li.className = n.tone || 'info';
  li.innerHTML = `<svg aria-hidden="true"><use href="${ICON[n.tone] || ICON.info}"/></svg><span></span>`;
  const span = li.querySelector('span');
  span.textContent = n.text;
  if (n.link) {
    span.append(' ');
    const a = document.createElement('a');
    a.href = n.link.url;
    a.textContent = n.link.label;
    a.rel = 'noopener';
    a.target = '_blank';
    span.appendChild(a);
  }
  return li;
}

function renderVerdict(v) {
  const box = $('#verdict');
  const board = $('#vboard');
  const p = v.primary;
  board.textContent = '';

  const top = document.createElement('div');
  top.className = 'vboard-top';
  const route = [v.route.from.code, ...v.route.via.map((x) => x.code), v.route.to.code].join(' › ');
  top.innerHTML = `<span><strong></strong></span><span></span>`;
  top.children[0].firstChild.textContent = route;
  top.children[1].textContent = `${Math.round(v.route.distanceKm).toLocaleString('en-US')} km great-circle`;
  board.appendChild(top);

  const status = document.createElement('div');
  status.className = 'vstatus';
  status.textContent = v.headline.status;
  board.appendChild(status);

  const amount = document.createElement('div');
  amount.className = 'vamount';
  board.appendChild(amount);
  const muted = !p || p.amount <= 0;
  amount.dataset.len = String([...v.headline.amountText].length);
  sizeFlaps(amount);
  setFlaps(amount, v.headline.amountText, {
    tone: muted ? 'muted' : '',
    label: v.headline.amountLabel,
  });

  const line = document.createElement('p');
  line.className = 'vline';
  line.textContent = v.headline.line;
  board.appendChild(line);

  const tags = document.createElement('div');
  tags.className = 'vrule';
  if (p) {
    const t1 = document.createElement('span');
    t1.className = `tag ${p.strength}`;
    t1.textContent = p.strengthLabel;
    const t2 = document.createElement('span');
    t2.className = 'tag plain';
    t2.textContent = p.ruleTag;
    tags.append(t1, t2);
  }
  board.appendChild(tags);

  const notes = $('#v-notes');
  notes.textContent = '';
  (p ? p.notes : v.notes).forEach((n) => notes.appendChild(noteItem(n)));

  const also = $('#v-also');
  also.textContent = '';
  if (v.others.length) {
    const s = document.createElement('p');
    s.style.margin = '0';
    s.textContent = v.othersText;
    also.appendChild(s);
  }

  const care = $('#v-care');
  care.textContent = '';
  (p ? p.care : v.care).forEach((n) => care.appendChild(noteItem(n)));

  const cites = $('#v-cites');
  cites.textContent = '';
  const srcs = p ? p.sources : [];
  if (srcs.length) {
    cites.append('Sources: ');
    srcs.forEach((s, i) => {
      const a = document.createElement('a');
      a.href = s.url;
      a.textContent = s.title;
      a.target = '_blank';
      a.rel = 'noopener';
      cites.appendChild(a);
      if (i < srcs.length - 1) cites.append(' · ');
    });
    cites.append(`. ${CHECKED_LABEL}.`);
  }

  box.hidden = false;
  const claimable = p && p.letter;
  $('#to-letter').hidden = !claimable;
  $('#letter').hidden = !claimable;
  $('#share').hidden = !(p && p.amount > 0);
  $('#to-share').hidden = !(p && p.amount > 0);
  if (claimable) paintLetter();
  if (p && p.amount > 0) paintShare();
}

/* ---------- Letter ---------- */
function letterDetails() {
  return {
    name: $('#l-name').value.trim(),
    email: $('#l-email').value.trim(),
    flight: $('#l-flight').value.trim().toUpperCase(),
    date: $('#l-date').value,
    ref: $('#l-ref').value.trim().toUpperCase(),
    pax: Math.max(1, parseInt($('#l-pax').value || '1', 10) || 1),
    address: $('#l-address').value.trim(),
    costs: parseFloat($('#l-costs').value) || 0,
    airlineEmail: $('#l-airline-email').value.trim(),
  };
}

let letterDirty = false;

function paintLetter() {
  const v = state.lastVerdict;
  if (!v || !v.primary) return;
  const d = letterDetails();
  const { subject, body } = buildLetter(v, d);
  if (!letterDirty) $('#letter-text').value = body;
  const mail = $('#mail-letter');
  const text = $('#letter-text').value;
  mail.href = `mailto:${encodeURIComponent(d.airlineEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  mail.dataset.subject = subject;

  const steps = $('#steps');
  steps.textContent = '';
  escalationSteps(v).forEach((s) => {
    const li = document.createElement('li');
    const h = document.createElement('h4');
    h.textContent = s.title;
    li.appendChild(h);
    s.body.forEach((para) => {
      const p = document.createElement('p');
      p.textContent = para;
      li.appendChild(p);
    });
    (s.links || []).forEach((l) => {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = l.url;
      a.textContent = l.label;
      a.target = '_blank';
      a.rel = 'noopener';
      p.appendChild(a);
      li.appendChild(p);
    });
    steps.appendChild(li);
  });
}

function wireLetter() {
  $$('#letter-form input').forEach((el) =>
    el.addEventListener('input', () => {
      letterDirty = false;
      paintLetter();
    })
  );
  $('#letter-text').addEventListener('input', () => {
    letterDirty = true;
    const d = letterDetails();
    $('#mail-letter').href = `mailto:${encodeURIComponent(d.airlineEmail)}?subject=${encodeURIComponent(
      $('#mail-letter').dataset.subject || ''
    )}&body=${encodeURIComponent($('#letter-text').value)}`;
  });
  $('#copy-letter').addEventListener('click', () => copyText($('#letter-text').value, 'Letter copied'));
}

/* ---------- Share ---------- */
// A link that opens the checker with this flight filled in, for the people who were on it.
function flightLink(input) {
  const q = new URLSearchParams();
  q.set('from', input.from.code);
  q.set('to', input.to.code);
  const via = input.via.map((a) => a.code).filter(Boolean);
  if (via.length) {
    q.set('via', via.join(','));
    if (!input.singleBooking) q.set('separate', '1');
  }
  if (input.airline && input.airline.code) q.set('airline', input.airline.code);
  if (input.event === 'delay') {
    q.set('late', String(input.delayMin));
    if (input.cause !== 'unknown') q.set('cause', input.cause);
  } else {
    q.set('ev', input.event);
  }
  return `${SITE_URL}?${q}`;
}

function crewText() {
  const p = state.lastVerdict.primary;
  const money = `${p.upTo ? 'up to ' : ''}${formatMoney(p.amount * 1, p.currency)}`;
  const input = state.lastInput;
  const link = flightLink(input);
  return input.event === 'delay'
    ? `You were on that flight too, so the airline probably owes you ${money} as well. I filled the flight in, so it’s one tap to see yours: ${link}`
    : `You were on that flight too, so the airline might owe you ${money} as well. The route is already filled in: ${link}`;
}

function shareData() {
  const v = state.lastVerdict;
  const p = v.primary;
  const amount = formatMoney(p.amount * 1, p.currency);
  const text = `${v.share.text} Check yours in 30 seconds: ${SITE_URL}`;
  return { amount, text, card: { top: v.share.top, amount, line: v.share.line, rule: p.short, url: shortUrl } };
}

async function paintShare() {
  const { text, card } = shareData();
  $('#share-text').textContent = text;
  $('#crew-text').textContent = crewText();
  const canvas = $('#share-card');
  drawShareCard(canvas, card);
  canvas.setAttribute('aria-label', `Share card: ${card.top} ${card.amount}. ${card.line}. ${shortUrl}`);
  await fontsReady();
  drawShareCard(canvas, card);
}

function wireShare() {
  $('#crew-copy').addEventListener('click', () => copyText(crewText(), 'Message copied'));
  const crewBtn = $('#crew-native');
  if (!navigator.share) crewBtn.hidden = true;
  crewBtn.addEventListener('click', async () => {
    try {
      await navigator.share({ text: crewText() });
    } catch {
      /* user closed the share sheet */
    }
  });
  $('#copy-share').addEventListener('click', () => copyText(shareData().text, 'Share text copied'));
  $('#save-card').addEventListener('click', async () => {
    const blob = await canvasToBlob($('#share-card'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'delay-pay.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  $('#copy-card').addEventListener('click', async () => {
    try {
      const blob = await canvasToBlob($('#share-card'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Image copied');
    } catch {
      toast('Your browser won’t copy images. Use Download instead.');
    }
  });
  const nativeBtn = $('#share-native');
  if (!navigator.share) nativeBtn.hidden = true;
  nativeBtn.addEventListener('click', async () => {
    const { text } = shareData();
    try {
      const blob = await canvasToBlob($('#share-card'));
      const file = new File([blob], 'delay-pay.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ text, files: [file] });
      } else {
        await navigator.share({ text, url: SITE_URL });
      }
    } catch {
      /* user closed the share sheet */
    }
  });
}

/* ---------- Cheat sheet and FAQ ---------- */
function paintCheat() {
  const box = $('#cheat-card');
  const head = document.createElement('div');
  head.className = 'cheat-head';
  const h = document.createElement('h3');
  h.textContent = CHEAT_SHEET.title;
  const s = document.createElement('span');
  s.textContent = `${shortUrl} · checked ${CHECKED_LABEL.replace('Rules last checked ', '')}`;
  head.append(h, s);
  const grid = document.createElement('div');
  grid.className = 'cheat-grid';
  CHEAT_SHEET.columns.forEach((col) => {
    const c = document.createElement('div');
    c.className = 'cheat-col';
    const h4 = document.createElement('h4');
    h4.textContent = col.name;
    const where = document.createElement('div');
    where.className = 'where';
    where.textContent = col.where;
    const dl = document.createElement('dl');
    col.rows.forEach(([k, val, zero]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = val;
      if (zero) dd.className = 'zero';
      d.append(dt, dd);
      dl.appendChild(d);
    });
    c.append(h4, where, dl);
    if (col.fine) {
      const f = document.createElement('p');
      f.className = 'fine';
      f.textContent = col.fine;
      c.appendChild(f);
    }
    grid.appendChild(c);
  });
  const foot = document.createElement('div');
  foot.className = 'cheat-foot';
  CHEAT_SHEET.footer.forEach((t) => {
    const sp = document.createElement('span');
    sp.textContent = t;
    foot.appendChild(sp);
  });
  box.append(head, grid, foot);
}

function paintFaq() {
  const list = $('#faq-list');
  FAQ.forEach(([q, a]) => {
    const d = document.createElement('details');
    const s = document.createElement('summary');
    s.innerHTML = '<span></span><svg aria-hidden="true"><use href="#i-plus"/></svg>';
    s.firstChild.textContent = q;
    d.appendChild(s);
    (Array.isArray(a) ? a : [a]).forEach((para) => {
      const p = document.createElement('p');
      p.textContent = para;
      d.appendChild(p);
    });
    list.appendChild(d);
  });
}

/* ---------- Submit ---------- */
function validate(input) {
  let ok = true;
  const setErr = (id, inputId, msg) => {
    $(id).textContent = msg;
    if (inputId) $(inputId).setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) ok = false;
  };
  setErr('#from-err', '#from', input.from ? '' : 'Pick the airport you flew from.');
  setErr('#to-err', '#to', input.to ? '' : 'Pick your final destination.');
  if (input.from && input.to && input.from.code === input.to.code) {
    setErr('#to-err', '#to', 'That’s the same airport you left from.');
  }
  setErr('#delay-err', null, input.event === 'delay' && input.delayMin === null ? 'Add how late you arrived, even roughly.' : '');
  return ok;
}

function onSubmit(e) {
  e.preventDefault();
  const input = readInput();
  if (!validate(input)) {
    const first = $('[aria-invalid="true"]') || (input.event === 'delay' && input.delayMin === null ? $('#delay-h') : null);
    if (first) first.focus();
    $('#form-status').textContent = 'A couple of details are missing.';
    return;
  }
  $('#form-status').textContent = '';
  const v = assess(input);
  state.lastVerdict = v;
  state.lastInput = input;
  renderVerdict(v);
  const box = $('#verdict');
  box.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  box.focus({ preventScroll: true });
}

function wireForm() {
  comboFrom = makeAirportCombo($('#from'), (a) => {
    state.from = a;
    pickedLine($('#from-picked'), a);
    if (a) $('#from-err').textContent = '';
    $('#from').setAttribute('aria-invalid', 'false');
    refreshStub();
  });
  comboTo = makeAirportCombo($('#to'), (a) => {
    state.to = a;
    pickedLine($('#to-picked'), a);
    if (a) $('#to-err').textContent = '';
    $('#to').setAttribute('aria-invalid', 'false');
    refreshStub();
  });
  comboAirline = createCombobox({
    input: $('#airline'),
    search: (q) => searchAirlines(q, 8),
    describe: describeAirline,
    display: displayAirline,
    status: $('#combo-status'),
    emptyText: 'Not on our list. Keep typing the name and answer one quick question below.',
    onChange: (item, text) => {
      state.airline = item;
      state.airlineText = text;
      $('#airline-picked').textContent = item ? `Licensed in ${countryName(item.country)}` : '';
      $('#licence-wrap').hidden = !!item || !text;
      refreshStub();
    },
  });

  $('#add-via').addEventListener('click', () => addVia());
  $$('input[name="event"], input[name="offered"], input[name="licence"], input[name="casize"]').forEach((r) =>
    r.addEventListener('change', refreshStub)
  );
  $$('.quick button').forEach((b) =>
    b.addEventListener('click', () => {
      $('#delay-h').value = b.dataset.h;
      $('#delay-m').value = b.dataset.m;
      $('#delay-err').textContent = '';
    })
  );
  $('#checker').addEventListener('submit', onSubmit);
  // After the first result, keep it in sync as people tweak answers.
  $('#checker').addEventListener('change', () => {
    if (state.lastVerdict && !$('#verdict').hidden) {
      const input = readInput();
      if (input.from && input.to && !(input.event === 'delay' && input.delayMin === null)) {
        const v = assess(input);
        state.lastVerdict = v;
        state.lastInput = input;
        renderVerdict(v);
      }
    }
  });
}

function init() {
  wireConfig();
  wireTheme();
  paintBoard();
  wireForm();
  wireLetter();
  wireShare();
  paintCheat();
  paintFaq();
  refreshStub();
  // Handy for testing and for links like ?from=JFK&to=LHR
  const params = new URLSearchParams(location.search);
  const f = airportByCode(params.get('from'));
  const t = airportByCode(params.get('to'));
  const al = airlineByCode(params.get('airline'));
  if (f) comboFrom.set(f);
  if (t) comboTo.set(t);
  if (al) comboAirline.set(al);
  // Links sent by someone on the same flight carry the rest of the trip too.
  (params.get('via') || '').split(',').map((c) => airportByCode(c)).filter(Boolean).slice(0, 3).forEach((a) => addVia(a));
  if (params.get('separate') === '1') $('#single-booking').checked = false;
  const ev = $$('input[name="event"]').find((r) => r.value === params.get('ev'));
  if (ev) {
    ev.checked = true;
    showEventFields();
  }
  const late = parseInt(params.get('late'), 10);
  if (f && t && Number.isFinite(late) && late >= 0 && late < 10080) {
    $('#ev-delay').checked = true;
    $('#delay-h').value = String(Math.floor(late / 60));
    $('#delay-m').value = String(late % 60);
    const cause = $$('#cause option').find((o) => o.value === params.get('cause'));
    if (cause) $('#cause').value = cause.value;
    showEventFields();
    $('#shared-note').hidden = false;
    $('#checker').requestSubmit();
    // Jump straight there; a smooth scroll during page load can get cut short.
    requestAnimationFrame(() => $('#verdict').scrollIntoView({ behavior: 'instant', block: 'start' }));
  }
}

init();
