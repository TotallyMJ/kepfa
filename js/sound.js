// Small sounds made with WebAudio, so there are no audio files to ship. All of them are optional.

let ctx;
const audio = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function noise(seconds) {
  const a = audio();
  const buf = a.createBuffer(1, Math.round(a.sampleRate * seconds), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Glass "tink". */
export function chime(freqs = [1318, 1976], gap = 0.07) {
  try {
    const a = audio();
    const t0 = a.currentTime;
    freqs.forEach((f, i) => {
      const at = t0 + i * gap;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.18, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
      o.connect(g).connect(a.destination);
      o.start(at);
      o.stop(at + 0.65);
    });
  } catch { /* sound is optional */ }
}

/** Short air sweep: falling pitch going into the jar, rising coming out. */
export function whoosh(up = false) {
  try {
    const a = audio();
    const t = a.currentTime;
    const src = noise(0.4);
    const f = a.createBiquadFilter();
    const g = a.createGain();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(up ? 500 : 1800, t);
    f.frequency.exponentialRampToValueAtTime(up ? 1800 : 500, t + 0.35);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
    src.stop(t + 0.4);
  } catch { /* sound is optional */ }
}

/** The lid's single "click" on the thread. */
export function click() {
  try {
    const a = audio();
    const src = noise(0.03);
    const d = src.buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] *= (1 - i / d.length) ** 6;
    const f = a.createBiquadFilter();
    const g = a.createGain();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    g.gain.value = 0.5;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  } catch { /* sound is optional */ }
}
