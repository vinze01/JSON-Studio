/**
 * Generates the extension PNG icons (16/32/48/128) without any image
 * dependencies. Draws a rounded square with a "{ }" glyph using a small
 * pixel-map, lightly antialiased by supersampling and a rounded-box SDF.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icon');
mkdirSync(outDir, { recursive: true });

// 5-wide x 7-tall glyph bitmap ('X' = ink). '}' is the horizontal mirror.
const braceMap = ['..XX.', '.XX..', 'XX...', 'X....', 'XX...', '.XX..', '..XX.'];

const GLYPH_W = braceMap[0].length;
const GLYPH_H = braceMap.length;

const colors = {
  bg: [15, 23, 42], // slate-900
  ink: [226, 232, 240], // slate-200
};

/** Signed distance to a rounded rectangle (negative inside). */
function sdRoundedBox(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius);
  const qy = Math.abs(py - cy) - (halfH - radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius;
}

function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.18;
  const cell = size / 14; // glyph cell size in px
  const glyphW = GLYPH_W * cell;
  const gap = 4 * cell;
  const groupW = glyphW * 2 + gap;
  const startX = size / 2 - groupW / 2;
  const startY = size / 2 - (GLYPH_H * cell) / 2;

  const inkAt = (x, y) => {
    for (const tileOffset of [startX, startX + glyphW + gap]) {
      const tx = (x - tileOffset) / cell;
      const ty = (y - startY) / cell;
      if (tx < 0 || tx >= GLYPH_W || ty < 0 || ty >= GLYPH_H) continue;
      const col = tileOffset === startX ? Math.floor(tx) : GLYPH_W - 1 - Math.floor(tx);
      const row = Math.floor(ty);
      if (braceMap[row][col] === 'X') return true;
    }
    return false;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = sdRoundedBox(x + 0.5, y + 0.5, size / 2, size / 2, size / 2, size / 2, radius);
      const i = (y * size + x) * 4;
      const alpha = d <= 0 ? 1 : d > 1 ? 0 : 1 - d;
      if (alpha === 0) {
        buf[i + 3] = 0;
        continue;
      }
      let ink = 0;
      for (const [sx, sy] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ]) {
        if (inkAt(x + sx, y + sy)) ink++;
      }
      const mix = ink / 4;
      buf[i] = Math.round(colors.bg[0] * (1 - mix) + colors.ink[0] * mix);
      buf[i + 1] = Math.round(colors.bg[1] * (1 - mix) + colors.ink[1] * mix);
      buf[i + 2] = Math.round(colors.bg[2] * (1 - mix) + colors.ink[2] * mix);
      buf[i + 3] = Math.round(Math.max(alpha, mix) * 255);
    }
  }
  return buf;
}

function crc32or(data) {
  let c = 0xffffffff;
  for (const byte of data) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32or(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(buf, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA, colour type
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    buf.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128, 256]) {
  const png = encodePng(renderIcon(size), size);
  writeFileSync(path.join(outDir, `${size}.png`), png);
  console.log(`Wrote icon/${size}.png (${png.length} bytes)`);
}
