// A stand-in for the claude.ai artifact runtime (window.claude.use), for local browser tests only.
// db: in-memory collections with onSnapshot; sample: canned answers chosen by the prompt; assets/downloads: recorded.
(() => {
  const listeners = {};
  const collections = {};
  const col = name => (collections[name] = collections[name] || new Map());
  const notify = name => (listeners[name] || []).forEach(fn => fn());
  const snapshotOf = name => {
    const docs = [...col(name).entries()].map(([id, body]) => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(body)), metadata: { fromCache: false, hasPendingWrites: false } }));
    return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  // Same merge rule as the real db: nested objects merge, arrays and scalars replace.
  const merge = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
    return out;
  };
  const db = {
    collection(name) {
      return {
        path: name,
        doc(id) {
          return {
            id,
            async set(data) { col(name).set(id, JSON.parse(JSON.stringify(data))); notify(name); },
            async update(patch) { const cur = col(name).get(id); if (!cur) throw { code: 'invalid_argument', message: 'missing' }; col(name).set(id, merge(cur, JSON.parse(JSON.stringify(patch)))); notify(name); },
            async delete() { col(name).delete(id); notify(name); },
            async get() { const b = col(name).get(id); return { id, exists: !!b, data: () => b }; },
          };
        },
        onSnapshot(next) {
          const fn = () => setTimeout(() => next(snapshotOf(name)), 0);
          (listeners[name] = listeners[name] || []).push(fn);
          fn();
          return () => { listeners[name] = listeners[name].filter(f => f !== fn); };
        },
      };
    },
  };
  window.__db = collections;
  for (const [name, docs] of Object.entries(window.__seed || {})) for (const d of docs) col(name).set(d.id, d);
  window.__dump = () => Object.fromEntries(Object.entries(collections).map(([k, m]) => [k, [...m.values()]]));

  const calls = (window.__sampleCalls = []);
  const placesInPrompt = prompt => prompt.split('\n').filter(l => l.startsWith('{"id":"p_')).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const staysInPrompt = prompt => {
    const m = /城市和天数(?:（按顺序）)?：(.+?)。/.exec(prompt);
    if (!m) return [{ city: '东京', days: 2, base: '' }];
    return m[1].split(' → ').map(s => { const x = /^(\S+) (\d+) 天(?:（住 ([^）]+)）)?/.exec(s.trim()); return x ? { city: x[1], days: +x[2], base: x[3] || '' } : null; }).filter(Boolean);
  };
  function planAnswer(prompt) {
    const revising = prompt.includes('用户想调整');
    const stays = staysInPrompt(prompt);
    const ps = placesInPrompt(prompt);
    const out = {
      title: revising ? '东京两日（已调整）' : '东京两日：浅草与涩谷', summary: '第一天在东边，第二天在西边。', currency: 'JPY',
      bases: stays.filter(s => s.base).map(s => ({ city: s.city, name: s.base, lat: 35.6896, lng: 139.7006 })),
      tips: ['买一张 Suica', 'Shibuya Sky 要提前预约'], days: [], unplaced: [],
    };
    stays.forEach((s, si) => {
      const mine = ps.filter(p => p.city === s.city);
      for (let d = 0; d < s.days; d++) {
        const stops = [];
        if (si > 0 && d === 0) stops.push({ time: '08:30', kind: 'transfer', placeId: null, name: `${stays[si - 1].city} → ${s.city}`, category: 'transport', what: '寄存行李', travel: { mode: 'train', minutes: 60, detail: 'JR', fare: 950 } });
        mine.filter((_, i) => i % s.days === d).forEach(p => stops.push({
          time: `${String(9 + stops.length * 2).padStart(2, '0')}:00`, kind: 'visit', placeId: p.id, name: p.name, lat: p.lat, lng: p.lng, category: p.category, stayMin: 60,
          what: `逛 ${p.name}`, tip: '', spend: p.category === 'food' ? 1200 : 0, suggested: false,
          travel: { mode: stops.length ? 'walk' : 'metro', minutes: stops.length ? 12 : 25, detail: stops.length ? '步行约 900 米' : 'JR 山手线', fare: stops.length ? 0 : 200 },
        }));
        out.days.push({ day: out.days.length + 1, city: s.city, theme: d ? '涩谷代官山' : '浅草', area: d ? '涩谷' : '浅草', note: '', stops });
      }
    });
    out.days[0].stops.push({ time: '12:00', placeId: null, name: '大黑家天妇罗', nameLocal: '大黒家天麩羅', lat: 35.7118, lng: 139.7963, category: 'food', stayMin: 50, what: '炸虾天丼', spend: 2000, suggested: true, travel: { mode: 'walk', minutes: 6, detail: '步行', fare: 0 } });
    if (revising) out.days[0].stops.splice(1, 0, { time: '10:30', placeId: null, name: '浅草人形烧', category: 'food', stayMin: 15, what: '雷门对面的人形烧', spend: 500, suggested: true, travel: { mode: 'walk', minutes: 3, detail: '步行', fare: 0 } });
    return out;
  }
  function answerFor(prompt) {
    if (prompt.includes('旅行收藏助手')) {
      return {
        post: { title: '东京3日游｜懒人版攻略', summary: '三天经典路线', city: '东京', country: '日本' },
        places: [
          { name: '浅草寺', nameLocal: '浅草寺', city: '东京', country: '日本', countryCode: 'jp', region: '关东', regionType: 'region', confidence: 0.95, area: '浅草', category: 'sight', mustTry: ['求签'], tips: '早上 8 点前人少', durationMin: 60, lat: 35.7148, lng: 139.7967, coordConfidence: 'exact', evidence: '浅草寺早上8点前人少' },
          { name: '一兰拉面', nameLocal: '一蘭 渋谷店', city: '东京', country: '日本', area: '涩谷', category: 'food', mustTry: ['拉面'], tips: '别去本店排队', priceLevel: 2, price: { amount: 980, currency: 'JPY', per: '一碗' }, lat: 35.6611, lng: 139.701, coordConfidence: 'exact', evidence: '一兰拉面（别去本店排队）' },
          { name: '代官山茑屋书店', nameLocal: '代官山 蔦屋書店', city: '东京', country: '日本', confidence: 0.6, area: '代官山', category: 'shopping', tips: '文艺青年圣地', lat: 35.6484, lng: 139.6998, coordConfidence: 'area', evidence: '代官山茑屋书店必去' },
          { name: 'Shibuya Sky', nameLocal: 'SHIBUYA SKY', city: '东京', country: '日本', area: '涩谷', category: 'sight', tips: '日落前 1 小时上去', lat: 35.6585, lng: 139.7023, coordConfidence: 'exact', evidence: 'Shibuya Sky日落前1小时上去' },
        ],
      };
    }
    if (prompt.includes('排一份') || prompt.includes('用户想调整')) return planAnswer(prompt);
    if (prompt.includes('旅行整理助手')) {
      const ps = placesInPrompt(prompt);
      return {
        summary: `检查了 ${ps.length} 个地点，补上国家、地区和区域`, groups: [],
        changes: ps.map(p => ({ placeId: p.id, country: '日本', countryCode: 'jp', region: '关东', regionType: 'region', city: p.city || '东京', area: p.area || (p.name === '雷门' ? '浅草' : '筑地'),
          confidence: p.name === '雷门' ? 0.6 : 0.93, reason: p.name === '雷门' ? '攻略没写清楚' : '东京属于关东' })),
        duplicates: [], nearbyGroups: [],
        needsConfirmation: ps.length > 2 ? [{ placeId: ps[2].id, field: 'area', question: '这家店在哪个街区？', options: ['代官山', '涩谷'], confidence: 0.55 }] : [],
      };
    }
    if (prompt.includes('旅行向导')) {
      return {
        title: '从浅草站到晴空塔', city: '东京', country: '日本', overview: '浅草寺之后步行过隅田川到晴空塔。', duration: '半天',
        checklist: ['Suica 充值', '晴空塔网上预约'],
        steps: [
          { title: '浅草站出站', detail: '银座线浅草站从 1 号出口出来，雷门就在右手边。', from: '浅草站', to: '雷门', mode: 'walk', minutes: 2, exit: '1', cost: '', placeName: '雷门' },
          { title: '过吾妻桥', detail: '沿雷门通往东走，过吾妻桥。', from: '雷门', to: '东京晴空塔', mode: 'walk', minutes: 20, exit: '', cost: '', inferred: true },
        ],
        places: [{ name: '雷门', nameLocal: '雷門', category: 'sight', lat: 35.7111, lng: 139.7964 }, { name: '浅草寺', category: 'sight' }],
        warnings: ['晴空塔门票价格可能变动'],
      };
    }
    return { note: 'unrecognised prompt' };
  }
  const CHAT_REPLY = [
    '好的！按你们收藏的地点，东京 2 天可以这样走：',
    '- **Day 1** 浅草一带：浅草寺 → 一兰拉面',
    '- **Day 2** 涩谷和代官山：代官山茑屋书店，傍晚看日落',
    '住新宿的话两天都顺路。确认后我会帮你生成完整行程。',
    '<action>{"type":"plan_trip","label":"东京 2 天行程建议","cities":["东京"],"days":2,"bases":{"东京":"新宿站附近"},"pace":"normal","transport":"transit","notes":"美食和购物为主","outline":[{"day":1,"area":"浅草·上野","theme":"老城区 + 美食"},{"day":2,"area":"涩谷·代官山","theme":"购物 + 日落"}]}</action>',
  ].join('\n');
  async function stream(text, opts) {
    const chunks = text.match(/[\s\S]{1,120}/g) || [text];
    let acc = '';
    for (const c of chunks) {
      if (opts && opts.signal && opts.signal.aborted) throw { code: 'cancelled', message: 'aborted', text: acc };
      await new Promise(r => setTimeout(r, 15));
      acc += c;
      if (opts && opts.onText) opts.onText({ text: acc, delta: c });
    }
    return acc;
  }
  const sample = async (input, opts) => {
    calls.push({ input, opts: { ...opts, images: opts && opts.images ? opts.images.length : 0 } });
    if (window.__failNextSample) { const code = window.__failNextSample; window.__failNextSample = null; throw { code, message: code }; }
    const text = await stream(Array.isArray(input) ? CHAT_REPLY : JSON.stringify(answerFor(String(input))), opts);
    return { text, truncated: false, modelTierApplied: (opts && opts.modelTier) || 'default' };
  };
  sample.json = async (input, opts) => JSON.parse((await sample(input, opts)).text);
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 10, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] }, tools: { maxCount: 8 } });

  const uploads = (window.__uploads = []);
  const assets = {
    async upload(blob) { const id = (uploads.length + 1).toString(16).padStart(32, '0'); uploads.push({ id, size: blob.size, type: blob.type }); return { id, url: URL.createObjectURL(blob), sizeBytes: blob.size, contentType: blob.type }; },
    async delete() { return { deleted: true }; },
    async list() { return { assets: [], usage: { files: uploads.length, bytes: 0, maxFiles: 1000, maxBytes: 1e9 } }; },
  };
  const saved = (window.__downloads = []);
  const downloads = { async save(req) { saved.push({ filename: req.filename, size: String(req.data).length, head: String(req.data).slice(0, 200) }); return { status: 'saved' }; } };
  const NAMES = { u_test: '我', u_friend: '阿杰' };
  const avatar = (letter, color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="${color}"/><text x="24" y="31" font-size="20" text-anchor="middle" fill="#fff" font-family="sans-serif">${letter}</text></svg>`)}`;
  const profile = id => ({ id, name: NAMES[id] || '', avatarUrl: avatar((NAMES[id] || '?').slice(0, 1), id === 'u_test' ? '#1F5C45' : '#B8632E'), color: id === 'u_test' ? '#1F5C45' : '#B8632E', email: null, isMe: id === 'u_test', guest: false });
  const user = {
    isOwner: async () => true, canEdit: async () => true, can: async () => true, id: async () => 'u_test',
    me: async () => ({ ...profile('u_test'), isOwner: true, canEdit: true }),
    profiles: async ids => Object.fromEntries([].concat(ids).map(id => [id, profile(id)])),
  };
  const permissions = { state: async () => ({}), request: async () => ({}), manage: async () => {} };
  const caps = { db, sample, assets, downloads, user, permissions };
  window.claude = { use: name => new Promise(r => setTimeout(() => r(caps[name] || null), 20)) };
})();
