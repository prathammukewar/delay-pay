// Draws the share card: a departures board with the amount on split-flap tiles.
// No personal details go on it, only the amount, a short reason, the rule and the site address.

const W = 1200;
const H = 630;

const C = {
  board: '#111213',
  board2: '#1a1b1d',
  flap: '#232427',
  flapEdge: '#0b0b0c',
  amber: '#ffd23a',
  text: '#ece9e1',
  muted: '#a9a59c',
  signal: '#ffcc00',
  ink: '#121212',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setFont(ctx, weight, size, family, stretch) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch || 'normal';
}

function drawPlane(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 24, s / 24);
  ctx.translate(12, 12);
  ctx.rotate((-38 * Math.PI) / 180);
  ctx.translate(-12, -12);
  ctx.fillStyle = color;
  const p = new Path2D(
    'M22 15.6v-1.9l-8.4-5.3V3.3C13.6 2.4 12.9 1.6 12 1.6s-1.6.8-1.6 1.7v5.1L2 13.7v1.9l8.4-2.6v5.2l-2.1 1.6v1.5l3.7-1.1 3.7 1.1v-1.5l-2.1-1.6V13z'
  );
  ctx.fill(p);
  ctx.restore();
}

/** Wait for the web fonts so the canvas does not fall back to Arial. */
export async function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('900 80px Archivo'),
      document.fonts.load('600 24px "IBM Plex Mono"'),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{top: string, amount: string, line: string, rule: string, url: string, stamp?: string[]}} d
 */
export function drawShareCard(canvas, d) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const sans = 'Archivo, "Helvetica Neue", Arial, sans-serif';
  const mono = '"IBM Plex Mono", Menlo, monospace';

  ctx.fillStyle = C.board;
  ctx.fillRect(0, 0, W, H);

  // Yellow signage strip.
  ctx.fillStyle = C.signal;
  ctx.fillRect(0, 0, W, 86);
  drawPlane(ctx, 48, 20, 46, C.ink);
  ctx.fillStyle = C.ink;
  setFont(ctx, 900, 40, sans, 'condensed');
  ctx.textBaseline = 'middle';
  ctx.fillText('DELAY PAY', 108, 45);
  setFont(ctx, 600, 20, mono);
  ctx.textAlign = 'right';
  ctx.fillText('DEPARTURES · ARRIVALS · REFUNDS', W - 48, 45);
  ctx.textAlign = 'left';

  // Headline above the tiles.
  ctx.fillStyle = C.muted;
  setFont(ctx, 600, 26, mono);
  ctx.fillText(d.top.toUpperCase(), 60, 140);

  // Split-flap tiles.
  const chars = [...d.amount.toUpperCase()];
  const gap = 12;
  const tileW = Math.min(170, Math.floor((W - 120 - gap * (chars.length - 1)) / chars.length));
  const tileH = Math.round(tileW * 1.36);
  const y0 = 172;
  const fontSize = Math.round(tileW * 1.2);
  chars.forEach((ch, i) => {
    const x = 60 + i * (tileW + gap);
    ctx.fillStyle = C.flapEdge;
    roundRect(ctx, x, y0 + 4, tileW, tileH, 12);
    ctx.fill();
    ctx.fillStyle = C.flap;
    roundRect(ctx, x, y0, tileW, tileH, 12);
    ctx.fill();
    ctx.fillStyle = C.amber;
    setFont(ctx, 800, fontSize, sans, 'condensed');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, x + tileW / 2, y0 + tileH / 2 + fontSize * 0.04);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(x, y0 + tileH / 2 - 1.5, tileW, 3);
  });
  ctx.textAlign = 'left';

  // Reason and rule.
  const yLine = y0 + tileH + 60;
  ctx.fillStyle = C.text;
  setFont(ctx, 800, 40, sans);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(d.line, 60, yLine);

  if (d.rule) {
    setFont(ctx, 600, 20, mono);
    const label = d.rule.toUpperCase();
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = C.amber;
    roundRect(ctx, 60, yLine + 20, tw + 28, 38, 6);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 74, yLine + 40);
  }

  // Rubber stamp, bottom right.
  const stamp = d.stamp || ['0% TO A', 'CLAIM COMPANY'];
  ctx.save();
  // Keep the stamp clear of the tiles above and the footer below.
  ctx.translate(W - 205, Math.min(H - 152, Math.max(yLine - 4, y0 + tileH + 88)));
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.strokeStyle = C.amber;
  ctx.lineWidth = 4;
  roundRect(ctx, -150, -58, 300, 116, 10);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  roundRect(ctx, -140, -48, 280, 96, 6);
  ctx.stroke();
  ctx.fillStyle = C.amber;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, 900, 34, sans, 'condensed');
  ctx.fillText(stamp[0], 0, -17);
  ctx.fillText(stamp[1], 0, 21);
  ctx.restore();
  ctx.textAlign = 'left';

  // Footer.
  ctx.fillStyle = C.board2;
  ctx.fillRect(0, H - 70, W, 70);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.text;
  setFont(ctx, 700, 26, sans);
  ctx.fillText('Check your flight in 30 seconds', 60, H - 35);
  ctx.fillStyle = C.amber;
  setFont(ctx, 600, 22, mono);
  ctx.textAlign = 'right';
  ctx.fillText(d.url, W - 60, H - 35);
  ctx.textAlign = 'left';
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
