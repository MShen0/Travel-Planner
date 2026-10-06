// Browser smoke test for app/bacao.html with a mocked claude.ai runtime.
//   node tests/e2e/smoke.mjs [screenshot-dir]
// Needs Playwright (global install is fine), curl, and ffmpeg for the test media.
// CDN scripts and fonts are fetched once with curl and served to the browser from tests/e2e/.cache.
import { createRequire } from 'node:module';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const cache = path.join(here, '.cache');
const shots = path.resolve(process.argv[2] || path.join(cache, 'shots'));
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
  if (!existsSync(png)) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0xf4efe6:s=720x960', '-vf', "drawtext=text='ICHIRAN Shibuya':fontsize=64:x=60:y=420", '-frames:v', '1', png]);
  if (!existsSync(webm)) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=15:duration=6', '-c:v', 'libvpx-vp9', '-b:v', '300k', webm]);
  return { png, webm };
}

const app = readFileSync(path.join(root, 'app/bacao.html'), 'utf8');
const mock = readFileSync(path.join(here, 'mock-runtime.js'), 'utf8');
// Same skeleton the Artifact publisher wraps around a page.
const skeleton = (body, withRuntime, seed) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui;background:#fafaf9}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${withRuntime ? `<script>window.__seed=${JSON.stringify(seed || {})};${mock}</script>` : ''}${body}</body></html>`;

const ORIGIN = 'https://bacao.test/';
async function openPage(browser, { viewport, colorScheme = 'light', runtime = true, seed } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 2, hasTouch: viewport.width < 600 });
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
    if (url.startsWith(ORIGIN + '_blob/')) return route.fulfill({ status: 404, body: '' }); // assets exist only on claude.ai
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

