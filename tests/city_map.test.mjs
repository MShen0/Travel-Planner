// Bounds maths of tools/city_map.mjs (no rendering, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundsFor } from '../tools/city_map.mjs';

test('bounds contain every place with padding', () => {
  const b = boundsFor([{ lat: 35.7148, lng: 139.7967 }, { lat: 35.6585, lng: 139.7023 }], 0.1);
  assert.ok(b.west < 139.7023 && b.east > 139.7967 && b.south < 35.6585 && b.north > 35.7148);
});

test('a single place still gets a walkable area around it', () => {
  const b = boundsFor([{ lat: 35.3, lng: 139.5 }], 0);
  const widthKm = (b.east - b.west) * 111.32 * Math.cos((35.3 * Math.PI) / 180);
  assert.ok(widthKm >= 1.5 && widthKm < 2, `${widthKm} km`);
  assert.ok(b.north > 35.3 && b.south < 35.3);
});

test('the map is never much wider or taller than a screen', () => {
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const ratio = b => (((b.east - b.west) * Math.PI) / 180) / (merc(b.north) - merc(b.south));
  const wide = boundsFor([{ lat: 35.66, lng: 139.70 }, { lat: 35.66, lng: 139.89 }], 0.1);
  const tall = boundsFor([{ lat: 35.60, lng: 139.70 }, { lat: 35.75, lng: 139.70 }], 0.1);
  assert.ok(Math.abs(ratio(wide) - 1.4) < 1e-9, String(ratio(wide)));
  assert.ok(Math.abs(ratio(tall) - 0.75) < 1e-9, String(ratio(tall)));
  assert.ok(tall.south < 35.60 && tall.north > 35.75 && wide.west < 139.70 && wide.east > 139.89);
});

test('rendered maps carry their origin in a JPEG comment', async () => {
  const { embedOrigin } = await import('../tools/city_map.mjs');
  const { mkdtempSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const file = `${mkdtempSync(`${tmpdir()}/map-`)}/light.jpg`;
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]);
  writeFileSync(file, Buffer.concat([Buffer.from([0xff, 0xd8]), app0, Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0xff, 0xd9])]));
  embedOrigin(file, 'first');
  embedOrigin(file, 'OpenFreeMap · © OpenStreetMap');
  const out = readFileSync(file);
  assert.equal(out.toString('latin1').split('impeccable:prompt\0').length, 2, 'one stamp only');
  assert.ok(out.includes(Buffer.from('impeccable:prompt\0OpenFreeMap · © OpenStreetMap', 'utf8')));
  assert.ok(out.subarray(0, 4).equals(Buffer.from([0xff, 0xd8, 0xff, 0xfe])), 'stamp sits right after SOI');
  assert.ok(out.includes(app0));
});

test('runs as a script, also from a folder whose name has a space', async () => {
  const { mkdtempSync, copyFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');
  const script = `${mkdtempSync(`${tmpdir()}/city map-`)}/city_map.mjs`;
  copyFileSync(new URL('../tools/city_map.mjs', import.meta.url), script);
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(run.status, 2, 'without --places/--out it prints usage and exits 2');
  assert.match(run.stderr, /usage/);
});
