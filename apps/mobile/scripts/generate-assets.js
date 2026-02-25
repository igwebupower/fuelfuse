// Generates placeholder PNG assets for the Expo build
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// CRC32 implementation (required for PNG format)
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function createPNG(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Build raw scanlines: filter byte (0) + RGB pixels
  const row = Buffer.alloc(1 + width * 3);
  row[0] = 0;
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array(height).fill(row));
  const compressed = zlib.deflateSync(raw, { level: 1 });

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const assetsDir = path.join(__dirname, '../assets');
fs.mkdirSync(assetsDir, { recursive: true });

const assets = [
  { file: 'icon.png',              w: 1024, h: 1024, r: 30,  g: 100, b: 220 },
  { file: 'adaptive-icon.png',     w: 1024, h: 1024, r: 30,  g: 100, b: 220 },
  { file: 'splash.png',            w: 1284, h: 2778, r: 255, g: 255, b: 255 },
  { file: 'favicon.png',           w: 32,   h: 32,   r: 30,  g: 100, b: 220 },
  { file: 'notification-icon.png', w: 96,   h: 96,   r: 255, g: 255, b: 255 },
];

for (const { file, w, h, r, g, b } of assets) {
  const dest = path.join(assetsDir, file);
  fs.writeFileSync(dest, createPNG(w, h, r, g, b));
  console.log(`Created ${file} (${w}x${h})`);
}

console.log('Done — all assets generated.');
