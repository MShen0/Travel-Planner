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
  'niceScale', 'placeLabels', 'placeLink', 'legLink', 'dayRouteLink', 'mapProvider', 'buildExtractPrompt', 'buildPlanPrompt',
  'buildRevisePrompt', 'buildGuidePrompt', 'normalizePlan', 'normalizeGuide', 'tripToMarkdown', 'tripToText', 'placesToCSV',
  'parseBackup', 'frameTimes', 'normTime', 'addDays', 'weekday', 'fmtMin'];
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
      { name: '一兰拉面 道顿堀店', nameLocal: '一蘭 道頓堀店', category: 'food', lat: '34.6687', lng: 135.5023, coordConfidence: 'exact', mustTry: '拉面、溏心蛋', priceLevel: 9 },
      { name: '一兰拉面 道顿堀店', category: 'food' },
      { name: '黑门市场', category: 'market', lat: 0, lng: 0 },
      { name: '' },
    ],
  });
  assert.equal(out.places.length, 2);
  const [ichiran, kuromon] = out.places;
  assert.equal(ichiran.city, '大阪');
  assert.deepEqual(plain(ichiran.mustTry), ['拉面', '溏心蛋']);
  assert.equal(ichiran.priceLevel, 4);
  assert.equal(ichiran.lat, 34.6687);
  assert.equal(kuromon.category, 'other');
  assert.equal(kuromon.lat, null);
  assert.equal(kuromon.coordConfidence, null);
  assert.equal(lib.normalizePlace({ name: '一兰拉面', chain: true }).chain, true);
  assert.equal(lib.makePlaceDoc(lib.normalizePlace({ name: '一兰拉面', chain: 1 })).chain, true);
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
].map(([name, lat, lng], i) => ({ id: `p_${i}`, name, lat, lng, category: 'sight' }));

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

