export type ArcadeCue = 'jump' | 'double-jump' | 'slide' | 'coin' | 'negative'
  | 'power' | 'rush' | 'damage' | 'shield' | 'ui' | 'victory' | 'game-over';

const SAMPLE_RATE = 22050;
type Note = [frequency: number, start: number, duration: number, level: number, endFrequency?: number];

function tone(data: Float32Array, [frequency, start, duration, level, endFrequency = frequency]: Note,
  bright = false, wrap = false): void {
  const frames = Math.floor(duration * SAMPLE_RATE);
  const offset = Math.floor(start * SAMPLE_RATE);
  for (let i = 0; i < frames; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (frequency * t + (endFrequency - frequency) * t * t / (2 * duration));
    const envelope = Math.min(1, t / 0.006) * Math.pow(1 - i / frames, 2);
    const wave = Math.sin(phase) + (bright ? 0.25 * Math.sin(phase * 2) : 0);
    const index = wrap ? (offset + i) % data.length : offset + i;
    if (index < data.length) data[index] += wave * envelope * level;
  }
}

function noise(data: Float32Array, start: number, duration: number, level: number): void {
  let seed = 0x714a19;
  const frames = Math.floor(duration * SAMPLE_RATE);
  const offset = Math.floor(start * SAMPLE_RATE);
  let previous = 0;
  for (let i = 0; i < frames && offset + i < data.length; i++) {
    // Local deterministic noise must never consume the gameplay RNG.
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const sample = seed / 2147483648 - 1;
    const highPass = sample - previous;
    previous = sample;
    data[offset + i] += highPass * level * Math.min(1, i / 80) * Math.pow(1 - i / frames, 3);
  }
}

function buffer(context: AudioContext, duration: number): AudioBuffer {
  return context.createBuffer(1, Math.round(duration * SAMPLE_RATE), SAMPLE_RATE);
}

/** Original eight-bar F# minor loop, rendered once rather than scheduling notes every frame. */
export function createArcadeMusic(context: AudioContext): AudioBuffer {
  const beat = 60 / 132;
  const result = buffer(context, 32 * beat);
  const data = result.getChannelData(0);
  const roots = [92.499, 73.416, 110, 82.407];
  const intervals = [1, 2, 1.5, 2.378414, 2, 1.5, 2.996614, 2];
  for (let bar = 0; bar < 8; bar++) {
    const root = roots[Math.floor(bar / 2)];
    for (let step = 0; step < 16; step++) {
      const start = (bar * 4 + step / 4) * beat;
      noise(data, start, 0.045, step % 2 ? 0.035 : 0.018);
      if (step % 4 === 0) tone(data, [125, start, 0.19, 0.45, 42]);
      if (step === 4 || step === 12) {
        noise(data, start, 0.12, 0.095);
        tone(data, [185, start, 0.09, 0.10, 120]);
      }
      if (step % 2 === 0) {
        const interval = step === 6 && bar >= 2 ? 2.519842 : intervals[step / 2];
        tone(data, [root, start, beat * 0.42, 0.22], true, true);
        tone(data, [root * 4 * interval, start + beat / 8, beat * 0.7, 0.065], true, true);
      }
    }
  }
  return result;
}

export function createArcadeEffects(context: AudioContext): Map<ArcadeCue, AudioBuffer> {
  const notes: Record<ArcadeCue, Note[]> = {
    jump: [[420, 0, 0.15, 0.4, 760]],
    'double-jump': [[650, 0, 0.17, 0.4, 1100], [1300, 0.025, 0.09, 0.1, 1800]],
    slide: [[220, 0, 0.18, 0.12, 80]],
    coin: [[1047, 0, 0.09, 0.32], [1568, 0.055, 0.13, 0.24]],
    negative: [[180, 0, 0.13, 0.36, 95], [120, 0.09, 0.14, 0.22, 70]],
    power: [[520, 0, 0.13, 0.32, 1040], [1040, 0.09, 0.17, 0.3, 1560], [2080, 0.19, 0.12, 0.16]],
    rush: [[660, 0, 0.18, 0.35], [880, 0.10, 0.18, 0.35], [1320, 0.20, 0.3, 0.36], [1760, 0.20, 0.3, 0.14]],
    damage: [[160, 0, 0.24, 0.42, 45]],
    shield: [[1700, 0, 0.10, 0.24, 900], [2300, 0, 0.17, 0.17, 1500], [880, 0.06, 0.2, 0.25]],
    ui: [[700, 0, 0.045, 0.13, 900]],
    victory: [[440, 0, 0.18, 0.3], [554.365, 0.14, 0.18, 0.3], [659.255, 0.28, 0.2, 0.3],
      [880, 0.45, 0.65, 0.32], [554.365, 0.45, 0.65, 0.15], [659.255, 0.45, 0.65, 0.15]],
    'game-over': [[392, 0, 0.2, 0.3, 330], [294, 0.18, 0.25, 0.3, 220], [196, 0.4, 0.45, 0.3, 120]],
  };
  const effects = new Map<ArcadeCue, AudioBuffer>();
  for (const cue of Object.keys(notes) as ArcadeCue[]) {
    const duration = Math.max(...notes[cue].map(note => note[1] + note[2])) + 0.01;
    const result = buffer(context, duration);
    const data = result.getChannelData(0);
    for (const note of notes[cue]) tone(data, note, true);
    if (cue === 'slide') noise(data, 0, 0.18, 0.16);
    if (cue === 'damage') noise(data, 0, 0.15, 0.12);
    effects.set(cue, result);
  }
  return effects;
}
