// Draws the app icon (a rope loop with two handles) and writes PNGs to public/icons/.
// No image libraries: shapes are signed-distance tests, anti-aliased by 4×4 supersampling.
// Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const BG = [0x14, 0x16, 0x1a], ROPE = [0xff, 0x7a, 0x3d], HANDLE = [0xf1, 0xf2, 0xf4];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Colour at unit coords (x, y), or null for transparent. `scale` shrinks the artwork (maskable safe zone). */
function shade(x, y, { rounded, scale }) {
  if (rounded) {
    const r = 0.22, qx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0), qy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
    if (Math.hypot(qx, qy) > r) return null;
  }
  const u = 0.5 + (x - 0.5) / scale, v = 0.5 + (y - 0.5) / scale;
  // Handles at the top, rope hanging below in a U (gap in the loop is at the top).
  const cx = 0.5, cy = 0.56, R = 0.27, gap = (30 * Math.PI) / 180;
  const ex = Math.sin(gap) * R, ey = cy - Math.cos(gap) * R; // arc end points (both sides of the gap)
  for (const side of [-1, 1]) {
    // Handles tilt slightly outward, like they're being held.
    if (segDist(u, v, cx + side * ex, ey + 0.02, cx + side * (ex + 0.05), ey - 0.17) < 0.045) return HANDLE;
  }
  const ang = Math.atan2(u - cx, cy - v); // 0 = straight up
  if (Math.abs(ang) > gap && Math.abs(Math.hypot(u - cx, v - cy) - R) < 0.034) return ROPE;
  return BG;
}

function png(size, opts) {
  const SS = 4, raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, opts);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = (a / (SS * SS)) * 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = join(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
const icons = {
  'icon-192.png': [192, { rounded: true, scale: 1 }],
  'icon-512.png': [512, { rounded: true, scale: 1 }],
  'icon-maskable-512.png': [512, { rounded: false, scale: 0.78 }], // keep art inside the 80% safe zone
  'apple-touch-icon.png': [180, { rounded: false, scale: 0.9 }], // iOS rounds the corners itself
};
for (const [name, [size, opts]] of Object.entries(icons)) writeFileSync(join(out, name), png(size, opts));
console.log('Wrote', Object.keys(icons).join(', '));