test('projection, scale bar and labels stay inside the drawing', () => {
  const proj = lib.makeProjection(TOKYO, 600, 380, 34);
  for (const p of TOKYO) {
    const [x, y] = proj.project(p);
    assert.ok(x >= 33 && x <= 567 && y >= 33 && y <= 347, `${p.name} at ${x},${y}`);
  }
  const scale = lib.niceScale(proj.kmPerPx, 90);
  assert.ok(scale.px > 40 && scale.px < 180);
  assert.match(scale.label, /^(\d+ m|[\d.]+ km)$/);
  const items = TOKYO.map(p => { const [x, y] = proj.project(p); return { x, y, text: p.name }; });
  const placed = lib.placeLabels(items, 600, 380).filter(l => l.show);
  assert.ok(placed.length >= 6);
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

test('normalizePlan keeps saved places and reports dropped ones', () => {
  const byId = Object.fromEntries(TOKYO.map(p => [p.id, { ...p, city: '东京', country: '日本' }]));
  const plan = lib.normalizePlan({
    title: '东京三日', base: { name: '新宿', lat: 35.69, lng: 139.70 },
    days: [
      { theme: '浅草', stops: [
        { time: '9:05', placeId: 'p_0', name: '浅草寺', lat: 1, lng: 1, travel: { mode: 'metro', minutes: '25', detail: '丸之内线→银座线' } },
        { time: '11:30', placeId: 'p_404', name: '午饭：天妇罗', suggested: true, category: 'food', travel: { mode: 'rocket', minutes: 5 } },
      ] },
      { theme: '涩谷', stops: [{ time: '10:00', placeId: 'p_3', name: '涩谷 Sky' }] },
    ],
    unplaced: [{ placeId: 'p_6', reason: '太远' }, { placeId: 'p_404', reason: '?' }],
  }, byId, { startDate: '2026-10-12', placeIds: ['p_0', 'p_3', 'p_6', 'p_7'], city: '东京' });
  const [d1, d2] = plan.days;
  assert.equal(d1.date, '2026-10-12');
  assert.equal(d2.date, '2026-10-13');
  assert.equal(d1.stops[0].time, '09:05');
  assert.equal(d1.stops[0].lat, TOKYO[0].lat, 'stored coordinates win over Claude estimates');
  assert.equal(d1.stops[0].travel.minutes, 25);
  assert.equal(d1.stops[1].placeId, null);
  assert.equal(d1.stops[1].suggested, true);
  assert.equal(d1.stops[1].travel.mode, 'walk');
  assert.deepEqual(plain(plan.unplaced.map(u => u.placeId)), ['p_6', 'p_7']);
  assert.equal(plan.base.name, '新宿');
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
  const trip = { city: '东京', days: 3, startDate: '2026-10-12', base: { name: '新宿' }, prefs: { pace: 'normal', transport: 'transit', notes: '' } };
  const { groups, noCoord } = lib.clusterIntoDays(TOKYO, 3, null);
  const plan = lib.buildPlanPrompt({ trip, places: TOKYO, groups, noCoord, lang: 'zh-Hans', allowSuggest: true });
  for (const p2 of TOKYO) assert.ok(plan.includes(`"id":"${p2.id}"`));
  assert.ok(plan.includes('days 必须正好 3 天'));
  assert.ok(plan.includes('2026-10-12（周一）'));
  const chainPlan = lib.buildPlanPrompt({ trip, places: [{ id: 'p_c', name: '一兰拉面', category: 'food', chain: true }], groups: [[]], noCoord: [], lang: 'zh-Hans' });
  assert.ok(chainPlan.includes('"chain":"连锁店，挑当天路线附近的分店"'));
  const guide = lib.buildGuidePrompt({ text: '从浅草站 1 号出口出来', lang: 'en' });
  assert.ok(guide.includes('English'));
});

test('exports: markdown, chat text, CSV, backup', () => {
  const trip = { title: '东京三日', city: '东京', days: 1, startDate: '2026-10-12', plan: {
    summary: '先东后西', tips: ['买 Suica'], base: { name: '新宿' }, unplaced: [{ placeId: 'p_6', reason: '太远' }],
    days: [{ day: 1, date: '2026-10-12', theme: '浅草', stops: [{ time: '09:00', name: '浅草寺', nameLocal: '浅草寺', stayMin: 60, travel: { mode: 'metro', minutes: 25, detail: '银座线' } }] }] } };
  const md = lib.tripToMarkdown(trip, { p_6: { name: '台场' } });
  assert.ok(md.includes('## Day 1 · 浅草（2026-10-12 周一）'));
  assert.ok(md.includes('↳ 地铁 · 25 分钟 · 银座线'));
  assert.ok(md.includes('- 台场：太远'));
  assert.ok(lib.tripToText(trip).includes('• 09:00 浅草寺 · 1 小时'));
  const csv = lib.placesToCSV([{ name: 'Bar "X", Ginza', lat: 35.67, lng: 139.76, city: '东京', category: 'nightlife', status: 'want', mustTry: ['highball'], source: { url: 'https://a.b' } }]);
  assert.ok(csv.split('\n')[1].startsWith('"Bar ""X"", Ginza","35.67, 139.76",'), csv);
  assert.throws(() => lib.parseBackup('{"places":[{"id":"../evil"}]}'), /没有可导入/);
  assert.equal(lib.parseBackup('{"places":[{"id":"p_ok"}],"trips":[{"id":"t_1"}]}').trips.length, 1);
});

test('small formatters', () => {
  assert.equal(lib.normTime('8：30'), '08:30');
  assert.equal(lib.normTime('noon'), '');
  assert.equal(lib.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(lib.weekday('2026-10-06'), '周二');
  assert.equal(lib.fmtMin(95), '1 小时 35 分');
  assert.deepEqual(plain(lib.frameTimes(60, 4)), [7.5, 22.5, 37.5, 52.5]);
});
