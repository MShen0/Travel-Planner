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
  'planCosts', 'expenseTotals', 'diffPlan', 'assistantContext', 'buildAssistantTurns', 'parseAssistantReply', 'travelLine'];
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
