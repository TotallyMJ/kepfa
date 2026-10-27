import { store, newId } from './store.js';
import { prepareImage, hexToRgb, dominant } from './sky.js';
import { BOX, INSIDE, INTERIOR, loadJar, jarSvg, drawJar, setupCanvas, photoPoint, JAR_RATIO } from './jar.js';
import { livePile, loadThumbs, forgetThumb, paperIndex } from './pile.js';
import { foldStage, rollNote, unrollNote, noteScroll, skipNote, MOTION, reduceMotion } from './fold.js';
import { sunTimes, guessPlace } from './sun.js';
import { placeNear } from './places.js';
import { album, checkStamps, writeCard } from './stamps.js';
import { makeStory, shareImage, saveImage, scatterStars } from './story.js';
import { chime } from './sound.js';
import { t, fmt, MONTHS, MONTHS_SHORT, PROMPTS, THEMES, THEMES_FROM, QUOTES, CHALLENGE_SIZE } from './strings.js';

const ICON = {
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 11v7.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V11"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
  live: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="1.6" fill="currentColor"/><circle cx="6" cy="6" r="3.6"/><circle cx="6" cy="6" r="5.4" stroke-dasharray="1.2 1.4"/></svg>',
  pen: '<svg class="pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5.5M14 11v5.5"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const cap = $('#capture');

const state = { skies: [], year: new Date().getFullYear(), redraw: null, lastRoute: '', viaPrompt: false, unfolded: false, detail: null, live: null };

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
  forgetThumb(id);
  for (const kind of ['thumb', 'photo', 'live']) {
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
/** Where sun times come from: the location you shared, else a city guessed from the phone's time zone. */
const sunPlace = () => savedPlace() || guessPlace();
const zoneCity = () => guessPlace().name || t.yourZone;

function sunLine() {
  const place = sunPlace();
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
  if (!navigator.geolocation) { toast(t.locationDenied(zoneCity())); return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    // Two decimals is about a kilometre: plenty for sun times, and it never leaves this device.
    const place = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) };
    try { localStorage.setItem('kepfa.place', JSON.stringify(place)); } catch { /* keep the default */ }
    render();
  }, () => toast(t.locationDenied(zoneCity())), { maximumAge: 864e5, timeout: 10000 });
}

/** Today's prompt: the same for everyone, changes at local midnight. */
function todayPrompt(d = new Date()) {
  return promptFor(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
}
/** The month's theme, or null: themed months started with November 2026, earlier ones kept the everyday prompts. */
const themeFor = (year, month) => (year * 12 + month >= THEMES_FROM.year * 12 + THEMES_FROM.month ? THEMES[month] || null : null);

function promptFor(key) {
  const [y, m, d] = key.split('-').map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 864e5);
  // A themed month takes its prompts in date order; other months cycle the everyday list.
  const theme = themeFor(y, m - 1);
  return { key, text: theme ? theme.prompts[(d - 1) % theme.prompts.length] : PROMPTS[day % PROMPTS.length], theme: theme?.name || '', tag: fmt.dayTag(key) };
}
const tagUrl = (tag) => `https://www.instagram.com/explore/tags/${tag.toLowerCase()}/`;

/** How many prompt days have a real sky kept for them. */
const keptDays = () => new Set(state.skies.filter((s) => s.prompt && !s.sample).map((s) => s.prompt)).size;

/** The 30-sky challenge: one per prompt day, counted in rounds of 30. */
function challengeProgress() {
  const n = keptDays();
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
  // Which day of the challenge this sky was, counted up to its own day, so an old share keeps its number.
  const n = new Set(state.skies.filter((s) => s.prompt && (!s.sample || s.id === sky.id) && s.prompt <= sky.prompt).map((s) => s.prompt)).size;
  return { text: sky.promptText || p.text, day: fmt.dayLong(sky.prompt), tag: p.tag, kept: ((n - 1) % CHALLENGE_SIZE) + 1 };
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
  if (a === 'stamps') return { name: 'stamps' };
  // The Jars tab opens on the month you're in.
  if (a === 'jars') { const now = new Date(); return { name: 'month', year: now.getFullYear(), month: now.getMonth() }; }
  return { name: 'shelf' };
}

/** Months that hold skies as year * 12 + month, oldest first; this month too, so there's always one to open. */
function monthKeys() {
  const now = new Date();
  const keys = new Set(state.skies.map((s) => { const d = new Date(s.takenAt); return d.getFullYear() * 12 + d.getMonth(); }));
  keys.add(now.getFullYear() * 12 + now.getMonth());
  return [...keys].sort((a, b) => a - b);
}
const monthHash = (k) => `#/month/${Math.floor(k / 12)}-${pad2((k % 12) + 1)}`;

/** Month | Year | Stamps at the top of the Jars tab. Switching (and turning months) replaces the page, so back leaves the tab. */
const jarsSwitch = (on) => `<nav class="seg" aria-label="${t.jarsView}">
    <a href="${state.monthKey != null ? monthHash(state.monthKey) : '#/jars'}" data-replace${on === 'month' ? ' aria-current="page"' : ''}>${t.viewMonth}</a>
    <a href="#/months" data-replace${on === 'year' ? ' aria-current="page"' : ''}>${t.viewYear}</a>
    <a href="#/stamps" data-replace${on === 'stamps' ? ' aria-current="page"' : ''}>${t.viewStamps}</a>
  </nav>`;

