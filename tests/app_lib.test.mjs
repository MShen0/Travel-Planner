// Unit tests for the pure helpers inside app/bacao.html (the @lib-start … @lib-end block).
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page = readFileSync(new URL('../app/bacao.html', import.meta.url), 'utf8');
const start = page.indexOf('/* ===== @lib-start');
const end = page.indexOf('/* ===== @lib-end ===== */');
assert.ok(start > 0 && end > start, 'lib markers present');
const NAMES = ['CATEGORIES', 'MODES', 'extractUrls', 'detectPlatform', 'pickUrl', 'shareTitle', 'contentText', 'normKey', 'findDuplicate',
  'normalizePlace', 'normalizeExtraction', 'makePlaceDoc', 'haversineKm', 'routeKm', 'orderRoute', 'clusterIntoDays', 'makeProjection',
  'mapProject', 'pickBasemap', 'areaLabels', 'clusterScreen', 'placeLink', 'legLink', 'dayRouteLink', 'buildExtractPrompt', 'buildPlanPrompt',
  'buildRevisePrompt', 'buildGuidePrompt', 'normalizePlan', 'normalizeGuide', 'tripToMarkdown', 'tripToText', 'placesToCSV',
  'parseBackup', 'frameTimes', 'normTime', 'addDays', 'weekday', 'fmtMin', 'fmtDayChip', 'fmtCnDate', 'stayHint', 'greeting',
  'currencyOf', 'fmtMoney', 'toHome', 'normPrice', 'tripCities', 'allocateDays', 'tripStays', 'baseForDay', 'tripPlaces', 'progressOf',
  'planCosts', 'expenseTotals', 'diffPlan', 'assistantContext', 'buildAssistantTurns', 'parseAssistantReply', 'travelLine',
  'tripMembers', 'settleUp', 'placeGeo', 'countryCodeOf', 'getCountryLabel', 'getRegionLabel', 'getCityLabel', 'groupPlacesByCountry',
  'getCountryPlaceCount', 'getRegionPlaceCount', 'getCityPlaceCount', 'matchesQuery', 'findDuplicatePlaces', 'mergePlaceProposal', 'remapTripPlace',
  'findNearbyPlaces', 'analyzeLibrary', 'buildLibraryContext', 'buildOrganizationPrompt', 'chunkPlacesForAi', 'normalizeOrganization',
  'mergeOrganization', 'applyOrganizationProposal', 'librarySignature', 'planProposalStats', 'nearestDays', 'appendStops', 'ACTION_TYPES',
  'stopFromPlace', 'ownStop', 'insertStop', 'shiftChanged', 'editStop', 'normFlight', 'normFlights', 'flightDay', 'airportBy', 'flightLine', 'flightPromptLines',
  'clockMinus', 'cityHotel', 'transitFor', 'buildTransitPrompt', 'normalizeTransit', 'transitPoints', 'cleanChat', 'errorSummary'];
const lib = vm.runInNewContext(`${page.slice(start, end)}\n;({${NAMES.join(',')}})`, { URL });
// Values built inside the vm realm carry its own Array/Object prototypes; compare them as plain data.
const plain = v => JSON.parse(JSON.stringify(v));

const XHS_SHARE = '【东京3日游｜懒人版攻略 - 旅行的小王 | 小红书 - 你的生活指南】 😆 6E8kGnSd9JiMk7l 😆 http://xhslink.com/m/1gJ5tOG6M1b，复制本条信息，打开【小红书】App查看精彩内容！';

test('share texts: links, platform, title', () => {
  assert.deepEqual(plain(lib.extractUrls(XHS_SHARE)), ['http://xhslink.com/m/1gJ5tOG6M1b']);
  assert.equal(lib.pickUrl('参考 https://example.com/a 和 https://www.instagram.com/reel/C0abc/?igsh=x'), 'https://www.instagram.com/reel/C0abc/?igsh=x');
  assert.equal(lib.detectPlatform('https://v.douyin.com/iRNBho6u/'), 'douyin');
  assert.equal(lib.detectPlatform('https://b23.tv/abc'), 'bilibili');
  assert.equal(lib.detectPlatform('https://example.com/?ref=instagram'), 'web');
  assert.equal(lib.shareTitle(XHS_SHARE), '东京3日游｜懒人版攻略');
  assert.equal(lib.shareTitle('57 小王发布了一篇小红书笔记，快来看吧！ 😆 abc 😆 http://xhslink.com/a/do9xGe，复制本条信息，打开【小红书】App查看精彩内容！'), '');
  assert.equal(lib.shareTitle('7.43 复制打开抖音，看看【小李的作品】成都三天两夜吃到扶墙 # 成都美食 https://v.douyin.com/iRNBho6u/ abc:/'), '成都三天两夜吃到扶墙 # 成都美食');
  // A bare share text carries almost no content, which is what triggers the "add screenshots" hint.
  assert.ok(lib.contentText('http://xhslink.com/m/1gJ5tOG6M1b，复制本条信息，打开【小红书】App查看精彩内容！').length < 5);
});

test('normalizeExtraction cleans Claude output and drops duplicates', () => {
  const out = lib.normalizeExtraction({
    post: { title: '大阪吃什么', city: '大阪', country: '日本' },
    places: [
      { name: '一兰拉面 道顿堀店', nameLocal: '一蘭 道頓堀店', category: 'food', lat: '34.6687', lng: 135.5023, coordConfidence: 'exact', mustTry: '拉面、溏心蛋', priceLevel: 9, price: { amount: '1,180', currency: 'JPY', per: '一碗' } },
      { name: '一兰拉面 道顿堀店', category: 'food' },
      { name: '黑门市场', category: 'market', lat: 0, lng: 0, price: { amount: 0 } },
      { name: '' },
    ],
  });
  assert.equal(out.places.length, 2);
  const [ichiran, kuromon] = out.places;
  assert.equal(ichiran.city, '大阪');
  assert.deepEqual(plain(ichiran.mustTry), ['拉面', '溏心蛋']);
  assert.equal(ichiran.priceLevel, 4);
  assert.deepEqual(plain(ichiran.price), { amount: 1180, max: null, currency: 'JPY', per: '一碗' });
  assert.equal(ichiran.lat, 34.6687);
  assert.equal(kuromon.category, 'other');
  assert.equal(kuromon.lat, null);
  assert.equal(kuromon.coordConfidence, null);
  assert.equal(kuromon.price, null);
  assert.equal(lib.normalizePlace({ name: '一兰拉面', chain: true }).chain, true);
  const doc = lib.makePlaceDoc(lib.normalizePlace({ name: '一兰拉面', chain: 1 }), { createdBy: 'u_1', coverCredit: { text: '图' } });
  assert.equal(doc.chain, true);
  assert.equal(doc.createdBy, 'u_1');
  assert.equal(doc.coverCredit.text, '图');
  assert.deepEqual(plain(lib.makePlaceDoc({ name: 'x' }, { coverAssetId: 'a1' }).photoIds), ['a1'], 'the cover starts the photo list');
  assert.deepEqual(plain(lib.makePlaceDoc({ name: 'x' }, { coverAssetId: 'a1', photoIds: ['a1', 'a2'] }).photoIds), ['a1', 'a2']);
  assert.deepEqual(plain(lib.normalizeExtraction('garbage').places), []);
});

test('findDuplicate matches by name or local name within a city', () => {
  const saved = [{ id: 'p_1', name: '一兰拉面', nameLocal: '一蘭 渋谷店', city: '东京' }];
  assert.equal(lib.findDuplicate({ name: '一蘭 渋谷店', city: '东京' }, saved).id, 'p_1');
  assert.equal(lib.findDuplicate({ name: '一兰拉面', city: '大阪' }, saved), null);
  assert.equal(lib.findDuplicate({ name: '一兰拉面', city: '' }, saved).id, 'p_1');
});

