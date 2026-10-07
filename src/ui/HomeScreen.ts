import type Phaser from 'phaser';
import './homeScreen.css';

interface HomeScreenOptions {
  readyEvent?: string;
  onPlay?: () => void;
}

const cityRoot = '/assets/environment/gamdom-city-new/';
const runners = [
  { name: 'Steve', id: 'steve', atlas: { width: 1176, height: 1056 }, crop: { x: 854, y: 60, width: 183, height: 189 } },
  { name: 'Gamby', id: 'gamby', atlas: { width: 888, height: 1200 }, crop: { x: 670, y: 58, width: 108, height: 134 } },
  { name: 'Yungreal', id: 'yungreal', atlas: { width: 1176, height: 1320 }, crop: { x: 905, y: 26, width: 163, height: 223 } },
] as const;

export class HomeScreen {
  private readonly root = document.createElement('section');
  private readonly readyEvent: string;
  private readonly playAction?: () => void;
  private readonly play: HTMLButtonElement;
  private readonly playLabel: HTMLElement;
  private readonly progress: HTMLElement;
  private loading = true;
  private boot?: Phaser.Scene;
  private menu?: Phaser.Scene;

  constructor(private readonly game: Phaser.Game, options: HomeScreenOptions = {}) {
    this.readyEvent = options.readyEvent ?? 'home-menu-ready';
    this.playAction = options.onPlay;
    this.root.id = 'home-screen';
    this.root.setAttribute('aria-label', 'GAMDOM RUN Home');
    this.root.innerHTML = `
      <div class="home-city" aria-hidden="true">
        <div class="home-city-sky"></div>
        <img class="home-city-skyline" src="${cityRoot}gamdom-city-distant-skyline.png" alt="">
        <img class="home-city-tower" src="${cityRoot}gamdom-city-corporate-tower.png" alt="">
        <img class="home-city-office" src="${cityRoot}gamdom-city-wide-office.png" alt="">
        <div class="home-city-sidewalk"></div>
        <div class="home-city-road"></div>
        <div class="home-city-grade"></div>
      </div>
      <div class="home-content">
        <div class="home-top-space" aria-hidden="true"></div>
        <img class="home-logo" src="${cityRoot}gamdom-run-logo-game.png" width="1200" height="480" alt="GAMDOM RUN. RUN. DODGE. STACK CASH." fetchpriority="high">
        <div class="home-team" aria-label="The three runners"></div>
        <div class="home-action">
          <button id="home-play" type="button" class="home-play" disabled data-loading="true" aria-busy="true" aria-label="Loading game">
            <span class="home-play-fill" aria-hidden="true"></span>
            <span class="home-play-content">
              <svg class="home-play-icon" viewBox="0 0 24 24" width="25" height="25" aria-hidden="true" focusable="false">
                <path d="M7.5 4.9c0-.7.8-1.1 1.4-.7l10.2 6.3c.5.3.5 1.1 0 1.4L8.9 18.2c-.6.4-1.4 0-1.4-.7V4.9Z" fill="currentColor"></path>
              </svg>
              <span class="home-play-label" role="status" aria-live="polite">LOADING…</span>
            </span>
          </button>
        </div>
      </div>`;
    this.play = this.root.querySelector<HTMLButtonElement>('#home-play')!;
    this.playLabel = this.root.querySelector<HTMLElement>('.home-play-label')!;
    this.progress = this.root.querySelector<HTMLElement>('.home-play-fill')!;
    const team = this.root.querySelector('.home-team')!;
    for (const runner of runners) {
      const image = document.createElement('div');
      image.className = `home-runner home-runner-${runner.id}`;
      image.dataset.runner = runner.id;
      image.dataset.frame = 'run_0';
      image.setAttribute('role', 'img');
      image.setAttribute('aria-label', runner.name);
      const { atlas, crop } = runner;
      // Home-only alpha bounds remove transparent atlas padding, not any runner pixels.
      image.style.aspectRatio = `${crop.width} / ${crop.height}`;
      image.style.backgroundImage = `url('/assets/characters/${runner.id}/${runner.id}-playable-atlas.png')`;
      image.style.backgroundSize = `${atlas.width / crop.width * 100}% ${atlas.height / crop.height * 100}%`;
      image.style.backgroundPosition = `${crop.x / (atlas.width - crop.width) * 100}% ${crop.y / (atlas.height - crop.height) * 100}%`;
      team.append(image);
    }
    this.play.addEventListener('click', this.start);
    document.body.append(this.root);
    this.setVisible(true);
    game.events.on(this.readyEvent, this.onReady);
    game.events.once('ready', this.attachBootProgress);
    game.events.once('destroy', this.destroy);
  }

  private readonly attachBootProgress = (): void => {
    const boot = this.game.scene.getScene('Boot');
    if (!boot) throw new Error('Boot scene is unavailable while attaching Home loading progress');
    this.boot = boot;
    this.boot.load.on('progress', this.onProgress);
    this.onProgress(this.boot.load.progress);
  };

  private readonly onProgress = (progress: number): void => {
    if (this.loading) this.progress.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
  };

  private readonly onReady = (scene?: Phaser.Scene): void => {
    if (scene) {
      this.menu = scene;
      scene.events.once('shutdown', this.hide);
    }
    this.loading = false;
    this.play.disabled = false;
    this.play.dataset.loading = 'false';
    this.play.setAttribute('aria-busy', 'false');
    this.play.setAttribute('aria-label', 'Play');
    this.playLabel.textContent = 'PLAY';
    this.progress.style.transform = 'scaleX(0)';
    this.setVisible(true);
  };

  private setVisible(visible: boolean): void {
    this.root.hidden = !visible;
    document.documentElement.dataset.home = String(visible);
    this.game.events.emit('home-visibility');
  }

  private readonly hide = (): void => {
    this.play.disabled = true;
    this.menu = undefined;
    this.setVisible(false);
  };

  private readonly start = (): void => {
    if (this.play.disabled) return;
    if (this.playAction) {
      this.play.disabled = true;
      this.setVisible(false);
      this.playAction();
      return;
    }
    if (!this.menu) return;
    this.play.disabled = true;
    this.menu.scene.start('CharacterSelect');
  };

  private readonly destroy = (): void => {
    this.game.events.off(this.readyEvent, this.onReady);
    this.game.events.off('ready', this.attachBootProgress);
    this.menu?.events.off('shutdown', this.hide);
    this.boot?.load.off('progress', this.onProgress);
    this.play.removeEventListener('click', this.start);
    this.root.remove();
    delete document.documentElement.dataset.home;
  };
}
