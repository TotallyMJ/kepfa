import { store, newId } from './store.js';
import { SKY_TYPES, TYPE_ORDER, prepareImage, classify, makeSampleSky, hexToRgb, luminance } from './sky.js';
import { drawJar, lidColor, setupCanvas } from './jar.js';
import { makeStory, shareImage, saveImage, thaiDate, thaiTime } from './story.js';

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const PROMPTS = ['ฟ้าวันนี้ทำให้นึกถึงอะไร?', 'ตอนนั้นกำลังทำอะไรอยู่?', 'ใครอยู่ด้วยตอนนั้น?',
  'อยากบอกอะไรกับฟ้าวันนี้', 'ฟ้าแบบนี้เหมือนเพลงอะไร?'];
const DEX_HINTS = {
  sunrise: 'ตื่นก่อน 7 โมง แล้วมองไปทางทิศตะวันออก',
  clear: 'วันแดดดี ฟ้าโล่งไม่มีเมฆ',
  cloudy: 'วันที่เมฆลอยเต็มฟ้า',
  pink: 'ไม่กี่นาทีหลังพระอาทิตย์ตก',
  sunset: 'ราว 17:45–18:30 น.',
  bluehour: 'ฟ้าเริ่มมืด หลังตะวันตกราว 20 นาที',
  storm: 'ช่วงก่อนฝนตกหนัก',
  night: 'คืนที่ฟ้าเปิด เห็นดาวหรือพระจันทร์',
  rainbow: 'หลังฝนหยุด ยืนหันหลังให้พระอาทิตย์',
};

const ICON = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4l4 4"/><path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"/></svg>',
  shake: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="5" width="8" height="15" rx="3"/><path d="M9 3h6M4 9v6M20 9v6"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>',
  jar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7.5" y="2.5" width="9" height="3" rx="1"/><path d="M8 5.5v1.5A4 4 0 0 0 5 11v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7a4 4 0 0 0-3-4V5.5"/><path d="M5 14c2.5-1.5 4.5 1 7 0s4.5-1.5 7 0"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const cap = $('#capture');

const state = { skies: [], year: new Date().getFullYear(), redraw: null, lastRoute: '' };

// ---------- helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const gradCss = (colors) => `linear-gradient(180deg, ${colors.join(', ')})`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function skiesIn(year, month) {
  return state.skies.filter((s) => {
    const d = new Date(s.takenAt);
    return d.getFullYear() === year && (month == null || d.getMonth() === month);
  });
}

function sortSkies() {
  state.skies.sort((a, b) => a.takenAt - b.takenAt);
}

const urls = new Map();
function photoUrl(sky, kind = 'thumb') {
  const key = `${sky.id}:${kind}`;
  if (!urls.has(key)) urls.set(key, URL.createObjectURL(sky[kind]));
  return urls.get(key);
}
function forgetUrls(id) {
  for (const kind of ['thumb', 'photo']) {
    const key = `${id}:${kind}`;
    if (urls.has(key)) { URL.revokeObjectURL(urls.get(key)); urls.delete(key); }
  }
}

function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function countBy(list, fn) {
  const out = {};
  for (const s of list) { const k = fn(s); out[k] = (out[k] || 0) + 1; }
  return out;
}

function topKey(counts) {
  const e = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return e ? e[0] : null;
}

function partOfDay(ms) {
  const h = new Date(ms).getHours();
  if (h >= 5 && h < 11) return 'ตอนเช้า';
  if (h >= 11 && h < 16) return 'กลางวัน';
  if (h >= 16 && h < 19) return 'ตอนเย็น';
  return 'ตอนค่ำ';
}

