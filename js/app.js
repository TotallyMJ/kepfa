import { store, newId } from './store.js';
import { prepareImage, makeSampleSky, hexToRgb, dominant, hex, mix } from './sky.js';
import { BOX, INSIDE, INTERIOR, loadJar, jarSvg, drawJar, setupCanvas, JAR_RATIO } from './jar.js';
import { foldStage, MOTION, reduceMotion } from './fold.js';
import { sunTimes } from './sun.js';
import { makeStory, shareImage, saveImage } from './story.js';
import { chime } from './sound.js';
import { t, fmt, MONTHS, MONTHS_SHORT, PROMPTS, QUOTES, CHALLENGE_SIZE } from './strings.js';

const ICON = {
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const cap = $('#capture');

const BANGKOK = { lat: 13.7563, lon: 100.5018 };
const state = { skies: [], year: new Date().getFullYear(), redraw: null, lastRoute: '', viaPrompt: false, unfolded: false, detail: null };

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


/** Canvas jars can't read CSS, so tell them which glass layer suits the theme. */
const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

let toastTimer;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
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

/** Today's prompt: the same for everyone, changes at local midnight. */
function todayPrompt(d = new Date()) {
  return promptFor(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
}
function promptFor(key) {
  const [y, m, d] = key.split('-').map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 864e5);
  return { key, text: PROMPTS[day % PROMPTS.length], tag: fmt.dayTag(key) };
}
const tagUrl = (tag) => `https://www.instagram.com/explore/tags/${tag.toLowerCase()}/`;

/** The 30-sky challenge: one per prompt day, counted in rounds of 30. */
function challengeProgress() {
  const n = new Set(state.skies.filter((s) => s.prompt && !s.sample).map((s) => s.prompt)).size;
  return { filled: n ? ((n - 1) % CHALLENGE_SIZE) + 1 : 0, round: Math.max(1, Math.ceil(n / CHALLENGE_SIZE)) };
}

/** Index of a dot filled since the shelf was last drawn, so it can fill in with a little bounce; -1 if none. */
function newDot(filled) {
  let seen = filled;
  try {
    seen = +(localStorage.getItem('kepfa.dots') ?? filled);
    localStorage.setItem('kepfa.dots', filled);
  } catch { /* no bounce without storage */ }
  return filled > seen ? filled - 1 : -1;
}

/** What a challenge share carries: the prompt as it was kept, its day and its hashtag. */
function challengeFor(sky) {
  if (!sky.prompt) return null;
  const p = promptFor(sky.prompt);
  return { text: sky.promptText || p.text, day: fmt.dayLong(sky.prompt), tag: p.tag, kept: challengeProgress().filled };
}

/** A strip of masking tape; where it sits and how it tilts lives in CSS. */
const tape = (where) => `<span class="tape ${where}" aria-hidden="true"></span>`;

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

/** Which sky is out right now, so the prompt sits on a sheet of that colour. */
function skyPhase(now = new Date()) {
  const place = savedPlace() || BANGKOK;
  const sun = sunTimes(now, place.lat, place.lon);
  if (!sun) return 'day';
  if (now < sun.sunrise || now >= sun.sunset) return 'night';
  if (now < sun.goldenMorningEnd || now >= sun.goldenEveningStart) return 'golden';
  return 'day';
}

function renderShelf() {
  const now = new Date();
  const prompt = todayPrompt(now);
  const { filled, round } = challengeProgress();
  const fresh = newDot(filled);
  const memory = onThisDay();
  // The home screen holds this month only; the rest live on Months.
  const thisMonth = skiesIn(now.getFullYear(), now.getMonth()).reverse();
  const sun = sunLine();

  view.innerHTML = `
    <header class="masthead">
      <div class="masthead-meta"><span class="eyebrow">${t.issue(now.getMonth() + 1)}</span><span class="eyebrow">${fmt.issueDate(now)}</span></div>
      <h1 class="wordmark">Kepfa</h1>
    </header>
    ${sun ? `<div class="sunline"><span id="sunLine">${sun}</span>
      <button type="button" class="sunline-place" id="setPlace" aria-label="${t.useLocation}">${savedPlace() ? t.herePlace : t.defaultPlace}</button></div>` : ''}
    <section class="prompt is-${skyPhase(now)}">
      <div class="prompt-sheet-head"><span class="prompt-badge">${t.challengeBadge}</span><span class="prompt-day">${fmt.dayShort(prompt.key)}</span></div>
      <div class="prompt-pin">
        ${tape('tape-top')}
        <div class="slip torn">
          <span class="eyebrow">${t.lookFor}</span>
          <h2 class="prompt-text">${prompt.text}</h2>
          <p class="prompt-line">${t.sameSky}</p>
          <button type="button" class="btn primary prompt-go" id="lookUp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>${t.lookUp}</button>
          <a class="btn-text prompt-tag" href="${tagUrl(prompt.tag)}" target="_blank" rel="noopener">${t.seeTag(prompt.tag)}</a>
          <div class="prompt-progress">
            <div class="prompt-head"><span class="eyebrow">${t.challenge(round)}</span><span class="prompt-count">${filled} / ${CHALLENGE_SIZE}</span></div>
            <div class="dots" role="img" aria-label="${filled} of ${CHALLENGE_SIZE}">${Array.from({ length: CHALLENGE_SIZE }, (_, i) => `<i${i < filled ? ` class="on${i === fresh ? ' is-new' : ''}"` : ''}></i>`).join('')}</div>
          </div>
        </div>
      </div>
    </section>
    ${bannerHtml()}
    ${memory ? `<section class="memory-block">
      <p class="eyebrow">${memory.label}</p>
      <div class="memory">${slotButton(memory.sky)}
        <p>${memory.sky.note ? `<span class="memory-note ${handClass(memory.sky.note)}">${esc(memory.sky.note)}</span>` : ''}<span class="memory-date">${fmt.shelf(memory.sky.takenAt)[0]}, ${new Date(memory.sky.takenAt).getFullYear()} · ${fmt.shelf(memory.sky.takenAt)[1]}</span></p>
      </div>
    </section>` : ''}
    <div class="section-head"><h2 class="section-title">${MONTHS[now.getMonth()]} <span>${now.getFullYear()}</span></h2><span class="eyebrow">${thisMonth.length} ${t.kept(thisMonth.length)}</span></div>
    ${thisMonth.length
      ? shelfRowsHtml(thisMonth)
      : `<div class="empty">
           <div class="empty-jar">${jarSvg()}</div>
           ${state.skies.length ? `<p>${t.monthEmpty(MONTHS[now.getMonth()])}</p>` : `<h2>${t.emptyTitle}</h2><p>${t.emptyBody}</p>`}
         </div>`}
    ${state.skies.length > thisMonth.length ? `<p class="see-months"><a class="btn-text" href="#/months">${t.seeMonths}</a></p>` : ''}`;

  bindJarSlots(view);
  $('#clearSamples')?.addEventListener('click', clearSamples);
  $('#setPlace')?.addEventListener('click', askLocation);
  $('#lookUp').addEventListener('click', () => { state.viaPrompt = true; openCapture(); });
  state.redraw = null;
}

/** Tap a jar to open it; press and hold for the delete menu. Moving the finger means scrolling, so it cancels. */
function bindJarSlots(root) {
  root.querySelectorAll('.jar-slot').forEach((el) => {
    const sky = () => state.skies.find((s) => s.id === el.dataset.id);
    let timer = 0, x0 = 0, y0 = 0, held = false;
    const cancel = () => { clearTimeout(timer); el.classList.remove('is-pressing'); };
    el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      held = false;
      x0 = e.clientX;
      y0 = e.clientY;
      el.classList.add('is-pressing');
      timer = setTimeout(() => { held = true; cancel(); openJarMenu(el, sky()); }, HOLD_MS);
    });
    el.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => el.addEventListener(type, cancel));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', () => {
      if (held) { held = false; return; }
      openDetail(sky());
    });
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
    ${all.length ? `<div class="section-head"><span></span><button type="button" class="btn-text" id="shareYear">${t.shareYear}</button></div>` : ''}
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
    const dark = isDark();
    view.querySelectorAll('.month-slot').forEach((el) => {
      const m = +el.dataset.month;
      const w = Math.min(el.clientWidth, 96);
      const h = Math.round(w * JAR_RATIO);
      const ctx = setupCanvas(el.querySelector('canvas'), w, h);
      drawJar(ctx, { x: 0, y: 0, w, skies: skiesIn(y, m), capacity: daysIn(y, m), ghost: el.disabled, dark });
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
           <button type="button" class="btn primary" id="shareJar">${t.shareMonth(MONTHS[month])}</button>
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
    layers = drawJar(ctx, { x: 0, y: 0, w, skies: list, capacity: days, dark: isDark() });
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
let camWindow = null;   // the jar's glass interior on screen, in CSS px: what the shot keeps

function showStep(name) {
  cap.querySelectorAll('.cap-step').forEach((s) => { s.hidden = s.dataset.step !== name; });
}

/** Dim the viewfinder outside a jar-shaped window, so what you frame is what gets kept. */
function layoutCameraFrame() {
  const W = innerWidth, H = innerHeight;
  const jh = Math.min(H * 0.58, Math.min(W * 0.78, 340) * JAR_RATIO);
  const jw = jh / JAR_RATIO;
  const x = (W - jw) / 2, y = (H - jh) / 2 - H * 0.02;
  // Place the photo's coordinate space so its jar box lands at x,y, jw wide.
  const place = `translate(${x} ${y}) scale(${jw / BOX.w}) translate(${-BOX.x} ${-BOX.y})`;
  const k = jw / BOX.w;
  camWindow = { x: x + (INSIDE.x - BOX.x) * k, y: y + (INSIDE.y - BOX.y) * k, w: INSIDE.w * k, h: INSIDE.h * k };
  $('#camFrame').setAttribute('viewBox', `0 0 ${W} ${H}`);
  $('#camFrame').innerHTML = `
    <defs><mask id="camMask"><rect width="${W}" height="${H}" fill="white"/><path d="${INTERIOR}" transform="${place}" fill="black"/></mask></defs>
    <rect class="cam-scrim" width="${W}" height="${H}" mask="url(#camMask)"/>
    <g transform="${place}">${jarSvg({ lidded: true }).replace(/^<svg[^>]*>|<\/svg>\s*$/g, '')}</g>`;
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
      // As sharp as the phone allows: the shot keeps only the part inside the jar.
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } },
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
  // Keep what was framed: map the jar window back through the video's object-fit: cover onto the camera frame.
  const vw = v.videoWidth, vh = v.videoHeight;
  const s = Math.max(innerWidth / vw, innerHeight / vh);
  const ox = (innerWidth - vw * s) / 2, oy = (innerHeight - vh * s) / 2;
  const sx = Math.max(0, (camWindow.x - ox) / s), sy = Math.max(0, (camWindow.y - oy) / s);
  const sw = Math.min(vw - sx, camWindow.w / s), sh = Math.min(vh - sy, camWindow.h / s);
  const c = document.createElement('canvas');
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
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
  // Only the camera app can hand a photo in (no library), so the sky was taken just now.
  review(f, Date.now());
}