function render() {
  state.live?.stop();
  state.live = null;
  state.monthNav = null;
  const route = parseRoute();
  const tab = route.name === 'shelf' ? 'shelf' : 'months';
  document.querySelectorAll('.tab').forEach((el) => {
    if (el.dataset.tab === tab) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  if (route.name === 'month') renderMonth(route.year, route.month);
  else if (route.name === 'months') renderMonths();
  else if (route.name === 'stamps') renderStamps();
  else renderShelf();
  if (location.hash !== state.lastRoute) {
    window.scrollTo(0, 0);
    state.lastRoute = location.hash;
    // Months opens on the shelf you're filling now.
    if (route.name === 'months') view.querySelector('.is-now')?.closest('.shelf-row').scrollIntoView({ block: 'center' });
  }
}

function go(hash) {
  // A window closed with ✕ is still taking its history step back; move on once it has.
  if (unwinding) { afterUnwind = () => go(hash); return; }
  if (location.hash === hash) render(); else location.hash = hash;
}

// ---------- back button: each open window is one step in history ----------

// Android's back button (and the browser's) closes the window on top instead of leaving the app.
// Opening a window adds a history step; closing it with ✕ takes that step back without anything else happening.
const layers = [];
let unwinding = 0, afterUnwind = null;   // steps still being taken back after ✕

function openLayer(name, onBack) {
  layers.push({ name, onBack });
  history.pushState({ kepfa: name }, '');
}

function closeLayer(name) {
  const i = layers.findIndex((l) => l.name === name);
  if (i < 0) return;   // already taken off by the back button
  layers.splice(i, 1);
  unwinding++;
  history.back();
}

window.addEventListener('popstate', () => {
  if (unwinding) {
    if (--unwinding) return;
    const next = afterUnwind;
    afterUnwind = null;
    next?.();
    return;
  }
  layers.pop()?.onBack();
});

// ---------- shelf (home): one jar per sky ----------

// The app this page is open inside (Instagram, LINE…), or '' in a real browser. Their browsers can't run the
// live camera and keep their own storage, so skies kept there don't show up in Safari or Chrome.
const IN_APP = [[/Instagram/i, 'Instagram'], [/FBAN|FBAV|FB_IAB/, 'Facebook'], [/\bLine\//i, 'LINE'],
  [/TikTok|musical_ly|BytedanceWebview/i, 'TikTok'], [/Twitter/i, 'X'], [/KAKAOTALK/i, 'KakaoTalk'],
  [/MicroMessenger/i, 'WeChat'], [/Snapchat/i, 'Snapchat'], [/LinkedInApp/i, 'LinkedIn']]
  .find(([re]) => re.test(navigator.userAgent))?.[1] || '';
const ANDROID = /Android/i.test(navigator.userAgent);
// Already on the home screen (iPhone reports it on navigator.standalone), or an iPhone/iPad that can be.
const STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Chrome and Android hand over their own install prompt; Home's card uses it. iPhone gets the two steps instead.
let installPrompt = null;
const homeShown = () => !!view.querySelector('.masthead-home');
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (homeShown()) render(); });
window.addEventListener('appinstalled', () => { installPrompt = null; if (homeShown()) render(); });
const canInstall = () => !STANDALONE && !IN_APP && (!!installPrompt || IOS);
/** "Not now" puts the card away for 30 days; a small link at the bottom of Home stays. */
function installSnoozed() {
  try { return Date.now() - (+localStorage.getItem('kepfa.installLater') || 0) < 30 * 864e5; } catch { return false; }
}

async function installApp() {
  if (!installPrompt) { openInstallSheet(); return; }
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;   // each prompt can be shown once
  render();
}

function openInstallSheet() {
  const wrap = $('#installSheet');
  wrap.querySelector('.sheet').innerHTML = `
    <div class="grabber"></div>
    <div class="sheet-head"><span></span><h2>${t.installSheetTitle}</h2><button type="button" class="viewer-icon" id="installClose" aria-label="${t.close}">${ICON.close}</button></div>
    <ol class="install-steps"><li>${t.installStep1(ICON.share)}</li><li>${t.installStep2}</li></ol>
    <p class="hint">${t.installSafariNote}</p>`;
  wrap.hidden = false;
  openLayer('install', closeInstallSheet);
  $('#installClose').addEventListener('click', closeInstallSheet);
  wrap.querySelector('.overlay-backdrop').onclick = closeInstallSheet;
}

function closeInstallSheet() {
  $('#installSheet').hidden = true;
  closeLayer('install');
}
const homeUrl = () => `${location.origin}${location.pathname}`;

function inAppHtml() {
  if (!IN_APP) return '';
  // Android can hand the page straight to Chrome; iOS has no such link, so it says where the menu is.
  const chrome = `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
  return `<div class="banner in-app"><p><b>${t.inAppTitle(IN_APP)}</b> ${ANDROID ? t.inAppAndroid : t.inAppIos}</p>
    <div class="in-app-actions"><button type="button" class="btn-text" id="copyLink">${t.copyLink}</button>${ANDROID ? `<a class="btn-text" href="${chrome}">${t.openChrome}</a>` : ''}</div></div>`;
}

function copyLink() {
  const url = homeUrl();
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
    .then(() => toast(t.linkCopied), () => toast(url, 6000));
}

function bannerHtml() {
  if (!state.skies.some((s) => s.sample)) return '';
  return `<div class="banner samples"><p>${t.sampleBanner}</p><button type="button" class="btn-text" id="clearSamples">${t.clearSamples}</button></div>`;
}

function slotButton(s) {
  return `<button type="button" class="jar-slot${s.sample ? ' is-sample' : ''}" data-id="${s.id}" aria-label="${t.openSky(fmt.long(s.takenAt))}">${jarSvg({ href: photoUrl(s) })}</button>`;
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
  const place = sunPlace();
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
  // Home is today and this week: the last seven days, newest first, two shelves at most. Everything else is in Jars.
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const week = state.skies.filter((s) => s.takenAt >= weekStart).reverse().slice(0, 6);
  // The memory waits under the shelf, unless it's already on it.
  const found = onThisDay();
  const memory = found && !week.includes(found.sky) ? found : null;
  // "October's jar ›" opens this month, or the month of the latest sky when this one is still empty.
  const latest = state.skies[state.skies.length - 1];
  const jarMonth = skiesIn(now.getFullYear(), now.getMonth()).length || !latest ? now : new Date(latest.takenAt);
  const sun = sunLine();
  const next = nextStamp();

  view.innerHTML = `
    <header class="masthead masthead-home">
      <h1 class="wordmark">Kepfa</h1>
      <span class="eyebrow">${t.tagline}</span>
    </header>
    ${sun ? `<div class="sunline"><span id="sunLine">${sun}</span>
      <button type="button" class="sunline-place" id="setPlace" aria-label="${t.useLocation}">${ICON.pin}<u>${savedPlace() ? t.nearYou : esc(zoneCity())}</u></button></div>` : ''}
    ${inAppHtml()}
    <section class="prompt is-${skyPhase(now)}">
      <div class="prompt-print">
        <div class="prompt-sky"></div>
        <div class="prompt-sheet-head"><span class="prompt-badge">${t.challengeBadge}</span><span class="prompt-day">${fmt.dayShort(prompt.key)}</span></div>
      </div>
      <div class="prompt-pin">
        ${tape('tape-top')}
        <div class="slip torn">
          <span class="eyebrow">${prompt.theme ? `${MONTHS[now.getMonth()]} · ${prompt.theme}` : t.lookFor}</span>
          <h2 class="prompt-text">${prompt.text}</h2>
          <p class="prompt-line">${t.sameSky}</p>
          <button type="button" class="btn primary prompt-go" id="lookUp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.3-2h6l1.3 2h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/></svg>${t.lookUp}</button>
          <a class="btn-text prompt-tag" href="${tagUrl(prompt.tag)}" target="_blank" rel="noopener">${t.seeWho}</a>
          <div class="prompt-progress">
            <div class="prompt-head"><span class="eyebrow">${t.challenge(round)}</span><span class="prompt-count">${t.challengeCount(filled)}</span></div>
            <div class="dots" role="img" aria-label="${t.challengeCount(filled)}">${Array.from({ length: CHALLENGE_SIZE }, (_, i) => `<i${i < filled ? ` class="on${i === fresh ? ' is-new' : ''}"` : ''}></i>`).join('')}</div>
          </div>
        </div>
      </div>
    </section>
    ${bannerHtml()}
    <div class="section-head"><h2 class="section-title">${t.thisWeek}</h2>${latest
      ? `<a class="eyebrow head-link" href="#/month/${jarMonth.getFullYear()}-${pad2(jarMonth.getMonth() + 1)}">${t.monthsJar(MONTHS[jarMonth.getMonth()])}</a>` : ''}</div>
    ${week.length
      ? shelfRowsHtml(week)
      : `<div class="empty">
           <div class="empty-jar">${jarSvg()}</div>
           ${state.skies.length ? `<p>${t.weekEmpty}</p>` : `<h2>${t.emptyTitle}</h2><p>${t.emptyBody}</p>`}
         </div>`}
    ${canInstall() && !installSnoozed() ? `<div class="memory install-card">
      <button type="button" class="install-open" id="installOpen">
        <img class="install-icon" src="icons/icon-192.png" alt="">
        <span class="memory-text"><span class="eyebrow">${t.installEyebrow}</span><span class="next-name">${t.installTitle}</span><span class="memory-date">${t.installSub}</span></span>
        ${ICON.right}
      </button>
      <button type="button" class="btn-text install-later" id="installLater">${t.installLater}</button>
    </div>` : ''}
    ${next ? `<a class="memory next-stamp" href="#/stamps">
      <span class="next-slot">${next.have}/${next.need}</span>
      <span class="memory-text"><span class="eyebrow">${t.nextStamp}</span><span class="next-name">${esc(t.stamps[next.id].name)}</span>
        <span class="memory-date">${t.stamps[next.id].hint} · ${t.moreToGo(next.need - next.have)}</span></span>
      ${ICON.right}
    </a>` : ''}
    ${memory ? `<button type="button" class="memory" id="memory" aria-label="${t.openSky(fmt.long(memory.sky.takenAt))}">
      <span class="memory-jar">${jarSvg({ href: photoUrl(memory.sky) })}</span>
      <span class="memory-text"><span class="eyebrow">${memory.label}</span>${memory.sky.note ? `<span class="memory-note ${handClass(memory.sky.note)}">${esc(memory.sky.note)}</span>` : ''}<span class="memory-date">${fmt.shelf(memory.sky.takenAt)[0]}, ${new Date(memory.sky.takenAt).getFullYear()} · ${fmt.shelf(memory.sky.takenAt)[1]}</span></span>
      ${ICON.right}
    </button>` : ''}
    <section class="poem"><p>${t.poem.join('<br>')}</p><span class="eyebrow">${t.poemSign}</span></section>
    ${canInstall() && installSnoozed() ? `<p class="install-again"><button type="button" class="btn-text" id="installAgain">${t.installAgain}</button></p>` : ''}
    <p class="credit">${t.madeBy} <a href="https://vibethebloom.com" target="_blank" rel="noopener">${t.maker}</a> ↗</p>`;

  bindJarSlots(view);
  $('#memory')?.addEventListener('click', () => openDetail(memory.sky));
  $('#installOpen')?.addEventListener('click', installApp);
  $('#installAgain')?.addEventListener('click', installApp);
  $('#installLater')?.addEventListener('click', () => {
    try { localStorage.setItem('kepfa.installLater', String(Date.now())); } catch { /* it shows again next time */ }
    render();
  });
  $('#clearSamples')?.addEventListener('click', clearSamples);
  $('#copyLink')?.addEventListener('click', copyLink);
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
  const isNow = (m) => y === now.getFullYear() && m === now.getMonth();
  // The months that hold skies and this one; in the current year the months still to come wait as faded empty jars.
  const isFuture = (m) => y === now.getFullYear() && m > now.getMonth();
  const shown = [...Array(12).keys()].filter((m) => isNow(m) || isFuture(m) || skiesIn(y, m).length);

  // Three to an oak shelf, each jar with a tent card in front: the month and how many skies (render scrolls to this month).
  view.innerHTML = `
    ${jarsSwitch('year')}
    <header class="masthead">
      <div class="masthead-meta"><span class="eyebrow">${all.length} ${t.kept(all.length)}</span>
        <div class="year-switch">
          <button type="button" id="prevYear" aria-label="${t.prevYear}" ${y <= minYear ? 'disabled' : ''}>${ICON.left}</button>
          <span>${y}</span>
          <button type="button" id="nextYear" aria-label="${t.nextYear}" ${y >= now.getFullYear() ? 'disabled' : ''}>${ICON.right}</button>
        </div>
      </div>
      <h1 class="wordmark">${t.monthsTitle[0]} <i>${t.monthsTitle[1]}</i></h1>
    </header>
    ${all.length ? `<button type="button" class="btn primary share share-year" id="shareYear">${ICON.share}${t.shareYear}</button>` : ''}
    ${chunk(shown, 3).map((ms) => `<div class="shelf-row">
        <div class="shelf-jars">${ms.map((m) => `<button type="button" class="month-slot${isFuture(m) ? ' is-future' : ''}" data-month="${m}"
          aria-label="${t.monthJar(MONTHS[m], skiesIn(y, m).length)}"${isFuture(m) ? ' disabled' : ''}><canvas></canvas></button>`).join('')}</div>
        <div class="shelf-labels tents">${ms.map((m) => `<p${isNow(m) ? ' class="is-now"' : isFuture(m) ? ' class="is-future"' : ''}><span>${MONTHS_SHORT[m]}</span><span>${skiesIn(y, m).length}</span></p>`).join('')}</div>
      </div>`).join('')}`;

  view.querySelectorAll('.month-slot:not(.is-future)').forEach((el) => {
    el.addEventListener('click', () => go(`#/month/${y}-${pad2(+el.dataset.month + 1)}`));
  });
  $('#shareYear')?.addEventListener('click', () => openStory('year', { year: y, skies: all }));
  $('#prevYear').addEventListener('click', () => { state.year--; renderMonths(); });
  $('#nextYear').addEventListener('click', () => { state.year++; renderMonths(); });

  const redraw = () => {
    const dark = isDark();
    view.querySelectorAll('.month-slot').forEach((el) => {
      const m = +el.dataset.month;
      const w = Math.min(el.clientWidth, 96);
      const h = Math.round(w * JAR_RATIO);
      const ctx = setupCanvas(el.querySelector('canvas'), w, h);
      drawJar(ctx, { x: 0, y: 0, w, skies: skiesIn(y, m), dark });
    });
  };
  state.redraw = redraw;
  redraw();
  // The folded photos show once their thumbnails are in; until then each is the colour of its sky.
  loadThumbs(all).then(() => { if (state.redraw === redraw) redraw(); });
}

// ---------- the stamp album ----------

/** What the stamp rules need from the app: where the sun is, and which months have a theme. */
const stampCtx = () => ({ place: sunPlace(), hasTheme: (y, m) => !!themeFor(y, m) });

