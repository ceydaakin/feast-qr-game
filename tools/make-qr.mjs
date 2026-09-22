// Generates the branded QR codes + a printable poster.
//
//   GAME_URL=https://oyun.feast.tr/ npm run qr
//
// Outputs:
//   qr/feast-game-qr.svg|png     → QR that opens the game (print this)
//   qr/feast-game-poster.svg|png → table-tent poster with chef + QR
//   assets/store-qr.svg          → shown on desktop end screen; phones scanning it
//                                  are redirected straight to their app store (?dl=1)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INK = '#3a1d10';
const RED = '#ff3131';

function parseGameUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`GAME_URL is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== 'https:') throw new Error('GAME_URL must be https (camera apps warn on http).');
  return url;
}

function withParams(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

const headPng = readFileSync(join(ROOT, 'assets/chef-head.png')).toString('base64');

// Rounded-dot QR with a chef badge in the middle. Level H tolerates ~30% loss,
// the badge covers well under that.
function qrSvgBody(text, size, { badge = true } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const quiet = 3;
  const cell = size / (n + quiet * 2);
  const badgeCells = badge ? Math.floor(n * 0.24) | 1 : 0;
  const bStart = (n - badgeCells) / 2;
  const inBadge = (r, c) => badge && r >= bStart - 0.5 && r < bStart + badgeCells + 0.5
    && c >= bStart - 0.5 && c < bStart + badgeCells + 0.5;
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  const dots = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || inFinder(r, c) || inBadge(r, c)) continue;
      const x = (c + quiet) * cell;
      const y = (r + quiet) * cell;
      dots.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${(cell * 0.38).toFixed(2)}"/>`);
    }
  }
  const finder = (r, c) => {
    const x = (c + quiet) * cell;
    const y = (r + quiet) * cell;
    return `<rect x="${x + cell / 2}" y="${y + cell / 2}" width="${cell * 6}" height="${cell * 6}" rx="${cell * 1.8}" fill="none" stroke="${INK}" stroke-width="${cell}"/>`
      + `<rect x="${x + cell * 2}" y="${y + cell * 2}" width="${cell * 3}" height="${cell * 3}" rx="${cell * 0.9}" fill="${RED}"/>`;
  };
  let badgeSvg = '';
  if (badge) {
    const bx = (bStart + quiet) * cell;
    const bs = badgeCells * cell;
    badgeSvg = `<rect x="${bx}" y="${bx}" width="${bs}" height="${bs}" rx="${bs * 0.28}" fill="#fff" stroke="${INK}" stroke-width="${cell * 0.6}"/>`
      + `<image x="${bx + bs * 0.06}" y="${bx + bs * 0.06}" width="${bs * 0.88}" height="${bs * 0.88}" href="data:image/png;base64,${headPng}"/>`;
  }
  return `<rect width="${size}" height="${size}" rx="${cell * 2}" fill="#fff"/>`
    + `<g fill="${INK}">${dots.join('')}</g>`
    + finder(0, 0) + finder(0, n - 7) + finder(n - 7, 0)
    + badgeSvg;
}

function qrSvg(text, size, opts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${qrSvgBody(text, size, opts)}</svg>`;
}

// A6-ish table tent (1240x1748 ≈ A6 @ 300dpi).
function posterSvg(gameUrl) {
  const W = 1240; const H = 1748; const qs = 720;
  const toss = readFileSync(join(ROOT, 'assets/toss.webp')).toString('base64');
  const logo = readFileSync(join(ROOT, 'assets/logo.webp')).toString('base64');
  const host = new URL(gameUrl).host;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e8"/><stop offset="1" stop-color="#ffe2c2"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${Array.from({ length: 10 }, (_, i) => `<rect x="${i * 124}" y="0" width="124" height="70" fill="${i % 2 ? '#fff' : RED}"/><circle cx="${i * 124 + 62}" cy="70" r="62" fill="${i % 2 ? '#fff' : RED}"/>`).join('')}
  <image x="${(W - 300) / 2}" y="170" width="300" height="82" href="data:image/webp;base64,${logo}"/>
  <text x="${W / 2}" y="340" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial Black, Helvetica, sans-serif" font-weight="900" font-size="84" fill="${RED}" stroke="${INK}" stroke-width="4" paint-order="stroke">Bıyıklı Şef'le oyna!</text>
  <text x="${W / 2}" y="410" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="40" fill="${INK}">Okut · Şefle koş · yeni mekânları keşfet</text>
  <image x="30" y="${H - 690}" width="400" height="606" href="data:image/webp;base64,${toss}"/>
  <g transform="translate(${W - qs - 90}, 520)">
    <rect x="-24" y="-24" width="${qs + 48}" height="${qs + 48}" rx="56" fill="#fff" stroke="${INK}" stroke-width="10"/>
    ${qrSvgBody(gameUrl, qs)}
  </g>
  <g transform="translate(${W - qs / 2 - 90}, ${520 + qs + 110})">
    <rect x="-250" y="-54" width="500" height="92" rx="46" fill="${RED}" stroke="${INK}" stroke-width="6"/>
    <text y="10" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial Black, Helvetica, sans-serif" font-weight="900" font-size="46" fill="#fff">Kamerayla okut</text>
  </g>
  <text x="${W - qs / 2 - 90}" y="${H - 90}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="30" fill="${INK}" opacity="0.6">${host}</text>
</svg>`;
}

function toPng(svgPath, pngPath, width) {
  try {
    execFileSync('rsvg-convert', ['-w', String(width), svgPath, '-o', pngPath]);
    return true;
  } catch (err) {
    console.warn(`! PNG skipped for ${svgPath} (install librsvg: brew install librsvg) — ${err.message}`);
    return false;
  }
}

function main() {
  const base = parseGameUrl(process.env.GAME_URL || 'https://oyun.feast.tr/');
  const gameUrl = withParams(base, { src: 'qr' });
  const storeRedirect = withParams(base, { dl: '1', src: 'desktop_qr' });

  mkdirSync(join(ROOT, 'qr'), { recursive: true });
  const files = {
    'qr/feast-game-qr.svg': qrSvg(gameUrl, 1024),
    'qr/feast-game-poster.svg': posterSvg(gameUrl),
    'assets/store-qr.svg': qrSvg(storeRedirect, 296, { badge: false }),
  };
  Object.entries(files).forEach(([rel, svg]) => writeFileSync(join(ROOT, rel), svg));
  toPng(join(ROOT, 'qr/feast-game-qr.svg'), join(ROOT, 'qr/feast-game-qr.png'), 1024);
  toPng(join(ROOT, 'qr/feast-game-poster.svg'), join(ROOT, 'qr/feast-game-poster.png'), 1240);

  console.log(`Game QR    → ${gameUrl}`);
  console.log(`Desktop QR → ${storeRedirect}`);
  console.log('Wrote:', Object.keys(files).join(', '), '+ PNGs');
}

main();
