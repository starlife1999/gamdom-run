import Phaser from 'phaser';
import { createElement, Volume2, VolumeX } from 'lucide';
import type { PrototypeSnapshot } from '../presentationProfiles';
import { createArcadeEffects, createArcadeMusic, type ArcadeCue } from './arcadeSynth';
import './portraitAudio.css';

const STORAGE_KEY = 'gamdom-run-audio-muted';

/** Portrait-only audio graph sharing Phaser's single AudioContext and master destination. */
export class PortraitAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private effectsGain?: GainNode;
  private filter?: BiquadFilterNode;
  private musicBuffer?: AudioBuffer;
  private silence?: AudioBuffer;
  private wakeSource?: AudioBufferSourceNode;
  private music?: AudioBufferSourceNode;
  private effects = new Map<ArcadeCue, AudioBuffer>();
  private readonly voices = new Set<AudioBufferSourceNode>();
  private readonly lastCue = new Map<ArcadeCue, number>();
  private offset = 0;
  private musicStarted = 0;
  private unlocked = false;
  private muted = false;
  private playing = false;
  private rush = false;
  private ended: PrototypeSnapshot['ended'] = null;
  private hidden = document.hidden;
  private destroyed = false;
  private unavailable = false;
  private runnerEvents?: Phaser.Events.EventEmitter;
  private readonly button = document.querySelector<HTMLButtonElement>('#portrait-sound')!;

  constructor(private readonly game: Phaser.Game) {
    try { this.muted = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { /* Storage can be disabled. */ }
    this.updateButton();
    document.addEventListener('pointerdown', this.unlock, true);
    document.addEventListener('keydown', this.unlock, true);
    document.addEventListener('click', this.click);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('pagehide', this.hide);
    window.addEventListener('pageshow', this.visibility);
    window.addEventListener('blur', this.hide);
    window.addEventListener('focus', this.visibility);
    this.button.addEventListener('click', this.toggleMute);
    game.events.on('portrait-audio-cue', this.cue);
    game.events.on('portrait-audio-state', this.sync);
    game.events.on('portrait-audio-reset', this.reset);
    game.events.on('portrait-audio-stop', this.stop);
    game.events.once('portrait-prototype-ready', this.bindRunner);
    game.events.once(Phaser.Core.Events.DESTROY, this.destroy);
  }

  private readonly bindRunner = (): void => {
    this.runnerEvents = this.game.scene.getScene('Runner').events;
    this.runnerEvents.on(Phaser.Scenes.Events.CREATE, this.reset);
    this.runnerEvents.on(Phaser.Scenes.Events.SHUTDOWN, this.stop);
  };

  private prepare(): boolean {
    if (this.unavailable) return false;
    if (this.context) return true;
    const manager = this.game.sound;
    if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return false;
    try {
      this.context = manager.context;
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.65;
      this.master.connect(manager.destination);
      this.effectsGain = this.context.createGain();
      this.effectsGain.gain.value = 0.45;
      this.effectsGain.connect(this.master);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.13;
      this.filter = this.context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2400;
      this.filter.Q.value = 0.5;
      this.filter.connect(this.musicGain).connect(this.master);
      this.musicBuffer = createArcadeMusic(this.context);
      this.effects = createArcadeEffects(this.context);
      this.silence = this.context.createBuffer(1, 1, this.context.sampleRate);
      this.context.addEventListener('statechange', this.contextState);
      return true;
    } catch {
      this.master?.disconnect();
      this.filter?.disconnect();
      this.musicGain?.disconnect();
      this.effectsGain?.disconnect();
      this.effects.clear();
      this.musicBuffer = undefined;
      this.context = undefined;
      this.unavailable = true;
      return false;
    }
  }

  private readonly unlock = (event: Event): void => {
    if (!event.isTrusted || this.destroyed || !this.prepare()) return;
    this.unlocked = true;
    this.wake();
    // resume() is invoked synchronously inside the genuine gesture, including after iOS interruption.
    void this.context!.resume().then(this.reconcile).catch(() => {});
  };

  private wake(): void {
    if (!this.context || this.context.state === 'running' || this.context.state === 'closed'
      || !this.silence || !this.master || this.wakeSource) return;
    // A started node also primes mobile output after an OS interruption; the buffer is exactly silent.
    const source = this.context.createBufferSource();
    source.buffer = this.silence;
    source.connect(this.master);
    source.onended = () => {
      source.disconnect();
      if (this.wakeSource === source) this.wakeSource = undefined;
    };
    this.wakeSource = source;
    source.start();
  }

  private readonly click = (event: MouseEvent): void => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target || target.disabled || target === this.button) return;
    this.unlock(event);
    this.cue('ui');
  };

  private readonly sync = (snapshot: PrototypeSnapshot, countdownFinished: boolean): void => {
    const playing = countdownFinished && !snapshot.paused && !snapshot.ended
      && snapshot.lives > 0 && snapshot.elapsed < 90;
    const rush = playing && snapshot.cashRush > 0;
    if (rush !== this.rush) {
      this.rush = rush;
      this.intensity();
    }
    if (playing !== this.playing) {
      this.playing = playing;
      if (snapshot.paused && !snapshot.ended) this.stopEffects();
      this.reconcile();
    }
    if (snapshot.ended && snapshot.ended !== this.ended) {
      this.ended = snapshot.ended;
      this.stopEffects();
      this.cue(snapshot.ended === 'run-complete' ? 'victory' : 'game-over');
    }
  };

  private intensity(): void {
    if (!this.context || !this.musicGain || !this.filter) return;
    this.musicGain.gain.setTargetAtTime(this.rush ? 0.19 : 0.13, this.context.currentTime, 0.18);
    this.filter.frequency.setTargetAtTime(this.rush ? 7500 : 2400, this.context.currentTime, 0.18);
  }

  private readonly reconcile = (): void => {
    if (this.destroyed) return;
    if (!this.playing || !this.unlocked || this.muted || this.hidden || this.context?.state !== 'running') {
      this.stopMusic();
      return;
    }
    if (this.music || !this.musicBuffer || !this.filter) return;
    const source = this.context.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(this.filter);
    source.start(0, this.offset);
    this.musicStarted = this.context.currentTime;
    this.music = source;
    this.intensity();
  };

  private stopMusic(): void {
    if (!this.music || !this.context || !this.musicBuffer) return;
    this.offset = (this.offset + Math.max(0, this.context.currentTime - this.musicStarted)) % this.musicBuffer.duration;
    this.music.stop();
    this.music.disconnect();
    this.music = undefined;
  }

  private readonly cue = (cue: ArcadeCue): void => {
    if (!this.context || this.context.state !== 'running' || !this.unlocked || this.muted || this.hidden) return;
    if (cue !== 'ui' && cue !== 'victory' && cue !== 'game-over' && !this.playing) return;
    const buffer = this.effects.get(cue);
    if (!buffer || !this.effectsGain) return;
    const now = this.context.currentTime;
    const cooldown = cue === 'coin' ? 0.075 : cue === 'ui' ? 0.05 : 0.035;
    if (now - (this.lastCue.get(cue) ?? -Infinity) < cooldown) return;
    this.lastCue.set(cue, now);
    if (this.voices.size >= 4) {
      const oldest = this.voices.values().next().value!;
      oldest.stop();
      oldest.disconnect();
      this.voices.delete(oldest);
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.effectsGain);
    source.onended = () => { source.disconnect(); this.voices.delete(source); };
    this.voices.add(source);
    source.start();
  };

  private stopEffects(): void {
    for (const voice of this.voices) {
      voice.stop();
      voice.disconnect();
    }
    this.voices.clear();
  }

  private readonly reset = (): void => {
    this.stop();
    this.offset = 0;
    this.ended = null;
    this.lastCue.clear();
  };

  private readonly stop = (): void => {
    this.playing = false;
    this.rush = false;
    this.stopMusic();
    this.stopEffects();
    this.intensity();
  };

  private readonly hide = (): void => {
    this.hidden = true;
    this.stopMusic();
    this.stopEffects();
  };

  private readonly visibility = (): void => {
    this.hidden = document.hidden;
    if (this.hidden) this.hide();
    else {
      this.reconcile();
      if (this.unlocked && this.context && this.context.state !== 'running' && this.context.state !== 'closed') {
        void this.context.resume().then(this.reconcile).catch(() => {});
      }
    }
  };

  private readonly contextState = (): void => {
    if (this.context?.state !== 'running') this.stopEffects();
    this.reconcile();
  };

  private readonly toggleMute = (): void => {
    this.muted = !this.muted;
    try { localStorage.setItem(STORAGE_KEY, String(this.muted)); } catch { /* Preference remains valid for this page. */ }
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.65, this.context.currentTime, 0.01);
    if (this.muted) this.stopEffects();
    this.reconcile();
    this.updateButton();
  };

  private updateButton(): void {
    const icon = createElement(this.muted ? VolumeX : Volume2);
    icon.setAttribute('width', '22');
    icon.setAttribute('height', '22');
    icon.setAttribute('aria-hidden', 'true');
    this.button.replaceChildren(icon);
    this.button.setAttribute('aria-pressed', String(this.muted));
    this.button.setAttribute('aria-label', this.muted ? 'Unmute sound' : 'Mute sound');
    this.button.title = this.muted ? 'Unmute sound' : 'Mute sound';
  }

  private readonly destroy = (): void => {
    this.destroyed = true;
    this.stop();
    this.wakeSource?.stop();
    this.wakeSource?.disconnect();
    this.wakeSource = undefined;
    this.silence = undefined;
    this.master?.disconnect();
    this.filter?.disconnect();
    this.musicGain?.disconnect();
    this.effectsGain?.disconnect();
    this.context?.removeEventListener('statechange', this.contextState);
    this.effects.clear();
    this.musicBuffer = undefined;
    document.removeEventListener('pointerdown', this.unlock, true);
    document.removeEventListener('keydown', this.unlock, true);
    document.removeEventListener('click', this.click);
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('pagehide', this.hide);
    window.removeEventListener('pageshow', this.visibility);
    window.removeEventListener('blur', this.hide);
    window.removeEventListener('focus', this.visibility);
    this.button.removeEventListener('click', this.toggleMute);
    this.game.events.off('portrait-audio-cue', this.cue);
    this.game.events.off('portrait-audio-state', this.sync);
    this.game.events.off('portrait-audio-reset', this.reset);
    this.game.events.off('portrait-audio-stop', this.stop);
    this.game.events.off('portrait-prototype-ready', this.bindRunner);
    this.runnerEvents?.off(Phaser.Scenes.Events.CREATE, this.reset);
    this.runnerEvents?.off(Phaser.Scenes.Events.SHUTDOWN, this.stop);
  };
}