async function review(blob, takenAt) {
  showStep('review');
  const el = cap.querySelector('.review');
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t.reading}</p></div>`;
  try {
    draft = { ...(await prepareImage(blob)), takenAt };
  } catch {
    el.innerHTML = `<div class="loading"><p>${t.cantOpen}</p>
      <button type="button" class="btn primary" id="tryAgain">${t.tryAgain}</button></div>`;
    $('#tryAgain').addEventListener('click', openCapture);
    return;
  }
  draft.url = URL.createObjectURL(draft.photo);
  const prompt = todayPrompt();

  el.innerHTML = `
    <div class="review-inner">
      <div class="page-head">
        <button type="button" class="eyebrow back" data-close-capture>${t.cancel}</button>
        <span class="eyebrow">${t.newSky}</span>
      </div>
      <div id="foldSlot"></div>
      ${skyFields({ takenAt })}
      <label class="tick-row">
        <input type="checkbox" id="forPrompt" ${state.viaPrompt ? 'checked' : ''}>
        <span><span class="eyebrow">${t.keptForToday}</span><span class="tick-prompt">${prompt.text}</span></span>
      </label>
      <div class="review-actions">
        <button type="button" class="btn" id="retake">${t.retake}</button>
        <button type="button" class="btn primary" id="keepIt">${t.keep}</button>
      </div>
    </div>`;

  const stage = foldStage(draft.url, Math.min(150, innerWidth * 0.4), 'open');
  $('#foldSlot').append(stage.el);
  draft.stage = stage;
  draft.prompt = prompt;

  $('#noteInput').addEventListener('input', (e) => { e.target.className = `field note ${handClass(e.target.value)}`; });
  $('#retake').addEventListener('click', () => { URL.revokeObjectURL(draft.url); draft = null; openCapture(); });
  $('#keepIt').addEventListener('click', saveDraft);
}

/** Note and place; the time is the moment of the shot, shown as it is. */
function skyFields({ takenAt }) {
  const placeholder = t.notePrompts[Math.floor(Math.random() * t.notePrompts.length)];
  return `
    <div>
      <label class="field-label" for="noteInput">${t.note}</label>
      <input id="noteInput" class="field note hand" maxlength="80" placeholder="${placeholder}" autocomplete="off" enterkeyhint="next">
    </div>
    <div>
      <label class="field-label" for="placeInput">${t.place}</label>
      <input id="placeInput" class="field" maxlength="24" placeholder="${t.placeHint}" autocomplete="off" enterkeyhint="done">
      <p class="kept-at">${t.keptAt(fmt.stamp(takenAt))}</p>
    </div>`;
}

async function saveDraft() {
  const btn = $('#keepIt');
  btn.disabled = true;
  const sky = {
    id: newId(),
    takenAt: draft.takenAt,
    note: $('#noteInput').value.trim(),
    place: $('#placeInput').value.trim(),
    prompt: $('#forPrompt').checked ? draft.prompt.key : '',
    promptText: $('#forPrompt').checked ? draft.prompt.text : '',
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
        <button type="button" class="btn" id="dropShare">${t.shareSky}</button>
        <button type="button" class="btn primary" id="dropOpen">${t.seeMySkies}</button>
      </div>
    </div>`;
  $('#dropShare').addEventListener('click', () => openStory('single', { sky }));
  $('#dropOpen').addEventListener('click', () => { closeCapture(); go('#/'); });
}

