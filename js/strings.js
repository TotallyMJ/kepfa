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
  // Prompt days are keyed 'YYYY-MM-DD'.
  dayShort: (key) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; },
  dayLong: (key) => { const [y, m, d] = key.split('-').map(Number); return `${d} ${MONTHS_SHORT[m - 1]} ${y}`; },
  // One hashtag per day, written so people can read it: #Kepfa24Oct.
  dayTag: (key) => { const [, m, d] = key.split('-').map(Number); return `Kepfa${d}${MONTHS_SHORT[m - 1]}`; },
};

const skies = (n) => (n === 1 ? 'sky' : 'skies');

export const CHALLENGE_TAG = 'kepfachallenge';
export const CHALLENGE_SIZE = 30;
const SITE = 'totallymj.github.io/kepfa';

// One prompt a day, the same for everyone. Each works in any weather; 30 so a month goes by before one comes back.
export const PROMPTS = [
  'The sky from your window.', 'The first sky you see today.', 'The sky on your way somewhere.',
  'The sky over lunch.', 'The sky through the trees.', 'The sky above your home.',
  'The sky between two buildings.', 'The sky straight above you.', 'The sky behind someone you love.',
  'The sky from where you sit right now.', 'The sky just before you sleep.', 'The sky at exactly noon.',
  'The sky reflected in something.', 'The sky over the street you know best.', 'The sky through a window frame.',
  'The sky from somewhere you’ve never stood.', 'The sky with a wire or a pole in it.', 'The sky over water, any water.',
  'The sky outside your favorite café.', 'The sky from the bus or train.', 'The sky that made you stop.',
  'The sky behind a plant.', 'The sky from the lowest spot you can find.', 'The sky from the highest spot you can reach.',
  'The sky as the lights come on.', 'The sky over your work or school.', 'The sky with your hand in it.',
  'The color of the sky right now.', 'The sky someone else is looking at too.', 'The last sky of your day.',
];

// Written for Kepfa; one is drawn at random per share, without repeats until all 30 are used.
export const QUOTES = [
  'Some people collect stamps. We collect skies.', 'The sky is free. Keep a little.',
  'Be the kind of person who looks up.', 'Everyone gets the sky. Collectors keep it.',
  'One sky a day keeps the scroll away.', 'Today’s sky won’t happen twice.',
  'Look up. It’s still there.', 'A jar of sky, no lid on the wonder.',
  'Proof I looked up today.', 'The ceiling of the world, kept.',
  'Collected, not scrolled.', 'This one was too good to scroll past.',
  'Skies, kept like letters.', 'Same sky, different day, kept.',
  'Notes from above.', 'Five seconds of looking up, kept for good.',
  'Pocket-sized sky.', 'The sky did something today.',
  'Come collect skies with me.', 'Small sky, big feeling.',
  'Weather report: worth keeping.', 'I stopped walking for this one.',
  'Sky collectors know where to look.', 'Kept before it changed its mind.',
  'Every jar is a different day.', 'Proof the sky shows off.',
  'Slow down. Look up. Keep it.', 'Today, in one jar.',
  'The view was free. The memory is mine.', 'Start a shelf of skies.',
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

  lookFor: 'Today, look for',
  sameSky: 'Wherever you are today, we’re all under the same sky.',
  seeTag: (tag) => `See #${tag} ↗`,
  lookUp: 'Look up',
  challenge: (round) => (round > 1 ? `${CHALLENGE_SIZE} skies · round ${round}` : `${CHALLENGE_SIZE} skies`),
  keptForToday: 'Kept for today',
  keepSky: 'Keep a sky',
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
  note: 'Tell this sky something',
  place: 'Where',
  taken: 'When',
  notePrompts: ['you made my whole day', 'thanks for waiting for me', 'same time tomorrow?', 'you look like peach soda', 'stay a little longer'],
  placeHint: 'Bangkok',
  retake: 'Retake',
  keep: 'Keep',
  reading: 'Reading the colors…',
  cantOpen: 'That photo couldn’t be opened. Try another one.',
  chooseAnother: 'Choose another photo',
  saveFailed: 'Couldn’t save. Try again.',
  keptDone: 'Kept.',
  seeShelf: 'See shelf',

  putBack: 'Put it back',
  edit: 'Edit',
  editTitle: 'Edit sky',
  save: 'Save',
  deleteSky: 'Delete',
  deleted: 'Sky deleted',
  undo: 'Undo',
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
  captionHint: 'A caption with the hashtags is copied for you. Paste it in your post.',
  captionCopied: 'Caption copied. Paste it in your post.',
  caption: ({ text, day, kept, tag }) =>
    `${text}\n${day} · ${kept} of ${CHALLENGE_SIZE} skies kept.\nYour turn: ${SITE}\n#${CHALLENGE_TAG} #${tag}`,

  footer: 'kepfa · start your own collection',
  storyKept: (y, n) => `${y} · ${n} ${skies(n)} kept`,
  stripCaption: 'Every sky you kept, in order',
};