function setPhase() {
  const h = new Date().getHours();
  document.documentElement.dataset.phase = h >= 5 && h < 9 ? 'dawn' : h >= 9 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

let actx;
/** Glassy "tink" made with WebAudio, so there are no sound files to ship. */
function chime(freqs = [1318, 1976], gap = 0.07) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime;
    freqs.forEach((f, i) => {
      const t = t0 + i * gap;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
  } catch { /* sound is optional */ }
}

function tween(ms, fn) {
  return new Promise((resolve) => {
    if (reduceMotion()) { fn(1); return resolve(); }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      fn(t);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

function paletteHtml(palette) {
  return palette.map((p) => {
    const fg = luminance(hexToRgb(p.hex)) > 0.55 ? '#1f2444' : '#ffffff';
    return `<button type="button" data-hex="${p.hex}" style="background:${p.hex};color:${fg}" aria-label="คัดลอกสี ${p.hex}">${p.hex.slice(1).toUpperCase()}</button>`;
  }).join('');
}

function chipHtml(type, pressed) {
  const t = SKY_TYPES[type];
  return `<button type="button" class="chip" data-type="${type}" aria-pressed="${pressed}"><i style="background:${gradCss(t.grad)}"></i>${t.th}</button>`;
}

// ---------- routing ----------

function parseRoute() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'jar' && /^\d{4}-\d{2}$/.test(b || '')) {
    const [y, m] = b.split('-').map(Number);
    return { name: 'jar', year: y, month: m - 1 };
  }
  if (a === 'dex') return { name: 'dex' };
  return { name: 'shelf' };
}

function render() {
  const route = parseRoute();
  document.querySelectorAll('.tab').forEach((t) => {
    const on = (route.name === 'dex' && t.dataset.tab === 'dex') || (route.name !== 'dex' && t.dataset.tab === 'shelf');
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  if (route.name === 'jar') renderJar(route.year, route.month);
  else if (route.name === 'dex') renderDex();
  else renderShelf();
  if (location.hash !== state.lastRoute) { window.scrollTo(0, 0); state.lastRoute = location.hash; }
}

function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

// ---------- shelf ----------

function bannerHtml() {
  if (!state.skies.some((s) => s.sample)) return '';
  return `<div class="banner"><p>นี่คือฟ้าตัวอย่าง กดเล่นได้เลย พร้อมเก็บฟ้าของตัวเองเมื่อไหร่ค่อยล้างออก</p>
    <button type="button" class="pill" id="clearSamples">ล้างตัวอย่าง</button></div>`;
}

function renderShelf() {
  const y = state.year;
  const now = new Date();
  const all = skiesIn(y);
  const types = new Set(all.map((s) => s.type)).size;
  const years = state.skies.map((s) => new Date(s.takenAt).getFullYear());
  const minYear = Math.min(now.getFullYear(), ...years);

  const slot = (m) => {
    const future = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());
    const isNow = y === now.getFullYear() && m === now.getMonth();
    const n = skiesIn(y, m).length;
    return `<button type="button" class="jar-slot${isNow ? ' is-now' : ''}" data-month="${m}" ${future ? 'disabled' : ''}
      aria-label="โหลเดือน${TH_MONTHS[m]} ${n} ท้องฟ้า">
      <span class="jar-wrap"><canvas></canvas></span>
      <span class="jar-name">${TH_MONTHS_SHORT[m]}</span>
      <span class="jar-count">${future ? '–' : `${n} ฟ้า`}</span></button>`;
  };

  // Newest shelf on top so the jars you're filling now are the first thing you see.
  view.innerHTML = `
    <header class="top">
      <div class="top-title"><h1 class="wordmark">Kepfa<small>เก็บฟ้าใส่โหล</small></h1></div>
      <button type="button" class="icon-btn" id="shareYear" aria-label="แชร์ชั้นวางปี ${y} ลงสตอรี่" ${all.length ? '' : 'disabled'}>${ICON.share}</button>
    </header>
    ${bannerHtml()}
    <div class="year-head">
      <div>
        <p class="eyebrow">ชั้นฟ้าปี ${y}</p>
        <p class="big-count">${all.length}<span>ท้องฟ้า</span></p>
        <p class="sub">เจอแล้ว ${types} จาก ${TYPE_ORDER.length} แบบใน Sky dex</p>
      </div>
      <div class="year-switch">
        <button type="button" id="prevYear" aria-label="ปีก่อน" ${y <= minYear ? 'disabled' : ''}>${ICON.left}</button>
        <strong>${y}</strong>
        <button type="button" id="nextYear" aria-label="ปีถัดไป" ${y >= now.getFullYear() ? 'disabled' : ''}>${ICON.right}</button>
      </div>
    </div>
    <div class="shelf">
      ${[3, 2, 1, 0].map((r) => `<div class="shelf-row">${[0, 1, 2].map((c) => slot(r * 3 + c)).join('')}</div>`).join('')}
    </div>`;

  view.querySelectorAll('.jar-slot').forEach((el) => {
    el.addEventListener('click', () => go(`#/jar/${y}-${pad2(+el.dataset.month + 1)}`));
  });
  $('#prevYear').addEventListener('click', () => { state.year--; renderShelf(); });
  $('#nextYear').addEventListener('click', () => { state.year++; renderShelf(); });
  $('#shareYear').addEventListener('click', () => openStory('year', { year: y, skies: all }));
  $('#clearSamples')?.addEventListener('click', clearSamples);

  state.redraw = () => {
    view.querySelectorAll('.jar-slot').forEach((el) => {
      const m = +el.dataset.month;
      const wrap = el.querySelector('.jar-wrap');
      const w = wrap.clientWidth;
      const h = Math.round(w * 4 / 3);
      const ctx = setupCanvas(el.querySelector('canvas'), w, h);
      drawJar(ctx, {
        x: w * 0.08, y: h * 0.02, w: w * 0.84, h: h * 0.98,
        skies: skiesIn(y, m), capacity: daysIn(y, m), lid: lidColor(m), ghost: el.disabled,
      });
    });
  };
  state.redraw();
}

async function clearSamples() {
  const samples = state.skies.filter((s) => s.sample);
  for (const s of samples) { await store.remove(s.id); forgetUrls(s.id); }
  state.skies = state.skies.filter((s) => !s.sample);
  render();
  toast('ล้างฟ้าตัวอย่างแล้ว ออกไปเก็บฟ้าแรกกัน');
}

// ---------- one month's jar ----------

function renderJar(year, month) {
  const list = skiesIn(year, month);
  const days = daysIn(year, month);
  const topType = topKey(countBy(list, (s) => s.type));
  const topTime = topKey(countBy(list, (s) => partOfDay(s.takenAt)));

  view.innerHTML = `
    <header class="top">
      <a class="icon-btn" href="#/" aria-label="กลับไปชั้นวาง">${ICON.back}</a>
      <div class="top-title"><p class="eyebrow">โหลเดือน · ${year}</p><h1>${TH_MONTHS[month]}</h1></div>
      <button type="button" class="icon-btn" id="shareJar" aria-label="แชร์โหลนี้ลงสตอรี่" ${list.length ? '' : 'disabled'}>${ICON.share}</button>
    </header>
    <div class="jar-stage" id="jarStage"><canvas id="bigJar" aria-label="โหลเดือน${TH_MONTHS[month]} มี ${list.length} ชั้นสี"></canvas></div>
    ${list.length
      ? '<p class="tap-hint">แตะชั้นสีในโหลเพื่อดูฟ้าวันนั้น</p>'
      : '<p class="empty-note"><strong>โหลนี้ยังว่าง</strong>ฟ้าแรกของเดือนรออยู่ข้างนอก ออกไปเก็บกัน</p>'}
    <div class="actions">
      ${list.length
        ? `<button type="button" class="pill" id="shake">${ICON.shake} เขย่าโหล</button>
           <button type="button" class="pill primary" id="shareJar2">${ICON.share} แชร์ลงสตอรี่</button>`
        : `<button type="button" class="pill primary" id="firstSky">${ICON.camera} เก็บฟ้าแรก</button>`}
    </div>
    ${list.length ? `
      <div class="stats">
        <div class="stat"><b>${list.length}/${days}</b><span>วันที่มีฟ้าในโหล</span></div>
        <div class="stat"><b>${SKY_TYPES[topType].th}</b><span>ฟ้าที่เจอบ่อยสุด</span></div>
        <div class="stat"><b>${topTime}</b><span>ช่วงที่ชอบมองฟ้า</span></div>
      </div>
      <h2 class="section-title">ฟ้าเดือนนี้</h2>
      <div class="thumbs">
        ${list.slice().reverse().map((s) => `<button type="button" class="thumb" data-id="${s.id}">
          <img src="${photoUrl(s)}" alt="ฟ้า${SKY_TYPES[s.type].th} ${thaiDate(s.takenAt)}" loading="lazy"><span>${new Date(s.takenAt).getDate()} ${TH_MONTHS_SHORT[month]}</span></button>`).join('')}
      </div>` : ''}`;

  const share = () => openStory('jar', { year, month, skies: list });
  $('#shareJar').addEventListener('click', share);
  $('#shareJar2')?.addEventListener('click', share);
  $('#firstSky')?.addEventListener('click', openCapture);
  $('#shake')?.addEventListener('click', () => shakeJar(list));
  view.querySelectorAll('.thumb').forEach((el) => {
    el.addEventListener('click', () => openDetail(state.skies.find((s) => s.id === el.dataset.id)));
  });

  let layers = [];
  const cv = $('#bigJar');
  const jarBox = { x: 0, w: 0 };
  state.redraw = () => {
    const w = Math.min(view.clientWidth, 290);
    const h = Math.round(w * 1.38);
    const ctx = setupCanvas(cv, w, h);
    jarBox.x = w * 0.04; jarBox.w = w * 0.92;
    layers = drawJar(ctx, {
      x: jarBox.x, y: h * 0.01, w: jarBox.w, h: h * 0.98,
      skies: list, capacity: days, lid: lidColor(month), label: `${TH_MONTHS_SHORT[month]} ${year}`,
    });
  };
  state.redraw();
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < jarBox.x || px > jarBox.x + jarBox.w) return;
    const hit = layers.find((l) => py >= l.top - 2 && py <= l.bottom + 2);
    if (hit) openDetail(list[hit.index]);
  });
}

