// A tiny canvas confetti: one short-lived full-screen canvas per burst, removed when the last piece lands.

const AURORA = ['#c4b5fd', '#a78bfa', '#818cf8', '#67e8f9', '#22d3ee', '#f0abfc'];
const GOLD = ['#fde68a', '#f5c451', '#fbbf24', '#fff4c2', '#c4b5fd'];

type Piece = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; t: number };

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function launch(make: (w: number, h: number) => Piece[]) {
  if (reduced()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  const pieces = make(W, H);
  let last = performance.now();

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 16.67, 3); // in 60fps frames
    last = now;
    g.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of pieces) {
      p.t += dt;
      p.vx *= 0.985 ** dt;
      p.vy = p.vy * 0.985 ** dt + 0.32 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      if (p.y > H + 20) continue;
      alive++;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.scale(1, Math.cos(p.t * 0.15)); // flutter
      g.fillStyle = p.c;
      g.globalAlpha = Math.max(0, Math.min(1, 2.5 - p.t / 60));
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (alive && pieces[0].t < 260) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function piece(x: number, y: number, angle: number, speed: number, colors: string[]): Piece {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    t: 0,
  };
}

/** Day complete: a fountain from an element (or the lower middle of the screen). */
export function burst(from?: Element | null) {
  launch((W, H) => {
    const r = from?.getBoundingClientRect();
    const x = r ? r.left + r.width / 2 : W / 2;
    const y = r ? r.top + r.height / 2 : H * 0.7;
    return Array.from({ length: 90 }, () =>
      piece(x, y, -Math.PI / 2 + (Math.random() - 0.5) * 1.4, 9 + Math.random() * 9, AURORA));
  });
}

/** The big moments: two side cannons plus a shower from the top. */
export function shower(gold = false) {
  const colors = gold ? GOLD : AURORA;
  launch((W, H) => [
    ...Array.from({ length: 80 }, () => piece(0, H * 0.75, -Math.PI / 3 + (Math.random() - 0.5) * 0.6, 14 + Math.random() * 10, colors)),
    ...Array.from({ length: 80 }, () => piece(W, H * 0.75, (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.6, 14 + Math.random() * 10, colors)),
    ...Array.from({ length: 90 }, () => piece(Math.random() * W, -20 - Math.random() * H * 0.4, Math.PI / 2, 1 + Math.random() * 3, colors)),
  ]);
}