// ---------- viewer: a sky out of its jar, as a polaroid ----------

const PEN = '<svg class="pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const viewer = { stage: null, pol: null, busy: false, editing: false };

/** Long notes write a little smaller so the polaroid's strip stays two or three lines. */
const noteClass = (note) => `${handClass(note)}${note.length > 40 ? ' is-long' : ''}`;

function stripHtml(sky) {
  const note = sky.note
    ? `<span class="${noteClass(sky.note)}">${esc(sky.note)}</span>`
    : `<span class="polaroid-empty">${t.note}</span>`;
  return `<button type="button" class="polaroid-note" id="editNote" aria-label="${t.editNote}">${note}${PEN}</button>
    <p class="polaroid-meta"><time datetime="${new Date(sky.takenAt).toISOString()}">${fmt.stamp(sky.takenAt)}</time>${sky.place ? ` · ${esc(sky.place)}` : ''}</p>`;
}

const shareHtml = () => `<button type="button" class="btn light" id="shareOne">${t.shareSky}</button>`;

function bindPolaroid(sky) {
  $('#editNote').addEventListener('click', () => startEdit(sky));
  $('#shareOne').addEventListener('click', () => openStory('single', { sky }));
}

/** @param from  1 or -1 when arriving by swipe: the polaroid slides in from that side, no jar to open */
function openDetail(sky, { from = 0 } = {}) {
  if (!sky) return;
  const wrap = $('#sheet');
  const body = wrap.querySelector('.viewer-body');
  const swapping = !wrap.hidden && from !== 0;
  body.className = 'viewer-body';
  body.innerHTML = `
    <div class="viewer-stage" id="viewerStage"></div>
    <div class="viewer-stack">
      <div class="polaroid">
        <button type="button" class="polaroid-close" id="closeJar" aria-label="${t.closeJar}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg></button>
        <div class="polaroid-photo" style="background-image:url('${photoUrl(sky, 'photo')}')" role="img" aria-label="${t.openSky(fmt.long(sky.takenAt))}"></div>
        <div class="polaroid-strip" id="strip">${stripHtml(sky)}</div>
      </div>
      <div class="viewer-actions" id="viewerActions">${shareHtml()}</div>
    </div>`;
  wrap.hidden = false;
  document.body.style.overflow = 'hidden';
  state.detail = sky;
  viewer.editing = false;

  const stage = foldStage(photoUrl(sky, 'photo'), Math.round(Math.min(150, innerWidth * 0.4)), swapping ? 'open' : 'kept');
  $('#viewerStage').append(stage.el);
  viewer.stage = stage;
  viewer.pol = $('.polaroid', body);
  $('#closeJar').addEventListener('click', closeJar);
  bindPolaroid(sky);

  if (swapping) {
    stage.card.style.opacity = 0;
    stage.el.classList.add('is-behind');
    body.classList.add('is-out', 'is-swap');
    if (!reduceMotion()) {
      viewer.pol.animate([{ transform: `translateX(${from * 60}px) rotate(-2deg)`, opacity: 0 }, { transform: 'rotate(-2deg)', opacity: 1 }],
        { duration: MOTION.move, easing: MOTION.out });
    }
    return;
  }
  // The full unfold plays once per visit; after that a short one. A tap anywhere skips it.
  const quick = state.unfolded;
  state.unfolded = true;
  viewer.busy = true;
  requestAnimationFrame(async () => {
    await stage.foldOut({ quick });
    if (viewer.stage !== stage) return;
    await popOut(stage, viewer.pol, body);
    viewer.busy = false;
  });
}

