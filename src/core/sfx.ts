type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Tiny WebAudio blip synth - zero audio assets required.
 * Every effect is one or two oscillator notes.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const w = window as WindowWithWebkit;
      const Ctor = window.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture so mobile browsers unlock audio. */
  unlock(): void {
    this.ensure();
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'square',
    gain = 0.045,
    slideTo?: number,
    delay = 0,
  ): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(dur: number, gain = 0.05, freq = 900): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, Math.max(1, frames), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start();
  }

  jump(): void {
    this.tone(420, 0.16, 'square', 0.04, 760);
  }

  doubleJump(): void {
    this.tone(560, 0.16, 'triangle', 0.045, 980);
  }

  dash(): void {
    this.noise(0.22, 0.05, 1400);
    this.tone(180, 0.2, 'sawtooth', 0.03, 520);
  }

  land(): void {
    this.noise(0.09, 0.035, 380);
  }

  coin(combo = 0): void {
    this.tone(880 + Math.min(12, combo) * 45, 0.09, 'square', 0.035);
    this.tone(1320 + Math.min(12, combo) * 45, 0.09, 'square', 0.025, undefined, 0.06);
  }

  power(): void {
    this.tone(520, 0.1, 'triangle', 0.045, 1040);
    this.tone(1040, 0.16, 'triangle', 0.035, 1560, 0.09);
  }

  nearMiss(): void {
    this.tone(1400, 0.06, 'sine', 0.03, 2200);
  }

  hit(): void {
    this.noise(0.3, 0.07, 220);
    this.tone(220, 0.3, 'sawtooth', 0.05, 60);
  }

  phase(): void {
    this.tone(660, 0.12, 'square', 0.04);
    this.tone(880, 0.12, 'square', 0.04, undefined, 0.11);
    this.tone(1320, 0.22, 'square', 0.035, undefined, 0.22);
  }

  gameOver(): void {
    this.tone(392, 0.2, 'triangle', 0.05, 330);
    this.tone(294, 0.25, 'triangle', 0.05, 220, 0.18);
    this.tone(196, 0.5, 'triangle', 0.05, 120, 0.4);
  }

  ui(): void {
    this.tone(700, 0.06, 'square', 0.03, 900);
  }
}
