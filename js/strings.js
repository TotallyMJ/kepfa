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
};

const skies = (n) => (n === 1 ? 'sky' : 'skies');

export const t = {
  tagline: 'Keep the sky.',
  vol: (y) => `Vol. ${y}`,
  kept: (n) => `${skies(n)} kept`,
  opening: 'Opening your shelf…',
  preparing: (i, n) => `Setting up a sample shelf… ${i}/${n}`,
  notPersistent: 'This browser won’t keep your skies after you close the tab.',

  sampleBanner: 'These are sample skies. Clear them when you’re ready to keep your own.',
  clearSamples: 'Clear samples',
  samplesCleared: 'Samples cleared. Go keep your first sky.',
  emptyTitle: 'Your shelf is empty',
  emptyBody: 'Hold a bottle up to the sky and cork what you see.',
  keepFirst: 'Keep your first sky',
  openSky: (when) => `Open the sky from ${when}`,

  months: 'Months',
  prevYear: 'Previous year',
  nextYear: 'Next year',
  monthBottle: (name, n) => `${name}, ${n} ${skies(n)}`,
  backToMonths: 'Months',
  issue: (m) => `No. ${m}`,
  tapLayer: 'Tap a layer to open that day’s sky',
  emptyMonthTitle: 'This bottle is empty',
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
  corkIt: 'Cork it',
  reading: 'Reading the colors…',
  cantOpen: 'That photo couldn’t be opened. Try another one.',
  chooseAnother: 'Choose another photo',
  saveFailed: 'Couldn’t save. Try again.',
  corked: 'Corked',
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
