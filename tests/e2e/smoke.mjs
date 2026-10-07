// Browser smoke test for app/bacao.html with a mocked claude.ai runtime.
//   node tests/e2e/smoke.mjs [screenshot-dir] [--seed seed.json --blobs blobs.json]
// --seed fills the db for the screenshot pass (otherwise it reuses what the flow test created);
// --blobs maps asset ids to local image files so photos and basemaps show up in the screenshots.
// Needs Playwright (global install is fine), curl, and ffmpeg for the test media.
// CDN scripts and fonts are fetched once with curl and served to the browser from tests/e2e/.cache.
import { createRequire } from 'node:module';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const cache = path.join(here, '.cache');
const argv = process.argv.slice(2);
const flag = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const shots = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : path.join(cache, 'shots'));
const seedFile = flag('--seed');
const blobs = flag('--blobs') ? JSON.parse(readFileSync(flag('--blobs'), 'utf8')) : {};
mkdirSync(cache, { recursive: true });
mkdirSync(shots, { recursive: true });

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
function cached(url) {
  const file = path.join(cache, createHash('sha1').update(url).digest('hex').slice(0, 16));
  if (!existsSync(file)) execFileSync('curl', ['-sSfL', '--max-time', '60', '-A', UA, '-o', file, url]);
  return file;
}
function media() {
  const png = path.join(cache, 'shot.png'), webm = path.join(cache, 'clip.webm');
  // Windows builds of ffmpeg can crash finding a default font through fontconfig: give drawtext a font file there.
  const font = process.platform === 'win32'
    ? `fontfile='${path.join(process.env.SystemRoot || 'C:\\Windows', 'Fonts', 'arial.ttf').replace(/\\/g, '/').replace(':', '\\:')}':` : '';
  if (!existsSync(png)) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0xf4efe6:s=720x960', '-vf', `drawtext=${font}text='ICHIRAN Shibuya':fontsize=64:x=60:y=420`, '-frames:v', '1', png]);
  if (!existsSync(webm)) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=15:duration=6', '-c:v', 'libvpx-vp9', '-b:v', '300k', webm]);
  return { png, webm };
}

const app = readFileSync(path.join(root, 'app/bacao.html'), 'utf8');
const mock = readFileSync(path.join(here, 'mock-runtime.js'), 'utf8');
// Same skeleton the Artifact publisher wraps around a page.
const skeleton = (body, withRuntime, seed) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui;background:#fafaf9}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${withRuntime ? `<script>window.__seed=${JSON.stringify(seed || {})};${mock}</script>` : ''}${body}</body></html>`;
// A rate table so RM conversion works in the flow test.
const FX = { id: 'fx', base: 'MYR', date: '2026-10-06', source: 'test', rates: { JPY: 38.66, KRW: 328.8, THB: 8.24, USD: 0.2447 }, manual: {} };

const ORIGIN = 'https://bacao.test/';
async function openPage(browser, { viewport, colorScheme = 'light', runtime = true, seed } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 2, hasTouch: viewport.width < 600, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/status of 404/.test(m.text())) problems.push(`console: ${m.text()}`); });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === ORIGIN) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: skeleton(app, runtime, seed) });
    if (url.startsWith('https://cdnjs.cloudflare.com/')) return route.fulfill({ contentType: 'application/javascript', body: readFileSync(cached(url)) });
    if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ contentType: 'text/css', body: readFileSync(cached(url)) });
    if (url.startsWith('https://fonts.gstatic.com/')) return route.fulfill({ contentType: 'font/woff2', body: readFileSync(cached(url)) });
    if (url.startsWith(ORIGIN + '_blob/')) {
      const file = blobs[url.slice((ORIGIN + '_blob/').length)];
      return file && existsSync(file) ? route.fulfill({ contentType: 'image/jpeg', body: readFileSync(file) }) : route.fulfill({ status: 404, body: '' });
    }
    if (url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
    problems.push(`blocked request: ${url}`);
    return route.abort();
  });
  await page.goto(ORIGIN);
  return { context, page, problems };
}