/** A postage stamp printed from one of your skies: perforated edge, cream border, ink grain, its name in italic. */
function stampSvg({ id, href, name, n, w = 86 }) {
  const W = 100, H = 124, r = 3.2, step = 9.6;
  let holes = '';
  for (let x = 4.8; x <= W; x += step) holes += `<circle cx="${x}" cy="0" r="${r}"/><circle cx="${x}" cy="${H}" r="${r}"/>`;
  for (let y = 5.4; y <= H; y += step) holes += `<circle cx="0" cy="${y}" r="${r}"/><circle cx="${W}" cy="${y}" r="${r}"/>`;
  // Ids carry the stamp's own id so two stamps on a page never borrow each other's mask or grain.
  return `<svg class="stamp" style="width:${w}px;height:${(w * H) / W}px" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>
    <mask id="sm-${id}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${holes}</g></mask>
    <clipPath id="sc-${id}"><rect x="8" y="8" width="${W - 16}" height="${H - 40}"/></clipPath>
    <filter id="sg-${id}"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="${n}"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .16  0 0 0 0 .1  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
    <filter id="sp-${id}"><feColorMatrix type="matrix" values=".92 .06 .02 0 .02  .04 .9 .06 0 .02  .02 .08 .86 0 .03  0 0 0 1 0"/></filter></defs>
    <g mask="url(#sm-${id})"><rect width="${W}" height="${H}" fill="#FBF7EE"/>
      <image href="${href}" x="8" y="8" width="${W - 16}" height="${H - 40}" preserveAspectRatio="xMidYMid slice" clip-path="url(#sc-${id})" filter="url(#sp-${id})"/>
      <rect width="${W}" height="${H}" fill="#000" filter="url(#sg-${id})"/>
      <text x="13" y="21" font-family="Cormorant Garamond" font-size="11" font-weight="500" fill="#FBF7EE">${n}</text>
      <text x="${W / 2}" y="${H - 18}" text-anchor="middle" font-family="Cormorant Garamond" font-style="italic" font-size="12" fill="#2a2420">${esc(name)}</text>
      <text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-family="IBM Plex Mono" font-size="5.2" letter-spacing="1.6" fill="#8A8277">KEPFA</text>
    </g></svg>`;
}

/** The album: three stamps to a row, each tucked behind a glassine strip; the ones still to come show a hint. */
/** The stamp nearest to being earned (by how much of it is done), or null once all are in or only samples are kept. */
function nextStamp() {
  if (!state.skies.some((s) => !s.sample) && state.skies.length) return null;
  const left = album(state.skies, stampCtx()).filter((st) => !st.got);
  return left.reduce((best, st) => (st.have / st.need > best.have / best.need ? st : best), left[0]) || null;
}

/** The sky a stamp is printed from: the one that earned it, or the latest kept if that one was deleted. */
function stampSky(got) {
  const real = state.skies.filter((s) => !s.sample);
  return real.find((s) => s.id === got.sky) || real[real.length - 1];
}

function renderStamps() {
  const list = album(state.skies, stampCtx());
  const cell = (st) => {
    const { name, hint } = t.stamps[st.id];
    const sky = st.got && stampSky(st.got);
    const got = st.got ? fmt.shelf(st.got.at)[0] : '';
    // An earned stamp opens its letter again.
    return `<div class="stamp-cell" role="listitem" aria-label="${esc(t.stampLabel(name, got))}">
      ${sky ? `<button type="button" class="stamp-open" data-stamp="${st.id}" aria-label="${esc(t.openLetter(name))}">${stampSvg({ id: st.id, href: photoUrl(sky), name, n: st.need })}</button>`
        : `<div class="stamp-empty">${hint}</div>`}
      <p class="stamp-cap">${esc(name)}<small>${got || `${st.have} / ${st.need}`}</small></p></div>`;
  };
  view.innerHTML = `
    ${jarsSwitch('stamps')}
    <div class="month-head">
      <div><h1 class="title">${t.stampAlbum}</h1><p class="month-theme">${t.stampAlbumSub}</p></div>
      <p class="eyebrow">${t.stampsOf(list.filter((st) => st.got).length, list.length)}</p>
    </div>
    <div class="album" role="list">${chunk(list, 3).map((row) => `<div class="album-row">${row.map(cell).join('')}</div>`).join('')}</div>`;
  view.querySelectorAll('.stamp-open').forEach((b) => b.addEventListener('click', () => openLetters([b.dataset.stamp])));
  state.redraw = null;
}

// ---------- one month's jar ----------

/** Dawn, Morning, … for a time of day, by that month's own sunrise and sunset where you are. */
function partOfDay(year, month, min) {
  const place = sunPlace();
  const sun = sunTimes(new Date(year, month, 15), place.lat, place.lon);
  const at = (d) => d.getHours() * 60 + d.getMinutes();
  const rise = sun ? at(sun.sunrise) : 360, set = sun ? at(sun.sunset) : 1080;
  if (min < rise - 45 || min >= set + 45) return t.dayParts.night;
  if (min < rise + 45) return t.dayParts.dawn;
  if (min < 660) return t.dayParts.morning;
  if (min < 840) return t.dayParts.midday;
  if (min < set - 60) return t.dayParts.afternoon;
  return t.dayParts.sunset;
}

/** A dab of paint: a wobbly round edge, roughened, with a little brush grain. The same seed gives the same dab. */
function paintDab(color, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const n = 18, r = 44, ph1 = rnd() * 6, ph2 = rnd() * 6, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + Math.sin(a * 2 + ph1) * 0.05 + Math.sin(a * 3 + ph2) * 0.035 + (rnd() - 0.5) * 0.03;
    pts.push([50 + Math.cos(a) * r * k, 50 + Math.sin(a) * r * k]);
  }
  // A smooth closed curve through the midpoints, with each point as the control.
  const mid = (p, q) => `${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  const d = `M${mid(pts[n - 1], pts[0])}` + pts.map((p, i) => ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${mid(p, pts[(i + 1) % n])}`).join('');
  const id = `dab${seed}`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
    <filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>
    <filter id="${id}g"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="${seed + 3}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .14 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
    <g filter="url(#${id})"><path d="${d}" fill="${color}"/><path d="${d}" fill="#000" filter="url(#${id}g)"/></g></svg>`;
}

function renderMonth(year, month) {
  const list = skiesIn(year, month);
  const days = daysIn(year, month);
  const daysWithSky = new Set(list.map((s) => new Date(s.takenAt).getDate())).size;
  const minutes = list.map((s) => { const d = new Date(s.takenAt); return d.getHours() * 60 + d.getMinutes(); }).sort((a, b) => a - b);
  const skyOclock = minutes.length ? partOfDay(year, month, minutes[Math.floor(minutes.length / 2)]) : '';
  // Four of the month's colours (each sky's main one), spread from light to dark.
  const lum = (h) => { const [r, g, b] = hexToRgb(h); return 0.3 * r + 0.59 * g + 0.11 * b; };
  const tones = [...new Set(list.map((s) => dominant(s.palette).hex))].sort((a, b) => lum(b) - lum(a));
  const colors = tones.length <= 4 ? tones : [0, 1, 2, 3].map((i) => tones[Math.round((i * (tones.length - 1)) / 3)]);
  // The months on either side that hold skies (empty ones are skipped, as on the Year shelves).
  const key = year * 12 + month, keys = monthKeys();
  const prev = keys.filter((k) => k < key).pop(), next = keys.find((k) => k > key);
  const name = (k) => MONTHS[k % 12] + (Math.floor(k / 12) !== year ? ` ${Math.floor(k / 12)}` : '');
  const isNow = key === new Date().getFullYear() * 12 + new Date().getMonth();
  const theme = themeFor(year, month);
  state.monthKey = key;
  state.year = year;
  state.monthNav = { prev: prev != null ? monthHash(prev) : null, next: next != null ? monthHash(next) : null };

  view.innerHTML = `
    ${jarsSwitch('month')}
    <nav class="month-nav" aria-label="${t.otherMonths}">
      ${prev != null ? `<a class="eyebrow" href="${monthHash(prev)}" data-replace>‹ ${name(prev)}</a>` : '<span></span>'}
      ${next != null ? `<a class="eyebrow" href="${monthHash(next)}" data-replace>${name(next)} ›</a>`
        : isNow ? `<span class="eyebrow is-off">${MONTHS[(month + 1) % 12]} ›</span>` : '<span></span>'}
    </nav>
    <div class="month-head">
      <div><h1 class="title">${MONTHS[month]}</h1>${theme ? `<p class="month-theme">${theme.name}</p>` : ''}</div>
      <p class="eyebrow">${year}<br>${list.length} ${t.kept(list.length)}</p>
    </div>
    <div class="jar-stage" id="jarStage"><canvas id="bigJar" aria-label="${t.monthJar(MONTHS[month], list.length)}"></canvas></div>
    ${list.length
      ? `<p class="hint">${t.tapLayer}${!reduceMotion() && window.DeviceOrientationEvent?.requestPermission ? `<span id="tiltPlay"> · <button type="button" class="btn-text hint-link">${t.tiltToPlay}</button></span>` : ''}</p>
         <div class="actions">
           <button type="button" class="btn" id="shake">${t.shake}</button>
           <button type="button" class="btn primary share" id="shareJar">${ICON.share}${t.shareMonth(MONTHS[month])}</button>
         </div>
         <div class="stats">
           <div class="stat"><b>${daysWithSky}<small>/${days}</small></b><span>${t.statDays}</span></div>
           <div class="stat"><b class="word">${skyOclock}</b><span>${t.skyOclock}</span></div>
           <div class="stat"><b class="dabs">${colors.map((c, i) => paintDab(c, i + 1)).join('')}</b><span>${t.statColors}</span></div>
         </div>
         <h2 class="section-title">${t.thisMonth}</h2>
         <div class="mini-grid">${list.slice().reverse().map((s) => { const [day, time] = fmt.shelf(s.takenAt); return `<div class="mini">
           ${slotButton(s)}<p><span>${day}</span><span>${time}</span></p></div>`; }).join('')}</div>`
      : `<div class="empty"><h2>${t.emptyMonthTitle}</h2><p>${t.emptyMonthBody}</p></div>`}`;

  $('#shareJar')?.addEventListener('click', () => openStory('jar', { year, month, skies: list, theme: theme?.name }));
  $('#shake')?.addEventListener('click', () => shakeJar(list));
  bindJarSlots(view);

  // The big jar is live: the pile rolls when the phone tilts, Shake really shakes it, and a tap opens the sky under it.
  const cv = $('#bigJar');
  let w = 0, ctx = null, last = null;
  const paint = (pile) => {
    last = pile;
    ctx.clearRect(0, 0, w, Math.round(w * JAR_RATIO));
    drawJar(ctx, { x: 0, y: 0, w, pile, skies: list, dark: isDark() });
  };
  const redraw = () => {
    w = Math.min(view.clientWidth * 0.55, 200);
    ctx = setupCanvas(cv, w, Math.round(w * JAR_RATIO));
    if (last) paint(last);
  };
  redraw();
  if (!list.length) { drawJar(ctx, { x: 0, y: 0, w, skies: list, dark: isDark() }); state.redraw = redraw; return; }
  state.live = livePile(list, paint);
  state.redraw = redraw;
  loadThumbs(list).then(() => { if (state.redraw === redraw && last) paint(last); });
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect();
    const sky = state.live?.at(...photoPoint(e.clientX - r.left, e.clientY - r.top, 0, 0, w));
    if (sky) openDetail(sky);
  });
  // iPhones ask before a page may read the tilt; others just start sending it.
  $('#tiltPlay button')?.addEventListener('click', async () => {
    try { await DeviceOrientationEvent.requestPermission(); } catch { /* stays still */ }
    $('#tiltPlay')?.remove();
  });
}

function shakeJar(list) {
  const st = $('#jarStage');
  st.classList.remove('shaking');
  void st.offsetWidth;
  st.classList.add('shaking');
  if (!reduceMotion()) state.live?.shake();
  chime([1568, 1175, 1760, 1318], 0.11);
  navigator.vibrate?.([20, 40, 20, 40, 20]);
  setTimeout(() => {
    st.classList.remove('shaking');
    openDetail(list[Math.floor(Math.random() * list.length)]);
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 750);
}

// ---------- capture ----------

let stream = null;
let facing = 'environment';
let draft = null;
let camWindow = null;   // the jar's glass interior on screen, in CSS px: what the shot keeps

function showStep(name) {
  cap.querySelectorAll('.cap-step').forEach((s) => { s.hidden = s.dataset.step !== name; });
}

/** Dim the viewfinder (or a library photo) outside a jar-shaped window, so what you frame is what gets kept. */
function layoutCameraFrame(svg = $('#camFrame'), maskId = 'camMask') {
  const W = innerWidth, H = innerHeight;
  const jh = Math.min(H * 0.58, Math.min(W * 0.78, 340) * JAR_RATIO);
  const jw = jh / JAR_RATIO;
  const x = (W - jw) / 2, y = (H - jh) / 2 - H * 0.02;
  // Place the photo's coordinate space so its jar box lands at x,y, jw wide.
  const place = `translate(${x} ${y}) scale(${jw / BOX.w}) translate(${-BOX.x} ${-BOX.y})`;
  const k = jw / BOX.w;
  camWindow = { x: x + (INSIDE.x - BOX.x) * k, y: y + (INSIDE.y - BOX.y) * k, w: INSIDE.w * k, h: INSIDE.h * k };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs><mask id="${maskId}"><rect width="${W}" height="${H}" fill="white"/><path d="${INTERIOR}" transform="${place}" fill="black"/></mask></defs>
    <rect class="cam-scrim" width="${W}" height="${H}" mask="url(#${maskId})"/>
    <g transform="${place}">${jarSvg({ lidded: true }).replace(/^<svg[^>]*>|<\/svg>\s*$/g, '')}</g>`;
  // The hint sits just above the lid, clear of the close button.
  const hint = svg.parentElement.querySelector('.cam-hint');
  if (hint) hint.style.top = `${Math.max(y - 44, 60)}px`;
}