/** Where the polaroid has to start (or end) so its photo sits exactly on the unfolded card. */
function onTheCard(card, pol) {
  const c = card.getBoundingClientRect();
  pol.style.transform = 'none';
  const p = pol.getBoundingClientRect();
  const ph = pol.querySelector('.polaroid-photo').getBoundingClientRect();
  pol.style.transform = '';
  const k = c.width / ph.width;
  return {
    transform: `translate(${c.left - p.left - k * (ph.left - p.left)}px, ${c.top - p.top - k * (ph.top - p.top)}px) scale(${k})`,
    backgroundColor: 'rgba(253, 252, 248, 0)',
  };
}

/** The unfolded photo grows into a polaroid while the jar falls back out of focus. */
async function popOut(stage, pol, body) {
  stage.el.classList.add('is-behind');
  body.classList.add('is-out');
  const start = reduceMotion() ? null : onTheCard(stage.card, pol);
  stage.card.style.opacity = 0;
  if (!start) return;
  await pol.animate([start, { transform: 'rotate(-2deg)', backgroundColor: 'rgb(253, 252, 248)' }],
    { duration: MOTION.pop, easing: MOTION.spring }).finished.catch(() => {});
}

/** ✕: the polaroid shrinks back onto the card, which folds into the jar; then back to the shelf. */
async function closeJar() {
  const { stage, pol } = viewer;
  if (!stage) { closeSheet(); return; }
  if (viewer.busy) { stage.skip(); return; }
  if (viewer.editing) endEdit(state.detail);
  viewer.busy = true;
  const body = $('#sheet .viewer-body');
  body.classList.add('is-closing');
  if (!reduceMotion()) {
    await pol.animate([{ transform: 'rotate(-2deg)' }, onTheCard(stage.card, pol)],
      { duration: MOTION.move, easing: MOTION.in, fill: 'forwards' }).finished.catch(() => {});
  }
  body.classList.remove('is-out');
  stage.card.style.opacity = 1;
  stage.el.classList.remove('is-behind');
  await stage.foldIn();
  navigator.vibrate?.(18);
  viewer.busy = false;
  closeSheet();
  holdHintOnce();
}