function shakeJar(list) {
  const st = $('#jarStage');
  st.classList.remove('shaking');
  void st.offsetWidth;
  st.classList.add('shaking');
  chime([1568, 1175, 1760, 1318], 0.11);
  navigator.vibrate?.([20, 40, 20, 40, 20]);
  setTimeout(() => {
    st.classList.remove('shaking');
    openDetail(list[Math.floor(Math.random() * list.length)], { pop: true });
  }, reduceMotion() ? 0 : 750);
}

// ---------- sky dex ----------

function renderDex() {
  const byType = {};
  for (const s of state.skies) (byType[s.type] ||= []).push(s);
  const found = TYPE_ORDER.filter((t) => byType[t]).length;

  view.innerHTML = `
    <header class="top">
      <div class="top-title"><p class="eyebrow">สะสมให้ครบทุกแบบ</p><h1>Sky dex</h1></div>
    </header>
    <div class="dex-progress">
      <p class="sub">เจอแล้ว <b>${found}</b> จาก ${TYPE_ORDER.length} แบบ</p>
      <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="${TYPE_ORDER.length}" aria-valuenow="${found}"><i style="width:${(found / TYPE_ORDER.length) * 100}%"></i></div>
    </div>
    <div class="dex-grid">
      ${TYPE_ORDER.map((t) => {
        const info = SKY_TYPES[t];
        const list = byType[t];
        if (!list) {
          return `<div class="dex-card locked">
            <div class="tile" style="background:${gradCss(info.grad)}"></div>
            <b>${info.th}</b><small>${DEX_HINTS[t]}</small></div>`;
        }
        const latest = list[list.length - 1];
        return `<button type="button" class="dex-card" data-type="${t}">
          <div class="tile"><img src="${photoUrl(latest)}" alt="" loading="lazy"><span class="count">${list.length}</span></div>
          <b>${info.th}</b><small>เจอครั้งแรก ${thaiDate(list[0].takenAt)}</small></button>`;
      }).join('')}
    </div>`;

  view.querySelectorAll('.dex-card[data-type]').forEach((el) => {
    el.addEventListener('click', () => {
      const list = byType[el.dataset.type];
      openDetail(list[list.length - 1]);
    });
  });
  state.redraw = null;
}