async function openCapture() {
  if (cap.hidden) openLayer('capture', closeCapture);
  cap.hidden = false;
  document.body.style.overflow = 'hidden';
  showStep('camera');
  const camStep = cap.querySelector('.cam');
  $('#camFallback').hidden = true;
  camStep.classList.remove('no-camera');
  $('#shutter').hidden = false;
  cap.querySelector('.cam-hint').hidden = false;
  // "hold for a Live sky" shows until the first one is kept.
  let tipSeen = false;
  try { tipSeen = !!localStorage.getItem('kepfa.liveTip'); } catch { /* show it */ }
  $('#liveTip').hidden = tipSeen || !canRecord();
  layoutCameraFrame();

  if (!navigator.mediaDevices?.getUserMedia) return showFallback();
  // Always the sky-facing camera first; the front one is a tap away.
  facing = 'environment';
  try {
    await startCamera();
  } catch {
    showFallback();
    return;
  }
  // Only offer the flip when the phone has more than one camera.
  const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'videoinput');
  $('#camFlip').hidden = cams.length < 2;
}

async function startCamera() {
  const camStep = cap.querySelector('.cam');
  const s = await navigator.mediaDevices.getUserMedia({
    // As sharp as the phone allows: the shot keeps only the part inside the jar.
    video: { facingMode: { ideal: facing }, width: { ideal: 4096 }, height: { ideal: 3072 } },
    audio: false,
  });
  if (cap.hidden || camStep.hidden) { s.getTracks().forEach((tr) => tr.stop()); return; }
  stream = s;
  // The front camera previews like a mirror, the way every selfie screen does.
  camStep.classList.toggle('is-front', facing === 'user');
  const v = $('#camVideo');
  v.srcObject = stream;
  await v.play();
}

async function flipCamera() {
  const was = facing;
  facing = facing === 'user' ? 'environment' : 'user';
  stopCamera();
  try {
    await startCamera();
  } catch {
    facing = was;
    try { await startCamera(); } catch { showFallback(); }
  }
}

function showFallback() {
  $('#camFallback').hidden = false;
  $('#fallbackJar').innerHTML = jarSvg();
  cap.querySelector('.cam').classList.add('no-camera');
  $('#shutter').hidden = true;
  cap.querySelector('.cam-hint').hidden = true;
  $('#liveTip').hidden = true;
}

function stopCamera() {
  if (rec) endLive();   // closed or flipped mid-recording: the clip is dropped
  stream?.getTracks().forEach((tr) => tr.stop());
  stream = null;
  $('#camVideo').srcObject = null;
}

function closeCapture() {
  stopCamera();
  if (draft?.url) URL.revokeObjectURL(draft.url);
  draft = null;
  if (frame.url) { URL.revokeObjectURL(frame.url); frame.url = ''; }
  document.querySelectorAll('.note-ghost, .note-fly').forEach((n) => n.remove());
  state.viaPrompt = false;
  cap.hidden = true;
  document.body.style.overflow = '';
  closeLayer('capture');
}

/** Keep what was framed: map the jar window back through the video's object-fit: cover onto the camera frame. */
function camCrop(v) {
  const vw = v.videoWidth, vh = v.videoHeight;
  const s = Math.max(innerWidth / vw, innerHeight / vh);
  const ox = (innerWidth - vw * s) / 2, oy = (innerHeight - vh * s) / 2;
  // A mirrored preview shows the jar window's left edge from the frame's right side; the saved photo reads the right way round.
  const wx = v.closest('.is-front') ? innerWidth - camWindow.x - camWindow.w : camWindow.x;
  const sx = Math.max(0, (wx - ox) / s), sy = Math.max(0, (camWindow.y - oy) / s);
  return { sx, sy, sw: Math.min(vw - sx, camWindow.w / s), sh: Math.min(vh - sy, camWindow.h / s) };
}

/** What's in the jar right now, as a full-size JPEG. */
function camShot(v) {
  const { sx, sy, sw, sh } = camCrop(v);
  const c = document.createElement('canvas');
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
}

async function snap() {
  const v = $('#camVideo');
  if (!v.videoWidth) return;
  chime([2093], 0);
  const blob = await camShot(v);
  stopCamera();
  review(blob, { takenAt: Date.now(), source: 'camera' });
}

// ---------- Live sky: hold the shutter for a short, silent loop of what's in the jar ----------

const LIVE_MAX = 3000, LIVE_MIN = 1000, HOLD = 350;
const canRecord = () => typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
let rec = null;   // while recording: { recorder, chunks, start, raf, timer, poster }

/** Starts recording the jar window; its first frame, full size, becomes the sky's photo. */
function startLive() {
  const v = $('#camVideo');
  if (!v.videoWidth || !canRecord()) return false;
  const { sx, sy, sw, sh } = camCrop(v);
  const k = Math.min(1, 720 / sw);
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k) & ~1;   // even sizes, which video encoders want
  c.height = Math.round(sh * k) & ~1;
  const ctx = c.getContext('2d');
  const mimeType = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported?.(m));
  const hint = cap.querySelector('.cam-hint');
  let shown = 0;
  rec = { chunks: [], start: performance.now(), poster: camShot(v), hint: hint.textContent };
  const draw = () => {
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const sec = Math.min(LIVE_MAX / 1000, Math.floor((performance.now() - rec.start) / 1000) + 1);
    if (sec !== shown) { shown = sec; hint.innerHTML = `<span class="rec-dot"></span>${t.recording(sec)}`; }
    rec.raf = requestAnimationFrame(draw);
  };
  draw();
  rec.recorder = new MediaRecorder(c.captureStream(30), { ...(mimeType && { mimeType }), videoBitsPerSecond: 2500000 });
  // The last piece arrives as it stops, after rec is cleared, so it goes into this recording's own list.
  const { chunks } = rec;
  rec.recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.recorder.start();
  rec.timer = setTimeout(stopLive, LIVE_MAX);
  $('#shutter').classList.add('is-recording');
  return true;
}

/** Ends the recording (or drops it); returns what was recorded, still to be handed on. */
async function endLive() {
  const r = rec;
  rec = null;
  clearTimeout(r.timer);
  const stopped = new Promise((res) => { r.recorder.onstop = res; });
  r.recorder.stop();
  await stopped;
  cancelAnimationFrame(r.raf);
  $('#shutter').classList.remove('is-recording');
  cap.querySelector('.cam-hint').textContent = r.hint;
  return r;
}

async function stopLive() {
  if (!rec) return;
  const r = await endLive();
  // Let go within a second and it's a photo after all.
  const live = performance.now() - r.start >= LIVE_MIN && r.chunks.length ? new Blob(r.chunks, { type: r.recorder.mimeType || 'video/webm' }) : null;
  if (live) { try { localStorage.setItem('kepfa.liveTip', '1'); } catch { /* the tip just shows again */ } }
  chime([2093], 0);
  const photo = await r.poster;
  stopCamera();
  review(photo, { takenAt: Date.now(), source: 'camera', live });
}