const results = [];
async function step(name, fn) {
  try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
}
const text = (page, s) => page.getByText(s, { exact: false }).first();
const tab = (page, name) => page.locator('.nav').getByRole('button', { name: new RegExp('^' + name) }).click();
// Scroll through the page so lazy photos load before a full-page screenshot.
async function settle(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 6000 }).catch(() => {});
}
const noSideScroll = async page => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`page scrolls sideways by ${overflow}px`);
};
const closeSheet = page => page.locator('.sheet-head').getByRole('button', { name: '关闭' }).click();

const browser = await playwright.chromium.launch();
const { png, webm } = media();
let dumped;
{
  // A new user still gets the shared home photo (meta/app) when the seed file carries one, as in the live app.
  const appMeta = seedFile ? (JSON.parse(readFileSync(seedFile, 'utf8')).meta || []).filter(m => m.id === 'app') : [];
  const { page, problems, context } = await openPage(browser, { viewport: { width: 390, height: 844 }, seed: { meta: [FX, ...appMeta] } });
  await step('home renders for a new user', async () => {
    await text(page, '下一站去哪儿').waitFor({ timeout: 8000 });
    await text(page, '还没有旅行计划').waitFor();
  });
  await page.screenshot({ path: path.join(shots, '01-phone-home-empty.png') });
  await step('collect: paste on home, screenshot + video frames, AI review', async () => {
    await page.fill('#home-paste', '【东京3日游｜懒人版攻略 - 小王 | 小红书 - 你的生活指南】 😆 abc 😆 http://xhslink.com/m/1gJ5tOG6M1b，复制本条信息，打开【小红书】App查看精彩内容！');
    await page.getByRole('button', { name: 'AI 识别', exact: true }).click();
    await text(page, '这个页面里的 AI 打不开链接').waitFor();
    await page.setInputFiles('#pick-images', png);
    await page.locator('.media figure').first().waitFor();
    await page.setInputFiles('#pick-video', webm);
    await page.locator('.media figcaption').first().waitFor({ timeout: 15000 });
    if (await page.locator('.media figure').count() < 3) throw new Error('video frames missing');
    await page.getByRole('button', { name: 'AI 识别地点' }).click();
    await page.locator('.review-item').nth(3).waitFor({ timeout: 10000 });
    await text(page, 'AI 已识别 4 个地点 · 1 个国家 · 1 个地区 · 1 个城市').waitFor();
    // 地点归属确认: the place Claude was unsure about waits for a yes
    await page.locator('.needs-confirm').getByText('代官山茑屋书店').waitFor();
    const call = await page.evaluate(() => window.__sampleCalls[0]);
    if (!call.opts.images) throw new Error('images not sent to Claude');
    if (!String(call.input).includes('另附')) throw new Error('prompt does not mention the images');
  });
  await page.screenshot({ path: path.join(shots, '02-phone-review.png') });
  await step('collect: save 3 of 4 places with a cover image', async () => {
    await page.locator('.review-item input[type=checkbox]').nth(3).uncheck();
    await page.getByRole('button', { name: /确认保存 3 个地点/ }).waitFor();
    await page.locator('.needs-confirm').getByRole('button', { name: '没问题' }).click();
    await page.locator('.needs-confirm').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: /全部加入收藏（3）/ }).click();
    await text(page, '已收藏 3 个地点').waitFor();
    const saved = await page.evaluate(() => window.__dump().places);
    if (!saved.every(p => p.countryCode === 'jp' && p.region === '关东' && p.savedAt)) throw new Error('geo not stored: ' + JSON.stringify(saved.map(p => [p.countryCode, p.region])));
    await tab(page, '收藏');
    // one country: the library opens on it; 东京 is one city card
    await text(page, '3 个地点 · 1 个国家 · 1 个城市').waitFor();
    await page.locator('.city-card').first().click();
    await page.locator('.pcard').nth(2).waitFor();
    if (await page.locator('.pcard').count() !== 3) throw new Error('city does not show 3 places');
    if (!(await page.evaluate(() => window.__uploads.length))) throw new Error('cover not uploaded');
  });
  await page.screenshot({ path: path.join(shots, '03-phone-library.png'), fullPage: true });
  await step('library: heart marks 想去, place page edit saves a note', async () => {
    await page.locator('.pcard .heart').first().click();
    await page.locator('.pcard .heart[aria-pressed="true"]').first().waitFor();
    await page.locator('.pcard-main').first().click();
    await page.locator('.pp-body h1').waitFor();
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await page.fill('#pe-note', '想周五去');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await text(page, '备注：想周五去').waitFor();
    await page.getByRole('button', { name: '返回' }).first().click();
    await page.locator('.pcard').first().waitFor();
  });
  await step('plan: add to a new trip, 2 days with hotel and date', async () => {
    await page.locator('.pcard').first().getByRole('button', { name: '加入行程' }).click();
    await page.getByRole('button', { name: '新建一趟行程' }).click();
    await page.getByRole('button', { name: '少一天' }).first().click();
    await text(page, '2 天').waitFor();
    await page.getByLabel('东京 住哪里').fill('新宿站附近');
    await page.fill('#tp-date', '2026-12-24');
    await page.getByRole('button', { name: '生成行程' }).click();
    await page.locator('.tl-row').first().waitFor({ timeout: 10000 });
    await text(page, '东京两日：浅草与涩谷').waitFor();
    await text(page, '12/24 (四)').waitFor();
    await text(page, '酒店出发').waitFor();
    const href = await page.locator('.leg a').first().getAttribute('href');
    if (!href.startsWith('https://www.google.com/maps/dir/?api=1')) throw new Error('bad leg link ' + href);
    const prompt = await page.evaluate(() => window.__sampleCalls.at(-1).input);
    if (!prompt.includes('东京 2 天（住 新宿站附近）')) throw new Error('stay line missing from prompt');
  });
  await page.screenshot({ path: path.join(shots, '04-phone-trip.png'), fullPage: true });
  await step('plan: switch days, mark a stop visited from its menu', async () => {
    await page.locator('.daychip').nth(1).click();
    await text(page, 'Day 2 — 东京').waitFor();
    await page.locator('.daychip').first().click();
    await page.locator('.tl-row .more').nth(1).click();
    await page.getByRole('button', { name: '标记去过' }).click();
    await page.locator('.tl-row .dot.done').first().waitFor();
    await closeSheet(page);
  });
  await step('plan: edit a stop by hand; it is not lit as an AI change', async () => {
    await page.locator('.tl-row .more').first().click();
    await page.getByRole('button', { name: '编辑这一站' }).click();
    await page.fill('#se-time', '10:05');
    await page.fill('#se-what', '先去御守柜台');
    await page.selectOption('#se-mode', 'taxi');
    await page.fill('#se-min', '12');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await text(page, '这一站改好了').waitFor();
    const t = await page.evaluate(() => window.__dump().trips[0]);
    const s = t.plan.days[0].stops[0];
    if (s.time !== '10:05' || s.what !== '先去御守柜台' || s.travel.mode !== 'taxi' || s.travel.minutes !== 12) throw new Error(JSON.stringify(s));
    if ((t.changed || []).length) throw new Error('a hand edit was lit');
    await text(page, '打车 12 分钟').waitFor();
  });
  await step('plan: add your own stop by its time, edit the day theme', async () => {
    await page.getByRole('button', { name: '加一站' }).click();
    await page.getByRole('button', { name: '自己写一站' }).click();
    await page.fill('#as-name', '回酒店休息');
    await page.fill('#as-time', '23:00');
    await page.getByRole('button', { name: '加到 Day 1', exact: true }).click();
    await text(page, '已加到 Day 1').waitFor();
    const stops = await page.evaluate(() => window.__dump().trips[0].plan.days[0].stops);
    if (stops.at(-1).name !== '回酒店休息' || stops.at(-1).placeId !== null) throw new Error('own stop not last: ' + stops.map(s => s.name).join('、'));
    await page.getByRole('button', { name: '编辑 Day 1 的主题和备注' }).click();
    await page.fill('#de-theme', '浅草半日');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await text(page, '浅草半日').waitFor();
  });
  await step('plan: flights from 行程信息 head day 1 and close the last day', async () => {
    await page.getByRole('button', { name: '行程菜单' }).click();
    await page.getByRole('button', { name: '改名称、日期、预算和航班' }).click();
    await page.fill('#fl-out-no', 'mh 88');
    await page.fill('#fl-out-to', '羽田 HND');
    await page.fill('#fl-out-depart', '2026-12-23T23:30');
    await page.fill('#fl-out-arrive', '2026-12-24T07:40');
    await page.fill('#fl-back-from', '羽田 HND');
    await page.fill('#fl-back-depart', '2026-12-25T18:00');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await text(page, '已保存').waitFor();
    await text(page, '羽田 HND 落地').waitFor();
    await text(page, '先到住处放行李').waitFor();
    await page.locator('.daychip').nth(1).click();
    await text(page, '建议 15:00 前到机场').waitFor();
    await page.locator('.daychip').first().click();
    const f = await page.evaluate(() => window.__dump().trips[0].flights);
    if (f.out.flightNo !== 'MH88' || f.back.depart !== '2026-12-25T18:00') throw new Error(JSON.stringify(f));
  });
  await step('plan: AI revision lights the changed rows until acknowledged', async () => {
    await page.getByRole('button', { name: 'AI 优化这一天' }).click();
    await page.getByRole('button', { name: '这天轻松一点' }).click();
    await page.getByRole('button', { name: '开始调整' }).click();
    // a proposal first: before/after minutes, nothing saved until 采用
    await page.locator('.proposal .cmp').waitFor({ timeout: 10000 });
    const asked = await page.evaluate(() => window.__sampleCalls.at(-1).input);
    if (!asked.includes('去程航班：MH88') || !asked.includes('回程航班')) throw new Error('flights missing from the revise prompt');
    const rev = await page.evaluate(() => window.__dump().trips[0].revisions || 0);
    if (rev) throw new Error('revision saved before it was adopted');
    await page.getByRole('button', { name: '采用这个方案' }).click();
    await page.locator('.changed-note').waitFor({ timeout: 10000 });
    if (!(await page.locator('.tl-row.changed').count())) throw new Error('no lit rows');
    await page.screenshot({ path: path.join(shots, '05-phone-trip-changed.png') });
    await page.getByRole('button', { name: '知道了' }).click();
    await page.locator('.changed-note').waitFor({ state: 'detached' });
  });
  await step('trip tabs: map, costs in RM, pending, overview', async () => {
    await page.getByRole('tab', { name: /地图/ }).click();
    await page.locator('.mapwrap .pin').first().waitFor();
    if (!(await page.locator('.route-svg polyline').count())) throw new Error('no route drawn');
    await page.getByRole('tab', { name: /花费/ }).click();
    await page.getByRole('button', { name: '记一笔', exact: true }).click();
    await page.fill('#ex-amount', '1200');
    await text(page, '≈ RM').waitFor();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.locator('.expense-row').first().waitFor();
    await text(page, 'RM 31').waitFor();
    await page.getByRole('tab', { name: /待安排/ }).click();
    await text(page, '都安排好了').waitFor();
    await page.getByRole('tab', { name: /概览/ }).click();
    if (await page.locator('.day-list button').count() !== 2) throw new Error('overview should list 2 days');
  });
  await step('transit: AI writes the 交通 tab: airport legs with totals, map and link, leave-by time, passes', async () => {
    await page.getByRole('tab', { name: '交通', exact: true }).click();
    await page.getByRole('button', { name: '生成交通攻略' }).click();
    await text(page, '羽田 HND → 新宿站附近').waitFor({ timeout: 10000 });
    await text(page, '约 1 小时').waitFor();
    await page.locator('.transit-route .mapwrap .pin').first().waitFor();
    const href = await page.locator('.transit-route a.btn').first().getAttribute('href');
    if (!href.startsWith('https://www.google.com/maps/dir/')) throw new Error('bad route link ' + href);
    await text(page, '最晚 13:45 从住处出发').waitFor();
    const asked = await page.evaluate(() => window.__sampleCalls.at(-1).input);
    if (!asked.includes('落地：MH88') || !asked.includes('住处：新宿站附近')) throw new Error('flight or hotel missing from the transit prompt');
    await page.getByRole('button', { name: '机场巴士' }).first().click();
    await text(page, '入境大厅 1 楼 4 号站台').waitFor();
    await page.getByRole('button', { name: '常用票券' }).click();
    await text(page, 'Suica 西瓜卡').waitFor();
    const saved = await page.evaluate(() => window.__dump().trips[0].transit);
    if (!saved || saved[0].city !== '东京' || saved[0].airport.length !== 2) throw new Error('transit not saved: ' + JSON.stringify(saved));
  });
  await step('trip menu: export markdown through downloads', async () => {
    await page.getByRole('button', { name: '行程菜单' }).click();
    await page.getByRole('button', { name: '导出 Markdown' }).click();
    await page.waitForFunction(() => window.__downloads.length === 1);
    const d = await page.evaluate(() => window.__downloads[0]);
    if (!d.filename.endsWith('.md') || !d.head.startsWith('# 东京两日')) throw new Error(JSON.stringify(d));
  });
  await step('guide: text to numbered steps, then save its new place', async () => {
    await tab(page, '行程');
    await page.locator('.guide-card').first().click();
    await page.fill('#g-text', '浅草站 1 号出口出来右转就是雷门，逛完浅草寺沿雷门通过吾妻桥走到晴空塔，大概 20 分钟。');
    await page.getByRole('button', { name: '整理成步骤' }).click();
    await page.locator('.gsteps li').nth(1).waitFor({ timeout: 10000 });
    await page.locator('.exit').first().waitFor();
    await page.getByRole('button', { name: '把「雷门」加入收藏' }).click();
    await text(page, '已加入收藏 1 个地点').waitFor();
    await page.getByRole('button', { name: '「雷门」已在收藏，打开' }).waitFor();
  });
  await page.screenshot({ path: path.join(shots, '06-phone-guide.png'), fullPage: true });
  await step('agent inbox: a link-only paste goes to the agent', async () => {
    await tab(page, '首页');
    await page.fill('#home-paste', 'https://www.instagram.com/reel/C0abcdefghi/?igsh=xyz');
    await page.getByRole('button', { name: 'AI 识别', exact: true }).click();
    await page.getByRole('button', { name: '交给 Agent' }).click();
    await page.getByRole('button', { name: /1 条链接在等 Agent 处理/ }).click();
    await page.locator('.inbox-item .st.pending').waitFor();
  });
  await step('assistant: quick ask, action card, confirm opens the trip form', async () => {
    await tab(page, 'AI');
    await page.getByRole('button', { name: '规划行程' }).click();
    await page.locator('.action-card').waitFor({ timeout: 10000 });
    await text(page, '东京 2 天行程建议').waitFor();
    if (await page.locator('.bubble').filter({ hasText: '<action' }).count()) throw new Error('raw action block shown');
    await page.screenshot({ path: path.join(shots, '07-phone-assistant.png') });
    await page.getByRole('button', { name: /确认，去生成行程/ }).click();
    await page.getByRole('dialog', { name: '排行程' }).waitFor();
    if ((await page.getByLabel('东京 住哪里').inputValue()) !== '新宿站附近') throw new Error('hotel not prefilled');
    await closeSheet(page);
    await text(page, '已确认').waitFor();
  });
  await step('settings: map app, CSV, import, manual FX rate', async () => {
    await tab(page, '首页');
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByRole('button', { name: 'Apple 地图' }).click();
    await page.getByRole('button', { name: '地点 CSV' }).click();
    await page.waitForFunction(() => window.__downloads.some(d => d.filename.endsWith('.csv')));
    await page.fill('#import-text', JSON.stringify({ places: [{ id: 'p_imported1', name: '筑地场外市场', city: '东京', category: 'food', status: 'saved', createdAt: 1 }] }));
    await page.getByRole('button', { name: '导入', exact: true }).click();
    await text(page, '导入了 1 条').waitFor();
    await page.getByLabel('1 MYR 换多少 JPY').fill('40');
    await page.getByRole('button', { name: '保存手动汇率' }).click();
    await text(page, '汇率已保存').waitFor();
    await closeSheet(page);
    await tab(page, '收藏');
    await page.locator('.city-card').first().click();
    const href = await page.locator('.pcard-foot a').first().getAttribute('href');
    if (!href.startsWith('https://maps.apple.com/')) throw new Error('map preference not applied: ' + href);
    const fx = await page.evaluate(() => window.__dump().meta.find(d => d.id === 'fx'));
    if (fx.manual.JPY !== 40) throw new Error('manual rate not stored');
  });
  await step('organize: AI proposes, nothing changes until 确认整理, then only what was approved', async () => {
    await tab(page, '收藏');
    await page.getByRole('button', { name: 'AI 整理' }).click();
    await page.getByRole('button', { name: '开始整理' }).click();
    await page.locator('.org-result').waitFor({ timeout: 10000 });
    await page.locator('.org-result .needs-confirm').waitFor();
    const before = await page.evaluate(() => window.__dump().places.find(p => p.id === 'p_imported1'));
    if (before.region || before.country) throw new Error('organize wrote before confirmation');
    await page.screenshot({ path: path.join(shots, '08-phone-organize.png') });
    await page.getByRole('button', { name: /确认整理/ }).click();
    await text(page, '个地点').waitFor();
    await page.waitForFunction(() => (window.__dump().places.find(p => p.id === 'p_imported1') || {}).region === '关东');
    const after = await page.evaluate(() => window.__dump().places.find(p => p.id === 'p_imported1'));
    if (after.country !== '日本' || after.countryCode !== 'jp' || after.area !== '筑地' || !after.aiMeta || !after.aiMeta.normalized) throw new Error(JSON.stringify(after));
    const unsure = await page.evaluate(() => window.__dump().places.find(p => p.name === '雷门'));
    if (unsure.area) throw new Error('the unsure change was applied without the user accepting it');
    await page.locator('.city-card').first().click();
  });
  await step('AI errors: rate limit message; refused consent disables AI', async () => {
    await page.getByRole('button', { name: '添加', exact: true }).click();
    await page.fill('#add-text', '银座 鸟贵族 晚上 8 点后不用排队');
    await page.evaluate(() => { window.__failNextSample = 'rate_limited'; });
    await page.getByRole('button', { name: 'AI 识别地点' }).click();
    await text(page, '用量暂时到上限').waitFor();
    await page.evaluate(() => { window.__failNextSample = 'not_granted'; });
    await page.getByRole('button', { name: 'AI 识别地点' }).click();
    await text(page, '还没允许这个页面使用 Claude').first().waitFor();
    if (await page.getByRole('button', { name: 'AI 识别地点' }).isEnabled()) throw new Error('AI button still enabled after not_granted');
    await page.keyboard.press('Escape');
  });
  dumped = await page.evaluate(() => window.__dump());
  results.push(['info', 'flow page problems', problems.join(' | ') || 'none']);
  await context.close();
}