// ---------- capture ----------

let stream = null;
let draft = null;

function showStep(name) {
  cap.querySelectorAll('.cap-step').forEach((s) => { s.hidden = s.dataset.step !== name; });
}

async function openCapture() {
  cap.hidden = false;
  document.body.style.overflow = 'hidden';
  showStep('camera');
  const camStep = cap.querySelector('.cam');
  $('#camFallback').hidden = true;
  camStep.classList.remove('no-camera');
  $('#shutter').hidden = false;
  cap.querySelector('.cam-hint').hidden = false;

  if (!navigator.mediaDevices?.getUserMedia) return showFallback();
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    if (cap.hidden || cap.querySelector('.cam').hidden) { s.getTracks().forEach((t) => t.stop()); return; }
    stream = s;
    const v = $('#camVideo');
    v.srcObject = stream;
    await v.play();
  } catch {
    showFallback();
  }
}

function showFallback() {
  $('#camFallback').hidden = false;
  cap.querySelector('.cam').classList.add('no-camera');
  $('#shutter').hidden = true;
  cap.querySelector('.cam-hint').hidden = true;
}

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $('#camVideo').srcObject = null;
}

function closeCapture() {
  stopCamera();
  if (draft?.url) URL.revokeObjectURL(draft.url);
  draft = null;
  cap.hidden = true;
  document.body.style.overflow = '';
}

