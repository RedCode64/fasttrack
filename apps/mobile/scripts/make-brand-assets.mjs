// Regenerates every FastTrack launcher/brand asset from one source of truth.
//
//   node apps/mobile/scripts/make-brand-assets.mjs
//
// The mark is the same lightning bolt the product already uses: the path is
// copied verbatim from apps/web/src/components/icons.tsx and the violet from
// --accent in apps/web/src/app/globals.css (= colors.accent in src/theme.ts).
// Change it here and re-run; don't hand-edit the PNGs.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "assets", "images");
const REPO_ROOT = join(HERE, "..", "..", "..");

// sharp is a transitive dependency, so it isn't resolvable from any workspace
// package.json — go at it through the pnpm store directly.
const sharp = createRequire(join(REPO_ROOT, "package.json"))(
  join(REPO_ROOT, "node_modules/.pnpm/sharp@0.34.5/node_modules/sharp"),
);

/** 24x24 viewBox. Path bounds are x 4..18, y 2..22 — NOT centred in the box. */
const BOLT = "M13 2 4 13.5h6l-1 8.5 9-12h-6z";
const BOLT_CX = 11;
const BOLT_CY = 12;

const ACCENT = "#7b6cf0";
const ACCENT_DEEP = "#6a58e6";
const ACCENT_LIFT = "#8f82f5";
const APP_BG = "#0b0c16";

/**
 * A bolt centred on its own path bounds rather than on the viewBox — centring
 * on the box leaves it visibly low and left.
 *
 * @param size    canvas edge in px
 * @param ratio   bolt box as a fraction of the canvas
 * @param fill    bolt colour
 */
function bolt(size, ratio, fill = "#ffffff") {
  const scale = (size * ratio) / 24;
  const tx = size / 2 - BOLT_CX * scale;
  const ty = size / 2 - BOLT_CY * scale;
  return `<g transform="translate(${tx},${ty}) scale(${scale})"><path d="${BOLT}" fill="${fill}"/></g>`;
}

const gradientDef = `<defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
  <stop offset="0" stop-color="${ACCENT_LIFT}"/><stop offset="1" stop-color="${ACCENT_DEEP}"/>
</linearGradient></defs>`;

const doc = (size, body) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`,
  );

/** Full-bleed violet plate. iOS and the Android background layer both want this. */
const plate = (size) =>
  `${gradientDef}<rect width="${size}" height="${size}" fill="url(#g)"/>`;

/** Rounded tile on transparency, for contexts that aren't masked by the OS. */
const tile = (size) =>
  `${gradientDef}<rect width="${size}" height="${size}" rx="${size * 0.2237}" ry="${size * 0.2237}" fill="url(#g)"/>`;

// Android crops the outer ~1/3 of an adaptive layer; keep art inside the centre
// 66.6% so the visible result matches the iOS proportion.
const ANDROID_SAFE = 0.666;
const BOLT_RATIO = 0.56;

const ASSETS = [
  {
    file: "icon.png",
    size: 1024,
    // Opaque: Apple rejects an app icon carrying an alpha channel.
    flatten: ACCENT,
    body: (s) => plate(s) + bolt(s, BOLT_RATIO),
  },
  {
    file: "splash-icon.png",
    size: 512,
    body: (s) => tile(s) + bolt(s, BOLT_RATIO),
  },
  {
    file: "android-icon-background.png",
    size: 512,
    flatten: ACCENT,
    body: (s) => plate(s),
  },
  {
    file: "android-icon-foreground.png",
    size: 512,
    body: (s) => bolt(s, BOLT_RATIO * ANDROID_SAFE),
  },
  {
    file: "android-icon-monochrome.png",
    size: 432,
    // Themed icons read only the alpha channel; the fill colour is discarded.
    body: (s) => bolt(s, BOLT_RATIO * ANDROID_SAFE),
  },
  {
    file: "favicon.png",
    size: 48,
    body: (s) => tile(s) + bolt(s, BOLT_RATIO),
  },
];

for (const a of ASSETS) {
  let pipe = sharp(doc(a.size, a.body(a.size)));
  if (a.flatten) pipe = pipe.flatten({ background: a.flatten });
  await pipe.png({ compressionLevel: 9 }).toFile(join(OUT, a.file));

  const m = await sharp(join(OUT, a.file)).metadata();
  console.log(`${a.file.padEnd(30)} ${m.width}x${m.height}  alpha=${m.hasAlpha}`);
}

console.log(`\nSplash background should be ${APP_BG}; Android adaptive background ${ACCENT}.`);
