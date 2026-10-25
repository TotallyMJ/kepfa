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
const SITE = 'kepfa.vibethebloom.com';

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

// A theme for each month (by month index), so a month's shelf tells one story. Prompts go in date order:
// the 1st gets the first one. Each stays easy: a phone, yourself or what you carry, any weather.
// Months without a theme use PROMPTS. Themes start in November 2026 (THEMES_FROM).
export const THEMES_FROM = { year: 2026, month: 10 };
export const THEMES = {
  10: {
    name: 'Me & the sky',
    prompts: [
      'The sky through your fingers.', 'Your hand reaching for the sky.', 'Your shadow and a bit of sky.',
      'The sky above your shoes.', 'The sky resting in your palm.', 'The sky over your shoulder.',
      'Your silhouette against a bright sky.', 'The sky in your sunglasses or a window.', 'The sky behind your drink.',
      'The sky over your lunch.', 'Your thumbs-up against the sky.', 'The sky framed by your two hands.',
      'The sky from flat on your back.', 'The sky above your front door.', 'Your finger pointing at the sky.',
      'The sky with your sleeve in it.', 'The sky behind your keys.', 'The sky from your usual seat.',
      'The sky as you step outside.', 'The sky on your way home.', 'The sky with your bag in the shot.',
      'The sky as you look back over your shoulder.', 'The sky through a circle of your fingers.', 'The sky with your favorite color in the shot.',
      'The sky you’d send to a friend right now.', 'Your reflection, with the sky in the window.', 'The sky straight above your head.',
      'Your hand on a wall, with the sky above.', 'The first sky you see today, with you in it.', 'The sky from your bed or sofa, through a window.',
    ],
  },
  11: {
    name: 'Lights & sky',
    prompts: [
      'The sky as the streetlights come on.', 'A lit window against the evening sky.', 'The sky with a lamp in the shot.',
      'The sky over a lit-up sign.', 'Sunlight through a curtain.', 'The brightest spot in today’s sky.',
      'Car lights under the evening sky.', 'The sky with any string of lights.', 'The sky through a glowing window.',
      'Your phone light held up to the night sky.', 'The sky over a lit bridge or road.', 'The sky over a lit shop.',
      'The moon, or where it should be.', 'The day’s last light.', 'The day’s first light.',
      'Sunlight on your hand, sky above.', 'A light by the window, the sky outside.', 'The sky lit by the city at night.',
      'The brightest cloud you can find.', 'The sky beside a traffic light.', 'Light through leaves, sky behind.',
      'The sky above a lit doorway.', 'The sky through a glass of water.', 'The sky with a plane light or a star in it.',
      'The sky above anything lit up for the holidays.', 'The bluest moment after sunset.', 'The sky with a glowing screen in the corner.',
      'The sky over a lamp post.', 'The sun peeking past something.', 'The sky as the lights go off in the morning.',
      'The last light of the year.',
    ],
  },
};

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
  thisWeek: 'This week',
  weekEmpty: 'Nothing kept this week yet.',
  monthsJar: (month) => `${month}’s jar ›`,
  jarsView: 'Jars view',
  viewMonth: 'Month',
  viewYear: 'Year',
  otherMonths: 'Other months',
  madeBy: 'Made by',
  maker: 'Vibe the Bloom',

  sunriseIn: (time, dur) => `Sunrise ${time} · in ${dur}`,
  goldenNowUntil: (time) => `Golden hour now · until ${time}`,
  goldenIn: (time, dur) => `Golden hour ${time} · in ${dur}`,
  goldenNowSunset: (time) => `Golden hour now · sunset ${time}`,
  sunriseTomorrow: (time) => `Sunrise ${time} · tomorrow`,
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

  inAppTitle: (app) => `You’re in ${app}’s browser.`,
  inAppIos: 'Open Kepfa in Safari to use the camera and keep your skies. Tap ⋯, then open in your browser.',
  inAppAndroid: 'Open Kepfa in Chrome to use the camera and keep your skies.',
  copyLink: 'Copy link',
  openChrome: 'Open in Chrome ↗',
  linkCopied: 'Link copied. Paste it into your browser.',
  sampleBanner: 'These skies are samples. Clear them and start your own.',
  clearSamples: 'Clear samples',
  samplesCleared: 'All clear. Your first sky is out there.',
  emptyTitle: 'No skies yet',
  emptyBody: 'Tap the camera, frame the sky in the jar, keep it.',
  openSky: (when) => `Open the sky from ${when}`,

  // The Months page heading, magazine style: the second half set in italics.
  monthsTitle: ['A year', 'of skies'],
  prevYear: 'Previous year',
  nextYear: 'Next year',
  monthJar: (name, n) => `${name}, ${n} ${skies(n)}`,
  tapLayer: 'Tap a sky to open it',
  tiltToPlay: 'Tilt to play',
  emptyMonthTitle: 'This jar is empty',
  emptyMonthBody: 'The first sky of the month is still out there.',
  shake: 'Shake for a memory',
  shareYear: 'Share my year in skies',
  shareMonth: (month) => `Share ${month}’s jar`,
  statDays: 'days',
  skyOclock: 'sky o’clock',
  statColors: 'colors',
  dayParts: { dawn: 'Dawn', morning: 'Morning', midday: 'Midday', afternoon: 'Afternoon', sunset: 'Sunset', night: 'Night' },
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
  skyOf: (i, n) => `${i} / ${n}`,
  live: 'LIVE',
  recording: (s) => `Recording · 0:0${s} of 0:03`,
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

  doneKicker: (round) => `Your ${CHALLENGE_SIZE}-day sky challenge · Round ${round}`,
  doneTitle: [`${CHALLENGE_SIZE} days.`, `${CHALLENGE_SIZE} skies.`],
  doneLine: 'You looked up every single day.',
  doneRange: (from, to) => `${from} to ${to}`,
  doneStamp: `${CHALLENGE_SIZE} DAYS · ${CHALLENGE_SIZE} SKIES · KEPFA · DONE · `,
  doneWord: 'DONE',
  doneShare: `Share my ${CHALLENGE_SIZE} days`,
  nextRound: (round) => `Start round ${round}`,
  deleteYes: 'Delete',
  deleted: 'Sky deleted',
  holdHint: 'Hold a jar to delete it',

  shareTitle: { single: 'Share this sky', jar: (m) => `Share ${m}’s jar`, year: () => 'Share my year in skies', done: `Share my ${CHALLENGE_SIZE} days` },
  showPlace: 'Show place',
  showPlaceHint: 'Stays the way you last set it. No GPS ever leaves with the image.',
  close: 'Close',
  saveImage: 'Save image',
  share: 'Share',
  saved: 'Image saved',
  sharedFallback: 'This device can’t share directly, so the image was saved.',
  storyFailed: 'Couldn’t make the image. Close this and try again.',
  captionHint: 'We’ll copy a caption with the link. Just paste.',
  captionCopied: 'Caption copied. Paste it wherever you post.',
  caption: ({ text, day, kept, tag }) =>
    `${text}\n${day} · day ${kept} of my ${CHALLENGE_SIZE}-day sky challenge on Kepfa.\nYour turn: ${SITE}\n#${CHALLENGE_TAG} #${tag} #kepfa`,
  // Every other share gets a caption too, so whoever sees it can find the app.
  shareCaption: {
    single: (note) => `${note ? `“${note}”\n` : ''}Kept in a jar with Kepfa.\nStart your own: ${SITE}\n#kepfa`,
    jar: (month) => `My ${month} in skies, kept with Kepfa.\nStart your own: ${SITE}\n#kepfa`,
    year: (year) => `My ${year} in skies, kept with Kepfa.\nStart your own: ${SITE}\n#kepfa`,
    done: () => `${CHALLENGE_SIZE} days, ${CHALLENGE_SIZE} skies. I finished the Kepfa sky challenge.\nYour turn: ${SITE}\n#${CHALLENGE_TAG} #kepfa`,
  },

  // Every image that leaves the app says where it came from and where to go.
  footerLine: 'Keep the sky in a jar',
  site: SITE,
  issueLine: (n, month, year) => `No. ${n} · ${month} ${year}`,
  ticketLine: (day) => `Sky homework, day ${day}. Handed in.`,
  volume: (year) => `Vol. ${year}`,
  keptRing: (month, year) => `KEPT · ${month.toUpperCase()} · ${year} · KEPFA · `,
  keptWord: 'KEPT',
  keptInJar: ['my sky,', 'kept in here'],
  storyKept: (y, n) => `${y} · ${n} ${skies(n)} kept`,
  stripCaption: 'Every sky you kept, in order',
};