async function snap() {
  const v = $('#camVideo');
  if (!v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  chime([2093], 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
  stopCamera();
  review(blob, Date.now());
}

function picked(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  stopCamera();
  // Gallery photos: lastModified is usually when the photo was taken; the user can fix it on the next screen.
  review(f, Math.min(f.lastModified || Date.now(), Date.now()));
}

async function review(blob, takenAt) {
  showStep('review');
  const el = cap.querySelector('.review');
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังดึงสีจากฟ้า…</p></div>';
  try {
    const prep = await prepareImage(blob);
    draft = { ...prep, takenAt, type: classify(prep.palette, new Date(takenAt)), typeTouched: false };
  } catch {
    el.innerHTML = `<div class="loading"><p>เปิดรูปนี้ไม่ได้ ลองรูปอื่นดูนะ</p>
      <button type="button" class="pill primary" id="tryAgain">เลือกรูปใหม่</button></div>`;
    $('#tryAgain').addEventListener('click', openCapture);
    return;
  }
  draft.url = URL.createObjectURL(draft.photo);
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  el.innerHTML = `
    <div class="review-inner">
      <div class="top">
        <button type="button" class="icon-btn" data-close-capture aria-label="ยกเลิก">${ICON.close}</button>
        <div class="top-title"><p class="eyebrow">ฟ้าใหม่</p><h1>หย่อนลงโหลเลยไหม</h1></div>
      </div>
      <div class="review-photo"><img src="${draft.url}" alt="ภาพฟ้าที่เพิ่งเก็บ"></div>
      <div><p class="field-label">สีของฟ้านี้ · แตะเพื่อคัดลอก</p><div class="palette">${paletteHtml(draft.palette)}</div></div>
      <div><p class="field-label">ฟ้าแบบไหน</p><div class="chips" id="typeChips">${TYPE_ORDER.map((t) => chipHtml(t, t === draft.type)).join('')}</div></div>
      <div>
        <label class="field-label" for="noteInput">บันทึกสั้น ๆ</label>
        <textarea id="noteInput" class="note" maxlength="120" rows="3" placeholder="${prompt}"></textarea>
        <div class="note-meta"><span>ข้อความนี้จะไปอยู่ใต้รูปตอนแชร์</span><span id="noteCount">0/120</span></div>
      </div>
      <div>
        <label class="field-label" for="whenInput">ถ่ายเมื่อ</label>
        <input id="whenInput" class="when" type="datetime-local" value="${toLocalInput(takenAt)}" max="${toLocalInput(Date.now())}">
      </div>
      <div class="review-actions">
        <button type="button" class="pill" id="retake">ถ่ายใหม่</button>
        <button type="button" class="pill primary" id="dropIt">${ICON.jar} หย่อนลงโหล</button>
      </div>
    </div>`;

  const chips = $('#typeChips');
  const setType = (t) => {
    draft.type = t;
    chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.type === t)));
  };
  chips.addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    draft.typeTouched = true;
    setType(c.dataset.type);
  });
  $('#noteInput').addEventListener('input', (e) => { $('#noteCount').textContent = `${e.target.value.length}/120`; });
  $('#whenInput').addEventListener('change', (e) => {
    const ms = new Date(e.target.value).getTime();
    if (!Number.isFinite(ms)) return;
    draft.takenAt = Math.min(ms, Date.now());
    if (!draft.typeTouched) setType(classify(draft.palette, new Date(draft.takenAt)));
  });
  $('#retake').addEventListener('click', () => { URL.revokeObjectURL(draft.url); draft = null; openCapture(); });
  $('#dropIt').addEventListener('click', saveDraft);
}

async function saveDraft() {
  const btn = $('#dropIt');
  btn.disabled = true;
  const sky = {
    id: newId(),
    takenAt: draft.takenAt,
    type: draft.type,
    note: $('#noteInput').value.trim(),
    palette: draft.palette,
    photo: draft.photo,
    thumb: draft.thumb,
    sample: false,
    createdAt: Date.now(),
  };
  try {
    await store.put(sky);
  } catch {
    btn.disabled = false;
    toast('บันทึกไม่สำเร็จ ลองอีกครั้งนะ');
    return;
  }
  URL.revokeObjectURL(draft.url);
  draft = null;
  state.skies.push(sky);
  sortSkies();
  await playDrop(sky);
}

