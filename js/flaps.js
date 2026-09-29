// Split-flap text, like an old departures board. Tiles are decorative; screen readers get plain text.

const CYCLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789€£$';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Render `text` as flap tiles inside `el`.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {{tone?: string, animate?: boolean, width?: number, label?: string}} [opts]
 */
export function setFlaps(el, text, opts = {}) {
  const { tone = '', animate = true, width = 0, label } = opts;
  const chars = [...String(text).toUpperCase().padEnd(width, ' ')];
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = label ?? text;
  const row = document.createElement('span');
  row.className = `flaps ${tone}`.trim();
  row.setAttribute('aria-hidden', 'true');
  const tiles = chars.map((ch) => {
    const t = document.createElement('span');
    t.className = ch === ' ' ? 'flap sp' : 'flap';
    t.textContent = ch === ' ' ? ' ' : ch;
    row.appendChild(t);
    return t;
  });
  el.append(sr, row);

  if (!animate || reduceMotion()) return Promise.resolve();

  return new Promise((resolve) => {
    let pending = tiles.length;
    if (!pending) resolve();
    tiles.forEach((tile, i) => {
      const final = chars[i];
      if (final === ' ') {
        if (--pending === 0) resolve();
        return;
      }
      const steps = 6 + i * 2 + Math.floor(Math.random() * 4);
      let n = 0;
      const tick = () => {
        n += 1;
        tile.classList.remove('tick');
        // Force a reflow so the flip animation restarts.
        void tile.offsetWidth;
        tile.classList.add('tick');
        if (n >= steps) {
          tile.textContent = final;
          if (--pending === 0) resolve();
          return;
        }
        tile.textContent = CYCLE[Math.floor(Math.random() * CYCLE.length)];
        setTimeout(tick, 45);
      };
      setTimeout(tick, 60 + i * 25);
    });
  });
}
