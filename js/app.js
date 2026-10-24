import { store, newId } from './store.js';
import { prepareImage, makeSampleSky, hexToRgb, luminance, dominant, hex, mix } from './sky.js';
import { jarShape, jarSvg, lidSvg, drawJar, setupCanvas, JAR_RATIO } from './jar.js';
import { foldStage } from './fold.js';
import { sunTimes } from './sun.js';
import { makeStory, shareImage, saveImage } from './story.js';
import { chime } from './sound.js';
import { t, fmt, MONTHS, MONTHS_SHORT, DARES, QUOTES } from './strings.js';

const ICON = {
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const cap = $('#capture');

const BANGKOK = { lat: 13.7563, lon: 100.5018 };
const state = { skies: [], year: new Date().getFullYear(), redraw: null, lastRoute: '', viaPrompt: false };

// ---------- helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

function skiesIn(year, month) {
  return state.skies.filter((s) => {
    const d = new Date(s.takenAt);
    return d.getFullYear() === year && (month == null || d.getMonth() === month);
  });
}

function sortSkies() {
  state.skies.sort((a, b) => a.takenAt - b.takenAt);
}

function chunk(list, n) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
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

/** Canvas jars can't read CSS, so hand them the theme's colors. */
function themeInk() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name) => cs.getPropertyValue(name).trim();
  return { ink: v('--ink'), paper: v('--paper'), glass: v('--glass') };
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/** Handwriting suits short English lines; Thai stays in the regular face at its regular size. */
function handClass(text) {
  return /[฀-๿]/.test(text) ? 'hand is-thai' : 'hand';
}

/** Shuffle-bag quotes: every quote is used once before any comes back. */
function nextQuote() {
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem('kepfa.quotes')) || []; } catch { /* start fresh */ }
  bag = bag.filter((i) => i < QUOTES.length);
  if (!bag.length) {
    bag = QUOTES.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  }
  const pick = bag.shift();
  try { localStorage.setItem('kepfa.quotes', JSON.stringify(bag)); } catch { /* fine without */ }
  return QUOTES[pick];
}

function paletteHtml(palette) {
  return palette.map((p) => {
    const fg = luminance(hexToRgb(p.hex)) > 0.55 ? '#1E1C19' : '#FBF9F5';
    return `<button type="button" data-hex="${p.hex}" style="background:${p.hex};color:${fg}" aria-label="Copy ${p.hex}">${p.hex.slice(1).toUpperCase()}</button>`;
  }).join('');
}

// ---------- sun, prompt, memory ----------

function savedPlace() {
  try { return JSON.parse(localStorage.getItem('kepfa.place')) || null; } catch { return null; }
}

function sunLine() {
  const place = savedPlace() || BANGKOK;
  const now = new Date();
  const today = sunTimes(now, place.lat, place.lon);
  if (!today) return '';
  const { sunrise, goldenMorningEnd, goldenEveningStart, sunset } = today;
  if (now < sunrise) return t.sunriseIn(fmt.time(sunrise), fmt.duration(sunrise - now));
  if (now < goldenMorningEnd) return t.goldenNowUntil(fmt.time(goldenMorningEnd));
  if (now < goldenEveningStart) return t.goldenIn(fmt.time(goldenEveningStart), fmt.duration(goldenEveningStart - now));
  if (now < sunset) return t.goldenNowSunset(fmt.time(sunset));
  const tomorrow = sunTimes(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), place.lat, place.lon);
  return tomorrow ? t.sunriseTomorrow(fmt.time(tomorrow.sunrise)) : '';
}

function askLocation() {
  if (!navigator.geolocation) { toast(t.locationDenied); return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    // Two decimals is about a kilometre: plenty for sun times, and it never leaves this device.
    const place = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) };
    try { localStorage.setItem('kepfa.place', JSON.stringify(place)); } catch { /* keep the default */ }
    render();
  }, () => toast(t.locationDenied), { maximumAge: 864e5, timeout: 10000 });
}