const browser = await playwright.chromium.launch();
const { png, webm } = media();
let seed;
{
  const { page, problems, context } = await openPage(browser, { viewport: { width: 390, height: 844 } });
  await step('empty library renders', async () => { await text(page, '还没有种草').waitFor({ timeout: 8000 }); });
  await page.screenshot({ path: path.join(shots, '01-phone-empty.png') });
  await step('collect: paste + screenshot + video frames + AI review', async () => {
    await page.getByRole('button', { name: '添加第一条' }).click();
    await page.fill('#add-text', '【东京3日游｜懒人版攻略 - 小王 | 小红书 - 你的生活指南】 😆 abc 😆 http://xhslink.com/m/1gJ5tOG6M1b，复制本条信息，打开【小红书】App查看精彩内容！');
    await text(page, '这里只有链接').waitFor();
    await page.setInputFiles('#pick-images', png);
    await page.locator('.media figure').first().waitFor();
    await page.setInputFiles('#pick-video', webm);
    await page.locator('.media figcaption').first().waitFor({ timeout: 15000 });
    const frames = await page.locator('.media figure').count();
    if (frames < 3) throw new Error(`only ${frames} images after video`);
    await page.getByRole('button', { name: 'AI 识别地点' }).click();
    await page.locator('.review-item').nth(3).waitFor({ timeout: 10000 });
    const call = await page.evaluate(() => window.__sampleCalls[0]);
    if (!call.opts.images) throw new Error('images not sent to Claude');
    if (!String(call.input).includes('另附')) throw new Error('prompt does not mention the images');
  });
  await page.screenshot({ path: path.join(shots, '02-phone-review.png') });
  await step('collect: save 3 of 4 places with a cover image', async () => {
    await page.locator('.review-item input[type=checkbox]').nth(3).uncheck();
    await page.getByRole('button', { name: /种草 3 个地点/ }).click();
    await text(page, '已种草 3 个地点').waitFor();
    if (await page.locator('.place').count() !== 3) throw new Error('library does not show 3 places');
    if (!(await page.evaluate(() => window.__uploads.length))) throw new Error('cover not uploaded');
  });
  await page.screenshot({ path: path.join(shots, '03-phone-library.png'), fullPage: true });
  await step('place status cycles and editor saves', async () => {
    await page.locator('.place .status').first().click();
    await page.locator('.place .status.want').first().waitFor();
    await page.locator('.place').first().getByRole('button', { name: '编辑' }).click();
    await page.fill('#pe-note', '想周五去');
    await page.getByRole('button', { name: '保存' }).click();
    await text(page, '备注：想周五去').waitFor();
  });
  await step('plan: 2-day trip with base, map and timeline', async () => {
    await page.getByRole('button', { name: /排 东京 行程/ }).click();
    await page.selectOption('#tp-days', '2');
    await page.fill('#tp-base', '新宿站附近');
    await page.fill('#tp-date', '2026-10-12');
    await page.getByRole('button', { name: '生成行程' }).click();
    await page.locator('.timeline').waitFor({ timeout: 10000 });
    await text(page, '东京两日：浅草与涩谷').waitFor();
    if (!(await page.locator('.map-box svg polyline').count())) throw new Error('no route line drawn');
    if (!(await page.locator('.leg .linkish').count())) throw new Error('no route links');
    const href = await page.locator('.leg .linkish').first().getAttribute('href');
    if (!href.startsWith('https://www.google.com/maps/dir/?api=1')) throw new Error('bad leg link ' + href);
  });
  await page.screenshot({ path: path.join(shots, '04-phone-trip.png'), fullPage: true });
  await step('plan: switch days, overview, mark visited', async () => {
    await page.locator('.daychip').nth(2).click();
    await text(page, '涩谷代官山').waitFor();
    await page.locator('.daychip').first().click();
    await page.locator('.trip-card').nth(1).waitFor();
    await page.locator('.trip-card').first().click();
    await page.getByRole('button', { name: '标记拔草' }).first().click();
    await page.locator('.station.done').first().waitFor();
  });
  await step('plan: revise with feedback', async () => {
    await page.getByRole('button', { name: '第一天轻松一点' }).click();
    await page.getByRole('button', { name: '按要求重新排' }).click();
    await text(page, '东京两日（已调整）').waitFor({ timeout: 10000 });
  });
  await step('plan: export markdown through downloads', async () => {
    await page.getByRole('button', { name: '导出 Markdown' }).click();
    await page.waitForFunction(() => window.__downloads.length === 1);
    const d = await page.evaluate(() => window.__downloads[0]);
    if (!d.filename.endsWith('.md') || !d.head.startsWith('# 东京两日')) throw new Error(JSON.stringify(d));
  });
  await step('guide: text to steps, then save its new place', async () => {
    await page.getByRole('button', { name: '全部行程' }).click();
    await page.locator('.tabbar .tab').nth(2).click();
    await page.getByRole('button', { name: '整理第一篇' }).click();
    await page.fill('#g-text', '浅草站 1 号出口出来右转就是雷门，逛完浅草寺沿雷门通过吾妻桥走到晴空塔，大概 20 分钟。');
    await page.getByRole('button', { name: '整理成步骤' }).click();
    await page.locator('.gsteps li').nth(1).waitFor({ timeout: 10000 });
    await page.locator('.exit').first().waitFor();
    await page.getByRole('button', { name: /把 1 个新地点加入种草/ }).click();
    await text(page, '已种草 1 个地点').waitFor();
  });
  await page.screenshot({ path: path.join(shots, '05-phone-guide.png'), fullPage: true });
  await step('agent inbox: link-only paste goes to 待处理', async () => {
    await page.locator('.tabbar .tab').nth(0).click();
    await page.getByRole('button', { name: '添加' }).click();
    await page.fill('#add-text', 'https://www.instagram.com/reel/C0abcdefghi/?igsh=xyz');
    await page.getByRole('button', { name: '交给 Agent' }).click();
    await page.locator('.tabbar .tab').nth(3).click();
    await page.locator('.inbox-item .st.pending').waitFor();
  });
  await step('settings: map preference, CSV export, JSON import', async () => {
    await page.getByRole('button', { name: '设置' }).click();
    await page.getByRole('button', { name: 'Apple 地图' }).click();
    await page.getByRole('button', { name: '地点 CSV' }).click();
    await page.waitForFunction(() => window.__downloads.some(d => d.filename.endsWith('.csv')));
    await page.fill('#import-text', JSON.stringify({ places: [{ id: 'p_imported1', name: '筑地场外市场', city: '东京', category: 'food', status: 'saved', createdAt: 1 }] }));
    await page.getByRole('button', { name: '导入', exact: true }).click();
    await text(page, '导入了 1 条').waitFor();
    await page.getByRole('button', { name: '关闭' }).click();
    await page.locator('.tabbar .tab').nth(0).click();
    const href = await page.locator('.place .linkish').first().getAttribute('href');
    if (!href.startsWith('https://maps.apple.com/')) throw new Error('map preference not applied: ' + href);
  });
  await step('AI errors: rate limit shows a message, refusal of consent disables AI', async () => {
    await page.evaluate(() => { window.__failNextSample = 'rate_limited'; });
    await page.getByRole('button', { name: '添加' }).click();
    await page.fill('#add-text', '银座 鸟贵族 晚上 8 点后不用排队');
    await page.getByRole('button', { name: 'AI 识别地点' }).click();
    await text(page, '用量暂时到上限').waitFor();
    await page.evaluate(() => { window.__failNextSample = 'not_granted'; });
    await page.getByRole('button', { name: 'AI 识别地点' }).click();
    await text(page, '还没允许这个页面使用 Claude').first().waitFor();
    if (await page.getByRole('button', { name: 'AI 识别地点' }).isEnabled()) throw new Error('AI button still enabled after not_granted');
    await page.keyboard.press('Escape');
  });
  seed = await page.evaluate(() => window.__dump());
  results.push(['info', 'phone page problems', problems.join(' | ') || 'none']);
  await context.close();
}
for (const [label, opts] of [
  ['desktop-light', { viewport: { width: 1280, height: 860 }, colorScheme: 'light' }],
  ['desktop-dark', { viewport: { width: 1280, height: 860 }, colorScheme: 'dark' }],
  ['phone-dark', { viewport: { width: 390, height: 844 }, colorScheme: 'dark' }],
]) {
  const { page, problems, context } = await openPage(browser, { ...opts, seed });
  await step(`${label}: library with seeded data`, async () => { await page.locator('.place').first().waitFor({ timeout: 8000 }); });
  await page.screenshot({ path: path.join(shots, `10-${label}-library.png`), fullPage: label !== 'desktop-dark' });
  await step(`${label}: trip view`, async () => {
    await page.locator(label.startsWith('desktop') ? '.tabs-top .tab' : '.tabbar .tab').nth(1).click();
    await page.locator('.trip-card').first().click();
    await page.locator('.timeline').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) throw new Error(`page scrolls sideways by ${overflow}px`);
  });
  await page.screenshot({ path: path.join(shots, `11-${label}-trip.png`), fullPage: true });
  results.push(['info', `${label} problems`, problems.join(' | ') || 'none']);
  await context.close();
}
{
  const { page, problems, context } = await openPage(browser, { viewport: { width: 390, height: 844 }, runtime: false });
  await step('offline copy: explains it is a preview and disables AI', async () => {
    await text(page, '离线预览').waitFor();
    await page.getByRole('button', { name: '添加第一条' }).click();
    await text(page, '请在 claude.ai 里打开这个页面').waitFor();
  });
  results.push(['info', 'offline problems', problems.join(' | ') || 'none']);
  await context.close();
}
await browser.close();
for (const r of results) console.log(r.join('  '));
console.log(`screenshots: ${shots}`);
process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
