// All user-facing copy lives here, so a second language is one more object instead of a hunt through the code.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

const pad2 = (n) => String(n).padStart(2, '0');
const hm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const fmt = {
  shelf: (ms) => { const d = new Date(ms); return [`${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`, hm(d)]; },
  long: (ms) => { const d = new Date(ms); return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hm(d)}`; },
  stamp: (ms) => { const d = new Date(ms); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} · ${hm(d)}`; },
  minutes: (m) => `${pad2(Math.floor(m / 60))}:${pad2(Math.round(m % 60))}`,
  time: (d) => hm(d),
  duration: (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}:${pad2(m % 60)}`; },
  issueDate: (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
};

const skies = (n) => (n === 1 ? 'sky' : 'skies');

export const PROMPTS = [
  'The sky after rain', 'From your window', 'The first sky of the day', 'Above your commute',
  'The sky over lunch', 'A sky with birds in it', 'Through the trees', 'The sky behind your home',
  'A sky with the moon out', 'The bluest sky this week', 'The sky at your favorite café', 'Clouds that look like something',
  'The last light', 'A sky reflected in something', 'The sky from somewhere new', 'Straight up, no buildings',
  'The sky with someone you love', 'A grey sky worth keeping', 'The sky before a storm', 'The sky right after sunset',
];

export const t = {
  kept: (n) => `${skies(n)} kept`,
  shelf: 'Shelf',

  sunriseIn: (time, dur) => `Sunrise ${time} · in ${dur}`,
  goldenNowUntil: (time) => `Golden hour now · until ${time}`,
  goldenIn: (time, dur) => `Golden hour ${time} · in ${dur}`,
  goldenNowSunset: (time) => `Golden hour now · sunset ${time}`,
  sunriseTomorrow: (time) => `Sunrise ${time} · tomorrow`,
  defaultPlace: 'Bangkok',
  herePlace: 'Here',
  useLocation: 'Use my location for sun times',
  locationDenied: 'Location is off. Sun times stay set to Bangkok.',

  thisWeek: 'This week',
  daysLeft: (n) => (n <= 1 ? 'last day' : `${n} days left`),
  keptForPrompt: (n) => `${n} kept`,
  keepOne: 'Keep one',
  countForPrompt: (p) => `Count it for “${p}”`,
  yearAgo: 'A year ago',
  monthAgo: 'A month ago',
  weekAgo: 'A week ago',
  opening: 'Opening your shelf…',
  preparing: (i, n) => `Setting up a sample shelf… ${i}/${n}`,
  notPersistent: 'This browser won’t keep your skies after you close the tab.',

  sampleBanner: 'These are sample skies. Clear them when you’re ready to keep your own.',
  clearSamples: 'Clear samples',
  samplesCleared: 'Samples cleared. Go keep your first sky.',
  emptyTitle: 'Your shelf is empty',
  emptyBody: 'Look up, frame it in the jar and keep what you see.',
  keepFirst: 'Keep your first sky',
  openSky: (when) => `Open the sky from ${when}`,

  months: 'Months',
  prevYear: 'Previous year',
  nextYear: 'Next year',
  monthJar: (name, n) => `${name}, ${n} ${skies(n)}`,
  backToMonths: 'Months',
  issue: (m) => `No. ${m}`,
  tapLayer: 'Tap a layer to open that day’s sky',
  emptyMonthTitle: 'This jar is empty',
  emptyMonthBody: 'The first sky of the month is still out there.',
  shake: 'Shake',
  shareStory: 'Share to story',
  daysOf: (days) => `of ${days} days`,
  favoriteTime: 'favorite time',
  monthColor: 'color of the month',
  thisMonth: 'This month',

  newSky: 'New sky',
  cancel: 'Cancel',
  colors: 'Colors · tap to copy',
  note: 'Note',
  place: 'Place',
  optional: 'optional',
  taken: 'Taken',
  notePrompts: ['Name this sky', 'What did it remind you of?', 'Where were you headed?', 'Who were you with?'],
  placeHint: 'Bangkok',
  retake: 'Retake',
  keep: 'Keep',
  reading: 'Reading the colors…',
  cantOpen: 'That photo couldn’t be opened. Try another one.',
  chooseAnother: 'Choose another photo',
  saveFailed: 'Couldn’t save. Try again.',
  keptDone: 'Kept.',
  seeShelf: 'See shelf',

  deleteSky: 'Delete',
  deleteConfirm: 'Delete this sky? This can’t be undone.',
  keepIt: 'Keep it',
  deleted: 'Sky deleted',
  copied: (hex) => `Copied ${hex}`,

  shareTitle: { single: 'Share this sky', jar: (m) => `Share ${m}`, year: (y) => `Share ${y}` },
  showPlace: 'Show place',
  showPlaceHint: 'Off by default. Shared images never carry GPS data.',
  storyTip: 'On your phone, tap Share and pick Instagram, then Stories. Not in the list? Save the image and post it from your photos.',
  saveImage: 'Save image',
  share: 'Share',
  saved: 'Image saved',
  sharedFallback: 'This device can’t share directly, so the image was saved.',
  storyFailed: 'Couldn’t make the image. Close this and try again.',

  skyCollection: 'Sky collection',
  footer: 'kepfa · keep the sky',
  storyKept: (y, n) => `${y} · ${n} ${skies(n)} kept`,
  stripCaption: 'Every sky you kept, in order',
};