/** Today's dare: the same for everyone, changes at local midnight. */
function todayDare(d = new Date()) {
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  return { key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, text: DARES[day % DARES.length] };
}

function onThisDay() {
  const now = new Date();
  const same = (s, d) => { const x = new Date(s.takenAt); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };
  const tries = [
    [t.yearAgo, new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())],
    [t.monthAgo, new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())],
    [t.weekAgo, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)],
  ];
  for (const [label, d] of tries) {
    const hits = state.skies.filter((s) => same(s, d));
    if (hits.length) return { label, sky: hits[hits.length - 1] };
  }
  return null;
}

// ---------- routing ----------

function parseRoute() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'month' && /^\d{4}-\d{2}$/.test(b || '')) {
    const [y, m] = b.split('-').map(Number);
    return { name: 'month', year: y, month: m - 1 };
  }
  if (a === 'months') return { name: 'months' };
  return { name: 'shelf' };
}

function render() {
  const route = parseRoute();
  const tab = route.name === 'shelf' ? 'shelf' : 'months';
  document.querySelectorAll('.tab').forEach((el) => {
    if (el.dataset.tab === tab) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  if (route.name === 'month') renderMonth(route.year, route.month);
  else if (route.name === 'months') renderMonths();
  else renderShelf();
  if (location.hash !== state.lastRoute) { window.scrollTo(0, 0); state.lastRoute = location.hash; }
}

function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

// ---------- shelf (home): one jar per sky ----------

function bannerHtml() {
  if (!state.skies.some((s) => s.sample)) return '';
  return `<div class="banner"><p>${t.sampleBanner}</p><button type="button" class="btn-text" id="clearSamples">${t.clearSamples}</button></div>`;
}

function slotButton(s) {
  return `<button type="button" class="jar-slot" data-id="${s.id}" aria-label="${t.openSky(fmt.long(s.takenAt))}">${jarSvg({ href: photoUrl(s) })}</button>`;
}

function shelfRowsHtml(list) {
  return chunk(list, 3).map((row) => `
    <div class="shelf-row">
      <div class="shelf-jars">${row.map(slotButton).join('')}</div>
      <div class="shelf-labels">${row.map((s) => { const [day, time] = fmt.shelf(s.takenAt); return `<p><span>${day}</span><span>${time}</span></p>`; }).join('')}</div>
    </div>`).join('');
}

function renderShelf() {
  const now = new Date();
  const dare = todayDare(now);
  const taken = state.skies.filter((s) => s.prompt === dare.key).length;
  const memory = onThisDay();
  const groups = [];
  for (const s of state.skies.slice().reverse()) {
    const d = new Date(s.takenAt);
    const last = groups[groups.length - 1];
    if (last && last.y === d.getFullYear() && last.m === d.getMonth()) last.items.push(s);
    else groups.push({ y: d.getFullYear(), m: d.getMonth(), items: [s] });
  }
  const sun = sunLine();

  view.innerHTML = `
    <header class="masthead">
      <div class="masthead-meta"><span class="eyebrow">${t.issue(now.getMonth() + 1)}</span><span class="eyebrow">${fmt.issueDate(now)}</span></div>
      <h1 class="wordmark">Kepfa</h1>
    </header>
    ${sun ? `<div class="sunline"><span id="sunLine">${sun}</span>
      <button type="button" class="sunline-place" id="setPlace" aria-label="${t.useLocation}">${savedPlace() ? t.herePlace : t.defaultPlace}</button></div>` : ''}
    ${bannerHtml()}
    <section class="dare">
      <div class="dare-head"><span class="eyebrow">${t.skyDare}</span><span class="dare-when">${t.newDare}</span></div>
      <h2 class="dare-text hand">${dare.text}</h2>
      <div class="dare-foot"><span>${t.takenToday(taken)}</span><button type="button" class="btn-text" id="takeDare">${t.takeDare}</button></div>
    </section>
    ${memory ? `<section class="memory-block">
      <p class="eyebrow">${memory.label}</p>
      <div class="memory">${slotButton(memory.sky)}
        <p>${memory.sky.note ? `<span class="memory-note ${handClass(memory.sky.note)}">${esc(memory.sky.note)}</span>` : ''}<span class="memory-date">${fmt.shelf(memory.sky.takenAt)[0]}, ${new Date(memory.sky.takenAt).getFullYear()} · ${fmt.shelf(memory.sky.takenAt)[1]}</span></p>
      </div>
    </section>` : ''}
    <div class="section-head"><h2 class="section-title">${t.shelf}</h2><span class="eyebrow">${state.skies.length} ${t.kept(state.skies.length)}</span></div>
    ${groups.length
      ? groups.map((g) => `<section class="shelf-group"><h3 class="group-title">${MONTHS[g.m]} <span>${g.y}</span></h3>${shelfRowsHtml(g.items)}</section>`).join('')
      : `<div class="empty">
           <div class="empty-jar">${jarSvg()}</div>
           <h2>${t.emptyTitle}</h2><p>${t.emptyBody}</p>
         </div>`}`;

  bindJarSlots(view);
  $('#clearSamples')?.addEventListener('click', clearSamples);
  $('#setPlace')?.addEventListener('click', askLocation);
  $('#takeDare').addEventListener('click', () => { state.viaPrompt = true; openCapture(); });
  state.redraw = null;
}

function bindJarSlots(root) {
  root.querySelectorAll('.jar-slot').forEach((el) => {
    el.addEventListener('click', () => openDetail(state.skies.find((s) => s.id === el.dataset.id)));
  });
}

async function clearSamples() {
  const samples = state.skies.filter((s) => s.sample);
  for (const s of samples) { await store.remove(s.id); forgetUrls(s.id); }
  state.skies = state.skies.filter((s) => !s.sample);
  render();
  toast(t.samplesCleared);
}

// ---------- months: one layered jar per month ----------

function renderMonths() {
  const y = state.year;
  const now = new Date();
  const all = skiesIn(y);
  const minYear = Math.min(now.getFullYear(), ...state.skies.map((s) => new Date(s.takenAt).getFullYear()));
  const isFuture = (m) => y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());

  // Newest shelf on top so the jars you're filling now are the first thing you see.
  view.innerHTML = `
    <header class="masthead">
      <div class="masthead-meta"><span class="eyebrow">${all.length} ${t.kept(all.length)}</span>
        <div class="year-switch">
          <button type="button" id="prevYear" aria-label="${t.prevYear}" ${y <= minYear ? 'disabled' : ''}>${ICON.left}</button>
          <span>${y}</span>
          <button type="button" id="nextYear" aria-label="${t.nextYear}" ${y >= now.getFullYear() ? 'disabled' : ''}>${ICON.right}</button>
        </div>
      </div>
      <h1 class="wordmark">${t.months}</h1>
    </header>
    ${all.length ? `<div class="section-head"><span></span><button type="button" class="btn-text" id="shareYear">${t.shareStory}</button></div>` : ''}
    ${[3, 2, 1, 0].map((r) => {
      const ms = [0, 1, 2].map((c) => r * 3 + c);
      return `<div class="shelf-row">
        <div class="shelf-jars">${ms.map((m) => `<button type="button" class="month-slot" data-month="${m}" ${isFuture(m) ? 'disabled' : ''}
          aria-label="${t.monthJar(MONTHS[m], skiesIn(y, m).length)}"><canvas></canvas></button>`).join('')}</div>
        <div class="shelf-labels">${ms.map((m) => `<p><span>${MONTHS_SHORT[m]}</span><span>${isFuture(m) ? '–' : skiesIn(y, m).length}</span></p>`).join('')}</div>
      </div>`;
    }).join('')}`;

  view.querySelectorAll('.month-slot').forEach((el) => {
    el.addEventListener('click', () => go(`#/month/${y}-${pad2(+el.dataset.month + 1)}`));
  });
  $('#shareYear')?.addEventListener('click', () => openStory('year', { year: y, skies: all }));
  $('#prevYear').addEventListener('click', () => { state.year--; renderMonths(); });
  $('#nextYear').addEventListener('click', () => { state.year++; renderMonths(); });

  state.redraw = () => {
    const theme = themeInk();
    view.querySelectorAll('.month-slot').forEach((el) => {
      const m = +el.dataset.month;
      const w = Math.min(el.clientWidth, 96);
      const h = Math.round(w * JAR_RATIO);
      const ctx = setupCanvas(el.querySelector('canvas'), w, h);
      drawJar(ctx, { x: 0, y: 0, w, h, skies: skiesIn(y, m), capacity: daysIn(y, m), ghost: el.disabled, ...theme });
    });
  };
  state.redraw();
}

// ---------- one month's jar ----------

function renderMonth(year, month) {
  const list = skiesIn(year, month);
  const days = daysIn(year, month);
  const minutes = list.map((s) => { const d = new Date(s.takenAt); return d.getHours() * 60 + d.getMinutes(); }).sort((a, b) => a - b);
  const favorite = minutes.length ? fmt.minutes(minutes[Math.floor(minutes.length / 2)]) : '';
  const monthColor = list.length
    ? hex(list.map((s) => hexToRgb(dominant(s.palette).hex)).reduce((acc, c, i) => mix(acc, c, 1 / (i + 1))))
    : '';

  view.innerHTML = `
    <header class="page-head">
      <a class="eyebrow back" href="#/months">‹ ${t.backToMonths}</a>
      <span class="eyebrow">${t.issue(month + 1)}</span>
    </header>
    <h1 class="title">${MONTHS[month]}</h1>
    <p class="subtitle">${year}</p>
    <div class="jar-stage" id="jarStage"><canvas id="bigJar" aria-label="${t.monthJar(MONTHS[month], list.length)}"></canvas></div>
    ${list.length
      ? `<p class="hint">${t.tapLayer}</p>
         <div class="actions">
           <button type="button" class="btn" id="shake">${t.shake}</button>
           <button type="button" class="btn primary" id="shareJar">${t.shareStory}</button>
         </div>
         <div class="stats">
           <div class="stat"><b class="num">${list.length}</b><span>${t.daysOf(days)}</span></div>
           <div class="stat"><b class="mono">${favorite}</b><span>${t.favoriteTime}</span></div>
           <div class="stat"><b class="mono"><i class="swatch" style="background:${monthColor}"></i>${monthColor.slice(1).toUpperCase()}</b><span>${t.monthColor}</span></div>
         </div>
         <h2 class="section-title">${t.thisMonth}</h2>
         <div class="mini-grid">${list.slice().reverse().map((s) => { const [day, time] = fmt.shelf(s.takenAt); return `<div class="mini">
           ${slotButton(s)}<p><span>${day}</span><span>${time}</span></p></div>`; }).join('')}</div>`
      : `<div class="empty"><h2>${t.emptyMonthTitle}</h2><p>${t.emptyMonthBody}</p></div>`}`;

  $('#shareJar')?.addEventListener('click', () => openStory('jar', { year, month, skies: list }));
  $('#shake')?.addEventListener('click', () => shakeJar(list));
  bindJarSlots(view);

  let layers = [];
  const cv = $('#bigJar');
  state.redraw = () => {
    const w = Math.min(view.clientWidth * 0.55, 200);
    const h = Math.round(w * JAR_RATIO);
    const ctx = setupCanvas(cv, w, h);
    layers = drawJar(ctx, { x: 0, y: 0, w, h, skies: list, capacity: days, ...themeInk() });
  };
  state.redraw();
  cv.addEventListener('click', (e) => {
    const py = e.clientY - cv.getBoundingClientRect().top;
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
    openDetail(list[Math.floor(Math.random() * list.length)]);
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750);
}

// ---------- capture ----------

let stream = null;
let draft = null;

function showStep(name) {
  cap.querySelectorAll('.cap-step').forEach((s) => { s.hidden = s.dataset.step !== name; });
}

/** Dim the viewfinder outside a jar-shaped window, so what you frame is what gets kept. */
function layoutCameraFrame() {
  const W = innerWidth, H = innerHeight;
  const jh = Math.min(H * 0.58, Math.min(W * 0.78, 340) * JAR_RATIO);
  const jw = jh / JAR_RATIO;
  const x = (W - jw) / 2, y = (H - jh) / 2 - H * 0.02;
  const g = jarShape(jw, jh, 1.5);
  $('#camFrame').setAttribute('viewBox', `0 0 ${W} ${H}`);
  $('#camFrame').innerHTML = `
    <defs><mask id="camMask"><rect width="${W}" height="${H}" fill="white"/><path d="${g.body}" transform="translate(${x} ${y})" fill="black"/></mask></defs>
    <rect class="cam-scrim" width="${W}" height="${H}" mask="url(#camMask)"/>
    <g transform="translate(${x} ${y})">
      <path class="cam-line" d="${g.body}"/>
      ${g.threads.map((ty) => `<line class="cam-line" x1="${g.mx}" x2="${jw - g.mx}" y1="${ty}" y2="${ty}"/>`).join('')}
      ${lidSvg(g)}
    </g>`;
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
  layoutCameraFrame();

  if (!navigator.mediaDevices?.getUserMedia) return showFallback();
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      audio: false,
    });
    if (cap.hidden || camStep.hidden) { s.getTracks().forEach((tr) => tr.stop()); return; }
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
  $('#fallbackJar').innerHTML = jarSvg();
  cap.querySelector('.cam').classList.add('no-camera');
  $('#shutter').hidden = true;
  cap.querySelector('.cam-hint').hidden = true;
}