/** The note and place are edited right on the polaroid's strip. */
function startEdit(sky) {
  if (viewer.busy) return;
  viewer.editing = true;
  $('#sheet .viewer-body').classList.add('is-editing');
  $('#strip').innerHTML = `
    <form class="polaroid-form" id="noteForm">
      <input id="noteInput" class="polaroid-input ${handClass(sky.note)}" maxlength="80" value="${esc(sky.note)}" placeholder="${t.note}" aria-label="${t.note}" autocomplete="off" enterkeyhint="next">
      <input id="placeInput" class="polaroid-input place" maxlength="24" value="${esc(sky.place)}" placeholder="${t.addPlace}" aria-label="${t.place}" autocomplete="off" enterkeyhint="done">
      <p class="polaroid-meta">${fmt.stamp(sky.takenAt)}</p>
    </form>`;
  $('#viewerActions').innerHTML = `
    <button type="button" class="btn-text on-dark" id="cancelNote">${t.cancel}</button>
    <button type="submit" form="noteForm" class="btn light">${t.done}</button>`;
  const note = $('#noteInput');
  note.addEventListener('input', () => { note.className = `polaroid-input ${handClass(note.value)}`; });
  note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#placeInput').focus(); } });
  // Done, or ✓ on the keyboard, both submit the form.
  $('#noteForm').addEventListener('submit', (e) => { e.preventDefault(); saveNote(sky); });
  $('#cancelNote').addEventListener('click', () => endEdit(sky));
  note.focus();
}

