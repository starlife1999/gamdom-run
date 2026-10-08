import Phaser from 'phaser';
import { RunnerScene } from '../game/scenes/RunnerScene';
import type { PortraitPrototypeProfile, PrototypeSnapshot } from '../presentationProfiles';
import { PortraitCountdown } from './portraitCountdown';

declare global {
  interface Window {
    portraitPrototypeMetrics: { playReadyMs: number | null; fit?: { scale: number; cropLeft: number; cropRight: number } };
  }
}

export class PortraitPresentation {
  private readonly shell = document.querySelector<HTMLElement>('#portrait-shell')!;
  private readonly band = document.querySelector<HTMLElement>('#portrait-band')!;
  private readonly app = document.querySelector<HTMLElement>('#portrait-app')!;
  private readonly hud = document.querySelector<HTMLElement>('#portrait-hud')!;
  private readonly play = document.querySelector<HTMLButtonElement>('#portrait-play')!;
  private readonly pause = document.querySelector<HTMLButtonElement>('#portrait-pause')!;
  private readonly pauseMenu = document.querySelector<HTMLElement>('#portrait-pause-menu')!;
  private readonly resume = document.querySelector<HTMLButtonElement>('#portrait-resume')!;
  private readonly restart = document.querySelector<HTMLButtonElement>('#portrait-restart')!;
  private readonly character = document.querySelector<HTMLSelectElement>('#portrait-character')!;
  private readonly startPanel = document.querySelector<HTMLElement>('#portrait-start')!;
  private readonly title = document.querySelector<HTMLElement>('#portrait-start-title')!;
  private readonly meter = document.querySelector<HTMLProgressElement>('#portrait-streak-meter')!;
  private readonly steps = [...document.querySelectorAll<HTMLElement>('#portrait-streak-steps i')];
  private readonly powers = document.querySelector<HTMLElement>('#portrait-powers')!;
  private readonly atmosphere = document.querySelector<HTMLElement>('#portrait-atmosphere')!;
  private readonly districtTransition = document.createElement('div');
  private readonly transitionTitle = document.createElement('div');
  private readonly transitionLabel = document.createTextNode('');
  private readonly atmosphereImages: HTMLImageElement[] = [];
  private readonly guides = {
    slide: document.querySelector<HTMLElement>('#portrait-guide-slide')!,
    jump: document.querySelector<HTMLElement>('#portrait-guide-jump')!,
  };
  private readonly textElements = new Map<string, HTMLElement>();
  private readonly visualTouches = new Map<number, 'slide' | 'jump'>();
  private readonly powerIndicators = [
    { name: 'SHIELD', asset: 'shield', accent: '#76caff' },
    { name: 'MONEY MAGNET', asset: 'money-magnet', accent: '#ffd778' },
    { name: '2X CASH', asset: '2x-cash', accent: '#ffe083' },
    { name: 'BOOST', asset: 'boost', accent: '#64f3d2' },
    { name: 'MULTIPLIER', asset: 'multiplier', accent: '#88f59c' },
  ].map(power => {
    const element = document.createElement('div');
    element.className = 'portrait-power';
    element.dataset.power = power.name;
    element.style.setProperty('--power-accent', power.accent);
    element.setAttribute('role', 'img');
    element.hidden = true;
    const icon = document.createElement('img');
    icon.src = `/assets/environment/gamdom-city/${power.asset}-game.png`;
    icon.alt = '';
    icon.width = 28;
    icon.height = 28;
    const timer = document.createElement('span');
    timer.className = 'portrait-power-time';
    timer.setAttribute('aria-hidden', 'true');
    element.append(icon, timer);
    return { name: power.name, element, timer };
  });
  private district = 'city';
  private readonly resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.scheduleFit()) : undefined;
  private ready = false;
  private started = false;
  private completionShown = false;
  private gameOverShown = false;
  private destroyed = false;
  private frame = 0;
  private parentBounds = '';
  private readonly countdown = new PortraitCountdown(this.band);
  private countdownCreateListener?: () => void;
  private onCountdownCancel = (): void => {
    this.setHidden(this.startPanel, false);
    this.setDisabled(this.character, false);
  };

  startWithCountdown(onCancel: () => void): void {
    if (!this.ready || this.destroyed || this.countdown.active || this.countdownCreateListener) return;
    this.onCountdownCancel = onCancel;
    const runner = this.runner();
    this.countdownCreateListener = () => {
      this.countdownCreateListener = undefined;
      // CREATE fires before Runner's first update; a paused scene still renders.
      runner.preparePrototypeCountdown();
      runner.events.once(Phaser.Scenes.Events.SHUTDOWN, this.countdown.cancel);
      this.countdown.start(() => {
        runner.events.off(Phaser.Scenes.Events.SHUTDOWN, this.countdown.cancel);
        runner.finishPrototypeCountdown(true);
        this.updateHud();
      }, () => {
        runner.events.off(Phaser.Scenes.Events.SHUTDOWN, this.countdown.cancel);
        runner.finishPrototypeCountdown(false);
        if (runner.sys.isPaused()) this.game.scene.stop('Runner');
        this.started = false;
        this.game.events.emit('portrait-audio-stop');
        if (!this.destroyed) onCancel();
      });
      this.updateHud();
    };
    runner.events.once(Phaser.Scenes.Events.CREATE, this.countdownCreateListener);
    this.start();
  }

  constructor(
    private readonly game: Phaser.Game,
    private readonly profile: PortraitPrototypeProfile,
    private readonly onRunComplete?: (snapshot: PrototypeSnapshot) => void,
    private readonly onGameOver?: (snapshot: PrototypeSnapshot) => void,
  ) {
    this.powers.append(...this.powerIndicators.map(power => power.element));
    this.districtTransition.className = 'portrait-district-transition';
    this.districtTransition.hidden = true;
    this.districtTransition.setAttribute('aria-hidden', 'true');
    const veil = document.createElement('div');
    veil.className = 'portrait-transition-veil';
    const sweep = document.createElement('div');
    sweep.className = 'portrait-transition-sweep';
    this.transitionTitle.className = 'portrait-transition-title';
    const accent = document.createElement('div');
    accent.className = 'portrait-transition-accent';
    this.transitionTitle.append(this.transitionLabel, accent);
    this.districtTransition.append(veil, sweep, this.transitionTitle);
    this.shell.append(this.districtTransition);
    window.portraitPrototypeMetrics = { playReadyMs: null };
    game.events.once('portrait-prototype-ready', this.onReady);
    game.events.on(Phaser.Core.Events.POST_STEP, this.updateHud);
    game.events.once(Phaser.Core.Events.DESTROY, this.destroy);
    this.play.addEventListener('click', this.start);
    this.pause.addEventListener('click', this.togglePause);
    this.resume.addEventListener('click', this.resumeRun);
    this.restart.addEventListener('click', this.restartPausedRun);
    window.addEventListener('resize', this.scheduleFit);
    window.addEventListener('orientationchange', this.scheduleFit);
    window.visualViewport?.addEventListener('resize', this.scheduleFit);
    window.visualViewport?.addEventListener('scroll', this.scheduleFit);
    this.resizeObserver?.observe(this.hud);
    window.addEventListener('touchmove', this.moveTouch, { passive: true });
    window.addEventListener('touchend', this.hideTouch, { passive: true });
    window.addEventListener('touchcancel', this.hideTouch, { passive: true });
    window.addEventListener('blur', this.clearTouchVisuals);
    this.fit();
  }

  private readonly onReady = (): void => {
    this.ready = true;
    this.game.canvas.addEventListener('touchstart', this.showTouch, { passive: true });
    this.fit();
    this.setDisabled(this.play, false);
    const playReadyMs = performance.now();
    window.portraitPrototypeMetrics.playReadyMs = playReadyMs;
    console.info(`[portrait-prototype] navigation-to-PLAY-ready: ${playReadyMs.toFixed(1)} ms`);
    // Keep decoded CSS sky plates ready for the handoff without delaying Boot or PLAY.
    for (const filename of ['casino-portrait-atmosphere-game.png', 'neon-boulevard-night-background.png', 'gamdom-hq-approach-sky-game.png']) {
      const image = new Image();
      this.atmosphereImages.push(image);
      image.src = `/assets/environment/gamdom-city-new/${filename}`;
      void image.decode().catch(() => {});
    }
  };

  private readonly start = (): void => {
    if (!this.ready) return;
    this.game.events.emit('portrait-audio-reset');
    this.started = true;
    this.completionShown = false;
    this.gameOverShown = false;
    this.clearTouchVisuals();
    this.setHidden(this.startPanel, true);
    this.setDisabled(this.character, true);
    this.game.scene.stop('Runner');
    this.game.scene.stop('Boot');
    this.game.scene.start('Runner', { selectedCharacter: Number(this.character.value), presentationProfile: this.profile });
    this.parentBounds = '';
    this.fit();
  };

  private runner(): RunnerScene {
    return this.game.scene.getScene('Runner') as RunnerScene;
  }

  leaveCompletedRun(): void {
    if (this.runner().getPrototypeSnapshot()?.ended !== 'run-complete') return;
    this.game.events.emit('portrait-audio-stop');
    this.started = false;
    this.game.scene.stop('Runner');
  }

  leaveGameOverRun(): void {
    if (this.runner().getPrototypeSnapshot()?.ended !== 'game-over') return;
    this.game.events.emit('portrait-audio-stop');
    this.started = false;
    this.game.scene.stop('Runner');
  }

  private readonly togglePause = (): void => {
    if (this.countdown.active || this.countdownCreateListener) return;
    const runner = this.runner();
    const snapshot = runner.getPrototypeSnapshot();
    if (snapshot) runner.setPrototypePaused(!snapshot.paused);
    this.updateHud();
  };

  private readonly resumeRun = (): void => {
    if (this.countdown.active || this.countdownCreateListener) return;
    this.runner().setPrototypePaused(false);
    this.updateHud();
    this.pause.focus({ preventScroll: true });
  };

  private readonly restartPausedRun = (): void => {
    if (this.destroyed || this.countdown.active || this.countdownCreateListener) return;
    const snapshot = this.runner().getPrototypeSnapshot();
    if (!snapshot?.paused || snapshot.ended) return;
    this.setHidden(this.pauseMenu, true);
    this.character.value = String(snapshot.character);
    this.startWithCountdown(this.onCountdownCancel);
  };

  private text(id: string, value: string): void {
    let element = this.textElements.get(id);
    if (!element) {
      element = document.getElementById(id)!;
      this.textElements.set(id, element);
    }
    if (element.textContent !== value) element.textContent = value;
  }

  private setData(element: HTMLElement, key: string, value: string): void {
    if (element.dataset[key] !== value) element.dataset[key] = value;
  }

  private setHidden(element: HTMLElement, hidden: boolean): void {
    if (element.hidden !== hidden) element.hidden = hidden;
  }

  private setDisabled(element: HTMLButtonElement | HTMLSelectElement, disabled: boolean): void {
    if (element.disabled !== disabled) element.disabled = disabled;
  }

  private setAttributeValue(element: HTMLElement, name: string, value: string): void {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  private setTitle(element: HTMLElement, value: string): void {
    if (element.title !== value) element.title = value;
  }

  private setProgressValue(element: HTMLProgressElement, value: number): void {
    if (element.value !== value) element.value = value;
  }

  private setStyleProperty(element: HTMLElement, name: string, value: string): void {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }

  private readonly updateHud = (): void => {
    if (!this.started || this.destroyed) return;
    const snapshot = this.runner().getPrototypeSnapshot();
    if (!snapshot) return;
    this.game.events.emit('portrait-audio-state', snapshot, !this.countdown.active && !this.countdownCreateListener);
    const seconds = Math.floor(snapshot.elapsed);
    this.text('portrait-time', `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`);
    const cash = `$${snapshot.money.toLocaleString()}`;
    this.text('portrait-money', cash);
    this.setData(this.textElements.get('portrait-money')!, 'compact', String(cash.length > 8));
    this.text('portrait-lives', `${snapshot.lives}`);
    const rush = this.runner().getCashRushPresentation();
    const rushActive = snapshot.cashRush > 0 && rush.active && !snapshot.ended;
    this.setData(this.shell, 'normalHud', String(!snapshot.ended && !this.countdown.active && !this.countdownCreateListener));
    this.text('portrait-streak', rushActive ? `CASH RUSH ${snapshot.cashRush.toFixed(1)}s` : 'CASH STREAK');
    const filledSteps = rushActive
      ? Phaser.Math.Clamp(Math.ceil(rush.remainingFraction * this.steps.length), 0, this.steps.length)
      : Phaser.Math.Clamp(snapshot.streak, 0, this.steps.length);
    this.setProgressValue(this.meter, rushActive ? filledSteps : snapshot.streak);
    this.setAttributeValue(this.meter, 'aria-label', rushActive ? 'Cash Rush countdown' : 'Cash streak');
    this.steps.forEach((step, i) => this.setData(step, 'filled', String(i < filledSteps)));
    this.setData(this.shell, 'rush', String(rushActive));
    if (rushActive) this.setStyleProperty(this.shell, '--cash-rush-pulse', String(rush.activationPulse));
    else if (this.shell.style.getPropertyValue('--cash-rush-pulse')) this.shell.style.removeProperty('--cash-rush-pulse');
    this.setData(this.shell, 'guidanceSubtle', String(snapshot.elapsed >= 5));
    this.updatePowers(snapshot);
    this.updateDistrictAtmosphere(snapshot.elapsed, !!snapshot.ended);
    if (snapshot.paused || snapshot.ended) this.clearTouchVisuals();
    this.text('portrait-status', snapshot.ended ? '' : snapshot.paused ? 'PAUSED' : snapshot.status);
    const pauseLabel = snapshot.paused ? 'Resume' : 'Pause';
    this.setAttributeValue(this.pause, 'aria-label', pauseLabel);
    this.setTitle(this.pause, pauseLabel);
    this.setDisabled(this.pause, !!snapshot.ended || this.countdown.active || !!this.countdownCreateListener);
    const showPauseMenu = snapshot.paused && !snapshot.ended && !this.countdown.active && !this.countdownCreateListener;
    const openingPauseMenu = showPauseMenu && this.pauseMenu.hidden;
    this.setHidden(this.pauseMenu, !showPauseMenu);
    if (openingPauseMenu) this.resume.focus({ preventScroll: true });
    this.showEnd(snapshot);
  };

  private updatePowers(snapshot: PrototypeSnapshot): void {
    const gameplay = !snapshot.ended && !this.countdown.active && !this.countdownCreateListener;
    let activeCount = 0;
    for (const indicator of this.powerIndicators) {
      let power: PrototypeSnapshot['powers'][number] | undefined;
      if (gameplay) {
        for (const active of snapshot.powers) {
          if (active.name === indicator.name) {
            power = active;
            break;
          }
        }
      }
      this.setHidden(indicator.element, !power);
      if (!power) continue;
      activeCount++;
      const time = `${power.seconds.toFixed(1)}s`;
      if (indicator.timer.textContent !== time) {
        indicator.timer.textContent = time;
        this.setAttributeValue(indicator.element, 'aria-label', `${indicator.name}, ${time} remaining`);
      }
    }
    this.setHidden(this.powers, activeCount === 0);
  }

  private showEnd(snapshot: PrototypeSnapshot): void {
    if (snapshot.ended === 'game-over' && this.onGameOver) {
      this.setHidden(this.startPanel, true);
      if (!this.gameOverShown) {
        this.gameOverShown = true;
        this.onGameOver(snapshot);
      }
      return;
    }
    if (snapshot.ended === 'run-complete' && this.onRunComplete) {
      this.setHidden(this.startPanel, true);
      if (!this.completionShown) {
        this.completionShown = true;
        this.onRunComplete(snapshot);
      }
      return;
    }
    this.setHidden(this.startPanel, !snapshot.ended);
    this.setDisabled(this.character, !snapshot.ended);
    if (snapshot.ended) {
      const title = snapshot.ended === 'game-over' ? 'GAME OVER' : 'RUN COMPLETE';
      const play = snapshot.ended === 'game-over' ? 'TRY AGAIN' : 'PLAY AGAIN';
      if (this.title.textContent !== title) this.title.textContent = title;
      if (this.play.textContent !== play) this.play.textContent = play;
    }
  }

  private updateDistrictAtmosphere(elapsed: number, ended: boolean): void {
    const district = elapsed >= 70 ? 'hq' : elapsed >= 50 ? 'neon' : elapsed >= 25 ? 'casino' : 'city';
    if (district !== this.district) {
      this.district = district;
      this.setData(this.shell, 'district', district);
    }
    const frame = this.runner().getDistrictTransitionPresentation();
    this.setHidden(this.districtTransition, !frame.active || ended);
    if (!frame.active || ended) return;
    const scale = window.portraitPrototypeMetrics.fit?.scale ?? 1;
    this.setData(this.districtTransition, 'destination', frame.name);
    if (this.transitionLabel.textContent !== frame.name) this.transitionLabel.textContent = frame.name;
    this.setStyleProperty(this.districtTransition, '--transition-veil-alpha', String(frame.veilAlpha));
    this.setStyleProperty(this.districtTransition, '--transition-title-alpha', String(frame.titleAlpha));
    this.setStyleProperty(this.districtTransition, '--transition-title-x', `${frame.titleOffset * scale}px`);
    this.setStyleProperty(this.districtTransition, '--transition-sweep-alpha', String(frame.sweepAlpha));
    this.setStyleProperty(this.districtTransition, '--transition-sweep-x', `${(-240 + (960 + 240) * frame.sweepProgress - this.profile.visibleWorldLeft) * scale}px`);
  }

  private insideBand(touch: Touch): boolean {
    const bounds = this.band.getBoundingClientRect();
    return touch.clientX >= bounds.left && touch.clientX <= bounds.right
      && touch.clientY >= bounds.top && touch.clientY <= bounds.bottom;
  }

  // Passive observers only: Runner owns commands, pointer state and cancellation.
  private readonly showTouch = (event: TouchEvent): void => {
    const snapshot = this.runner().getPrototypeSnapshot();
    if (!this.started || !snapshot || snapshot.paused || snapshot.ended) return;
    const bounds = this.band.getBoundingClientRect();
    for (const touch of Array.from(event.changedTouches)) {
      if (this.insideBand(touch)) this.visualTouches.set(touch.identifier,
        touch.clientX < bounds.left + bounds.width * 0.35 ? 'slide' : 'jump');
    }
    this.refreshTouchVisuals();
  };

  private readonly moveTouch = (event: TouchEvent): void => {
    for (const touch of Array.from(event.changedTouches)) {
      if (!this.insideBand(touch)) this.visualTouches.delete(touch.identifier);
    }
    this.refreshTouchVisuals();
  };

  private readonly hideTouch = (event: TouchEvent): void => {
    for (const touch of Array.from(event.changedTouches)) this.visualTouches.delete(touch.identifier);
    this.refreshTouchVisuals();
  };

  private refreshTouchVisuals(): void {
    const held = [...this.visualTouches.values()];
    this.setData(this.guides.slide, 'pressed', String(held.includes('slide')));
    this.setData(this.guides.jump, 'pressed', String(held.includes('jump')));
  }

  private readonly clearTouchVisuals = (): void => {
    this.visualTouches.clear();
    this.refreshTouchVisuals();
  };

  private readonly scheduleFit = (): void => {
    if (this.frame || this.destroyed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.fit();
    });
  };

  private fit(): void {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? innerWidth;
    const height = viewport?.height ?? innerHeight;
    for (const [name, value] of Object.entries({ width, height, left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0 })) {
      this.setStyleProperty(this.shell, name, `${value}px`);
    }
    const style = getComputedStyle(this.shell);
    const availableWidth = this.shell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const contentHeight = height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const compact = height <= 600;
    const hudHeight = compact ? 76 : Math.min(120, Math.max(94, contentHeight * 0.12));
    const lowerHeight = compact ? 56 : contentHeight * 0.18;
    this.setStyleProperty(this.shell, '--hud-height', `${hudHeight}px`);
    this.setStyleProperty(this.shell, '--lower-height', `${lowerHeight}px`);
    const availableHeight = contentHeight - hudHeight - lowerHeight;
    const scale = Math.min(availableWidth / this.profile.visibleWorldWidth, Math.max(1, availableHeight) / 540);
    this.setStyleProperty(this.band, 'width', `${this.profile.visibleWorldWidth * scale}px`);
    this.setStyleProperty(this.band, 'justify-self', 'center');
    this.setStyleProperty(this.shell, '--band-height', `${540 * scale}px`);
    this.setStyleProperty(this.shell, '--surface-width', `${960 * scale}px`);
    this.setStyleProperty(this.shell, '--surface-left', `${-this.profile.visibleWorldLeft * scale}px`);
    const atmosphereHeight = this.atmosphere.getBoundingClientRect().height;
    // One uniformly scaled sky continues across both CSS regions; blend only the
    // upper sky pixels of the game, leaving buildings, player and road opaque.
    const skyHeight = atmosphereHeight + 540 * scale;
    const skyWidth = Math.max(availableWidth, skyHeight * 1920 / 1080);
    this.setStyleProperty(this.shell, '--sky-size', `${skyWidth}px ${skyWidth * 1080 / 1920}px`);
    this.setStyleProperty(this.shell, '--sky-position', 'center top');
    this.setStyleProperty(this.shell, '--band-sky-position', `center ${-atmosphereHeight}px`);
    this.setStyleProperty(this.shell, '--sky-blend-height', `${76 * scale}px`);
    const bounds = this.app.getBoundingClientRect();
    const key = `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
    if (this.ready && key !== this.parentBounds) {
      this.parentBounds = key;
      this.clearTouchVisuals();
      this.runner().cancelPrototypeGesture();
      this.game.scale.getParentBounds();
      this.game.scale.refresh();
    }
    window.portraitPrototypeMetrics.fit = { scale, cropLeft: this.profile.visibleWorldLeft, cropRight: this.profile.visibleWorldRight };
  }

  private readonly destroy = (): void => {
    this.destroyed = true;
    if (this.countdownCreateListener) this.runner().events.off(Phaser.Scenes.Events.CREATE, this.countdownCreateListener);
    this.countdownCreateListener = undefined;
    this.countdown.destroy();
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.play.removeEventListener('click', this.start);
    this.pause.removeEventListener('click', this.togglePause);
    this.resume.removeEventListener('click', this.resumeRun);
    this.restart.removeEventListener('click', this.restartPausedRun);
    window.removeEventListener('resize', this.scheduleFit);
    window.removeEventListener('orientationchange', this.scheduleFit);
    window.visualViewport?.removeEventListener('resize', this.scheduleFit);
    window.visualViewport?.removeEventListener('scroll', this.scheduleFit);
    this.game.canvas.removeEventListener('touchstart', this.showTouch);
    window.removeEventListener('touchmove', this.moveTouch);
    window.removeEventListener('touchend', this.hideTouch);
    window.removeEventListener('touchcancel', this.hideTouch);
    window.removeEventListener('blur', this.clearTouchVisuals);
    this.game.events.off('portrait-prototype-ready', this.onReady);
    this.game.events.off(Phaser.Core.Events.POST_STEP, this.updateHud);
    this.districtTransition.remove();
  };
}