function stopCamera() {
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  $('#camVideo').srcObject = null;
}

function closeCapture() {
  stopCamera();
  if (draft?.url) URL.revokeObjectURL(draft.url);
  draft = null;
  state.viaPrompt = false;
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
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t.reading}</p></div>`;
  try {
    draft = { ...(await prepareImage(blob)), takenAt };
  } catch {
    el.innerHTML = `<div class="loading"><p>${t.cantOpen}</p>
      <button type="button" class="btn primary" id="tryAgain">${t.chooseAnother}</button></div>`;
    $('#tryAgain').addEventListener('click', openCapture);
    return;
  }
  draft.url = URL.createObjectURL(draft.photo);
  const dare = todayDare();
  const placeholder = t.notePrompts[Math.floor(Math.random() * t.notePrompts.length)];

  el.innerHTML = `
    <div class="review-inner">
      <div class="page-head">
        <button type="button" class="eyebrow back" data-close-capture>${t.cancel}</button>
        <span class="eyebrow">${t.newSky}</span>
      </div>
      <div id="foldSlot"></div>
      <div><p class="field-label">${t.colors}</p><div class="palette">${paletteHtml(draft.palette)}</div></div>
      <div>
        <label class="field-label" for="noteInput">${t.note} <span>${t.optional}</span></label>
        <input id="noteInput" class="field note hand" maxlength="80" placeholder="${placeholder}" autocomplete="off">
      </div>
      <div>
        <label class="field-label" for="placeInput">${t.place} <span>${t.optional}</span></label>
        <input id="placeInput" class="field" maxlength="24" placeholder="${t.placeHint}" autocomplete="off">
      </div>
      <label class="switch"><span>${t.countForDare}</span><input type="checkbox" id="forPrompt" ${state.viaPrompt ? 'checked' : ''}></label>
      <div>
        <label class="field-label" for="whenInput">${t.taken}</label>
        <input id="whenInput" class="field mono" type="datetime-local" value="${toLocalInput(takenAt)}" max="${toLocalInput(Date.now())}">
      </div>
      <div class="review-actions">
        <button type="button" class="btn" id="retake">${t.retake}</button>
        <button type="button" class="btn primary" id="keepIt">${t.keep}</button>
      </div>
    </div>`;

  const stage = foldStage(draft.url, Math.min(150, innerWidth * 0.4), 'open');
  $('#foldSlot').append(stage.el);
  draft.stage = stage;
  draft.promptKey = dare.key;

  $('#noteInput').addEventListener('input', (e) => { e.target.className = `field note ${handClass(e.target.value)}`; });
  $('#whenInput').addEventListener('change', (e) => {
    const ms = new Date(e.target.value).getTime();
    if (Number.isFinite(ms)) draft.takenAt = Math.min(ms, Date.now());
  });
  $('#retake').addEventListener('click', () => { URL.revokeObjectURL(draft.url); draft = null; openCapture(); });
  $('#keepIt').addEventListener('click', saveDraft);
}

async function saveDraft() {
  const btn = $('#keepIt');
  btn.disabled = true;
  const sky = {
    id: newId(),
    takenAt: draft.takenAt,
    note: $('#noteInput').value.trim(),
    place: $('#placeInput').value.trim(),
    prompt: $('#forPrompt').checked ? draft.promptKey : '',
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
    toast(t.saveFailed);
    return;
  }
  state.skies.push(sky);
  sortSkies();
  state.viaPrompt = false;

  // Saved first; the fold is only the send-off.
  const { stage, url } = draft;
  cap.querySelector('.review').scrollTo({ top: 0, behavior: 'smooth' });
  await stage.foldIn();
  navigator.vibrate?.(18);
  URL.revokeObjectURL(url);
  draft = null;
  showKept(sky);
}

function showKept(sky) {
  showStep('drop');
  cap.querySelector('.drop').innerHTML = `
    <div class="drop-jar">${jarSvg({ href: photoUrl(sky) })}</div>
    <div class="drop-msg">
      <h2>${t.keptDone}</h2>
      <p>${fmt.long(sky.takenAt)}</p>
      <div class="actions">
        <button type="button" class="btn" id="dropShare">${t.shareStory}</button>
        <button type="button" class="btn primary" id="dropOpen">${t.seeShelf}</button>
      </div>
    </div>`;
  $('#dropShare').addEventListener('click', () => openStory('single', { sky }));
  $('#dropOpen').addEventListener('click', () => { closeCapture(); go('#/'); });
}

// ---------- detail sheet ----------

function openDetail(sky) {
  if (!sky) return;
  const wrap = $('#sheet');
  const art = wrap.querySelector('.sheet');
  art.innerHTML = `
    <div class="grabber"></div>
    <div id="detailStage" role="img" aria-label="${t.openSky(fmt.long(sky.takenAt))}"></div>
    ${sky.note ? `<p class="detail-note ${handClass(sky.note)}">${esc(sky.note)}</p>` : ''}
    <p class="detail-meta"><time datetime="${new Date(sky.takenAt).toISOString()}">${fmt.long(sky.takenAt)}</time>${sky.place ? ` · ${esc(sky.place)}` : ''}</p>
    <div class="palette">${paletteHtml(sky.palette)}</div>
    <div class="sheet-actions">
      <button type="button" class="btn primary" id="shareOne">${t.shareStory}</button>
      <button type="button" class="btn-text danger" id="askDelete">${t.deleteSky}</button>
    </div>
    <div id="confirmBox"></div>`;
  wrap.hidden = false;
  document.body.style.overflow = 'hidden';

  const stage = foldStage(photoUrl(sky, 'photo'), Math.min(160, innerWidth * 0.42), 'kept');
  $('#detailStage').append(stage.el);
  requestAnimationFrame(() => stage.foldOut());

  $('#shareOne').addEventListener('click', () => openStory('single', { sky }));
  $('#askDelete').addEventListener('click', () => {
    $('#confirmBox').innerHTML = `<div class="confirm">
      <p>${t.deleteConfirm}</p>
      <div class="actions"><button type="button" class="btn" id="noDelete">${t.keepIt}</button>
      <button type="button" class="btn danger" id="yesDelete">${t.deleteSky}</button></div></div>`;
    $('#noDelete').addEventListener('click', () => { $('#confirmBox').innerHTML = ''; });
    $('#yesDelete').addEventListener('click', async () => {
      await store.remove(sky.id);
      state.skies = state.skies.filter((s) => s.id !== sky.id);
      closeSheet();
      forgetUrls(sky.id);
      render();
      toast(t.deleted);
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
  const title = kind === 'single' ? t.shareTitle.single : kind === 'jar' ? t.shareTitle.jar(MONTHS[payload.month]) : t.shareTitle.year(payload.year);
  const canShowPlace = kind === 'single' && payload.sky.place;
  art.innerHTML = `
    <div class="grabber"></div>
    <h2>${title}</h2>
    <div class="story-preview" id="storyPreview"><div class="spinner"></div></div>
    ${canShowPlace ? `<label class="switch"><span>${t.showPlace}</span><input type="checkbox" id="showPlace"></label>
      <p class="hint left">${t.showPlaceHint}</p>` : ''}
    <p class="hint left">${t.storyTip}</p>
    <div class="sheet-actions">
      <button type="button" class="btn" id="saveStory" disabled>${t.saveImage}</button>
      <button type="button" class="btn primary" id="shareStory" disabled>${t.share}</button>
    </div>`;
  wrap.hidden = false;
  document.body.style.overflow = 'hidden';

  const filename = `kepfa-${kind}-${new Date().toISOString().slice(0, 10)}.jpg`;
  const quote = nextQuote();
  let blob = null;
  let build = 0;
  const make = async (showPlace) => {
    const mine = ++build;
    $('#saveStory').disabled = true;
    $('#shareStory').disabled = true;
    let out;
    try {
      out = await makeStory(kind, { ...payload, showPlace, quote });
    } catch {
      $('#storyPreview').innerHTML = `<p class="hint">${t.storyFailed}</p>`;
      return;
    }
    if (mine !== build || wrap.hidden) return;
    blob = out;
    if (storyUrl) URL.revokeObjectURL(storyUrl);
    storyUrl = URL.createObjectURL(blob);
    $('#storyPreview').innerHTML = `<img src="${storyUrl}" alt="">`;
    $('#saveStory').disabled = false;
    $('#shareStory').disabled = false;
  };

  $('#saveStory').addEventListener('click', () => { saveImage(blob, filename); toast(t.saved); });
  $('#shareStory').addEventListener('click', async () => {
    if ((await shareImage(blob, filename)) === 'saved') toast(t.sharedFallback);
  });
  // Place stays off every time the sheet opens, so it never leaves the phone by accident.
  $('#showPlace')?.addEventListener('change', (e) => make(e.target.checked));
  make(false);
}

function closeStory() {
  $('#storyModal').hidden = true;
  if (storyUrl) { URL.revokeObjectURL(storyUrl); storyUrl = null; }
  if (cap.hidden && $('#sheet').hidden) document.body.style.overflow = '';
}

// ---------- sample shelf ----------

const SAMPLE_RECIPES = [
  ['sunset', 18, 12, 'the one after work', 'Bangkok'],
  ['clear', 11, 5, 'saturday blue', ''],
  ['pink', 18, 34, 'peach bus ride', 'Bangkok'],
  ['cloudy', 14, 20, 'all clouds', ''],
  ['cloudy', 16, 2, '', ''],
  ['night', 21, 40, 'grandma’s stars', 'Chiang Mai'],
  ['sunrise', 6, 18, 'slow morning', ''],
  ['bluehour', 18, 55, 'blue hour on the bridge', 'Bangkok'],
  ['sunset', 17, 58, 'the river one', 'Bangkok'],
  ['clear', 9, 30, '', ''],
  ['cloudy', 12, 45, 'grey but fine', ''],
  ['pink', 18, 20, 'the cotton candy one', 'Hua Hin'],
];
const SEED_KEY = 'skyjar.seeded';
const SEED_VERSION = '2';

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
      const [kind, hh, mm, note, place] = SAMPLE_RECIPES[k % SAMPLE_RECIPES.length];
      k++;
      const takenAt = new Date(y, m, day, hh, mm).getTime();
      if (takenAt <= Date.now()) plan.push({ kind, takenAt, note, place, seed: k * 7919 });
    }
  }

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const prep = await prepareImage(await makeSampleSky(p.kind, p.seed));
    const sky = {
      id: newId(), takenAt: p.takenAt, note: p.note, place: p.place, prompt: '',
      palette: prep.palette, photo: prep.photo, thumb: prep.thumb, sample: true, createdAt: Date.now(),
    };
    await store.put(sky);
    state.skies.push(sky);
    onProgress?.(i + 1, plan.length);
  }
  sortSkies();
}

function seededVersion() {
  try { return localStorage.getItem(SEED_KEY); } catch { return null; }
}
function markSeeded() {
  try { localStorage.setItem(SEED_KEY, SEED_VERSION); } catch { /* ignore */ }
}

// ---------- boot ----------

function bindGlobal() {
  $('#openCapture').addEventListener('click', () => { state.viaPrompt = false; openCapture(); });
  $('#shutter').addEventListener('click', snap);
  $('#fileCamera').addEventListener('change', picked);
  $('#fileGallery').addEventListener('change', picked);
  cap.addEventListener('click', (e) => { if (e.target.closest('[data-close-capture]')) closeCapture(); });
  $('#sheet').addEventListener('click', (e) => { if (e.target.closest('[data-close-sheet]')) closeSheet(); });
  $('#storyModal').addEventListener('click', (e) => { if (e.target.closest('[data-close-story]')) closeStory(); });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.palette button[data-hex]');
    if (!b) return;
    const code = b.dataset.hex.toUpperCase();
    try {
      await navigator.clipboard.writeText(code);
      toast(t.copied(code));
    } catch {
      toast(code);
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
    resizeTimer = setTimeout(() => {
      state.redraw?.();
      if (!cap.hidden) layoutCameraFrame();
    }, 120);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.redraw?.());
  window.addEventListener('hashchange', render);
  setInterval(() => { const el = $('#sunLine'); if (el) el.textContent = sunLine(); }, 60000);
}

async function init() {
  bindGlobal();
  view.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t.opening}</p></div>`;

  try {
    await document.fonts.load('30px "Cormorant Garamond"');
  } catch { /* fonts are optional */ }
  state.skies = await store.all();
  if (!(await store.persistent())) toast(t.notPersistent);

  // First visit, or a shelf that still only holds an older batch of samples: lay out a fresh sample shelf.
  if (seededVersion() !== SEED_VERSION && state.skies.every((s) => s.sample)) {
    for (const s of state.skies) await store.remove(s.id);
    state.skies = [];
    view.innerHTML = `<div class="loading"><div class="spinner"></div><p id="seedMsg">${t.preparing(0, '…')}</p></div>`;
    await seedSamples((i, n) => { const m = $('#seedMsg'); if (m) m.textContent = t.preparing(i, n); });
    markSeeded();
  }
  render();
}

init();
