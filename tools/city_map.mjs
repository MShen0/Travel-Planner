#!/usr/bin/env node
// Render a static basemap for a city's saved places, in the app's own colours, for the 地图 views.
//
//   node tools/city_map.mjs --places places.json --city 首尔 --out .cache/maps/seoul
//
// places.json: [{name, city, lat, lng, ...}]. Writes <out>/light.jpg, <out>/dark.jpg and <out>/map.json:
//   {city, bounds: {west, east, north, south}, width, height, light, dark, attribution, createdAt}
// The bounds are read back from the renderer, so pins placed with Web Mercator line up exactly.
//
// Data: OpenFreeMap vector tiles (free, no key) drawn with MapLibre GL in headless Chromium (Playwright).
// Needs network and Playwright (`npm i -g playwright && npx playwright install chromium` on your own machine).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));

const PALETTES = {
  light: { land: '#F3F0E8', residential: '#EEEAE0', park: '#D5E8CF', wood: '#CFE3C8', water: '#BCD9EA', building: '#E7E2D7',
    minor: '#FFFFFF', major: '#FFFFFF', casing: '#E3DDD1', motorway: '#FBE6C3', motorwayCasing: '#EBCD9C', rail: '#CFC8BB', path: '#F7F4EE' },
  dark: { land: '#171C1A', residential: '#1B211E', park: '#1F3326', wood: '#1E3024', water: '#16293A', building: '#222925',
    minor: '#2A322E', major: '#323B36', casing: '#1E2522', motorway: '#4A4232', motorwayCasing: '#2E2A22', rail: '#39423D', path: '#222A26' },
};

// Web Mercator helpers (same maths the app uses to place pins on the image).
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latFromMerc = y => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

/**
 * Mercator bounds around the places: at least minSpanKm wide, padded on every side, and widened along the short
 * side until width/height sits inside `aspect` — so a tall phone and a wide desktop both have map to look at.
 */
export function boundsFor(points, pad = 0.12, minSpanKm = 1.6, aspect = [0.75, 1.4]) {
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  let west = Math.min(...lngs), east = Math.max(...lngs);
  let south = mercY(Math.min(...lats)), north = mercY(Math.max(...lats));
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const minLng = minSpanKm / (111.32 * Math.cos((midLat * Math.PI) / 180));
  if (east - west < minLng) { const c = (east + west) / 2; west = c - minLng / 2; east = c + minLng / 2; }
  const dx = (east - west) * pad, dy = (north - south) * pad;
  west -= dx; east += dx; north += dy; south -= dy;
  const xSpan = () => ((east - west) * Math.PI) / 180;
  if (xSpan() / (north - south) > aspect[1]) { const c = (north + south) / 2, h = xSpan() / aspect[1] / 2; north = c + h; south = c - h; }
  if (xSpan() / (north - south) < aspect[0]) { const c = (east + west) / 2, w = (((north - south) * aspect[0]) * 180) / Math.PI / 2; west = c - w; east = c + w; }
  return { west, east, north: latFromMerc(north), south: latFromMerc(south) };
}

function viewportFor(b, max) {
  const aspect = (((b.east - b.west) * Math.PI) / 180) / (mercY(b.north) - mercY(b.south));
  return aspect >= 1 ? { width: max, height: Math.round(max / aspect) } : { width: Math.round(max * aspect), height: max };
}

const page = (bounds, palette) => `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js"></script>
<style>html,body,#m{margin:0;width:100%;height:100%}</style></head><body><div id="m"></div><script>
const P = ${JSON.stringify(palette)};
const paint = (layer, prop, value) => { layer.paint = Object.assign({}, layer.paint, { [prop]: value }); };
fetch('https://tiles.openfreemap.org/styles/positron').then(r => r.json()).then(style => {
  // Keep geometry only: the app draws its own place and area labels on top.
  style.layers = style.layers.filter(l => l.type !== 'symbol' && !/^boundary|aeroway|ice_shelf|glacier/.test(l.id));
  for (const l of style.layers) {
    const id = l.id;
    if (id === 'background') paint(l, 'background-color', P.land);
    else if (id === 'water' || id === 'waterway') paint(l, l.type === 'line' ? 'line-color' : 'fill-color', P.water);
    else if (id === 'park') { paint(l, 'fill-color', P.park); paint(l, 'fill-opacity', 1); }
    else if (id === 'landcover_wood') { paint(l, 'fill-color', P.wood); paint(l, 'fill-opacity', 0.9); }
    else if (id === 'landuse_residential') { paint(l, 'fill-color', P.residential); paint(l, 'fill-opacity', 1); }
    else if (id === 'building') { paint(l, 'fill-color', P.building); paint(l, 'fill-outline-color', P.building); }
    else if (/motorway.*casing/.test(id)) paint(l, 'line-color', P.motorwayCasing);
    else if (/motorway/.test(id)) paint(l, 'line-color', P.motorway);
    else if (/casing/.test(id)) paint(l, 'line-color', P.casing);
    else if (/highway_path|road_pier/.test(id)) paint(l, 'line-color', P.path);
    else if (/highway_minor/.test(id)) paint(l, 'line-color', P.minor);
    else if (/highway_major/.test(id)) paint(l, 'line-color', P.major);
    else if (/railway/.test(id)) paint(l, 'line-color', P.rail);
    else if (l.type === 'fill') paint(l, 'fill-color', P.residential);
  }
  const map = new maplibregl.Map({ container: 'm', style, interactive: false, attributionControl: false,
    preserveDrawingBuffer: true, fadeDuration: 0,
    bounds: [[${bounds.west}, ${bounds.south}], [${bounds.east}, ${bounds.north}]], fitBoundsOptions: { padding: 0 } });
  map.on('error', e => console.error('map error', e.error && e.error.message));
  map.once('idle', () => { const b = map.getBounds(); window.__bounds = { west: b.getWest(), east: b.getEast(), north: b.getNorth(), south: b.getSouth() }; });
});
</script></body></html>`;