// Screenshot pass over every screen with example data, phone and desktop, light and dark.
const seed = seedFile ? JSON.parse(readFileSync(seedFile, 'utf8')) : dumped;
const tripId = (seed.trips[0] || {}).id;
const guideId = (seed.guides[0] || {}).id;
for (const [label, opts] of [
  ['phone', { viewport: { width: 390, height: 844 }, colorScheme: 'light' }],
  ['desktop', { viewport: { width: 1280, height: 860 }, colorScheme: 'light' }],
  ['phone-dark', { viewport: { width: 390, height: 844 }, colorScheme: 'dark' }],
  ['desktop-dark', { viewport: { width: 1280, height: 860 }, colorScheme: 'dark' }],
]) {
  const { page, problems, context } = await openPage(browser, { ...opts, seed });
  const full = !label.includes('dark');
  // Full-page captures pin the fixed bars to the page so they don't float over the middle of the shot.
  const snap = async name => {
    await settle(page);
    const pin = full ? await page.addStyleTag({ content: '.shell{position:relative}.nav,.fab{position:absolute!important}' }) : null;
    await page.screenshot({ path: path.join(shots, `${label}-${name}.png`), fullPage: full });
    if (pin) await pin.evaluate(el => el.remove());
  };
  await step(`${label}: home`, async () => {
    await page.locator('.trip-card .stats').waitFor({ timeout: 8000 });
    await page.waitForTimeout(400);
    await noSideScroll(page);
    await page.screenshot({ path: path.join(shots, `${label}-home-viewport.png`) });
    await snap('home');
  });
  await step(`${label}: library`, async () => {
    await tab(page, '收藏');
    await page.locator('.country-card, .city-card').first().waitFor();
    await noSideScroll(page);
    await snap('library');
  });
  await step(`${label}: map mode`, async () => {
    await page.getByRole('button', { name: '地图模式' }).click();
    await page.locator('.mapwrap .pin').first().waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(shots, `${label}-map.png`) });
    await page.getByRole('button', { name: '返回' }).first().click();
  });
  await step(`${label}: country and city`, async () => {
    if (await page.locator('.country-card').count()) {
      await page.locator('.country-card').first().click();
      await page.locator('.city-card').first().waitFor();
      await noSideScroll(page);
      await snap('country');
    }
    await page.locator('.city-card').first().click();
    await page.locator('.pcard').first().waitFor();
    await noSideScroll(page);
    await snap('city');
  });
  if (tripId) {
    await step(`${label}: trip plan`, async () => {
      await tab(page, '行程');
      await page.locator('.tripcard').first().click();
      await page.locator('.tl-row').first().waitFor();
      await page.waitForTimeout(400);
      await noSideScroll(page);
      await snap('trip');
    });
    await step(`${label}: trip day 4 (day trip with a city change)`, async () => {
      const chips = page.locator('.daychip');
      if (await chips.count() > 3) {
        await chips.nth(3).click();
        await page.waitForTimeout(300);
        await snap('trip-day4');
        await chips.first().click();
      }
    });
    for (const [name, key] of [['地图', 'trip-map'], ['交通', 'trip-transit'], ['花费', 'trip-costs'], ['待安排', 'trip-pending'], ['概览', 'trip-overview']]) {
      await step(`${label}: trip ${name}`, async () => {
        await page.getByRole('tab', { name: new RegExp(name) }).click();
        await page.waitForTimeout(name === '地图' ? 600 : 200);
        await noSideScroll(page);
        await snap(key);
      });
    }
    await step(`${label}: place page`, async () => {
      await page.getByRole('tab', { name: /行程/ }).click();
      await page.locator('.tl-row button.info').first().click();
      await page.locator('.pp-body h1').waitFor();
      await page.waitForTimeout(300);
      await noSideScroll(page);
      await snap('place');
    });
  }
  if (guideId) {
    await step(`${label}: guide`, async () => {
      await tab(page, '行程');
      await page.locator('.guide-card').first().click();
      await page.locator('.gsteps li').first().waitFor();
      await noSideScroll(page);
      await snap('guide');
    });
  }
  await step(`${label}: assistant`, async () => {
    await tab(page, 'AI');
    await page.getByRole('button', { name: '规划行程' }).click();
    await page.locator('.action-card').waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    await noSideScroll(page);
    await page.screenshot({ path: path.join(shots, `${label}-assistant.png`) });
  });
  results.push(['info', `${label} problems`, problems.join(' | ') || 'none']);
  await context.close();
}
{
  const { page, problems, context } = await openPage(browser, { viewport: { width: 390, height: 844 }, runtime: false });
  await step('offline copy: explains it is a preview and disables AI', async () => {
    await text(page, '离线预览').waitFor();
    await page.getByRole('button', { name: 'AI 识别', exact: true }).click();
    await text(page, '请在 claude.ai 里打开这个页面').waitFor();
  });
  results.push(['info', 'offline problems', problems.join(' | ') || 'none']);
  await context.close();
}
await browser.close();
for (const r of results) console.log(r.join('  '));
console.log(`screenshots: ${shots}`);
process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
