#!/usr/bin/env node
/**
 * generate_favicons.mjs
 * ─────────────────────
 * Generates all NIRA favicon and icon assets using sharp.
 *
 * Usage:
 *   node scripts/generate_favicons.mjs
 */

import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.dirname(__dirname);
const PUBLIC  = path.join(PROJECT, "public");
const BRAIN   = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".gemini/antigravity-ide/brain/4b3988e1-ea5f-45b6-9ab3-2d956b0de571"
);

const MARK_SRC = path.join(BRAIN, "nira_mark_clean_1790609727923.jpg");
const LOGO_SRC = path.join(BRAIN, "nira_logo_full_1790609766894.jpg");

// Warm ivory background
const BG = { r: 247, g: 248, b: 245, alpha: 1 };

fs.mkdirSync(PUBLIC, { recursive: true });

// Validate sources
for (const [label, p] of [["mark", MARK_SRC], ["logo", LOGO_SRC]]) {
  if (!fs.existsSync(p)) {
    console.error(`❌  Source ${label} not found:\n    ${p}`);
    process.exit(1);
  }
}

/**
 * Resize *src* to fit inside a padded ivory square, return sharp pipeline.
 */
async function onIvory(srcPath, size, padPct = 0.08) {
  const padPx = Math.round(size * padPct);
  const inner = size - 2 * padPx;

  // Get original dimensions to preserve aspect ratio
  const meta = await sharp(srcPath).metadata();
  const ar    = meta.width / meta.height;
  let tw, th;
  if (ar >= 1) { tw = inner; th = Math.round(inner / ar); }
  else          { th = inner; tw = Math.round(inner * ar); }

  const left = Math.round((size - tw) / 2);
  const top  = Math.round((size - th) / 2);

  const resized = await sharp(srcPath)
    .resize(tw, th, { fit: "fill" })
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: { ...BG } }
  })
  .composite([{ input: resized, left, top }]);
}

async function savePng(srcPath, size, outName, padPct = 0.08) {
  const s = await onIvory(srcPath, size, padPct);
  await s.png({ compressionLevel: 9 }).toFile(path.join(PUBLIC, outName));
  console.log(`  ✔ ${outName.padEnd(32)} ${size}×${size}`);
}

/** Build a multi-resolution .ico from raw PNG buffers */
async function saveIco(srcPath, sizes, outName) {
  // Collect PNG buffers at each size
  const pngs = await Promise.all(
    sizes.map(async (sz) => {
      const s = await onIvory(srcPath, sz, 0.05);
      return s.png().toBuffer();
    })
  );

  // Build ICO manually (supports 16/32/48 with PNG data)
  const HEADER_SIZE    = 6;
  const DIR_ENTRY_SIZE = 16;
  const numImages      = sizes.length;

  let dataOffset = HEADER_SIZE + DIR_ENTRY_SIZE * numImages;

  // ICO header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);          // reserved
  header.writeUInt16LE(1, 2);          // type: ICO
  header.writeUInt16LE(numImages, 4);  // count

  // Directory entries + image data
  const entries = [];
  for (let i = 0; i < numImages; i++) {
    const sz  = sizes[i];
    const buf = pngs[i];
    const entry = Buffer.alloc(DIR_ENTRY_SIZE);
    entry.writeUInt8(sz === 256 ? 0 : sz, 0);   // width  (0 = 256)
    entry.writeUInt8(sz === 256 ? 0 : sz, 1);   // height
    entry.writeUInt8(0, 2);                      // color palette count
    entry.writeUInt8(0, 3);                      // reserved
    entry.writeUInt16LE(1, 4);                   // color planes
    entry.writeUInt16LE(32, 6);                  // bits per pixel
    entry.writeUInt32LE(buf.length, 8);          // image data size
    entry.writeUInt32LE(dataOffset, 12);         // offset to image data
    dataOffset += buf.length;
    entries.push({ entry, buf });
  }

  const icoData = Buffer.concat([
    header,
    ...entries.map((e) => e.entry),
    ...entries.map((e) => e.buf),
  ]);

  fs.writeFileSync(path.join(PUBLIC, outName), icoData);
  console.log(`  ✔ ${outName.padEnd(32)} ${sizes.join("+")} px`);
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log("Generating NIRA favicon assets…\n");

await savePng(MARK_SRC, 512, "nira-mark.png",         0.07);
await savePng(LOGO_SRC, 512, "nira-logo.png",         0.06);
await savePng(MARK_SRC,  32, "favicon-32x32.png",     0.05);
await savePng(MARK_SRC,  16, "favicon-16x16.png",     0.04);
await savePng(MARK_SRC, 180, "apple-touch-icon.png",  0.08);
await savePng(MARK_SRC, 192, "icon-192.png",          0.07);
await savePng(MARK_SRC, 512, "icon-512.png",          0.07);
await saveIco(MARK_SRC, [16, 32, 48], "favicon.ico");

console.log("\n✅  All assets written to:", PUBLIC);
