import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

type Rgba = readonly [number, number, number, number];

const BG: Rgba = [15, 23, 42, 255]; // #0f172a
const RING: Rgba = [56, 189, 248, 96]; // #38bdf8 @ ~38%
const BONE: Rgba = [232, 224, 210, 255]; // #e8e0d2
const TRANSPARENT: Rgba = [0, 0, 0, 0];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // None filter
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function blend(dst: Rgba, src: Rgba, coverage: number): Rgba {
  const aSrc = (src[3] / 255) * coverage;
  const aDst = dst[3] / 255;
  const outA = aSrc + aDst * (1 - aSrc);
  if (outA <= 0) return TRANSPARENT;
  return [
    Math.round((src[0] * aSrc + dst[0] * aDst * (1 - aSrc)) / outA),
    Math.round((src[1] * aSrc + dst[1] * aDst * (1 - aSrc)) / outA),
    Math.round((src[2] * aSrc + dst[2] * aDst * (1 - aSrc)) / outA),
    Math.round(outA * 255),
  ];
}

function sdRoundedBox(
  px: number,
  py: number,
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  r: number,
): number {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

function sdCircle(px: number, py: number, cx: number, cy: number, r: number): number {
  return Math.hypot(px - cx, py - cy) - r;
}

function aaCoverage(sd: number, aa: number): number {
  return Math.max(0, Math.min(1, 0.5 - sd / aa));
}

function renderIcon(size: number, opts: { rounded: boolean; scale: number }): Buffer {
  const rgba = new Uint8Array(size * size * 4);
  const aa = 1.5 / size;

  for (let py = 0; py < size; py++) {
    const ny = (py + 0.5) / size;
    for (let px = 0; px < size; px++) {
      const nx = (px + 0.5) / size;
      let color: Rgba = TRANSPARENT;

      if (opts.rounded) {
        const bgCov = aaCoverage(
          sdRoundedBox(nx, ny, 0.5, 0.5, 0.48, 0.48, 0.2),
          aa,
        );
        color = blend(color, BG, bgCov);
      } else {
        color = BG;
      }

      // Scale anatomical emblem around (0.5, 0.5)
      const ex = (nx - 0.5) / opts.scale + 0.5;
      const ey = (ny - 0.5) / opts.scale + 0.5;
      const eAa = aa / opts.scale;

      // Subtle ring around silhouette
      const ringSd = Math.abs(sdCircle(ex, ey, 0.5, 0.5, 0.38)) - 0.011;
      color = blend(color, RING, aaCoverage(ringSd, eAa));

      // Cranium, neck, spine, three ribs, pelvis
      const head = sdCircle(ex, ey, 0.5, 0.29, 0.09);
      const jaw = sdRoundedBox(ex, ey, 0.5, 0.365, 0.04, 0.025, 0.015);
      const spine = sdRoundedBox(ex, ey, 0.5, 0.575, 0.024, 0.165, 0.018);
      const rib1 = sdRoundedBox(ex, ey, 0.5, 0.475, 0.168, 0.022, 0.02);
      const rib2 = sdRoundedBox(ex, ey, 0.5, 0.545, 0.145, 0.02, 0.018);
      const rib3 = sdRoundedBox(ex, ey, 0.5, 0.615, 0.118, 0.02, 0.018);
      const pelvis = sdRoundedBox(ex, ey, 0.5, 0.725, 0.132, 0.042, 0.03);

      const boneSd = Math.min(head, jaw, spine, rib1, rib2, rib3, pelvis);
      color = blend(color, BONE, aaCoverage(boneSd, eAa));

      const i = (py * size + px) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = color[3];
    }
  }

  return encodePng(size, size, rgba);
}

const outDir = path.resolve(process.cwd(), 'public/icons');
mkdirSync(outDir, { recursive: true });

writeFileSync(
  path.join(outDir, 'icon-192.png'),
  renderIcon(192, { rounded: true, scale: 0.92 }),
);
writeFileSync(
  path.join(outDir, 'icon-512.png'),
  renderIcon(512, { rounded: true, scale: 0.92 }),
);
writeFileSync(
  path.join(outDir, 'icon-512-maskable.png'),
  renderIcon(512, { rounded: false, scale: 0.7 }),
);
writeFileSync(
  path.join(outDir, 'apple-touch-icon.png'),
  renderIcon(180, { rounded: false, scale: 0.86 }),
);
console.log('Generated PWA icons in public/icons/');