async function saveNote(sky) {
  const next = { ...sky, note: $('#noteInput').value.trim(), place: $('#placeInput').value.trim() };
  try {
    await store.put(next);
  } catch {
    toast(t.saveFailed);
    return;
  }
  Object.assign(sky, next);
  endEdit(sky);
  render();
  toast(t.noteSaved);
}

function endEdit(sky) {
  viewer.editing = false;
  document.activeElement?.blur();
  $('#sheet .viewer-body').classList.remove('is-editing');
  $('#strip').innerHTML = stripHtml(sky);
  $('#viewerActions').innerHTML = shareHtml();
  bindPolaroid(sky);
}

/** Swipe between skies in the order they were taken. dir 1 = older (swipe left), -1 = newer. */
function stepDetail(dir) {
  if (viewer.busy || viewer.editing) return;
  const i = state.skies.findIndex((s) => s.id === state.detail?.id);
  const next = i < 0 ? null : state.skies[i - dir];
  if (next) openDetail(next, { from: dir });
  else viewer.pol?.animate([{ transform: 'rotate(-2deg)' }, { transform: `translateX(${-dir * 14}px) rotate(-2deg)` }, { transform: 'rotate(-2deg)' }], { duration: 240 });
}

function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheet .viewer-body').style.transform = '';
  state.detail = null;
  viewer.stage = null;
  viewer.busy = false;
  viewer.editing = false;
  if (cap.hidden && $('#storyModal').hidden) document.body.style.overflow = '';
}

/** Drag the polaroid down to put it back, or sideways to the next sky. A tap on the dimmed space closes. */
function bindViewerGestures() {
  const body = $('#sheet .viewer-body');
  let x0 = 0, y0 = 0, dx = 0, dy = 0, axis = '', active = false;
  const settle = () => {
    if (body.style.transform) body.animate([{ transform: body.style.transform }, { transform: 'none' }], { duration: MOTION.quick, easing: MOTION.spring });
    body.style.transform = '';
  };
  body.addEventListener('click', (e) => {
    if (e.target.closest('button, input, form')) return;
    if (viewer.busy) viewer.stage?.skip();
    else if (e.target === body && !viewer.editing) closeJar();
  });
  body.addEventListener('touchstart', (e) => {
    active = e.touches.length === 1 && !viewer.editing && !viewer.busy && !e.target.closest('input, button');
    if (!active) return;
    axis = '';
    dx = dy = 0;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });
  body.addEventListener('touchmove', (e) => {
    if (!active) return;
    dx = e.touches[0].clientX - x0;
    dy = e.touches[0].clientY - y0;
    if (!axis && Math.hypot(dx, dy) > 10) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : dy > 0 ? 'y' : 'none';
    if (axis === 'y') { e.preventDefault(); body.style.transform = `translateY(${dy * 0.5}px)`; }
    else if (axis === 'x') { e.preventDefault(); body.style.transform = `translateX(${dx * 0.35}px)`; }
  }, { passive: false });
  body.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    const swipe = axis === 'x' && Math.abs(dx) > 60;
    const drop = axis === 'y' && dy > 110;
    settle();
    if (swipe) stepDetail(dx < 0 ? 1 : -1);
    else if (drop) closeJar();
  });
  body.addEventListener('touchcancel', () => { active = false; settle(); });
}

// ---------- delete: press and hold a jar on the shelf ----------

const HOLD_MS = 500;

function confirmDialog({ title, body, no, yes }) {
  const el = $('#confirm');
  $('#confirmTitle').textContent = title;
  $('#confirmBody').textContent = body;
  $('#confirmNo').textContent = no;
  $('#confirmYes').textContent = yes;
  el.hidden = false;
  $('#confirmNo').focus();
  return new Promise((resolve) => {
    const done = (answer) => { el.hidden = true; resolve(answer); };
    $('#confirmNo').onclick = () => done(false);
    $('#confirmYes').onclick = () => done(true);
    el.onclick = (e) => { if (e.target === el) done(false); };
  });
}

