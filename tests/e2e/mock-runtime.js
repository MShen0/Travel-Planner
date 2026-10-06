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
  const placesInPrompt = prompt => [...prompt.matchAll(/"id":"(p_[^"]+)","name":"([^"]+)"(?:,"nameLocal":"[^"]*")?(?:,"area":"[^"]*")?,"category":"(\w+)"(?:[^\n]*?"lat":([\d.]+),"lng":([\d.]+))?/g)]
    .map(m => ({ id: m[1], name: m[2], category: m[3], lat: m[4] ? +m[4] : null, lng: m[5] ? +m[5] : null }));
  function answerFor(prompt) {
    if (prompt.includes('旅行收藏助手')) {
      return {
        post: { title: '东京3日游｜懒人版攻略', summary: '三天经典路线', city: '东京', country: '日本' },
        places: [
          { name: '浅草寺', nameLocal: '浅草寺', city: '东京', country: '日本', area: '浅草', category: 'sight', mustTry: ['求签'], tips: '早上 8 点前人少', durationMin: 60, lat: 35.7148, lng: 139.7967, coordConfidence: 'exact', evidence: '浅草寺早上8点前人少' },
          { name: '一兰拉面', nameLocal: '一蘭 渋谷店', city: '东京', country: '日本', area: '涩谷', category: 'food', mustTry: ['拉面'], tips: '别去本店排队', priceLevel: 2, lat: 35.6611, lng: 139.701, coordConfidence: 'exact', evidence: '一兰拉面（别去本店排队）' },
          { name: '代官山茑屋书店', nameLocal: '代官山 蔦屋書店', city: '东京', country: '日本', area: '代官山', category: 'shopping', tips: '文艺青年圣地', lat: 35.6484, lng: 139.6998, coordConfidence: 'area', evidence: '代官山茑屋书店必去' },
          { name: 'Shibuya Sky', nameLocal: 'SHIBUYA SKY', city: '东京', country: '日本', area: '涩谷', category: 'sight', tips: '日落前 1 小时上去', lat: 35.6585, lng: 139.7023, coordConfidence: 'exact', evidence: 'Shibuya Sky日落前1小时上去' },
        ],
      };
    }
    if (prompt.includes('排一份') || prompt.includes('用户想调整')) {
      const days = +(/days 必须正好 (\d+) 天/.exec(prompt) || [0, 2])[1];
      const ps = placesInPrompt(prompt);
      const out = { title: prompt.includes('用户想调整') ? '东京两日（已调整）' : '东京两日：浅草与涩谷', summary: '第一天在东边，第二天在西边。', base: { name: '新宿站附近', lat: 35.6896, lng: 139.7006 }, tips: ['买一张 Suica', 'Shibuya Sky 要提前预约'], days: [], unplaced: [] };
      for (let d = 0; d < days; d++) out.days.push({ day: d + 1, theme: d ? '涩谷代官山' : '浅草', area: d ? '涩谷' : '浅草', note: '', stops: [] });
      ps.forEach((p, i) => {
        const d = out.days[i % days];
        d.stops.push({ time: `${String(9 + d.stops.length * 2).padStart(2, '0')}:00`, placeId: p.id, name: p.name, lat: p.lat, lng: p.lng, category: p.category, stayMin: 60, what: `逛 ${p.name}`, tip: '', suggested: false, travel: { mode: d.stops.length ? 'walk' : 'metro', minutes: d.stops.length ? 12 : 25, detail: d.stops.length ? '步行约 900 米' : 'JR 山手线', cost: d.stops.length ? '' : '¥200' } });
      });
      out.days[0].stops.push({ time: '12:00', placeId: null, name: '大黑家天妇罗', nameLocal: '大黒家天麩羅', lat: 35.7118, lng: 139.7963, category: 'food', stayMin: 50, what: '炸虾天丼', suggested: true, travel: { mode: 'walk', minutes: 6, detail: '步行' } });
      return out;
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
    const text = await stream(JSON.stringify(answerFor(String(input))), opts);
    return { text, truncated: false, modelTierApplied: (opts && opts.modelTier) || 'default' };
  };
  sample.json = async (input, opts) => {
    if (window.__failNextSample) { const code = window.__failNextSample; window.__failNextSample = null; throw { code, message: code }; }
    const { text } = await sample(input, opts);
    return JSON.parse(text);
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 10, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] }, tools: { maxCount: 8 } });

  const uploads = (window.__uploads = []);
  const assets = {
    async upload(blob) { const id = (uploads.length + 1).toString(16).padStart(32, '0'); uploads.push({ id, size: blob.size, type: blob.type }); return { id, url: URL.createObjectURL(blob), sizeBytes: blob.size, contentType: blob.type }; },
    async delete() { return { deleted: true }; },
    async list() { return { assets: [], usage: { files: uploads.length, bytes: 0, maxFiles: 1000, maxBytes: 1e9 } }; },
  };
  const saved = (window.__downloads = []);
  const downloads = { async save(req) { saved.push({ filename: req.filename, size: String(req.data).length, head: String(req.data).slice(0, 200) }); return { status: 'saved' }; } };
  const user = { isOwner: async () => true, canEdit: async () => true, can: async () => true, id: async () => 'u_test', me: async () => ({ id: 'u_test', name: '', avatarUrl: '', color: '#888', email: null, isOwner: true, canEdit: true }) };
  const permissions = { state: async () => ({}), request: async () => ({}), manage: async () => {} };
  const caps = { db, sample, assets, downloads, user, permissions };
  window.claude = { use: name => new Promise(r => setTimeout(() => r(caps[name] || null), 20)) };
})();
