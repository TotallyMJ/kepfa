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
  'Look up. It’s still there.', 'A little sky, kept with the lid on.',
  'Proof I looked up today.', 'Kept: one piece of today’s sky.',
  'Collected, not scrolled.', 'This one was too good to scroll past.',
  'Skies, kept like letters.', 'Same sky, different day, kept.',
  'Notes from above.', 'Five seconds of looking up, kept for good.',
  'Pocket-sized sky.', 'The sky did something today.',
  'Come collect skies with me.', 'Small sky, big feeling.',
  'Weather report: worth keeping.', 'I stopped walking for this one.',
  'Sky collectors know where to look.', 'Kept before it changed its mind.',
  'Every jar is a different day.', 'Proof the sky shows off.',
  'Slow down. Look up. Keep it.', 'Today, in one jar.',
  'The view was free. The memory is mine.', 'Start a jar of skies.',
];

export const t = {
  kept: (n) => `${skies(n)} kept`,
  mySkies: 'My Skies',
  seeMonths: 'See every month ›',
  monthEmpty: (month) => `Your first ${month} sky is still out there.`,

  sunriseIn: (time, dur) => `Sunrise ${time} · in ${dur}`,
  goldenNowUntil: (time) => `Golden hour now · until ${time}`,
  goldenIn: (time, dur) => `Golden hour ${time} · in ${dur}`,
  goldenNowSunset: (time) => `Golden hour now · sunset ${time}`,
  sunriseTomorrow: (time) => `Sunrise ${time} · tomorrow`,
  notHere: 'not here?',
  nearYou: 'near you',
  yourZone: 'your time zone',
  useLocation: 'Use my location for sun times',
  locationDenied: (city) => `Location is off. Sun times stay set to ${city}.`,

  lookFor: 'Look for',
  sameSky: 'Wherever you are today, we’re all under the same sky.',
  seeWho: 'See who caught it ↗',
  lookUp: 'Catch today’s sky',
  challengeBadge: 'Daily sky challenge',
  challenge: (round) => (round > 1 ? `Your ${CHALLENGE_SIZE}-day challenge · round ${round}` : `Your ${CHALLENGE_SIZE}-day challenge`),
  challengeCount: (n) => `${n} of ${CHALLENGE_SIZE} days`,
  keptForToday: 'Count it for today’s challenge',
  yearAgo: 'A year ago',
  monthAgo: 'A month ago',
  weekAgo: 'A week ago',
  opening: 'Opening your jars…',
  preparing: (i, n) => `Filling a few sample jars… ${i}/${n}`,
  notPersistent: 'This browser won’t keep your skies after you close the tab.',

  sampleBanner: 'These skies are samples. Clear them and start your own.',
  clearSamples: 'Clear samples',
  samplesCleared: 'All clear. Your first sky is out there.',
  emptyTitle: 'No skies yet',
  emptyBody: 'Tap the camera, frame the sky in the jar, keep it.',
  openSky: (when) => `Open the sky from ${when}`,

  months: 'Months',
  prevYear: 'Previous year',
  nextYear: 'Next year',
  monthJar: (name, n) => `${name}, ${n} ${skies(n)}`,
  backToMonths: 'Months',
  tapLayer: 'Tap a sky to open it',
  tiltToPlay: 'Tilt to play',
  emptyMonthTitle: 'This jar is empty',
  emptyMonthBody: 'The first sky of the month is still out there.',
  shake: 'Shake for a memory',
  shareYear: 'Share my year in skies',
  shareMonth: (month) => `Share ${month}’s jar`,
  daysOf: (days) => `of ${days} days`,
  favoriteTime: 'favorite time',
  monthColor: 'color of the month',
  thisMonth: 'Every sky this month',

  newSky: 'New sky',
  cancel: 'Cancel',
  note: 'Tell this sky something',
  place: 'Where',
  keptAt: (stamp) => `Kept ${stamp}`,
  notePrompts: [
    'you made my whole day', 'thanks for waiting for me', 'same time tomorrow?', 'you look like peach soda',
    'stay a little longer', 'you were worth the stop', 'pov: i forgot my phone was in my hand', 'the bus can wait',
    'you again, my favorite', 'who painted you today?', 'saving you for a bad day', 'this one’s for mom',
  ],
  placeHint: 'rooftop, bus stop, home…',
  takenFrom: (stamp) => `Taken ${stamp} · from your photos`,
  otherDay: (when) => `Goes into ${when}. Only skies taken today count for the challenge.`,
  whenTaken: 'When was this?',
  noDate: 'This photo didn’t say when it was taken.',
  retake: 'Retake',
  chooseAnother: 'Choose another',
  closeLid: 'Close the lid',
  reading: 'Reading the colors…',
  cantOpen: 'That photo couldn’t be opened. Try again.',
  tryAgain: 'Try again',
  saveFailed: 'Couldn’t save. Try again.',
  keptDone: 'Kept.',
  seeMySkies: 'See my skies',

  closeJar: 'Close the jar',
  more: 'More',
  skyOf: (i, n) => `${i} / ${n}`,
  swipeHint: '‹  Swipe for other skies  ›',
  shareSky: 'Share this sky',
  editNote: 'Edit the note',
  writeOn: 'Write on this one',
  addPlace: 'Add a place',
  done: 'Done',
  noteSaved: 'Saved',
  deleteSky: 'Delete this sky',
  deleteTitle: 'Delete this sky?',
  deleteBody: 'It only lives on this phone. Once it’s gone, it’s gone.',
  keepIt: 'Keep it',
  deleteYes: 'Delete',
  deleted: 'Sky deleted',
  holdHint: 'Hold a jar to delete it',

  shareTitle: { single: 'Share this sky', jar: (m) => `Share ${m}’s jar`, year: () => 'Share my year in skies' },
  showPlace: 'Show place',
  showPlaceHint: 'Stays the way you last set it. No GPS ever leaves with the image.',
  close: 'Close',
  storyTip: 'Tap Share to post it anywhere, or save it to Photos.',
  saveImage: 'Save image',
  share: 'Share',
  saved: 'Image saved',
  sharedFallback: 'This device can’t share directly, so the image was saved.',
  storyFailed: 'Couldn’t make the image. Close this and try again.',
  captionHint: 'We’ll copy a caption with the hashtags. Just paste.',
  captionCopied: 'Caption copied. Paste it wherever you post.',
  caption: ({ text, day, kept, tag }) =>
    `${text}\n${day} · day ${kept} of my ${CHALLENGE_SIZE}-day sky challenge.\nYour turn: ${SITE}\n#${CHALLENGE_TAG} #${tag}`,

  footerLine: 'Start your own sky collection',
  issueLine: (month, year) => `Issue · ${month} ${year}`,
  issueNo: (n) => `No. ${n}`,
  ticketLine: (day) => `Sky homework, day ${day}. Handed in.`,
  volume: (year) => `Vol. ${year}`,
  keptRing: (month, year) => `KEPT · ${month.toUpperCase()} · ${year} · KEPFA · `,
  keptWord: 'KEPT',
  storyKept: (y, n) => `${y} · ${n} ${skies(n)} kept`,
  stripCaption: 'Every sky you kept, in order',
};