async function deleteSky(sky) {
  const yes = await confirmDialog({ title: t.deleteTitle, body: t.deleteBody, no: t.keepIt, yes: t.deleteYes });
  if (!yes) return;
  try {
    await store.remove(sky.id);
  } catch {
    toast(t.saveFailed);
    return;
  }
  state.skies = state.skies.filter((s) => s.id !== sky.id);
  forgetUrls(sky.id);
  render();
  toast(t.deleted);
}

/** The held jar wiggles with a round ✕ on its corner, like deleting an app on a phone. */
function openJarMenu(slot, sky) {
  if (!sky) return;
  navigator.vibrate?.(12);
  const x = $('#jarX');
  view.classList.add('is-holding');
  slot.classList.add('is-held');
  const r = slot.querySelector('.jar').getBoundingClientRect();
  x.style.left = `${Math.min(r.right - 22 - 6, innerWidth - 44 - 4)}px`;
  x.style.top = `${r.top - 22 + 10}px`;
  x.hidden = false;
  const close = () => {
    x.hidden = true;
    view.classList.remove('is-holding');
    slot.classList.remove('is-held');
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('scroll', close);
  };
  const outside = (e) => { if (!x.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
  window.addEventListener('scroll', close, { once: true });
  x.onclick = () => { close(); deleteSky(sky); };
}

/** Holding to delete can't be seen, so say it once, the first time a sky goes back on the shelf. */
function holdHintOnce() {
  try {
    if (localStorage.getItem('kepfa.holdHint')) return;
    localStorage.setItem('kepfa.holdHint', '1');
  } catch { return; }
  toast(t.holdHint, 3200);
}

// ---------- story export ----------

let storyUrl = null;

async function openStory(kind, payload) {
  const wrap = $('#storyModal');
  const art = wrap.querySelector('.sheet');
  const title = kind === 'single' ? t.shareTitle.single : kind === 'jar' ? t.shareTitle.jar(MONTHS[payload.month]) : t.shareTitle.year(payload.year);
  const canShowPlace = kind === 'single' && payload.sky.place;
  const challenge = kind === 'single' ? challengeFor(payload.sky) : null;
  art.innerHTML = `
    <div class="grabber"></div>
    <h2>${title}</h2>
    <div class="story-preview" id="storyPreview"><div class="spinner"></div></div>
    ${canShowPlace ? `<label class="switch"><span>${t.showPlace}</span><input type="checkbox" id="showPlace"></label>
      <p class="hint left">${t.showPlaceHint}</p>` : ''}
    ${challenge ? `<p class="hint left">${t.captionHint}</p>` : ''}
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
      out = await makeStory(kind, { ...payload, showPlace, quote, challenge });
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

  // Challenge skies carry a ready caption. Copying starts in the same tap as sharing, since both need the gesture.
  const copyCaption = () => (challenge && navigator.clipboard
    ? navigator.clipboard.writeText(t.caption(challenge)).then(() => true, () => false)
    : Promise.resolve(false));
  $('#saveStory').addEventListener('click', async () => {
    const copying = copyCaption();
    saveImage(blob, filename);
    toast((await copying) ? t.captionCopied : t.saved);
  });
  $('#shareStory').addEventListener('click', async () => {
    const copying = copyCaption();
    const how = await shareImage(blob, filename);
    if (how === 'saved') toast(t.sharedFallback);
    else if (await copying) toast(t.captionCopied);
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
  cap.addEventListener('click', (e) => { if (e.target.closest('[data-close-capture]')) closeCapture(); });
  $('#storyModal').addEventListener('click', (e) => { if (e.target.closest('[data-close-story]')) closeStory(); });
  $('#jarX').setAttribute('aria-label', t.deleteSky);

  bindViewerGestures();
  document.addEventListener('keydown', (e) => {
    const quiet = $('#storyModal').hidden && $('#confirm').hidden;
    if (state.detail && quiet && !viewer.editing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      stepDetail(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (e.key !== 'Escape') return;
    if (!$('#confirm').hidden) $('#confirmNo').click();
    else if (!$('#storyModal').hidden) closeStory();
    else if (viewer.editing) endEdit(state.detail);
    else if (!$('#sheet').hidden) closeJar();
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
  // Every jar on screen is drawn from these layers; without them jars fall back to a plain outline.
  try { await loadJar(); } catch { /* outline jars */ }
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