async function playDrop(sky) {
  showStep('drop');
  const el = cap.querySelector('.drop');
  const d = new Date(sky.takenAt);
  const y = d.getFullYear(), m = d.getMonth();
  const list = skiesIn(y, m);
  el.innerHTML = `
    <div class="drop-stage"><canvas id="dropJar"></canvas><div class="drop-ball" id="dropBall"></div></div>
    <div class="drop-msg" id="dropMsg">
      <h2>เก็บฟ้าแล้ว</h2>
      <p>โหลเดือน${TH_MONTHS[m]}มี ${list.length} ท้องฟ้า</p>
      <div class="actions">
        <button type="button" class="pill" id="dropShare">${ICON.share} แชร์ลงสตอรี่</button>
        <button type="button" class="pill primary" id="dropOpen">ดูโหล</button>
      </div>
    </div>`;

  const w = Math.round(Math.min(240, innerWidth * 0.62));
  const h = Math.round(w * 1.4);
  const ctx = setupCanvas($('#dropJar'), w, h);
  const opts = { x: 0, y: 0, w, h, capacity: daysIn(y, m), lid: lidColor(m) };
  const before = list.filter((s) => s !== sky);
  drawJar(ctx, { ...opts, skies: before });

  const ball = $('#dropBall');
  ball.style.backgroundImage = `url("${photoUrl(sky)}")`;
  if (!reduceMotion()) {
    await ball.animate([
      { transform: 'translateY(-70vh) rotate(-10deg) scale(1)', borderRadius: '18px' },
      { transform: `translateY(${h * 0.02}px) rotate(6deg) scale(.85)`, borderRadius: '24px', offset: 0.55 },
      { transform: `translateY(${h * 0.22}px) rotate(0deg) scale(.22)`, borderRadius: '50%', opacity: 1, offset: 0.82 },
      { transform: `translateY(${h * 0.5}px) scale(.06)`, borderRadius: '50%', opacity: 0 },
    ], { duration: 1300, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' }).finished;
  }
  ball.remove();
  chime();
  navigator.vibrate?.(18);

  // Pour the new sky in on top, then settle into date order.
  const poured = [...before, sky];
  await tween(800, (t) => {
    ctx.clearRect(0, 0, w, h);
    drawJar(ctx, { ...opts, skies: poured, grow: easeOutBack(t) });
  });
  if (list[list.length - 1] !== sky) {
    ctx.clearRect(0, 0, w, h);
    drawJar(ctx, { ...opts, skies: list });
  }
  $('#dropMsg').classList.add('show');
  $('#dropShare').addEventListener('click', () => openStory('single', sky));
  $('#dropOpen').addEventListener('click', () => {
    closeCapture();
    state.year = y;
    go(`#/jar/${y}-${pad2(m + 1)}`);
  });
}

// ---------- detail sheet ----------

function openDetail(sky, { pop = false } = {}) {
  if (!sky) return;
  const wrap = $('#sheet');
  const art = wrap.querySelector('.sheet');
  const t = SKY_TYPES[sky.type];
  art.className = `sheet${pop ? ' pop' : ''}`;
  art.innerHTML = `
    <div class="grabber"></div>
    <div class="detail-photo"><img src="${photoUrl(sky, 'photo')}" alt="ฟ้า${t.th} ${thaiDate(sky.takenAt)}"></div>
    <div class="detail-meta">
      <span class="chip"><i style="background:${gradCss(t.grad)}"></i>${t.th}</span>
      <time datetime="${new Date(sky.takenAt).toISOString()}">${thaiDate(sky.takenAt)} · ${thaiTime(sky.takenAt)}</time>
    </div>
    ${sky.note ? `<p class="detail-note">${esc(sky.note)}</p>` : '<p class="detail-note muted">ไม่มีบันทึก</p>'}
    <div class="palette detail-palette">${paletteHtml(sky.palette)}</div>
    <div class="sheet-actions">
      <button type="button" class="pill primary" id="shareOne">${ICON.share} แชร์ลงสตอรี่</button>
      <button type="button" class="pill danger" id="askDelete" aria-label="ลบฟ้านี้">${ICON.trash}</button>
    </div>
    <div id="confirmBox"></div>`;
  wrap.hidden = false;
  document.body.style.overflow = 'hidden';

  $('#shareOne').addEventListener('click', () => openStory('single', sky));
  $('#askDelete').addEventListener('click', () => {
    $('#confirmBox').innerHTML = `<div class="confirm">
      <p>ลบฟ้านี้ออกจากโหล? ลบแล้วกู้คืนไม่ได้</p>
      <div class="row"><button type="button" class="pill" id="noDelete">ยกเลิก</button>
      <button type="button" class="pill primary" id="yesDelete">ลบ</button></div></div>`;
    $('#noDelete').addEventListener('click', () => { $('#confirmBox').innerHTML = ''; });
    $('#yesDelete').addEventListener('click', async () => {
      await store.remove(sky.id);
      state.skies = state.skies.filter((s) => s.id !== sky.id);
      closeSheet();
      forgetUrls(sky.id);
      render();
      toast('ลบฟ้าออกจากโหลแล้ว');
    });
  });
}

function closeSheet() {
  $('#sheet').hidden = true;
  if (cap.hidden && $('#storyModal').hidden) document.body.style.overflow = '';
}

// ---------- story export ----------

let storyUrl = null;

async function openStory(kind, payload) {
  const wrap = $('#storyModal');
  const art = wrap.querySelector('.sheet');
  const title = kind === 'single' ? 'แชร์ฟ้านี้' : kind === 'jar' ? `แชร์โหลเดือน${TH_MONTHS[payload.month]}` : `แชร์ชั้นฟ้าปี ${payload.year}`;
  art.innerHTML = `
    <div class="grabber"></div>
    <h2>${title}</h2>
    <div class="story-preview" id="storyPreview"><div class="spinner"></div></div>
    <p class="story-tip">บนมือถือ กด "แชร์" แล้วเลือก Instagram → Stories ถ้าไม่มีให้เลือก บันทึกรูปแล้วอัปจากคลังภาพได้เลย</p>
    <div class="sheet-actions">
      <button type="button" class="pill" id="saveStory" disabled>${ICON.download} บันทึกรูป</button>
      <button type="button" class="pill primary" id="shareStory" disabled>${ICON.share} แชร์</button>
    </div>`;
  wrap.hidden = false;
  document.body.style.overflow = 'hidden';

  let blob;
  try {
    blob = await makeStory(kind, payload);
  } catch {
    $('#storyPreview').innerHTML = '<p class="story-tip">สร้างรูปไม่สำเร็จ ปิดแล้วลองใหม่อีกครั้งนะ</p>';
    return;
  }
  if (wrap.hidden) return;
  if (storyUrl) URL.revokeObjectURL(storyUrl);
  storyUrl = URL.createObjectURL(blob);
  $('#storyPreview').innerHTML = `<img src="${storyUrl}" alt="ภาพสตอรี่ขนาด 1080×1920">`;
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `kepfa-${kind}-${stamp}.jpg`;
  const saveBtn = $('#saveStory'), shareBtn = $('#shareStory');
  saveBtn.disabled = false;
  shareBtn.disabled = false;
  saveBtn.addEventListener('click', () => { saveImage(blob, filename); toast('บันทึกรูปแล้ว'); });
  shareBtn.addEventListener('click', async () => {
    const res = await shareImage(blob, filename);
    if (res === 'saved') toast('อุปกรณ์นี้แชร์ตรงไม่ได้ เลยบันทึกรูปให้แทน');
  });
}

function closeStory() {
  $('#storyModal').hidden = true;
  if (storyUrl) { URL.revokeObjectURL(storyUrl); storyUrl = null; }
  if (cap.hidden && $('#sheet').hidden) document.body.style.overflow = '';
}

// ---------- sample shelf ----------

const SAMPLE_RECIPES = [
  ['sunset', 18, 12, 'ฟ้าหลังเลิกงาน สวยจนต้องหยุดเดิน'],
  ['clear', 11, 5, 'ชาไทยกับฟ้าใส ๆ'],
  ['pink', 18, 34, 'ฟ้าสีชมพูเหมือนสายไหม'],
  ['cloudy', 14, 20, 'เมฆเยอะแต่ลมเย็นดี'],
  ['cloudy', 16, 2, 'ลมแรง เมฆวิ่งเร็วมาก'],
  ['night', 21, 40, 'ดาวเต็มฟ้าที่บ้านยาย'],
  ['sunrise', 6, 18, 'เช้าวันเสาร์ ไม่ต้องรีบไปไหน'],
  ['bluehour', 18, 55, 'บลูอาวร์บนสะพานพระราม 8'],
  ['sunset', 17, 58, 'ซันเซ็ตริมเจ้าพระยากับแก๊งเพื่อน'],
  ['clear', 9, 30, ''],
  ['cloudy', 12, 45, 'ฟ้าครึ้มแต่ใจสดใส'],
  ['pink', 18, 20, 'นั่งรถเมล์กลับบ้าน ฟ้าเป็นสีพีช'],
];

async function seedSamples(onProgress) {
  const now = new Date();
  const plan = [];
  const months = [
    { back: 0, count: Math.min(15, now.getDate()) },
    { back: 1, count: 14 },
    { back: 2, count: 10 },
    { back: 3, count: 6 },
  ];
  let k = 0;
  for (const mo of months) {
    const first = new Date(now.getFullYear(), now.getMonth() - mo.back, 1);
    const y = first.getFullYear(), m = first.getMonth();
    const last = mo.back === 0 ? now.getDate() : daysIn(y, m);
    for (let i = 0; i < mo.count; i++) {
      const day = Math.max(1, Math.round(((i + 0.5) * last) / mo.count));
      const [kind, hh, mm, note] = SAMPLE_RECIPES[k % SAMPLE_RECIPES.length];
      k++;
      const takenAt = new Date(y, m, day, hh, mm).getTime();
      if (takenAt <= Date.now()) plan.push({ kind, takenAt, note, seed: k * 7919 });
    }
  }
  // Stormy and rainbow skies are left out on purpose so the Sky dex has something left to find.

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const prep = await prepareImage(await makeSampleSky(p.kind, p.seed));
    const sky = {
      id: newId(), takenAt: p.takenAt, type: p.kind, note: p.note,
      palette: prep.palette, photo: prep.photo, thumb: prep.thumb, sample: true, createdAt: Date.now(),
    };
    await store.put(sky);
    state.skies.push(sky);
    onProgress?.(i + 1, plan.length);
  }
  sortSkies();
}

function seededBefore() {
  try { return localStorage.getItem('skyjar.seeded') === '1'; } catch { return false; }
}
function markSeeded() {
  try { localStorage.setItem('skyjar.seeded', '1'); } catch { /* ignore */ }
}

// ---------- boot ----------

function bindGlobal() {
  $('#openCapture').addEventListener('click', openCapture);
  $('#shutter').addEventListener('click', snap);
  $('#fileCamera').addEventListener('change', picked);
  $('#fileGallery').addEventListener('change', picked);
  cap.addEventListener('click', (e) => { if (e.target.closest('[data-close-capture]')) closeCapture(); });
  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close-sheet]')) closeSheet(); });
  $('#storyModal').addEventListener('click', (e) => { if (e.target.closest('[data-close-story]')) closeStory(); });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.palette button[data-hex]');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.dataset.hex.toUpperCase());
      toast(`คัดลอก ${b.dataset.hex.toUpperCase()} แล้ว`);
    } catch {
      toast(b.dataset.hex.toUpperCase());
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#storyModal').hidden) closeStory();
    else if (!$('#sheet').hidden) closeSheet();
    else if (!cap.hidden) closeCapture();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => state.redraw?.(), 120);
  });
  window.addEventListener('hashchange', render);
}

async function init() {
  setPhase();
  setInterval(setPhase, 5 * 60 * 1000);
  bindGlobal();
  view.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังเปิดชั้นวาง…</p></div>';

  try {
    await document.fonts.load('30px Itim');
  } catch { /* fonts are optional */ }
  state.skies = await store.all();
  if (!(await store.persistent())) toast('เบราว์เซอร์นี้ไม่เก็บข้อมูลถาวร ปิดแท็บแล้วฟ้าจะหายนะ');

  if (!state.skies.length && !seededBefore()) {
    view.innerHTML = '<div class="loading"><div class="spinner"></div><p id="seedMsg">กำลังจัดชั้นวางตัวอย่าง…</p></div>';
    await seedSamples((i, n) => { const m = $('#seedMsg'); if (m) m.textContent = `กำลังจัดชั้นวางตัวอย่าง… ${i}/${n}`; });
    markSeeded();
  }
  render();
}

init();
