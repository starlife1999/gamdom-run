import type Phaser from 'phaser';
import './howToRunScreen.css';

const cityRoot = '/assets/environment/gamdom-city-new/';
const runners = [
  { name: 'Gamby', id: 'gamby', atlas: { width: 888, height: 1200 }, crop: { x: 670, y: 58, width: 108, height: 134 } },
  { name: 'Steve', id: 'steve', atlas: { width: 1176, height: 1056 }, crop: { x: 854, y: 60, width: 183, height: 189 } },
  { name: 'Yungreal', id: 'yungreal', atlas: { width: 1176, height: 1320 }, crop: { x: 905, y: 26, width: 163, height: 223 } },
] as const;

interface HowToRunScreenOptions {
  onBack: () => void;
  onRun: () => void;
}

export class HowToRunScreen {
  private readonly root = document.createElement('section');
  private readonly preview: HTMLElement;
  private readonly runner: HTMLElement;
  private readonly heading: HTMLElement;

  constructor(game: Phaser.Game, private readonly options: HowToRunScreenOptions) {
    this.root.id = 'how-to-run-screen';
    this.root.hidden = true;
    this.root.setAttribute('aria-labelledby', 'how-to-run-title');
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
      <div class="how-to-run-content">
        <header class="how-to-run-header">
          <button class="how-to-run-back" type="button" aria-label="Back to Choose Runner">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="m14.5 5-7 7 7 7M8 12h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <h1 id="how-to-run-title" tabindex="-1">HOW TO <span>RUN</span></h1>
        </header>
        <div class="how-to-run-controls">
          <div class="how-to-run-instruction">
            <h2><small>HOLD</small>SLIDE</h2>
            <svg class="how-to-run-direction" viewBox="0 0 32 48" aria-hidden="true">
              <path d="M16 5v34M5 28l11 11 11-11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <h3>FAST FALL</h3>
            <p>Hold the left control in the air to fall faster.</p>
          </div>
          <div class="how-to-run-preview" role="img">
            <img class="how-to-run-skyline" src="${cityRoot}gamdom-city-distant-skyline.png" alt="">
            <img class="how-to-run-building" src="${cityRoot}gamdom-city-wide-office.png" alt="">
            <div class="how-to-run-road"></div>
            <div class="how-to-run-shadow"></div>
            <div class="how-to-run-runner"></div>
            <img class="how-to-run-coin" src="/assets/environment/gamdom-city/gamdom-coin-game.png" alt="">
            <img class="how-to-run-cone" src="/assets/obstacles/traffic-cone-game.png" alt="">
            <div class="how-to-run-phone-notch" aria-hidden="true"></div>
          </div>
          <div class="how-to-run-instruction">
            <h2><small>TAP</small>JUMP</h2>
            <svg class="how-to-run-direction" viewBox="0 0 32 48" aria-hidden="true">
              <path d="M16 43V9M5 20 16 9l11 11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <h3><small>TAP AGAIN</small>DOUBLE JUMP</h3>
          </div>
        </div>
        <div class="how-to-run-objectives" aria-label="Run objectives">
          <div><img src="/assets/environment/gamdom-city/gamdom-coin-game.png" alt=""><span>COLLECT CASH</span></div>
          <div><img src="/assets/obstacles/traffic-cone-game.png" alt=""><span>DODGE HAZARDS</span></div>
          <div>
            <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="18" r="11" fill="none" stroke="currentColor" stroke-width="2"></circle><path d="M12 2h8M16 2v5m0 5v7l4 2M24 7l3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
            <span>SURVIVE 90s</span>
          </div>
        </div>
        <button id="how-to-run-play" type="button">LET'S RUN</button>
      </div>`;
    this.preview = this.root.querySelector<HTMLElement>('.how-to-run-preview')!;
    this.runner = this.root.querySelector<HTMLElement>('.how-to-run-runner')!;
    this.heading = this.root.querySelector<HTMLElement>('h1')!;
    this.root.querySelector<HTMLButtonElement>('.how-to-run-back')!.addEventListener('click', () => {
      this.root.hidden = true;
      options.onBack();
    });
    this.root.querySelector<HTMLButtonElement>('#how-to-run-play')!.addEventListener('click', this.start);
    document.body.append(this.root);
    game.events.once('destroy', () => this.root.remove());
  }

  show(selectedCharacter: number): void {
    const runner = runners[selectedCharacter] ?? runners[0];
    const { atlas, crop } = runner;
    this.runner.dataset.runner = runner.id;
    this.runner.style.aspectRatio = `${crop.width} / ${crop.height}`;
    this.runner.style.backgroundImage = `url('/assets/characters/${runner.id}/${runner.id}-playable-atlas.png')`;
    this.runner.style.backgroundSize = `${atlas.width / crop.width * 100}% ${atlas.height / crop.height * 100}%`;
    this.runner.style.backgroundPosition = `${crop.x / (atlas.width - crop.width) * 100}% ${crop.y / (atlas.height - crop.height) * 100}%`;
    this.preview.setAttribute('aria-label', `${runner.name} running through Gamdom City with cash and a traffic cone`);
    this.root.hidden = false;
    this.heading.focus({ preventScroll: true });
  }

  private readonly start = (): void => {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.options.onRun();
  };
}