/** Stamp the image's origin into a JPEG comment (the format impeccable's embed-prompt.mjs reads). */
export function embedOrigin(file, text) {
  const buf = readFileSync(file);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return;
  const key = 'impeccable:prompt\0';
  const parts = [buf.subarray(0, 2)];
  let off = 2, last = 2;
  while (off + 4 <= buf.length && buf[off] === 0xff && buf[off + 1] !== 0xda) {
    const len = buf.readUInt16BE(off + 2);
    if (buf[off + 1] === 0xfe && buf.toString('utf8', off + 4, off + 4 + key.length) === key) { parts.push(buf.subarray(last, off)); last = off + 2 + len; }
    off += 2 + len;
  }
  const payload = Buffer.from(key + text, 'utf8').subarray(0, 0xfffd);
  const seg = Buffer.alloc(4 + payload.length);
  seg[0] = 0xff; seg[1] = 0xfe; seg.writeUInt16BE(payload.length + 2, 2); payload.copy(seg, 4);
  const rest = Buffer.concat([...parts.slice(1), buf.subarray(last)]);
  writeFileSync(file, Buffer.concat([parts[0], seg, rest.subarray(rest[0] === 0xff && rest[1] === 0xd8 ? 2 : 0)]));
}

async function render(bounds, size, palette, file) {
  const require = createRequire(import.meta.url);
  let playwright;
  try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
  const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const tab = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
    tab.on('console', m => { if (m.type() === 'error') console.error('[map]', m.text()); });
    await tab.setContent(page(bounds, palette), { waitUntil: 'load' });
    await tab.waitForFunction(() => window.__bounds, null, { timeout: 120000 });
    const drawn = await tab.evaluate(() => window.__bounds);
    await tab.screenshot({ path: file, type: 'jpeg', quality: 84 });
    return drawn;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!args.places || !args.out) {
    console.error('usage: node tools/city_map.mjs --places places.json [--city 首尔] --out DIR [--pad 0.12] [--max 1400]');
    process.exit(2);
  }
  const all = JSON.parse(readFileSync(args.places, 'utf8'));
  const pts = all.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (!args.city || p.city === args.city));
  if (!pts.length) { console.error('no places with coordinates'); process.exit(1); }
  mkdirSync(args.out, { recursive: true });
  const bounds = boundsFor(pts, Number(args.pad || 0.12));
  const size = viewportFor(bounds, Number(args.max || 1400));
  const drawn = await render(bounds, size, PALETTES.light, path.join(args.out, 'light.jpg'));
  await render(bounds, size, PALETTES.dark, path.join(args.out, 'dark.jpg'));
  const b = drawn, where = `${b.west.toFixed(4)},${b.south.toFixed(4)},${b.east.toFixed(4)},${b.north.toFixed(4)}`;
  for (const mode of ['light', 'dark']) {
    embedOrigin(path.join(args.out, `${mode}.jpg`), `Rendered basemap (${mode}) for ${args.city || pts[0].city || ''}: tools/city_map.mjs, MapLibre GL + OpenFreeMap positron vector tiles recoloured to the app palette, bounds ${where}. Map data © OpenStreetMap contributors · OpenFreeMap · OpenMapTiles`);
  }
  const meta = {
    city: args.city || pts[0].city || '', bounds: drawn, width: size.width * 2, height: size.height * 2,
    light: 'light.jpg', dark: 'dark.jpg', places: pts.length,
    attribution: '© OpenStreetMap contributors · OpenFreeMap · OpenMapTiles', createdAt: Date.now(),
  };
  writeFileSync(path.join(args.out, 'map.json'), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));
}