/** Tap for a photo, hold for a Live sky. A keyboard press is a tap. */
function bindShutter() {
  const b = $('#shutter');
  let hold = 0, pressed = false, recording = false;
  b.addEventListener('pointerdown', (e) => {
    pressed = true;
    b.setPointerCapture?.(e.pointerId);
    hold = setTimeout(() => { hold = 0; if (pressed) recording = startLive(); }, HOLD);
  });
  const up = () => {
    if (!pressed) return;
    pressed = false;
    if (hold) { clearTimeout(hold); hold = 0; snap(); }
    // Recording ends on letting go, unless it already stopped itself at three seconds.
    else if (recording) { recording = false; stopLive(); }
    // A hold where recording can't start is still a photo.
    else snap();
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('click', (e) => { if (e.detail === 0) snap(); });
}

// ---------- from the photo library: fit the sky in the jar ----------

/** The library photo being framed: its size, and where it sits on screen (top-left x,y at scale s). */
const frame = { url: '', takenAt: null, iw: 0, ih: 0, x: 0, y: 0, s: 1, min: 1, max: 4 };

/** When a JPEG says it was taken (EXIF DateTimeOriginal, else DateTime), as local time; null if it doesn't say. */
async function photoDate(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return null;
    for (let p = 2; p + 10 < v.byteLength;) {
      const marker = v.getUint16(p);
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) return null;
      if (marker === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) return exifDate(v, p + 10);
      p += 2 + v.getUint16(p + 2);
    }
  } catch { /* unreadable: we'll ask */ }
  return null;
}
function exifDate(v, tiff) {
  const le = v.getUint16(tiff) === 0x4949;
  const u16 = (o) => v.getUint16(tiff + o, le);
  const u32 = (o) => v.getUint32(tiff + o, le);
  const find = (ifd, tag) => {
    for (let i = 0, n = u16(ifd); i < n; i++) if (u16(ifd + 2 + i * 12) === tag) return ifd + 2 + i * 12;
    return 0;
  };
  const ifd0 = u32(4);
  const exif = find(ifd0, 0x8769);
  const entry = (exif && find(u32(exif + 8), 0x9003)) || find(ifd0, 0x0132);
  if (!entry) return null;
  const at = u32(entry + 8);
  const text = Array.from({ length: 19 }, (_, i) => String.fromCharCode(v.getUint8(tiff + at + i))).join('');
  const m = text.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
  if (!m) return null;
  const ms = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  return ms > 0 && ms <= Date.now() + 864e5 ? Math.min(ms, Date.now()) : null;
}

async function picked(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  stopCamera();
  // The date is read first: the crop is redrawn on a canvas, which drops all EXIF, GPS included.
  frame.takenAt = await photoDate(f);
  if (frame.url) URL.revokeObjectURL(frame.url);
  frame.url = URL.createObjectURL(f);
  const img = $('#frameImg');
  img.src = frame.url;
  try { await img.decode(); } catch { toast(t.cantOpen); return; }
  frame.iw = img.naturalWidth;
  frame.ih = img.naturalHeight;
  showStep('frame');
  layoutFrame(true);
}

/** Starts filling the screen, like the camera; it can zoom out until it just covers the jar, and in to 4x. */
function layoutFrame(reset) {
  layoutCameraFrame($('#frameMask'), 'frameMaskCut');
  const w = camWindow;
  const cover = Math.max(innerWidth / frame.iw, innerHeight / frame.ih);
  frame.min = Math.max(w.w / frame.iw, w.h / frame.ih);
  frame.max = Math.max(cover, frame.min) * 4;
  if (reset) {
    frame.s = Math.max(cover, frame.min);
    frame.x = (innerWidth - frame.iw * frame.s) / 2;
    frame.y = (innerHeight - frame.ih * frame.s) / 2;
  }
  placeFrame();
}

/** Keep the jar window covered by the photo, then draw it there. */
function placeFrame() {
  const w = camWindow;
  frame.s = Math.min(frame.max, Math.max(frame.min, frame.s));
  frame.x = Math.min(w.x, Math.max(w.x + w.w - frame.iw * frame.s, frame.x));
  frame.y = Math.min(w.y, Math.max(w.y + w.h - frame.ih * frame.s, frame.y));
  $('#frameImg').style.transform = `translate(${frame.x}px, ${frame.y}px) scale(${frame.s})`;
}

/** Zoom by k around a point on screen, so whatever is under the fingers stays put. */
function zoomFrame(k, px, py) {
  const s = Math.min(frame.max, Math.max(frame.min, frame.s * k));
  frame.x = px - (px - frame.x) * (s / frame.s);
  frame.y = py - (py - frame.y) * (s / frame.s);
  frame.s = s;
  placeFrame();
}