const TOKYO = [
  ['浅草寺', 35.7148, 139.7967], ['晴空塔', 35.7101, 139.8107], ['上野公园', 35.7156, 139.7745],
  ['涩谷 Sky', 35.6585, 139.7023], ['明治神宫', 35.6764, 139.6993], ['竹下通', 35.6716, 139.7031],
  ['台场 teamLab', 35.6267, 139.7839], ['丰洲市场', 35.6455, 139.7853], ['月岛文字烧', 35.6630, 139.7810],
].map(([name, lat, lng], i) => ({ id: `p_${i}`, name, lat, lng, city: '东京', country: '日本', category: 'sight' }));
const KAMAKURA = [
  { id: 'p_k1', name: '镰仓高校前站', city: '镰仓', country: '日本', category: 'sight', lat: 35.3067, lng: 139.5007 },
  { id: 'p_k2', name: '七里滨', city: '镰仓', country: '日本', category: 'sight', lat: 35.304, lng: 139.5141 },
];

test('clusterIntoDays groups by area with balanced sizes', () => {
  const { groups, noCoord } = lib.clusterIntoDays([...TOKYO, { id: 'p_x', name: '无坐标' }], 3, null);
  assert.equal(noCoord.length, 1);
  assert.equal(groups.length, 3);
  const names = groups.map(g => g.map(p => p.name).sort().join(','));
  assert.ok(names.includes(['上野公园', '晴空塔', '浅草寺'].sort().join(',')), names.join(' | '));
  assert.ok(names.includes(['明治神宫', '涩谷 Sky', '竹下通'].sort().join(',')), names.join(' | '));
  assert.ok(groups.every(g => g.length <= 4));
  // More days than places: empty days stay empty instead of crashing.
  assert.equal(lib.clusterIntoDays(TOKYO.slice(0, 2), 4, null).groups.length, 4);
});

test('orderRoute never makes the walk longer than the input order', () => {
  const shuffled = [TOKYO[6], TOKYO[0], TOKYO[3], TOKYO[1], TOKYO[4]];
  const ordered = lib.orderRoute(shuffled, null);
  assert.equal(ordered.length, shuffled.length);
  assert.ok(lib.routeKm(ordered) <= lib.routeKm(shuffled) + 1e-9);
});

test('maps: Web Mercator pins, basemap choice, labels and clusters', () => {
  const proj = lib.makeProjection(TOKYO, 600, 380, 34);
  for (const p of TOKYO) {
    const [x, y] = proj.project(p);
    assert.ok(x >= 33 && x <= 567 && y >= 33 && y <= 347, `${p.name} at ${x},${y}`);
  }
  const tokyoMap = { id: 'm_t', city: '东京', assetId: 'a', width: 2800, height: 1714, bounds: { west: 139.677, east: 139.907, north: 35.730, south: 35.616 } };
  const kamaMap = { id: 'm_k', city: '镰仓', assetId: 'b', width: 2400, height: 1440, bounds: { west: 139.496, east: 139.518, north: 35.311, south: 35.300 } };
  // Corners land on the image corners (the image is drawn at half its pixel size).
  const nw = lib.mapProject(tokyoMap, { lat: 35.730, lng: 139.677 }), se = lib.mapProject(tokyoMap, { lat: 35.616, lng: 139.907 });
  assert.ok(Math.abs(nw[0]) < 1e-6 && Math.abs(nw[1]) < 1e-6);
  assert.ok(Math.abs(se[0] - 1400) < 1e-6 && Math.abs(se[1] - 857) < 1e-6);
  // Mercator: the middle latitude sits slightly below the vertical middle of the image.
  const mid = lib.mapProject(tokyoMap, { lat: (35.730 + 35.616) / 2, lng: 139.79 });
  assert.ok(mid[1] > 428.4 && mid[1] < 429, String(mid[1]));
  assert.equal(lib.pickBasemap([tokyoMap, kamaMap], KAMAKURA, '镰仓').id, 'm_k');
  assert.equal(lib.pickBasemap([tokyoMap, kamaMap], TOKYO, '东京').id, 'm_t');
  assert.equal(lib.pickBasemap([tokyoMap], KAMAKURA, '镰仓'), null);
  const labels = lib.areaLabels([{ ...TOKYO[0], area: '浅草' }, { ...TOKYO[1], area: '浅草' }, { ...TOKYO[3], area: '多家分店' }]);
  assert.deepEqual(plain(labels.map(l => [l.text, l.n])), [['浅草', 2]]);
  const clusters = lib.clusterScreen([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 200, y: 0 }], 46);
  assert.deepEqual(plain(clusters.map(c => c.items.length)), [2, 1]);
});

