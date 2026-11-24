// Sounds are synthesised with Web Audio: no audio files to download or precache.
// On by default; the choice is a per-device convenience, so it lives in localStorage.

const KEY = 'sound';
let ctx: AudioContext | undefined;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch { /* private mode: just won't be remembered */ }
}

function audio(): AudioContext | undefined {
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return undefined;
  }
}

type Tone = { freq: number; at?: number; dur?: number; type?: OscillatorType; gain?: number; slide?: number };

function play(c: AudioContext, { freq, at = 0, dur = 0.12, type = 'sine', gain = 0.12, slide }: Tone) {
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const note = (semitones: number) => 523.25 * 2 ** (semitones / 12); // from C5
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

/** A set ticked: each set in a row climbs the scale, so a full rope sounds like a run up. */
export function tickSound(setIndex: number) {
  const c = audio();
  if (!c) return;
  const f = note(PENTATONIC[setIndex % PENTATONIC.length]);
  play(c, { freq: f, dur: 0.09, type: 'triangle', gain: 0.16 });
  play(c, { freq: f * 2, at: 0.015, dur: 0.06, gain: 0.04 });
}

export function untickSound() {
  const c = audio();
  if (c) play(c, { freq: 330, dur: 0.08, type: 'triangle', gain: 0.08, slide: 220 });
}

/** Day complete: a bright arpeggio. */
export function chimeSound() {
  const c = audio();
  if (!c) return;
  [0, 4, 7, 12].forEach((s, i) => play(c, { freq: note(s), at: i * 0.07, dur: 0.35, type: 'triangle', gain: 0.12 }));
  play(c, { freq: note(24), at: 0.3, dur: 0.5, gain: 0.05 });
}

/** Level-up / badge / perfect week / test day: a bigger fanfare. */
export function fanfareSound() {
  const c = audio();
  if (!c) return;
  [0, 7, 12].forEach((s) => play(c, { freq: note(s - 12), dur: 0.9, type: 'sawtooth', gain: 0.03 }));
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => play(c, { freq: note(s), at: 0.08 + i * 0.06, dur: 0.4, type: 'triangle', gain: 0.1 }));
  [0, 1, 2, 3, 4].forEach((i) => play(c, { freq: note(31 + (i % 2) * 5), at: 0.55 + i * 0.09, dur: 0.18, gain: 0.04 }));
}