/** One finger drags, two pinch (and drag); a mouse wheel zooms. */
function bindFrameGestures() {
  const el = cap.querySelector('.frame');
  const pts = new Map();
  let last = null;
  const read = () => {
    const p = [...pts.values()];
    return {
      x: p.reduce((a, q) => a + q.x, 0) / p.length,
      y: p.reduce((a, q) => a + q.y, 0) / p.length,
      d: p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0,
    };
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = read();
  });
  el.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const now = read();
    frame.x += now.x - last.x;
    frame.y += now.y - last.y;
    if (now.d && last.d) zoomFrame(now.d / last.d, now.x, now.y); else placeFrame();
    last = now;
  });
  const up = (e) => { pts.delete(e.pointerId); last = pts.size ? read() : null; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { e.preventDefault(); zoomFrame(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
}

/** Crop to the jar window with the same maths as a camera shot. */
async function useFrame() {
  const w = camWindow;
  const sw = w.w / frame.s, sh = w.h / frame.s;
  const k = Math.min(1, 3000 / Math.max(sw, sh));   // stays under phone canvas limits
  const c = document.createElement('canvas');
  c.width = Math.round(sw * k);
  c.height = Math.round(sh * k);
  c.getContext('2d').drawImage($('#frameImg'), (w.x - frame.x) / frame.s, (w.y - frame.y) / frame.s, sw, sh, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
  URL.revokeObjectURL(frame.url);
  frame.url = '';
  $('#frameImg').removeAttribute('src');
  review(blob, { takenAt: frame.takenAt, source: 'library' });
}

// ---------- keep: the photo goes straight into the open jar, then the note, then the lid ----------

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
/** For a datetime-local input: 2026-10-25T18:25 in local time. */
const localInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
/** Each sky's note paper (paper-0 to paper-4 in CSS), fixed by its id so it never changes colour. */
const paperFor = (id) => `paper-${paperIndex(id)}`;
/** "September", or "September 2025" when it's another year. */
const monthOf = (ms) => { const d = new Date(ms); return MONTHS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''); };

/**
 * @param from.takenAt  when the sky was taken; null for a library photo that didn't say
 * @param from.source   'camera' or 'library'
 */
async function review(blob, { takenAt, source, live = null }) {
  showStep('review');
  const el = cap.querySelector('.review');
  el.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t.reading}</p></div>`;
  if (draft?.url) URL.revokeObjectURL(draft.url);
  try {
    draft = { ...(await prepareImage(blob)), id: newId(), takenAt, source, live, front: source === 'camera' && facing === 'user' };
  } catch {
    draft = null;
    el.innerHTML = `<div class="loading"><p>${t.cantOpen}</p>
      <button type="button" class="btn primary" id="tryAgain">${t.tryAgain}</button></div>`;
    $('#tryAgain').addEventListener('click', openCapture);
    return;
  }
  draft.url = URL.createObjectURL(draft.photo);
  const prompt = todayPrompt();
  // Only a sky taken today counts for today's challenge; an older photo goes into the month it was taken.
  const counts = source === 'camera' || (takenAt != null && sameDay(takenAt, Date.now()));
  const paper = paperFor(draft.id);

  el.innerHTML = `
    <div class="review-inner">
      <div class="page-head">
        <button type="button" class="eyebrow back" data-close-capture>${t.cancel}</button>
        <span class="eyebrow">${t.newSky}</span>
      </div>
      <div id="foldSlot" class="review-jar"></div>
      <div class="review-form" id="reviewForm">
        ${skyFields({ takenAt, source, paper })}
        ${counts ? `<label class="tick-row">
          <input type="checkbox" id="forPrompt" ${state.viaPrompt ? 'checked' : ''}>
          <span><span class="eyebrow">${t.keptForToday}</span><span class="tick-prompt">${prompt.text}</span></span>
        </label>` : ''}
        ${takenAt != null && !counts ? `<p class="review-note">${t.otherDay(monthOf(takenAt))}</p>` : ''}
      </div>
      <div class="review-actions" id="reviewActions">
        <button type="button" class="btn" id="retake">${source === 'camera' ? t.retake : t.chooseAnother}</button>
        <button type="button" class="btn primary" id="keepIt">${t.closeLid}</button>
      </div>
    </div>`;

  fitPlaceholder($('#noteInput'));
  if (source === 'camera') suggestPlace($('#placeInput'));
  const stage = foldStage(draft.url, Math.min(150, innerWidth * 0.4), 'open');
  $('#foldSlot').append(stage.el);
  Object.assign(draft, { stage, prompt, paper, counts });
  // Straight into the open jar; the note follows when the lid is closed.
  draft.filling = new Promise((r) => requestAnimationFrame(r))
    .then(() => stage.foldIn({ lid: false }))
    .then(() => settleJar(stage));

  $('#noteInput').addEventListener('input', (e) => { e.target.className = `field note ${handClass(e.target.value)}`; });
  $('#retake').addEventListener('click', () => {
    if (source === 'library') { $('#fileLibrary').click(); return; }
    URL.revokeObjectURL(draft.url);
    draft = null;
    openCapture();
  });
  $('#keepIt').addEventListener('click', saveDraft);
}

/** Once the photo is in, the space where it was folded closes up and the jar moves up. */
function settleJar(stage) {
  const jar = stage.el.querySelector('.fold-jar');
  const top = jar.offsetTop, h = stage.el.offsetHeight;
  stage.el.style.height = `${h - top}px`;
  jar.style.top = '0px';
  if (reduceMotion()) return;
  const o = { duration: MOTION.move, easing: MOTION.out };
  stage.el.animate([{ height: `${h}px` }, { height: `${h - top}px` }], o);
  jar.animate([{ top: `${top}px` }, { top: '0px' }], o);
}

/** A torn slip of note paper holding the note, the place and the time. */
function skyFields({ takenAt, source, paper }) {
  const placeholder = t.notePrompts[Math.floor(Math.random() * t.notePrompts.length)];
  const now = localInput(Date.now());
  const when = source === 'camera' ? `<p class="kept-at">${t.keptAt(fmt.stamp(takenAt))}</p>`
    : takenAt != null ? `<p class="kept-at">${t.takenFrom(fmt.stamp(takenAt))}</p>`
      : `<label class="field-label" for="whenInput">${t.whenTaken}</label>
        <input id="whenInput" class="field when" type="datetime-local" value="${now}" max="${now}">
        <p class="kept-at">${t.noDate}</p>`;
  return `
    <div class="slip torn-top ${paper}" id="noteSlip">
      <label class="field-label" for="noteInput">${t.note}</label>
      <input id="noteInput" class="field note hand" maxlength="80" placeholder="${placeholder}" autocomplete="off" enterkeyhint="next">
      <label class="field-label" for="placeInput">${t.place}</label>
      <input id="placeInput" class="field" maxlength="24" placeholder="${t.placeHint}" autocomplete="off" enterkeyhint="done">
      ${when}
    </div>`;
}

/** The example note is drawn from the ones that fit this slip, so it's never cut off at the edge. */
function fitPlaceholder(input) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = getComputedStyle(input).font;
  const room = input.clientWidth - 4;
  if (ctx.measureText(input.placeholder).width <= room) return;
  const fits = t.notePrompts.filter((p) => ctx.measureText(p).width <= room);
  if (fits.length) input.placeholder = fits[Math.floor(Math.random() * fits.length)];
}

/**
 * A sky taken just now gets the province or city you're in, as a start to edit. Only when location is already
 * allowed (it never asks), only into an empty field nobody is typing in, and worked out on the phone.
 */
async function suggestPlace(input) {
  try { if ((await navigator.permissions.query({ name: 'geolocation' })).state !== 'granted') return; } catch { return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    const name = placeNear(pos.coords.latitude, pos.coords.longitude);
    if (name && input.isConnected && !input.value && document.activeElement !== input) input.value = name;
  }, () => {}, { maximumAge: 6e5, timeout: 8000 });
}

async function saveDraft() {
  const buttons = [$('#keepIt'), $('#retake')];
  buttons.forEach((b) => { b.disabled = true; });
  await draft.filling;
  const note = $('#noteInput').value.trim();
  const place = $('#placeInput').value.trim();
  const when = $('#whenInput');
  const forPrompt = draft.counts && $('#forPrompt').checked;
  const sky = {
    id: draft.id,
    takenAt: when ? Math.min(new Date(when.value).getTime(), Date.now()) || Date.now() : draft.takenAt,
    note,
    place,
    prompt: forPrompt ? draft.prompt.key : '',
    promptText: forPrompt ? draft.prompt.text : '',
    palette: draft.palette,
    photo: draft.photo,
    thumb: draft.thumb,
    live: draft.live,   // the Live sky clip, or null for a photo
    front: draft.front, // taken with the front camera (Me & the sky)
    sample: false,
    createdAt: Date.now(),
  };
  // Saved before anything moves: if it fails, the lid stays open and nothing is lost.
  try {
    await store.put(sky);
  } catch {
    buttons.forEach((b) => { b.disabled = false; });
    toast(t.saveFailed);
    return;
  }
  const daysBefore = keptDays();
  state.skies.push(sky);
  sortSkies();
  const fresh = checkStamps(state.skies, stampCtx());
  state.viaPrompt = false;
  // This sky finished a round when it added a new day and that day is the round's last.
  const daysNow = keptDays();
  const finished = daysNow > daysBefore && daysNow % CHALLENGE_SIZE === 0 ? daysNow / CHALLENGE_SIZE : 0;

  // The send-off: the keyboard goes, the jar comes back into view, the note rolls in, the lid closes.
  const { stage, paper } = draft;
  const scroller = cap.querySelector('.review');
  const typing = document.activeElement?.matches('input') && scroller.contains(document.activeElement);
  document.activeElement?.blur();
  if (typing) await new Promise((r) => setTimeout(r, 250));
  if (scroller.scrollTop > 0) {
    scroller.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    await new Promise((r) => setTimeout(r, reduceMotion() ? 0 : 350));
  }
  const fadeOut = (node) => node.animate({ opacity: [1, 0] }, { duration: MOTION.quick, easing: MOTION.in, fill: 'forwards' });
  fadeOut($('#reviewActions'));
  const rolling = note || place ? rollNote($('#noteSlip'), stage.el.querySelector('.fold-jar'), paper, { note }) : null;
  fadeOut($('#reviewForm'));
  await rolling;
  await stage.lidOn();
  showKept(sky, stage);
  // A beat on "Kept." first, then the celebration; letters for new stamps follow it, or come on their own.
  state.letters = fresh;
  if (finished || fresh.length) {
    setTimeout(() => {
      if (cap.hidden) return;
      if (finished) openCelebration(finished); else openLetters(fresh);
    }, reduceMotion() ? 0 : 900);
  }
}

/** The same jar, lid on, with what to do next. */
function showKept(sky, stage) {
  showStep('drop');
  cap.querySelector('.drop').innerHTML = `
    <div class="drop-jar" id="dropJar"></div>
    <div class="drop-msg">
      <h2>${t.keptDone}</h2>
      <p>${fmt.long(sky.takenAt)}</p>
      <div class="actions">
        <button type="button" class="btn" id="dropShare">${t.shareSky}</button>
        <button type="button" class="btn primary" id="dropOpen">${t.seeMySkies}</button>
      </div>
    </div>`;
  $('#dropJar').append(stage.el);
  $('#dropShare').addEventListener('click', () => openStory('single', { sky }));
  $('#dropOpen').addEventListener('click', () => { closeCapture(); go('#/'); });
}

// ---------- the challenge, done: every day of a round, looked up ----------

/** The days of a finished round, one sky each (the first kept for that day's prompt), oldest first. */
function roundSkies(round) {
  const byDay = new Map();
  for (const s of state.skies) if (s.prompt && !s.sample && !byDay.has(s.prompt)) byDay.set(s.prompt, s);
  return [...byDay.keys()].sort().slice((round - 1) * CHALLENGE_SIZE, round * CHALLENGE_SIZE).map((k) => byDay.get(k));
}

const doneStamp = () => `<svg class="done-stamp" viewBox="0 0 104 104" aria-hidden="true">
  <defs><path id="doneRing" d="M52 52m-36 0a36 36 0 1 1 72 0a36 36 0 1 1 -72 0"/></defs>
  <circle cx="52" cy="52" r="47"/><circle cx="52" cy="52" r="29" class="thin"/>
  <text class="ring"><textPath href="#doneRing">${t.doneStamp}</textPath></text>
  <text x="52" y="50" class="word">${t.doneWord}</text>
  <text x="52" y="66" class="score">${CHALLENGE_SIZE}/${CHALLENGE_SIZE}</text></svg>`;

/** Shown once, right after the sky that completes a round is kept: all its days on one sheet, stamped. */
function openCelebration(round) {
  const el = $('#celebrate');
  const skies = roundSkies(round);
  el.innerHTML = `
    <canvas class="done-stars" aria-hidden="true"></canvas>
    <span class="done-kicker">${t.doneKicker(round)}</span>
    <h1 class="done-title">${t.doneTitle.join('<br>')}</h1>
    <p class="done-line">${t.doneLine}</p>
    <div class="done-sheet">
      ${tape('done-tape')}
      <div class="done-grid">${skies.map((s, i) => `<i style="background-image:url('${photoUrl(s)}')"><span>${i + 1}</span></i>`).join('')}</div>
      <p class="done-range">${t.doneRange(fmt.dayLong(skies[0].prompt), fmt.dayLong(skies[skies.length - 1].prompt))}</p>
      ${doneStamp()}
    </div>
    <div class="done-actions">
      <button type="button" class="btn primary share" id="doneShare">${ICON.share}${t.doneShare}</button>
      <button type="button" class="btn-text" id="doneClose">${t.nextRound(round + 1)}</button>
    </div>`;
  el.hidden = false;
  doneStars(el);
  openLayer('celebrate', closeCelebration);
  $('#doneShare').addEventListener('click', () => openStory('done', { round, skies }));
  $('#doneClose').addEventListener('click', closeCelebration);
}

/** Star stickers drawn behind the whole screen, freshly scattered, kept off the writing and the buttons. */
function doneStars(el, keepOff = '.done-kicker, .done-title, .done-line, .done-actions > *', scale = 1) {
  const canvas = el.querySelector('.done-stars');
  const w = el.clientWidth, h = el.scrollHeight;
  const ctx = setupCanvas(canvas, w, h);
  const at = el.getBoundingClientRect();
  const avoid = [...el.querySelectorAll(keepOff)].map((n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left - at.left, y: r.top - at.top + el.scrollTop, w: r.width, h: r.height };
  });
  scatterStars(ctx, w, h, { unit: 0.42, avoid, scale });
}

function closeCelebration() {
  $('#celebrate').hidden = true;
  closeLayer('celebrate');
  // Stamps earned with the same sky wait their turn; the letter opens once the history step is back.
  const next = state.letters || [];
  if (next.length) { if (unwinding) afterUnwind = () => openLetters(next); else openLetters(next); }
}

// ---------- a letter from the sky: one for each new stamp ----------

/** The postmark over the stamp: KEPFA and the day on the ring, the count in the middle, wavy cancel lines. */
const postmark = (at, n) => { const d = new Date(at); return `<svg class="postmark" viewBox="0 0 140 70" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
  <circle cx="44" cy="35" r="26"/><circle cx="44" cy="35" r="19" stroke-width="1.2"/>
  <defs><path id="pmTop" d="M23.4 35 a20.6 20.6 0 0 1 41.2 0"/><path id="pmBottom" d="M19.8 35 a24.2 24.2 0 0 0 48.4 0"/></defs>
  <g class="postmark-ring"><text><textPath href="#pmTop" startOffset="50%">KEPFA</textPath></text>
    <text><textPath href="#pmBottom" startOffset="50%">${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toUpperCase()} ${d.getFullYear()}</textPath></text>
    <circle cx="21.5" cy="35" r=".9"/><circle cx="66.5" cy="35" r=".9"/></g>
  <text class="postmark-count" x="44.1" y="38.6">${n}/${n}</text>
  ${[0, 1, 2, 3].map((i) => `<path d="M74 ${20 + i * 10} q8 -5 16 0 t16 0 t16 0 t16 0"/>`).join('')}</svg>`; };

/** Opens the letters for these stamps, one after another (if one is already open, these follow it). */
function openLetters(ids) {
  const el = $('#letter');
  state.letters = ids.slice();
  if (!el.hidden) return;
  openLayer('letter', closeLetter);
  showLetter();
}

function showLetter() {
  const el = $('#letter');
  const id = state.letters.shift();
  const st = album(state.skies, stampCtx()).find((x) => x.id === id);
  if (!st?.got) { closeLetter(); return; }
  const copy = t.stamps[st.id];
  const sky = stampSky(st.got);
  const d = new Date(st.got.at);
  const card = st.got.card || copy.card, to = st.got.to || t.letterToWho;
  el.innerHTML = `
    <canvas class="done-stars" aria-hidden="true"></canvas>
    <button type="button" class="viewer-icon letter-close" id="letterClose" aria-label="${t.close}">${ICON.close}</button>
    <div class="letter">
      <p class="letter-head"><span class="letter-brand">Kepfa</span><span class="letter-date">${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}</span></p>
      <p class="letter-hi">${t.letterHi}</p>
      <p class="letter-body">${copy.letter}</p>
      <p class="letter-sign">${t.letterSign}</p>
    </div>
    <div class="postcard">
      <p class="postcard-msg"><span><span class="postcard-words ${handClass(card)}" contenteditable="plaintext-only" role="textbox" spellcheck="false"
        aria-label="${t.letterEdit}" data-field="card" data-max="60">${esc(card)}</span>${ICON.pen}</span></p>
      <p class="postcard-to"><span class="hand">${t.letterTo}</span> <span class="postcard-words ${handClass(to)}" contenteditable="plaintext-only" role="textbox" spellcheck="false"
        aria-label="${t.letterEditTo}" data-field="to" data-max="12">${esc(to)}</span>${ICON.pen}</p>
      ${sky ? stampSvg({ id: `card-${st.id}`, href: photoUrl(sky), name: copy.name, n: st.need, w: 62 }) : ''}
      ${postmark(st.got.at, st.need)}
    </div>
    <p class="postcard-hint">${t.letterTap}</p>
    <p class="letter-ps"><span class="eyebrow">${t.letterPS}</span><span class="letter-stamp">${copy.name}</span></p>
    <div class="done-actions">
      <button type="button" class="btn primary share" id="letterShare">${ICON.share}${t.letterShare}</button>
      <button type="button" class="btn-text" id="letterNext">${t.letterNext}</button>
    </div>`;
  el.hidden = false;
  el.scrollTop = 0;
  doneStars(el, '.letter-close, .letter, .postcard, .postcard-hint, .letter-ps, .done-actions > *', 0.6);
  el.querySelectorAll('.postcard-words').forEach((w) => {
    const max = +w.dataset.max, field = w.dataset.field;
    // Thai grows to 16px from the first touch, before the keyboard opens, so iPhone doesn't zoom in.
    const editing = () => w.classList.add('is-editing');
    w.addEventListener('pointerdown', editing);
    w.addEventListener('focus', editing);
    // Short enough to stay on the card; Enter just finishes.
    w.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); w.blur(); } });
    w.addEventListener('input', () => {
      if (w.textContent.length > max) {
        w.textContent = w.textContent.slice(0, max);
        getSelection().collapse(w, w.childNodes.length);
      }
      w.classList.toggle('is-thai', handClass(w.textContent).includes('is-thai'));
    });
    w.addEventListener('blur', () => {
      const words = w.textContent.replace(/\s+/g, ' ').trim();
      if (!words) w.textContent = field === 'card' ? copy.card : t.letterToWho;
      w.classList.toggle('is-thai', handClass(w.textContent).includes('is-thai'));
      w.classList.remove('is-editing');
      writeCard(st.id, { [field]: words });
    });
  });
  // Tapping the pen writes too.
  el.querySelectorAll('.postcard .pen').forEach((p) => p.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    p.previousElementSibling.classList.add('is-editing');
    p.previousElementSibling.focus();
  }));
  // The postcard is shared with the words on it now, rewritten or not.
  $('#letterShare').addEventListener('click', () => {
    const words = (field) => el.querySelector(`[data-field="${field}"]`).textContent.trim();
    openStory('stamp', { name: copy.name, need: st.need, at: st.got.at, letter: copy.letter, card: words('card') || copy.card, to: words('to') || t.letterToWho, sky });
  });
  $('#letterNext').addEventListener('click', () => (state.letters.length ? showLetter() : closeLetter()));
  $('#letterClose').addEventListener('click', closeLetter);
}

function closeLetter() {
  document.activeElement?.blur();
  $('#letter').hidden = true;
  state.letters = [];
  closeLayer('letter');
}

// ---------- viewer: a sky out of its jar, as a polaroid ----------

const PEN = '<svg class="pen" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const viewer = { stage: null, pol: null, busy: false, editing: false };

/** Long notes write a little smaller so the slip stays two or three lines. */
const noteClass = (note) => `${handClass(note)}${note.length > 40 ? ' is-long' : ''}`;

/** The polaroid's own edge: when and where. A sky with no note offers to write one. */
function stripHtml(sky, { editing = false } = {}) {
  return `${sky.note || editing ? '' : `<button type="button" class="polaroid-note" id="editNote" aria-label="${t.editNote}"><span class="polaroid-empty">${t.writeOn}</span>${PEN}</button>`}
    <p class="polaroid-meta"><time datetime="${new Date(sky.takenAt).toISOString()}">${fmt.stamp(sky.takenAt)}</time>${sky.place ? ` · ${esc(sky.place)}` : ''}</p>`;
}

/** The note comes out of the jar as its own slip, in the same paper it went in on. Tap it to edit. */
function noteHtml(sky, { rolled = false } = {}) {
  if (!sky.note) return '';
  return `<button type="button" class="slip torn-top ${paperFor(sky.id)} view-note" id="viewNote" aria-label="${t.editNote}"${rolled ? ' style="clip-path:inset(0 100% 0 0)"' : ''}>
    <span class="${noteClass(sky.note)}">${esc(sky.note)}</span>${PEN}</button>`;
}

const shareHtml = () => `<button type="button" class="btn light share" id="shareOne">${ICON.share}${t.shareSky}</button>`;

/** The bin at the top: the one thing to do to this sky that isn't on the polaroid itself (the note's pen edits). */
function bindSkyDelete(sky) {
  $('#skyDelete').addEventListener('click', async () => {
    if (viewer.busy || viewer.editing) return;
    if (await deleteSky(sky)) closeSheet();
  });
}

function bindPolaroid(sky) {
  $('#editNote')?.addEventListener('click', () => startEdit(sky));
  $('#viewNote')?.addEventListener('click', () => startEdit(sky));
  $('#shareOne').addEventListener('click', () => openStory('single', { sky }));
}

/** @param from  1 or -1 when arriving by swipe: the polaroid slides in from that side, no jar to open */
function openDetail(sky, { from = 0 } = {}) {
  if (!sky) return;
  const wrap = $('#sheet');
  const body = wrap.querySelector('.viewer-body');
  const swapping = !wrap.hidden && from !== 0;
  if (wrap.hidden) openLayer('sky', skyBack);
  // Opened from the shelf, the note waits in the jar as a scroll and unrolls once the photo is out.
  const rolled = !swapping && !!sky.note && !reduceMotion();
  // Numbered newest first, the way the shelf reads; swiping left goes back in time.
  const n = state.skies.length;
  const pos = n - state.skies.findIndex((s) => s.id === sky.id);
  body.className = 'viewer-body';
  body.innerHTML = `
    <div class="viewer-top">
      <button type="button" class="viewer-icon" id="closeJar" aria-label="${t.closeJar}">${ICON.close}</button>
      <span class="viewer-count">${n > 1 ? t.skyOf(pos, n) : ''}</span>
      <button type="button" class="viewer-icon" id="skyDelete" aria-label="${t.deleteSky}">${ICON.trash}</button>
    </div>
    <div class="viewer-stage" id="viewerStage"></div>
    <div class="viewer-stack">
      <div class="polaroid">
        <div class="polaroid-photo" style="background-image:url('${photoUrl(sky, 'photo')}')" role="img" aria-label="${t.openSky(fmt.long(sky.takenAt))}">${sky.live ? `
          <video class="polaroid-live" src="${photoUrl(sky, 'live')}" muted loop playsinline ${reduceMotion() ? '' : 'autoplay'}></video>
          <span class="live-badge">${ICON.live}${t.live}</span>` : ''}</div>
        <div class="polaroid-strip" id="strip">${stripHtml(sky)}</div>
      </div>
      <div class="viewer-note" id="noteSlot">${noteHtml(sky, { rolled })}</div>
      <div class="viewer-actions" id="viewerActions">${shareHtml()}</div>
      ${n > 1 ? `<p class="viewer-swipe">${t.swipeHint}</p>` : ''}
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
  bindSkyDelete(sky);
  bindPolaroid(sky);

  if (swapping) {
    stage.card.style.opacity = 0;
    stage.el.classList.add('is-behind');
    body.classList.add('is-out', 'is-swap');
    $('#noteSlot').classList.add('is-taped');
    if (!reduceMotion()) {
      [[viewer.pol, -2], [$('#viewNote'), -1.5]].filter(([n]) => n).forEach(([n, tilt]) => n.animate(
        [{ transform: `translateX(${from * 60}px) rotate(${tilt}deg)`, opacity: 0 }, { transform: `rotate(${tilt}deg)`, opacity: 1 }],
        { duration: MOTION.move, easing: MOTION.out }));
    }
    return;
  }
  const rest = sky.note ? noteScroll(paperFor(sky.id), sky.note) : null;
  if (rest) stage.el.querySelector('.fold-jar').append(rest);
  // The full unfold plays once per visit; after that a short one. A tap anywhere skips it.
  const quick = state.unfolded;
  state.unfolded = true;
  viewer.busy = true;
  requestAnimationFrame(async () => {
    await stage.foldOut({ quick });
    if (viewer.stage !== stage) return;
    await popOut(stage, viewer.pol, body);
    if (rest && viewer.stage === stage) await unrollNote(rest, $('#viewNote'), paperFor(sky.id), { quick, skipped: stage.isSkipped });
    if (viewer.stage === stage) { viewer.busy = false; $('#noteSlot').classList.add('is-taped'); }
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

// Putting a sky back you've already seen goes quicker than keeping it the first time.
const PUT_BACK = 0.55;

/** ✕: back in the order it went in: the polaroid folds into the jar, the note rolls up after it, then the lid. */
async function closeJar() {
  const { stage, pol } = viewer;
  if (!stage) { closeSheet(); return; }
  if (viewer.busy) { stage.skip(); skipNote(); return; }
  if (viewer.editing) endEdit(state.detail);
  viewer.busy = true;
  // The tape comes off before the note rolls back up.
  $('#noteSlot')?.classList.remove('is-taped');
  const body = $('#sheet .viewer-body');
  const slip = $('#viewNote');
  body.classList.add('is-closing');
  if (!reduceMotion()) {
    await pol.animate([{ transform: 'rotate(-2deg)' }, onTheCard(stage.card, pol)],
      { duration: MOTION.move * PUT_BACK, easing: MOTION.in, fill: 'forwards' }).finished.catch(() => {});
  }
  body.classList.remove('is-out');
  stage.card.style.opacity = 1;
  stage.el.classList.remove('is-behind');
  if (slip) {
    // The note starts rolling while the photo is still folding, and lands just after it.
    const folding = stage.foldIn({ lid: false, pace: PUT_BACK });
    if (!reduceMotion()) await new Promise((r) => setTimeout(r, 450 * PUT_BACK));
    await rollNote(slip, stage.el.querySelector('.fold-jar'), paperFor(state.detail.id), { note: state.detail.note, quick: true, skipped: stage.isSkipped });
    await folding;
    await stage.lidOn({ pace: PUT_BACK });
  } else {
    await stage.foldIn({ pace: PUT_BACK });
  }
  viewer.busy = false;
  closeSheet();
  holdHintOnce();
}

/** The note and place are edited right on the slip, like when the sky was kept. */
function startEdit(sky) {
  if (viewer.busy) return;
  viewer.editing = true;
  $('#sheet .viewer-body').classList.add('is-editing');
  $('#strip').innerHTML = stripHtml(sky, { editing: true });
  $('#noteSlot').innerHTML = `
    <form class="slip torn-top ${paperFor(sky.id)} view-note polaroid-form" id="noteForm">
      <input id="noteInput" class="polaroid-input ${handClass(sky.note)}" maxlength="80" value="${esc(sky.note)}" placeholder="${t.note}" aria-label="${t.note}" autocomplete="off" enterkeyhint="next">
      <input id="placeInput" class="polaroid-input place" maxlength="24" value="${esc(sky.place)}" placeholder="${t.addPlace}" aria-label="${t.place}" autocomplete="off" enterkeyhint="done">
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
  $('#noteSlot').innerHTML = noteHtml(sky);
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
  closeLayer('sky');
}

/** Back while a sky is open: finish whatever is playing or being typed first, otherwise put it back in its jar. */
function skyBack() {
  if (viewer.editing || viewer.busy) {
    if (viewer.editing) endEdit(state.detail);
    else { viewer.stage?.skip(); skipNote(); }
    openLayer('sky', skyBack);
    return;
  }
  closeJar();
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
    if (viewer.busy) { viewer.stage?.skip(); skipNote(); }
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
    const done = (answer) => { el.hidden = true; closeLayer('confirm'); resolve(answer); };
    // Back is the same as "keep it".
    openLayer('confirm', () => done(false));
    $('#confirmNo').onclick = () => done(false);
    $('#confirmYes').onclick = () => done(true);
    el.onclick = (e) => { if (e.target === el) done(false); };
  });
}

async function deleteSky(sky) {
  const yes = await confirmDialog({ title: t.deleteTitle, body: t.deleteBody, no: t.keepIt, yes: t.deleteYes });
  if (!yes) return false;
  try {
    await store.remove(sky.id);
  } catch {
    toast(t.saveFailed);
    return false;
  }
  state.skies = state.skies.filter((s) => s.id !== sky.id);
  forgetUrls(sky.id);
  render();
  toast(t.deleted);
  return true;
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
  if (wrap.hidden) openLayer('story', closeStory);
  const art = wrap.querySelector('.sheet');
  const title = kind === 'single' ? t.shareTitle.single : kind === 'jar' ? t.shareTitle.jar(MONTHS[payload.month])
    : kind === 'done' ? t.shareTitle.done : kind === 'stamp' ? t.shareTitle.stamp : t.shareTitle.year(payload.year);
  const canShowPlace = kind === 'single' && payload.sky.place;
  // Show place starts off, then keeps whatever you chose last time, on this phone only.
  let placeOn = false;
  try { placeOn = localStorage.getItem('kepfa.showPlace') === '1'; } catch { /* stays off */ }
  const challenge = kind === 'single' ? challengeFor(payload.sky) : null;
  // A single sky's jar holds that month's pile.
  const monthSkies = kind === 'single' ? skiesIn(new Date(payload.sky.takenAt).getFullYear(), new Date(payload.sky.takenAt).getMonth()) : null;
  art.innerHTML = `
    <div class="grabber"></div>
    <div class="sheet-head"><span></span><h2>${title}</h2><button type="button" class="viewer-icon" data-close-story aria-label="${t.close}">${ICON.close}</button></div>
    <div class="story-preview" id="storyPreview"><div class="spinner"></div></div>
    ${canShowPlace ? `<label class="switch"><span>${t.showPlace}</span><input type="checkbox" id="showPlace" ${placeOn ? 'checked' : ''}></label>
      <p class="hint place-note">${t.showPlaceHint}</p>` : ''}
    <div class="sheet-actions">
      <button type="button" class="btn" id="saveStory" disabled>${ICON.save}${t.saveImage}</button>
      <button type="button" class="btn primary" id="shareStory" disabled>${ICON.share}${t.share}</button>
    </div>
    <p class="hint">${t.captionHint}</p>`;
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
      out = await makeStory(kind, { ...payload, showPlace, quote, challenge, monthSkies });
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

  // Every share carries a ready caption with the app's link; challenge skies add their day and hashtags.
  // Copying starts in the same tap as sharing, since both need the gesture.
  const caption = challenge ? t.caption(challenge)
    : kind === 'single' ? t.shareCaption.single(payload.sky.note)
      : kind === 'jar' ? t.shareCaption.jar(MONTHS[payload.month])
        : kind === 'done' ? t.shareCaption.done() : kind === 'stamp' ? t.shareCaption.stamp(payload.name) : t.shareCaption.year(payload.year);
  const copyCaption = () => (navigator.clipboard
    ? navigator.clipboard.writeText(caption).then(() => true, () => false)
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
  $('#showPlace')?.addEventListener('change', (e) => {
    try { localStorage.setItem('kepfa.showPlace', e.target.checked ? '1' : '0'); } catch { /* this time only */ }
    make(e.target.checked);
  });
  make(!!canShowPlace && placeOn);
}

function closeStory() {
  $('#storyModal').hidden = true;
  if (storyUrl) { URL.revokeObjectURL(storyUrl); storyUrl = null; }
  if (cap.hidden && $('#sheet').hidden) document.body.style.overflow = '';
  closeLayer('story');
}

// ---------- sample shelf ----------

// Real skies (photos in assets/sky/), one jar each. `ago` is days back within this month;
// the one 7 days back gives the home screen an "A week ago". `day` places one in last month.
const SAMPLE_SKIES = [
  { file: 'sky-5.jpg', ago: 1, at: [18, 25], note: 'cotton candy hour' },
  { file: 'sky-8.jpg', ago: 3, at: [12, 50], note: 'blue after lunch' },
  { file: 'sky-3.jpg', ago: 5, at: [18, 5], note: 'is that a rainbow in the clouds' },
  { file: 'sky-7.jpg', ago: 7, at: [15, 40], note: 'storm coming' },
  { file: 'sky-4.jpg', ago: 9, at: [16, 40], note: 'the drive home' },
  { file: 'sky-1.jpg', ago: 12, at: [10, 20], note: 'above the clouds' },
  { file: 'sky-6.jpg', day: 26, at: [18, 10], note: 'last light at the beach' },
  { file: 'sky-2.jpg', day: 12, at: [7, 40], note: 'woke up to this' },
];
const SEED_KEY = 'skyjar.seeded';
const SEED_VERSION = '3';

async function seedSamples(onProgress) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const plan = SAMPLE_SKIES.map((s, i) => {
    let takenAt = s.day
      ? new Date(y, m - 1, s.day, ...s.at).getTime()
      : new Date(y, m, Math.max(1, now.getDate() - s.ago), ...s.at).getTime();
    // Early in the month several land on the 1st; none may be later than now.
    if (takenAt > now.getTime()) takenAt = now.getTime() - (i + 1) * 3600e3;
    return { ...s, takenAt };
  });

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const prep = await prepareImage(await (await fetch(`assets/sky/${p.file}`)).blob());
    const sky = {
      id: newId(), takenAt: p.takenAt, note: p.note, place: '', prompt: '',
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
  bindShutter();
  $('#camFlip').addEventListener('click', flipCamera);
  $('#fileLibrary').addEventListener('change', picked);
  $('#fileCamera').addEventListener('change', picked);
  $('#frameAnother').addEventListener('click', () => $('#fileLibrary').click());
  $('#frameUse').addEventListener('click', useFrame);
  bindFrameGestures();
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
    else if (!$('#installSheet').hidden) closeInstallSheet();
    else if (!$('#letter').hidden) closeLetter();
    else if (!$('#celebrate').hidden) closeCelebration();
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
      if (frame.url && !cap.querySelector('.frame').hidden) layoutFrame(false);
    }, 120);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.redraw?.());
  // The month jar's pile rolls the way the phone leans (portrait: gamma is left-right, beta is upright-flat).
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma != null && !reduceMotion()) state.live?.tilt(e.gamma, e.beta);
  });
  window.addEventListener('hashchange', render);
  // Month | Year and the month arrows swap the page in place instead of stacking history.
  view.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-replace]');
    if (!a) return;
    e.preventDefault();
    location.replace(a.getAttribute('href'));
  });
  // On a month's page, a sideways swipe turns to the month before or after; taps and scrolling go through.
  let sx = 0, sy = 0;
  view.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  view.addEventListener('touchend', (e) => {
    const nav = state.monthNav, p = e.changedTouches[0];
    if (!nav || !p) return;
    const dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const to = dx < 0 ? nav.next : nav.prev;
    if (to) location.replace(to);
  });
  setInterval(() => { const el = $('#sunLine'); if (el) el.textContent = sunLine(); }, 60000);
}

async function init() {
  // LINE opens a page in the phone's own browser when asked to in the address.
  if (IN_APP === 'LINE' && !new URLSearchParams(location.search).has('openExternalBrowser')) {
    const u = new URL(location.href);
    u.searchParams.set('openExternalBrowser', '1');
    location.replace(u.href);
    return;
  }
  bindGlobal();
  view.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t.opening}</p></div>`;

  try {
    await document.fonts.load('30px "Cormorant Garamond"');
  } catch { /* fonts are optional */ }
  // Every jar on screen is drawn from these layers; without them jars fall back to a plain outline.
  try { await loadJar(); } catch { /* outline jars */ }
  state.skies = await store.all();
  checkStamps(state.skies, stampCtx());
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