test('map links pick the right provider', () => {
  const tokyo = { name: '一兰拉面', nameLocal: '一蘭 渋谷店', city: '东京', country: '日本', lat: 35.66, lng: 139.70 };
  const chengdu = { name: '宽窄巷子', city: '成都', country: '中国', lat: 30.6677, lng: 104.0479, coordConfidence: 'exact' };
  const seoul = { name: '广藏市场', nameLocal: '광장시장', city: '首尔', country: '韩国' };
  assert.match(lib.placeLink(tokyo, 'auto'), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  assert.ok(lib.placeLink(tokyo, 'auto').includes(encodeURIComponent('一蘭 渋谷店 东京')));
  assert.match(lib.placeLink(chengdu, 'auto'), /^https:\/\/uri\.amap\.com\/marker\?position=104\.0479,30\.6677/);
  assert.match(lib.placeLink(seoul, 'auto'), /^https:\/\/map\.naver\.com\/p\/search\//);
  assert.match(lib.placeLink(tokyo, 'apple'), /^https:\/\/maps\.apple\.com\/\?q=.*&sll=35\.66,139\.7$/);
  assert.match(lib.legLink(tokyo, { name: '涩谷 Sky', city: '东京' }, 'metro', 'auto'), /travelmode=transit$/);
  assert.match(lib.legLink(tokyo, { name: '涩谷 Sky', city: '东京' }, 'walk', 'google'), /travelmode=walking$/);
  assert.match(lib.legLink({ name: '天府广场', city: '成都', country: '中国' }, chengdu, 'metro', 'auto'), /api\.map\.baidu\.com\/direction\?origin=name:/);
  assert.match(lib.legLink({ ...chengdu, name: '春熙路', lat: 30.657, lng: 104.08 }, chengdu, 'walk', 'auto'), /uri\.amap\.com\/navigation.*mode=walk/);
  assert.match(lib.dayRouteLink([tokyo, { name: '涩谷 Sky', city: '东京' }]), /^https:\/\/www\.google\.com\/maps\/dir\/.+\/.+\/$/);
  assert.equal(lib.dayRouteLink([chengdu, chengdu]), null);
  assert.equal(lib.dayRouteLink([tokyo]), null);
});

const byId = Object.fromEntries([...TOKYO, ...KAMAKURA].map(p => [p.id, p]));

test('normalizePlan keeps saved places and reports dropped ones', () => {
  const plan = lib.normalizePlan({
    title: '东京三日', base: { name: '新宿', lat: 35.69, lng: 139.70 },
    days: [
      { theme: '浅草', stops: [
        { time: '9:05', placeId: 'p_0', name: '浅草寺', lat: 1, lng: 1, spend: '0', travel: { mode: 'metro', minutes: '25', detail: '丸之内线→银座线', fare: '210' } },
        { time: '11:30', placeId: 'p_404', name: '午饭：天妇罗', suggested: true, category: 'food', spend: -5, travel: { mode: 'rocket', minutes: 5 } },
      ] },
      { theme: '涩谷', stops: [{ time: '10:00', placeId: 'p_3', name: '涩谷 Sky' }] },
    ],
    unplaced: [{ placeId: 'p_6', reason: '太远' }, { placeId: 'p_404', reason: '?' }],
  }, byId, { startDate: '2026-10-12', placeIds: ['p_0', 'p_3', 'p_6', 'p_7'], city: '东京', currency: 'JPY' });
  const [d1, d2] = plan.days;
  assert.equal(d1.date, '2026-10-12');
  assert.equal(d2.date, '2026-10-13');
  assert.equal(d1.city, '东京');
  assert.equal(d1.stops[0].time, '09:05');
  assert.equal(d1.stops[0].lat, TOKYO[0].lat, 'stored coordinates win over Claude estimates');
  assert.equal(d1.stops[0].travel.minutes, 25);
  assert.equal(d1.stops[0].travel.fare, 210);
  assert.equal(d1.stops[0].spend, 0);
  assert.equal(d1.stops[1].placeId, null);
  assert.equal(d1.stops[1].suggested, true);
  assert.equal(d1.stops[1].spend, null);
  assert.equal(d1.stops[1].travel.mode, 'walk');
  assert.deepEqual(plain(plan.unplaced.map(u => u.placeId)), ['p_6', 'p_7']);
  assert.equal(plan.base.name, '新宿');
  assert.equal(plan.currency, 'JPY');
});

test('normalizePlan spreads days over cities and keeps transfer stops', () => {
  const stays = [{ city: '东京', days: 2, base: { name: '新宿' } }, { city: '镰仓', days: 1, base: null }];
  const plan = lib.normalizePlan({
    currency: 'JPY', bases: [{ city: '东京', name: '新宿站', lat: 35.69, lng: 139.70 }],
    days: [
      { city: '东京', stops: [{ time: '09:00', placeId: 'p_0', name: '浅草寺' }] },
      { stops: [{ time: '10:00', placeId: 'p_3', name: '涩谷 Sky' }] },
      { city: '镰仓', stops: [
        { time: '08:30', kind: 'transfer', name: '东京 → 镰仓', category: 'sight', travel: { mode: 'train', minutes: 60, fare: 950 } },
        { time: '10:00', kind: 'transfer', placeId: 'p_k1', name: '镰仓高校前站' },
      ] },
    ],
  }, byId, { stays, startDate: '2026-12-24' });
  assert.deepEqual(plain(plan.days.map(d => d.city)), ['东京', '东京', '镰仓']);
  const [transfer, visit] = plan.days[2].stops;
  assert.equal(transfer.kind, 'transfer');
  assert.equal(transfer.category, 'transport');
  assert.equal(transfer.travel.fare, 950);
  assert.equal(visit.kind, 'visit', 'a saved place is never a transfer');
  assert.deepEqual(plain(plan.bases.map(b => b.name)), ['新宿站']);
  assert.equal(plan.days[2].date, '2026-12-26');
});

test('trips: cities, day split, bases, scope, progress', () => {
  assert.deepEqual(plain(lib.allocateDays([{ city: '东京', n: 12 }, { city: '京都', n: 6 }, { city: '大阪', n: 2 }], 7)), [{ city: '东京', days: 3 }, { city: '京都', days: 2 }, { city: '大阪', days: 2 }]);
  const split = lib.allocateDays([{ city: '东京', n: 30 }, { city: '镰仓', n: 2 }], 5);
  assert.equal(split.reduce((s, x) => s + x.days, 0), 5);
  assert.ok(split.every(x => x.days >= 1));
  assert.deepEqual(plain(lib.allocateDays([{ city: 'A' }, { city: 'B' }, { city: 'C' }], 2).map(x => x.city)), ['A', 'B']);
  const trip = {
    days: 3, stays: [{ city: '东京', days: 2, base: { name: '新宿' } }, { city: '镰仓', days: 1, base: null }],
    placeIds: ['p_0', 'p_k1'], skipped: ['p_8'],
    plan: { bases: [{ city: '东京', name: '新宿站', lat: 35.69, lng: 139.7 }], days: [
      { city: '东京', stops: [{ placeId: 'p_0' }, { placeId: 'p_3' }] }, { city: '东京', stops: [] }, { city: '镰仓', stops: [{ placeId: 'p_k1' }] }] },
  };
  assert.deepEqual(plain(lib.tripCities(trip)), ['东京', '镰仓']);
  assert.deepEqual(plain(lib.tripStays({ city: '东京', days: 2 }).map(s => [s.city, s.days])), [['东京', 2]]);
  assert.equal(lib.baseForDay(trip, 0).name, '新宿站');
  assert.equal(lib.baseForDay(trip, 2).name, '新宿站', 'a day trip starts from the previous city\'s hotel');
  const korea = { days: 4, stays: [{ city: '首尔', days: 2 }, { city: '釜山', days: 2 }],
    plan: { bases: [{ city: '首尔', name: '明洞' }, { city: '釜山', name: '海云台' }], days: [{ city: '首尔' }, { city: '首尔' }, { city: '釜山' }, { city: '釜山' }] } };
  assert.equal(lib.baseForDay(korea, 1).name, '明洞');
  assert.equal(lib.baseForDay(korea, 2).name, '明洞', 'the travel day starts at the hotel you check out of');
  assert.equal(lib.baseForDay(korea, 3).name, '海云台');
  const places = [...TOKYO, ...KAMAKURA, { id: 'p_far', name: '札幌', city: '札幌' }];
  const scope = lib.tripPlaces(trip, places);
  assert.ok(scope.some(p => p.id === 'p_k1'));
  assert.ok(!scope.some(p => p.id === 'p_8'), 'skipped places leave the trip');
  assert.ok(!scope.some(p => p.id === 'p_far'));
  const prog = lib.progressOf(scope.map(p => (p.id === 'p_3' ? { ...p, status: 'visited' } : p)), [trip]);
  assert.deepEqual(plain(prog), { saved: 10, arranged: 2, visited: 1, pending: 7, pct: 20 });
});

test('money: currencies, formatting, RM conversion, costs and diffs', () => {
  assert.equal(lib.currencyOf('日本'), 'JPY');
  assert.equal(lib.currencyOf('Malaysia'), 'MYR');
  assert.equal(lib.currencyOf('火星'), '');
  assert.equal(lib.fmtMoney(1350, 'MYR'), 'RM 1,350');
  assert.equal(lib.fmtMoney(77.6, 'MYR'), 'RM 77.60');
  assert.equal(lib.fmtMoney(61.04, 'MYR', true), 'RM 61');
  assert.equal(lib.fmtMoney(4.5, 'MYR', true), 'RM 4.50');
  assert.equal(lib.fmtMoney(2360, 'JPY'), '¥2,360');
  assert.equal(lib.fmtMoney(50000, 'VND'), '50,000₫');
  const fx = { base: 'MYR', rates: { JPY: 38.66, SGD: 0.3132 }, manual: { THB: 8 } };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`);
  near(lib.toHome(3866, 'JPY', fx, 'MYR'), 100);
  near(lib.toHome(80, 'THB', fx, 'MYR'), 10);
  assert.ok(Math.abs(lib.toHome(1000, 'JPY', fx, 'SGD') - 8.101) < 0.01, 'cross rates go through the base');
  assert.equal(lib.toHome(10, 'KRW', fx, 'MYR'), null);
  assert.equal(lib.toHome(10, 'MYR', null, 'MYR'), 10);
  assert.deepEqual(plain(lib.normPrice({ amount: '1000', max: 900, currency: 'jpy' })), { amount: 1000, max: null, currency: '', per: '' });
  const plan = { currency: 'JPY', days: [
    { stops: [{ spend: 2000, travel: { fare: 210 } }, { spend: null, travel: { fare: 0 } }] },
    { stops: [{ spend: null, travel: null }] },
  ] };
  const costs = lib.planCosts(plan);
  assert.deepEqual(plain([costs.total, costs.days[0].total, costs.days[1].known, costs.known]), [2210, 2210, 0, true]);
  const totals = lib.expenseTotals([{ amount: 3866, currency: 'JPY', category: 'food' }, { amount: 50, currency: 'MYR', category: 'bogus' }, { amount: 1, currency: 'KRW', category: 'food' }], fx, 'MYR');
  near(totals.total, 150);
  near(totals.byCat.food, 100);
  assert.equal(totals.byCat.other, 50, 'unknown categories count as 其他');
  assert.equal(totals.missing, 1);
  const before = { days: [{ stops: [{ placeId: 'p_0', time: '09:00' }, { placeId: 'p_3', time: '11:00' }] }, { stops: [{ name: '筑地', time: '08:00' }] }] };
  const after = { days: [{ stops: [{ placeId: 'p_0', time: '09:00' }, { name: '人形烧', time: '10:00' }, { placeId: 'p_3', time: '12:00' }] }, { stops: [{ name: '筑地', time: '08:00' }] }] };
  assert.deepEqual(plain(lib.diffPlan(before, after)), { 0: [1, 2] });
  assert.equal(lib.travelLine({ mode: 'metro', minutes: 25, detail: '银座线', fare: 210 }, 'JPY'), '地铁 · 25 分钟 · 银座线 · ¥210');
});

test('companions: members and who owes whom in RM', () => {
  const trip = { id: 't_1', createdBy: 'u_a', placeIds: ['p_1', 'p_2'] };
  const places = [{ id: 'p_1', createdBy: 'u_b' }, { id: 'p_2', createdBy: null }, { id: 'p_3', createdBy: 'u_x' }];
  const expenses = [
    { tripId: 't_1', amount: 300, currency: 'MYR', createdBy: 'u_a' },
    { tripId: 't_1', amount: 3866, currency: 'JPY', createdBy: 'u_a', paidBy: 'u_b' },
    { tripId: 't_1', amount: 90, currency: 'MYR', createdBy: 'u_c', split: ['u_a', 'u_c'] },
    { tripId: 't_2', amount: 999, currency: 'MYR', createdBy: 'u_z' },
    { tripId: 't_1', amount: 50, currency: 'MYR', createdBy: null },
  ];
  const members = lib.tripMembers(trip, expenses, places, 'u_me');
  assert.deepEqual(plain(members).sort(), ['u_a', 'u_b', 'u_c', 'u_me']);
  const fx = { base: 'MYR', rates: { JPY: 38.66 } };
  const r = lib.settleUp(expenses.filter(e => e.tripId === 't_1'), ['u_a', 'u_b', 'u_c'], fx, 'MYR');
  const by = Object.fromEntries(r.people.map(x => [x.id, x]));
  assert.ok(Math.abs(by.u_a.paid - 300) < 1e-6 && Math.abs(by.u_b.paid - 100) < 1e-6 && Math.abs(by.u_c.paid - 90) < 1e-6);
  assert.ok(Math.abs(by.u_a.share - (400 / 3 + 45)) < 1e-6, 'equal shares, and only the named people share a split cost');
  assert.ok(Math.abs(by.u_b.share - 400 / 3) < 1e-6);
  assert.equal(r.skipped, 1, 'a cost with no payer is left out');
  const sum = r.people.reduce((n, x) => n + x.net, 0);
  assert.ok(Math.abs(sum) < 1e-6, 'nets balance');
  for (const t of r.transfers) { by[t.from].net += t.amount; by[t.to].net -= t.amount; }
  assert.ok(r.people.every(x => Math.abs(by[x.id].net) < 0.01), 'the transfers settle everyone');
  assert.ok(r.transfers.length <= 2);
});

test('normalizeGuide coerces steps', () => {
  const g = lib.normalizeGuide({ title: '浅草怎么走', steps: [{ title: '出站', mode: 'metro', minutes: '3', exit: 'A1', lat: 'x' }, 'bad'], places: [{ name: '雷门', category: 'sight' }] }, { cityHint: '东京' });
  assert.equal(g.city, '东京');
  assert.equal(g.steps.length, 2);
  assert.equal(g.steps[0].minutes, 3);
  assert.equal(g.steps[0].lat, null);
  assert.equal(g.steps[1].title, '下一步');
  assert.equal(g.places[0].city, '东京');
});

test('prompts carry the data Claude needs', () => {
  const p = lib.buildExtractPrompt({ text: XHS_SHARE, url: 'http://xhslink.com/m/1', platform: 'xiaohongshu', cityHint: '', imageCount: 3, lang: 'zh-Hans', knownCities: ['东京', '大阪'] });
  assert.ok(p.includes('东京、大阪'));
  assert.ok(p.includes('另附 3 张图片'));
  assert.ok(p.includes('你打不开链接'));
  const stays = [{ city: '东京', days: 2, base: { name: '新宿' } }, { city: '镰仓', days: 1, base: null }];
  const trip = { days: 3, startDate: '2026-12-24', stays, prefs: { pace: 'normal', transport: 'transit', notes: '' } };
  const places = [...TOKYO, ...KAMAKURA, { id: 'p_c', name: '一兰拉面', city: '东京', category: 'food', chain: true }];
  const groupsByCity = { 东京: lib.clusterIntoDays(places.filter(x => x.city === '东京'), 2, null), 镰仓: lib.clusterIntoDays(KAMAKURA, 1, null) };
  const plan = lib.buildPlanPrompt({ trip, stays, places, groupsByCity, lang: 'zh-Hans', allowSuggest: true });
  for (const p2 of places) assert.ok(plan.includes(`"id":"${p2.id}"`));
  assert.ok(plan.includes('days 必须正好 3 天'));
  assert.ok(plan.includes('2026-12-24（周四）'));
  assert.ok(plan.includes('东京 2 天（住 新宿） → 镰仓 1 天（没写住宿'));
  assert.ok(plan.includes('【镰仓】'));
  assert.ok(plan.includes('kind "transfer"'));
  assert.ok(plan.includes('"chain":"连锁店，挑当天路线附近的分店"'));
  const revise = lib.buildRevisePrompt({ trip: { ...trip, plan: lib.normalizePlan({ days: [{ stops: [] }, { stops: [] }, { stops: [] }] }, {}, { stays }) }, places, feedback: '轻松一点', lang: 'zh-Hans' });
  assert.ok(revise.includes('用户的要求：轻松一点'));
  assert.ok(revise.includes('城市和天数：东京 2 天'));
  const guide = lib.buildGuidePrompt({ text: '从浅草站 1 号出口出来', lang: 'en' });
  assert.ok(guide.includes('English'));
});

test('assistant: context, turns and confirmable actions', () => {
  const trips = [{ id: 't_1', title: '东京三日', days: 1, stays: [{ city: '东京', days: 1 }], plan: { days: [{ day: 1, city: '东京', stops: [{ name: '浅草寺' }] }] } }];
  const ctx = lib.assistantContext({ places: TOKYO.slice(0, 2), trips, today: '2026-10-06', focus: '用户在看行程 t_1' });
  assert.ok(ctx.includes('浅草寺[景点·p_0]'));
  assert.ok(ctx.includes('t_1「东京三日」'));
  assert.ok(ctx.includes('用户在看行程 t_1'));
  const turns = plain(lib.buildAssistantTurns({ context: ctx, history: [{ role: 'me', text: '你好' }, { role: 'ai', text: '嗨', raw: '嗨<action>{}</action>' }], message: '排个行程' }));
  assert.equal(turns[0].role, 'user');
  assert.ok(turns[0].content.includes('你不能直接修改数据'));
  assert.deepEqual(turns.slice(2).map(t => t.role), ['user', 'assistant', 'user']);
  assert.equal(turns[3].content, '嗨<action>{}</action>', 'earlier replies go back with their action blocks');
  assert.equal(turns.at(-1).content, '排个行程');
  const reply = lib.parseAssistantReply('建议这样走：\n- Day 1 浅草\n<action>{"type":"plan_trip","cities":["东京"],"days":2}</action>\n<action>{"type":"delete_all"}</action><action>{oops}</action>');
  assert.equal(reply.text, '建议这样走：\n- Day 1 浅草');
  assert.deepEqual(plain(reply.actions.map(a => a.type)), ['plan_trip']);
  assert.equal(lib.parseAssistantReply('马上好<action>{"type":"plan_tr').text, '马上好', 'a half-written action never shows');
});

test('a damaged saved chat or a crash never blanks the app', () => {
  const kept = plain(lib.cleanChat([null, 'x', { role: 'me', text: '你好', at: 1 }, { role: 'ai', text: 42, actions: { 0: {} }, done: [] },
    { role: 'ai', text: '好的', actions: [null, { type: 'plan_trip' }, { label: 'no type' }], done: { 0: 'done' } },
    { role: 'ai', text: { a: 1 }, actions: [{ type: 'open_organize' }], done: ['done'] }, { role: 'ai', text: '', pending: true }, { role: 'bot', text: '?' }]));
  assert.deepEqual(kept.map(m => [m.role, m.text]), [['me', '你好'], ['ai', '好的'], ['ai', '']], 'nothing to show: dropped');
  assert.deepEqual(kept[1].actions, [{ type: 'plan_trip' }]);
  assert.deepEqual(kept[1].done, { 0: 'done' });
  assert.deepEqual(kept[2].actions, [{ type: 'open_organize' }]);
  assert.deepEqual(kept[2].done, {});
  assert.equal(plain(lib.cleanChat({ role: 'me' })).length, 0);
  assert.equal(lib.cleanChat(Array.from({ length: 50 }, (_, i) => ({ role: 'me', text: String(i) }))).length, 40, 'the last 40 messages stay');
  const chrome = { message: "Cannot read properties of null (reading 'day')", stack: "TypeError: Cannot read properties of null (reading 'day')\n    at Object.map (<anonymous>)\n    at ActionCard (https://x/:5630:57)\n    at B (preact.umd.js:1:1)" };
  assert.equal(lib.errorSummary(chrome), "Cannot read properties of null (reading 'day') · ActionCard");
  assert.equal(lib.errorSummary({ message: 'x is undefined', stack: 'describeChange@https://x/:1:2\nActionCard@https://x/:3:4\nS@https://cdn/p.js:1:1' }), 'x is undefined · ActionCard');
  assert.equal(lib.errorSummary({ code: 'not_available' }), 'not_available');
  assert.equal(lib.errorSummary(null), '未知错误');
});

test('exports: markdown, chat text, CSV, backup', () => {
  const trip = { title: '东京三日', city: '东京', days: 1, startDate: '2026-10-12', plan: {
    summary: '先东后西', tips: ['买 Suica'], currency: 'JPY', bases: [{ city: '东京', name: '新宿' }], unplaced: [{ placeId: 'p_6', reason: '太远' }],
    days: [{ day: 1, date: '2026-10-12', city: '东京', theme: '浅草', stops: [{ time: '09:00', name: '浅草寺', nameLocal: '浅草寺', stayMin: 60, spend: 500, travel: { mode: 'metro', minutes: 25, detail: '银座线', fare: 210 } }] }] } };
  const md = lib.tripToMarkdown(trip, { p_6: { name: '台场' } });
  assert.ok(md.includes('## Day 1 · 东京 · 浅草（2026-10-12 周一）'), md);
  assert.ok(md.includes('↳ 地铁 · 25 分钟 · 银座线 · ¥210'));
  assert.ok(md.includes('约 ¥500'));
  assert.ok(md.includes('东京住 新宿'));
  assert.ok(md.includes('- 台场：太远'));
  assert.ok(lib.tripToText(trip).includes('• 09:00 浅草寺 · 1 小时'));
  const csv = lib.placesToCSV([{ name: 'Bar "X", Ginza', lat: 35.67, lng: 139.76, city: '东京', category: 'nightlife', status: 'want', mustTry: ['highball'], source: { url: 'https://a.b' } }]);
  assert.ok(csv.split('\n')[1].startsWith('"Bar ""X"", Ginza","35.67, 139.76",'), csv);
  assert.throws(() => lib.parseBackup('{"places":[{"id":"../evil"}]}'), /没有可导入/);
  const backup = lib.parseBackup('{"places":[{"id":"p_ok"}],"trips":[{"id":"t_1"}],"expenses":[{"id":"x_1"},{"id":"p_wrong"}]}');
  assert.equal(backup.trips.length, 1);
  assert.equal(backup.expenses.length, 1);
});

test('small formatters', () => {
  assert.equal(lib.normTime('8：30'), '08:30');
  assert.equal(lib.normTime('noon'), '');
  assert.equal(lib.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(lib.weekday('2026-10-06'), '周二');
  assert.equal(lib.fmtDayChip('2026-12-24'), '12/24 (四)');
  assert.equal(lib.fmtCnDate('2026-12-24'), '12月24日');
  assert.equal(lib.fmtMin(95), '1 小时 35 分');
  assert.equal(lib.stayHint(60), '建议 1–1.5 小时');
  assert.equal(lib.stayHint(45), '建议 45 分钟');
  assert.equal(lib.greeting(20), '晚上好');
  assert.deepEqual(plain(lib.frameTimes(60, 4)), [7.5, 22.5, 37.5, 52.5]);
});

test('geography: old places find their region, grouped and searched country → region → city', () => {
  const old = [
    { id: 'p_1', name: '浅草寺', city: '东京', country: '日本', category: 'sight' },
    { id: 'p_2', name: '一兰', city: 'Tokyo', country: 'Japan', category: 'food' },
    { id: 'p_3', name: '道顿堀', city: '大阪府', country: '日本', category: 'sight' },
    { id: 'p_4', name: '广藏市场', city: '首尔', country: '韩国', category: 'food' },
    { id: 'p_5', name: 'Rooftop', city: '', country: '', category: 'nightlife' },
    { id: 'p_6', name: 'Blue Lagoon', city: 'Grindavik', country: '冰岛', countryCode: 'IS', category: 'sight' },
  ];
  const g = lib.placeGeo(old[1]);
  assert.deepEqual([g.country, g.countryCode, g.region, g.regionType, g.city], ['日本', 'jp', '关东', 'region', '东京']);
  assert.ok(g.inferred.region, 'the region comes from the presets, not the database');
  assert.equal(lib.placeGeo({ city: '台北市' }).country, '台湾', 'a known city names its country');
  assert.equal(lib.placeGeo({ country: '马来西亚', city: '槟城' }).regionType, 'state');
  assert.equal(lib.placeGeo({ country: '日本', city: '东京', region: 'Kanto' }).region, '关东');
  assert.equal(lib.placeGeo(old[5]).countryCode, 'is', "Claude's code covers countries outside the presets");
  const countries = lib.groupPlacesByCountry(old);
  assert.equal(countries[0].key, 'jp');
  assert.equal(countries.at(-1).key, '', 'unknown country last');
  assert.deepEqual(plain(countries[0].regions.map(r => [r.name, r.count])), [['关东', 2], ['关西', 1]]);
  assert.deepEqual(plain(countries[0].cities.map(c => [c.name, c.en, c.count])), [['东京', 'Tokyo', 2], ['大阪', 'Osaka', 1]]);
  assert.equal(lib.getCountryPlaceCount(old, '日本'), 3);
  assert.equal(lib.getCountryPlaceCount(old, 'jp'), 3);
  assert.equal(lib.getRegionPlaceCount(old, 'jp', 'Kansai'), 1);
  assert.equal(lib.getCityPlaceCount(old, '东京都'), 2);
  assert.equal(lib.getCountryLabel('KR'), '韩国');
  assert.equal(lib.getRegionLabel('prefecture'), '都道府县');
  assert.equal(lib.getRegionLabel('nonsense'), '地区');
  assert.equal(lib.getCityLabel('Seoul'), '首尔');
  assert.ok(lib.matchesQuery(old[0], 'tokyo'), 'an English city name finds 东京');
  assert.ok(lib.matchesQuery(old[3], 'korea 美食'));
  assert.ok(!lib.matchesQuery(old[3], 'tokyo'));
  const text = lib.buildLibraryContext(old).join('\n');
  assert.ok(text.includes('【日本 · jp】3 个地点'));
  assert.ok(text.includes('关东（地区） › 东京（2）：浅草寺[景点·p_1]'));
  assert.ok(text.includes('【国家待确认】1 个地点'));
});

test('duplicates need a matching spot; merging keeps everything and trips follow', () => {
  const a = { id: 'p_a', name: 'Shibuya Sky', nameLocal: 'SHIBUYA SKY', city: '东京', country: '日本', lat: 35.6585, lng: 139.7023, category: 'sight', coordConfidence: 'exact', createdAt: 1, coverAssetId: 'x1', photoIds: ['x1'], mustTry: ['日落'] };
  const b = { id: 'p_b', name: '涩谷天空', nameLocal: 'Shibuya Sky', city: 'Tokyo', country: '日本', lat: 35.6586, lng: 139.7022, category: 'sight', coordConfidence: 'area', createdAt: 2, status: 'want', tips: '日落前一小时上去', coverAssetId: 'x2', photoIds: ['x2', 'x3'] };
  const ramen = { id: 'p_c', name: '一兰拉面', city: '东京', country: '日本', lat: 35.6611, lng: 139.701 };
  const ramenFar = { id: 'p_d', name: '一兰拉面', city: '东京', country: '日本', lat: 35.7101, lng: 139.8107 };
  const chainA = { id: 'p_e', name: '星巴克', city: '东京', country: '日本', chain: true };
  const chainB = { id: 'p_f', name: '星巴克', city: '东京', country: '日本', chain: true };
  const temple = { id: 'p_g', name: '浅草寺', city: '东京', country: '日本', lat: 35.7148, lng: 139.7967 };
  const area = { id: 'p_h', name: '浅草', city: '东京', country: '日本', lat: 35.7119, lng: 139.7983 };
  const dups = plain(lib.findDuplicatePlaces([a, b, ramen, ramenFar, chainA, chainB, temple, area]));
  assert.deepEqual(dups.map(d => [d.a, d.b]), [['p_a', 'p_b']], 'same name far apart, chain branches and look-alike names are not duplicates');
  assert.ok(dups[0].similarity >= 0.9);
  assert.equal(lib.findDuplicatePlaces([{ ...a, distinctFrom: ['p_b'] }, b]).length, 0, '都保留 is remembered');
  const patch = plain(lib.mergePlaceProposal(a, b));
  assert.equal(patch.status, 'want');
  assert.deepEqual(patch.photoIds, ['x1', 'x2', 'x3']);
  assert.equal(patch.tips, '日落前一小时上去');
  assert.equal(patch.lat, undefined, 'exact coordinates stay');
  assert.deepEqual(plain(lib.mergePlaceProposal(a, { ...a, id: 'p_z' })), {});
  const trip = { placeIds: ['p_b', 'p_c'], skipped: ['p_b'], plan: { days: [{ stops: [{ placeId: 'p_b', name: '涩谷天空' }, { placeId: 'p_c' }] }], unplaced: [{ placeId: 'p_a', reason: '' }] } };
  const tp = plain(lib.remapTripPlace(trip, 'p_b', 'p_a'));
  assert.deepEqual(tp.placeIds, ['p_a', 'p_c']);
  assert.deepEqual(tp.skipped, []);
  assert.equal(tp.plan.days[0].stops[0].placeId, 'p_a');
  assert.deepEqual(tp.plan.unplaced, [], 'a place on a day is not also waiting');
  assert.equal(lib.remapTripPlace({ placeIds: ['p_x'] }, 'p_b', 'p_a'), null);
});

test('places that share a day, and the quick library check', () => {
  const near = [
    { id: 'n1', name: 'A', city: '东京', country: '日本', lat: 35.67, lng: 139.702, area: '原宿' },
    { id: 'n2', name: 'B', city: '东京', country: '日本', lat: 35.671, lng: 139.704, area: '原宿' },
    { id: 'n3', name: 'C', city: '东京', country: '日本', lat: 35.669, lng: 139.706, area: '表参道' },
    { id: 'n4', name: 'D', city: '东京', country: '日本', lat: 35.7148, lng: 139.7967, area: '浅草' },
    { id: 'n5', name: 'E', city: '东京', country: '日本', lat: 35.6705, lng: 139.703, area: '原宿', chain: true },
  ];
  const groups = plain(lib.findNearbyPlaces(near));
  assert.equal(groups.length, 1);
  assert.deepEqual([...groups[0].placeIds].sort(), ['n1', 'n2', 'n3']);
  assert.equal(groups[0].area, '原宿');
  assert.ok(groups[0].minutes > 0 && groups[0].minutes < 30);
  const around = plain(lib.findNearbyPlaces(near, { near: near[0] }));
  assert.equal(around[0].placeIds[0], 'n1');
  assert.equal(around[0].placeIds.length, 3);
  const report = lib.analyzeLibrary([...near, { id: 'n6', name: 'F', city: '', country: '' }], []);
  assert.equal(report.noCountry, 1);
  assert.equal(report.noCity, 1);
  assert.ok(report.insights.some(i => i.kind === 'nearby'));
  assert.ok(report.insights.some(i => i.kind === 'missing'));
  const together = { days: 1, stays: [{ city: '东京', days: 1 }], plan: { days: [{ stops: ['n1', 'n2', 'n3'].map(id => ({ placeId: id })) }] } };
  assert.ok(!lib.analyzeLibrary(near, [together]).insights.some(i => i.kind === 'nearby'), 'already on one day: no hint');
});

test('AI 整理: prompt, checked answer, only the approved writes', () => {
  const ps = [
    { id: 'p_1', name: '浅草寺', city: '东京', country: '日本', category: 'sight', area: '浅草' },
    { id: 'p_2', name: 'Ichiran', city: 'Tokyo', country: '', category: 'other' },
    { id: 'p_3', name: 'Rooftop', city: '', country: '', category: 'nightlife' },
  ];
  const byId = Object.fromEntries(ps.map(p => [p.id, p]));
  const prompt = lib.buildOrganizationPrompt({ places: ps, knownCities: ['东京'], lang: 'zh-Hans', localDuplicates: [{ a: 'p_1', b: 'p_2' }] });
  for (const s of ['你是「旅用」的 AI 旅行整理助手', '"id":"p_2"', '已有的城市必须写成完全一样：东京', '低于 0.75', '不要只因为名字相似就判断重复', 'p_1 / p_2', '"regionGuess":"关东"', '"needsConfirmation"', 'municipality']) {
    assert.ok(prompt.includes(s), s);
  }
  const prop = plain(lib.normalizeOrganization({
    summary: '整理好了',
    changes: [
      { placeId: 'p_1', country: '日本', countryCode: 'JP', region: '关东', regionType: 'region', city: '东京', confidence: 0.95 },
      { placeId: 'p_2', country: '日本', city: 'Tokyo', category: 'food', area: '涩谷', confidence: 92 },
      { placeId: 'p_3', country: '日本', city: '大阪', confidence: 0.5 },
      { placeId: 'p_404', country: '日本' },
    ],
    duplicates: [{ placeIds: ['p_1', 'p_2'], similarity: 0.4 }, { placeIds: ['p_1', 'p_1'] }],
    nearbyGroups: [{ placeIds: ['p_1'] }],
    needsConfirmation: [{ placeId: 'p_3', field: 'city', options: ['Osaka', '京都'], confidence: 0.4 }, { placeId: 'p_3', field: 'name', options: ['x'] }],
  }, byId, ['东京', '大阪']));
  assert.equal(prop.changes.length, 3);
  assert.deepEqual(prop.changes.find(c => c.placeId === 'p_1').fields, { countryCode: 'jp', region: '关东', regionType: 'region' }, 'only what changes');
  const c2 = prop.changes.find(c => c.placeId === 'p_2');
  assert.equal(c2.fields.city, '东京', 'the library spelling wins over "Tokyo"');
  assert.equal(c2.fields.category, 'food');
  assert.equal(c2.confidence, 0.92);
  assert.ok(prop.changes.find(c => c.placeId === 'p_3').needsConfirm, 'below 0.75 waits for the user');
  assert.equal(prop.duplicates.length, 1);
  assert.equal(prop.nearbyGroups.length, 0);
  assert.deepEqual(prop.needsConfirmation.map(n => n.options), [['大阪', '京都']]);
  const ops = plain(lib.applyOrganizationProposal(prop, { skip: { p_2: true }, pick: { 'p_3:city': '京都', 'p_3:country': { value: '日本', countryCode: 'jp' } } }, byId, 1000));
  assert.deepEqual(ops.map(o => o.id).sort(), ['p_1', 'p_3']);
  const o1 = ops.find(o => o.id === 'p_1');
  assert.equal(o1.patch.region, '关东');
  assert.deepEqual(o1.patch.aiMeta, { normalized: true, countryConfidence: 0.95, regionConfidence: 0.95, cityConfidence: 0.95, lastAnalyzedAt: 1000 });
  const o3 = ops.find(o => o.id === 'p_3');
  assert.deepEqual([o3.patch.city, o3.patch.country, o3.patch.countryCode], ['京都', '日本', 'jp']);
  assert.equal(o3.patch.region, undefined, 'the unsure change was not accepted');
  assert.equal(lib.applyOrganizationProposal(prop, { accept: { p_3: true } }, byId, 1).find(o => o.id === 'p_3').patch.city, '大阪');
  const merged = lib.mergeOrganization(prop, { ...lib.normalizeOrganization({ summary: '第二批', changes: [{ placeId: 'p_1', region: '关西', confidence: 0.9 }] }, byId, []), duplicates: [{ a: 'p_2', b: 'p_1', similarity: 0.5 }] });
  assert.equal(merged.changes.find(c => c.placeId === 'p_1').fields.region, '关西', 'a later batch wins');
  assert.equal(merged.duplicates.length, 1);
  assert.equal(merged.summary, '整理好了；第二批');
  const many = Array.from({ length: 130 }, (_, i) => ({ id: 'q' + i, name: 'x' + i, city: i < 70 ? '东京' : '首尔', country: i < 70 ? '日本' : '韩国' }));
  assert.deepEqual(plain(lib.chunkPlacesForAi(many, 60).map(c => c.length)), [60, 10, 60], "a city's places stay in one batch when they fit");
  assert.equal(lib.librarySignature(many), lib.librarySignature(many.slice()));
  assert.notEqual(lib.librarySignature(many), lib.librarySignature(many.slice(1)));
  assert.ok(['organize_library', 'merge_places_proposal', 'nearby_group'].every(t => lib.ACTION_TYPES.includes(t)));
  const reply = lib.parseAssistantReply('看看这个<action>{"type":"organize_library","changes":[]}</action>');
  assert.equal(reply.actions[0].type, 'organize_library');
});

test('extraction keeps the geography; new places fill it from the presets', () => {
  const ex = lib.normalizeExtraction({ post: { city: '东京', country: '日本' }, places: [{ name: 'A', countryCode: 'JP', region: '关东', regionType: 'region', confidence: 0.6 }, { name: 'B', city: '大阪' }] });
  assert.equal(ex.places[0].countryCode, 'jp');
  assert.equal(ex.places[0].geoConfidence, 0.6);
  const doc = lib.makePlaceDoc(ex.places[1]);
  assert.deepEqual([doc.country, doc.countryCode, doc.region, doc.regionType], ['日本', 'jp', '关西', 'region']);
  assert.ok(doc.savedAt);
  assert.equal(doc.aiMeta, undefined);
  assert.equal(lib.makePlaceDoc(ex.places[0]).aiMeta.cityConfidence, 0.6);
  assert.ok(lib.buildExtractPrompt({ text: 'x', lang: 'zh-Hans' }).includes('countryCode'));
});

test('trip proposals: minutes before and after, nearest day, adding to a day', () => {
  const before = { days: [{ city: '东京', stops: [{ placeId: 'p_1', travel: { minutes: 30 } }, { placeId: 'p_2', travel: { minutes: 40 } }] }, { city: '东京', stops: [] }], unplaced: [{ placeId: 'p_3' }] };
  const after = { days: [{ city: '东京', stops: [{ placeId: 'p_2', travel: { minutes: 20 } }, { placeId: 'p_1', travel: { minutes: 15 } }, { placeId: 'p_3', travel: { minutes: 10 } }] }, { city: '东京', stops: [] }], unplaced: [] };
  const st = plain(lib.planProposalStats(before, after, 0));
  assert.deepEqual([st.before, st.after, st.saved, st.unplacedAfter], [70, 45, 25, 0]);
  assert.deepEqual(st.placed, ['p_3']);
  const hints = plain(lib.nearestDays({ days: [{ city: '东京', stops: [{ lat: 35.71, lng: 139.79 }] }, { city: '东京', stops: [{ lat: 35.66, lng: 139.7 }] }] },
    [{ id: 'z', city: '东京', lat: 35.665, lng: 139.705 }, { id: 'y', city: '大阪', lat: 34.69, lng: 135.5 }]));
  assert.deepEqual(hints.map(h => [h.placeId, h.day]), [['z', 1]]);
  const r = plain(lib.appendStops(before, 1, [{ id: 'p_1', name: '浅草寺', lat: 35.7, lng: 139.8, durationMin: 60 }, { id: 'p_3', name: 'C' }]));
  assert.equal(r.added, 2);
  assert.deepEqual(r.days[1].stops.map(s => s.placeId), ['p_1', 'p_3']);
  assert.deepEqual(r.days[0].stops.map(s => s.placeId), ['p_2'], 'a place moves; it is never on two days');
  assert.deepEqual(r.unplaced, []);
  assert.deepEqual(r.changed, ['1:0', '1:1']);
  assert.equal(r.days[1].stops[0].stayMin, 60);
  assert.equal(lib.tripPlaces({ cities: ['东京'], placeIds: [] }, [{ id: 'nc', city: '' }]).length, 0, 'a place without a city is in no trip');
});

test('editing by hand: change a stop, insert one by its time, keep AI highlights on the right rows', () => {
  const plan = { days: [{ day: 1, city: '首尔', stops: [
    { time: '09:30', kind: 'visit', placeId: 'p_a', name: '景福宫', travel: { mode: 'metro', minutes: 20, detail: '3 号线', cost: '', fare: 1550 } },
    { time: '12:00', kind: 'visit', placeId: null, name: '午饭', suggested: true, travel: null },
    { time: '15:00', kind: 'visit', placeId: 'p_b', name: '北村', travel: null },
  ] }], unplaced: [{ placeId: 'p_c', reason: '' }] };
  const s = plain(lib.editStop(plan, 0, 0, { time: '10:15', name: '景福宫（看换岗）', stayMin: '90', what: '看守门将换岗', tip: '', spend: '3,000', mode: 'bus', minutes: '25', fare: '', detail: '' }))[0].stops[0];
  assert.deepEqual([s.time, s.name, s.stayMin, s.what, s.spend], ['10:15', '景福宫（看换岗）', 90, '看守门将换岗', 3000]);
  assert.deepEqual(s.travel, { mode: 'bus', minutes: 25, detail: '', cost: '', fare: null });
  assert.equal(plan.days[0].stops[0].time, '09:30', 'the plan passed in is untouched');
  // No mode means no leg; an emptied name keeps the old one.
  const bare = plain(lib.editStop(plan, 0, 0, { time: '', name: ' ', mode: '' }))[0].stops[0];
  assert.deepEqual([bare.travel, bare.name, bare.time, bare.spend], [null, '景福宫', '', null]);
  // A stop the user writes goes in by its time, and the AI-lit rows after it move down with it.
  const own = lib.ownStop({ name: '回酒店休息', time: '13:30', category: 'stay', stayMin: '60', what: '' }, plan.days[0], '韩国');
  assert.deepEqual([own.placeId, own.suggested, own.city, own.country, own.stayMin], [null, false, '首尔', '韩国', 60]);
  const ins = lib.insertStop(plan, 0, own);
  assert.equal(ins.index, 2);
  assert.deepEqual(plain(ins.days)[0].stops.map(x => x.name), ['景福宫', '午饭', '回酒店休息', '北村']);
  assert.deepEqual(plain(lib.shiftChanged(['0:1', '0:2', '1:0'], 0, 2)), ['0:1', '0:3', '1:0']);
  // A saved place without a time goes last and leaves the still-to-place list.
  const saved = lib.insertStop(plan, 0, lib.stopFromPlace({ id: 'p_c', name: '广藏市场', city: '首尔', category: 'food', lat: 37.57, lng: 126.99 }, plan.days[0]));
  assert.equal(saved.index, 3);
  assert.deepEqual(plain(saved.unplaced), []);
});

test('flights: cleaned legs, the day each shows on, when to reach the airport, prompts and exports', () => {
  assert.equal(lib.normFlight({ flightNo: '  ', depart: '19/11 08:30' }), null);
  const out = lib.normFlight({ flightNo: 'ci 722', from: '吉隆坡 KUL', to: '桃园 TPE', depart: '2026-11-19T08:30', arrive: '2026-11-19T13:20:00' });
  assert.deepEqual(plain(out), { flightNo: 'CI722', from: '吉隆坡 KUL', to: '桃园 TPE', depart: '2026-11-19T08:30', arrive: '2026-11-19T13:20' });
  const trip = { days: 5, startDate: '2026-11-19', flights: { out, back: { from: '桃园 TPE', depart: '2026-11-23T18:00' } } };
  assert.deepEqual([lib.flightDay(trip, 'out'), lib.flightDay(trip, 'back')], [0, 4]);
  assert.equal(lib.flightDay({ ...trip, flights: { out: { arrive: '2026-11-20T06:10' } } }, 'out'), 1, 'an overnight flight lands on day 2');
  assert.equal(lib.flightDay({ ...trip, flights: { back: { depart: '2026-12-01T10:00' } } }, 'back'), 4, 'dates past the trip stay on its last day');
  assert.equal(lib.flightDay({ days: 3, flights: { back: { depart: '2026-11-23T18:00' } } }, 'back'), 2, 'no start date: the last day');
  assert.deepEqual([lib.airportBy('2026-11-23T18:00'), lib.airportBy('2026-11-23T01:30'), lib.airportBy('')], ['15:00', '前一天 22:30', '']);
  assert.equal(lib.flightLine(out), 'CI722 · 11月19日 08:30 吉隆坡 KUL → 13:20 桃园 TPE');
  assert.equal(lib.flightLine({ flightNo: 'MH360', from: '吉隆坡', to: '仁川', depart: '2026-11-18T23:40', arrive: '2026-11-19T07:20' }), 'MH360 · 11月18日 23:40 吉隆坡 → 11月19日 07:20 仁川');
  const lines = lib.flightPromptLines(trip.flights);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('落地前不要排') && lines[1].includes('（15:00）到机场'), lines.join('\n'));
  assert.deepEqual(plain(lib.flightPromptLines({})), []);

  const tokyo = { title: '东京两日', days: 2, startDate: '2026-12-24', stays: [{ city: '东京', days: 2, base: null }], prefs: { pace: 'normal', transport: 'transit', notes: '' },
    flights: { out: { flightNo: 'MH88', from: '吉隆坡 KUL', to: '羽田 HND', depart: '2026-12-23T23:30', arrive: '2026-12-24T07:40' }, back: null },
    plan: { title: '东京两日', currency: 'JPY', bases: [], days: [], unplaced: [] } };
  const plan = lib.buildPlanPrompt({ trip: tokyo, stays: tokyo.stays, places: [], groupsByCity: {}, lang: 'zh-Hans', allowSuggest: true });
  assert.ok(plan.includes('去程航班：MH88 · 12月23日 23:30 吉隆坡 KUL → 12月24日 07:40 羽田 HND'));
  assert.ok(!plan.includes('回程航班'));
  assert.ok(lib.buildRevisePrompt({ trip: tokyo, places: [], feedback: '轻松一点', lang: 'zh-Hans', allowSuggest: true }).includes('去程航班：MH88'));
  assert.ok(lib.tripToMarkdown(tokyo, {}).includes('## 航班\n- 去程：MH88'));
  assert.ok(lib.tripToText(tokyo).includes('✈ 去程 MH88'));
});

test('交通 tab: a prompt from the flights and the hotel, a checked guide, pins for the route map', () => {
  const trip = { title: '东京两日', days: 2, startDate: '2026-12-24', country: '日本', stays: [{ city: '东京', days: 2, base: null }],
    flights: { out: { flightNo: 'MH88', to: '羽田 HND', arrive: '2026-12-24T07:40' }, back: { from: '羽田 HND', depart: '2026-12-25T18:00' } },
    plan: { bases: [{ city: '东京', name: '新宿站附近', lat: 35.69, lng: 139.7 }], days: [{ city: '东京', stops: [{ name: '浅草寺' }, { kind: 'transfer', name: '大阪 → 东京' }] }] } };
  const p = lib.buildTransitPrompt({ trip, city: '东京', lang: 'zh-Hans' });
  for (const want of ['交通顾问', '住处：新宿站附近', '落地：MH88 · 12月24日 07:40 羽田 HND', '回程起飞：', '这几天要去：浅草寺']) assert.ok(p.includes(want), want);
  assert.ok(!p.includes('大阪 → 东京'), 'a city change is not a place to visit');
  const two = { ...trip, stays: [{ city: '首尔', days: 2 }, { city: '釜山', days: 2 }], plan: null, flights: {} };
  const busan = lib.buildTransitPrompt({ trip: two, city: '釜山', lang: 'zh-Hans' });
  assert.ok(busan.includes('airport 写 []') && busan.includes('没填回程航班') && busan.includes('住处：还没定'), busan);
  assert.ok(lib.buildTransitPrompt({ trip: two, city: '首尔', lang: 'zh-Hans' }).includes('airportBack 写 null'));

  const g = lib.normalizeTransit({ currency: 'JPY',
    airport: [
      { title: '成田特快', steps: [{ title: '搭乘 Narita Express', mode: 'train', minutes: '60', fare: '3,250', place: '新宿站', lat: 35.6896, lng: 139.7006 }, { title: '步行到酒店', mode: 'walk', minutes: 6, fare: 0 }] },
      { title: '空的走法', steps: [] }, { steps: [{ place: '品川站' }] }, { title: '第四种', steps: [{ title: '多余的' }] }],
    airportBack: { title: '机场巴士', minutes: 75, fare: 1400, steps: [{ title: '搭巴士', mode: 'helicopter', minutes: 60 }] },
    metro: { intro: '刷 Suica 就能坐', lines: [{ name: 'JR 山手线', use: '绕一圈' }, { use: '没名字' }], howTo: '进站刷卡、换乘看颜色' },
    passes: [{ name: 'Suica', price: '500', verdict: 'buy' }, { name: 'JR Pass', price: -1, verdict: 'definitely' }, { price: 1 }],
    tips: ['末班车 0 点'] }, { city: '东京', currency: 'KRW', now: 5 });
  assert.equal(g.currency, 'JPY');
  assert.equal(g.airport.length, 2, 'routes without steps are dropped and at most two are kept');
  assert.deepEqual([g.airport[0].minutes, g.airport[0].fare], [66, 3250], 'missing totals add up from the steps');
  assert.deepEqual([g.airport[1].title, g.airport[1].steps[0].title], ['推荐走法', '品川站']);
  assert.deepEqual([g.airportBack.steps[0].mode, g.airportBack.minutes, g.airportBack.fare], ['', 75, 1400]);
  assert.deepEqual(plain(g.metro.lines), [{ name: 'JR 山手线', use: '绕一圈' }]);
  assert.deepEqual(plain(g.metro.howTo), ['进站刷卡', '换乘看颜色']);
  assert.deepEqual(plain(g.passes.map(x => [x.name, x.price, x.verdict])), [['Suica', 500, 'buy'], ['JR Pass', null, 'maybe']]);
  assert.equal(g.generatedAt, 5);
  assert.equal(lib.normalizeTransit({}, { city: '东京', currency: 'JPY' }).airportBack, null);
  assert.equal(lib.transitFor({ transit: [{ city: '东京', tips: [] }] }, '东京').city, '东京');
  assert.equal(lib.transitFor({}, '东京'), null);

  const pins = plain(lib.transitPoints({ steps: [{ title: 'a', lat: 35.5447, lng: 139.7685 }, { title: 'b' }, { title: 'c', lat: 35.6896, lng: 139.7006 }, { title: 'd', place: '酒店', lat: 35.6885, lng: 139.6982 }] }));
  assert.deepEqual(pins.map(x => [x.name, x.num]), [['a', 1], ['c', 3]], 'no pin without coordinates or within 400 m of the last one');
  assert.deepEqual([lib.clockMinus('2026-12-25T18:00', 255), lib.clockMinus('2026-12-25T01:00', 180)], ['13:45', '前一天 22:00']);
  const stays = { stays: [{ city: '首尔', days: 2, base: { name: '明洞' } }, { city: '釜山', days: 1 }] };
  assert.deepEqual(plain(lib.cityHotel(stays, '首尔')), { name: '明洞' });
  assert.equal(lib.cityHotel(stays, '釜山'), null);
});

