import Phaser from 'phaser';
import type { PrototypeSnapshot } from '../presentationProfiles';
import './runCompleteScreen.css';

const cityRoot = '/assets/environment/gamdom-city-new/';
// Crops are the existing atlas win_0 paste offsets and source dimensions.
const runners = [
  { id: 'gamby', name: 'Gamby', crop: [96, 67, 105, 119] },
  { id: 'steve', name: 'Steve', crop: [132, 42, 118, 201] },
  { id: 'yungreal', name: 'Yungreal', crop: [112, 26, 153, 218] },
] as const;

interface RunCompleteOptions {
  onRunAgain: (character: number) => void;
  onChangeRunner: () => void;
}

export class RunCompleteScreen {
  private readonly root = document.createElement('section');
  private readonly runner: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly cash: HTMLElement;
  private readonly runAgain: HTMLButtonElement;
  private readonly changeRunner: HTMLButtonElement;
  private readonly resizeObserver: ResizeObserver;
  private selectedCharacter = 0;
  private visible = false;

  constructor(private readonly game: Phaser.Game, private readonly options: RunCompleteOptions) {
    this.root.id = 'run-complete-screen';
    this.root.hidden = true;
    this.root.setAttribute('aria-labelledby', 'run-complete-title');
    this.root.innerHTML = `
      <div class="complete-city" aria-hidden="true">
        <img class="complete-skyline" src="${cityRoot}gamdom-city-distant-skyline.png" alt="">
        <img class="complete-road" src="${cityRoot}gamdom-city-road.png" alt="">
        <img class="complete-landmark" src="/assets/environment/gamdom-city/gamdom-casino.png" alt="">
      </div>
      <div class="complete-content">
        <img class="complete-logo" src="${cityRoot}gamdom-run-logo-game.png" alt="Gamdom Run" width="1200" height="480">
        <h1 id="run-complete-title">RUN COMPLETE</h1>
        <div class="complete-victory">
          <div class="complete-coins" aria-hidden="true">
            ${Array.from({ length: 6 }, () => '<img src="/assets/environment/gamdom-city/gamdom-coin-game.png" alt="" width="40" height="40">').join('')}
          </div>
          <div class="complete-runner" role="img"></div>
        </div>
        <div class="complete-results">
          <strong id="run-complete-cash"></strong>
          <span>TOTAL CASH</span>
        </div>
        <button id="run-complete-again" type="button">RUN AGAIN<span class="complete-chevron" aria-hidden="true"></span></button>
        <button id="run-complete-change" type="button">CHANGE RUNNER</button>
      </div>`;
    this.runner = this.root.querySelector<HTMLElement>('.complete-runner')!;
    this.stage = this.root.querySelector<HTMLElement>('.complete-victory')!;
    this.cash = this.root.querySelector<HTMLElement>('#run-complete-cash')!;
    this.runAgain = this.root.querySelector<HTMLButtonElement>('#run-complete-again')!;
    this.changeRunner = this.root.querySelector<HTMLButtonElement>('#run-complete-change')!;
    this.runAgain.addEventListener('click', this.replay);
    this.changeRunner.addEventListener('click', this.change);
    document.body.append(this.root);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.stage);
    window.visualViewport?.addEventListener('resize', this.resize);
    game.events.once(Phaser.Core.Events.DESTROY, this.destroy);
  }

  show(snapshot: PrototypeSnapshot): void {
    if (this.visible || snapshot.ended !== 'run-complete' || snapshot.elapsed < 90) return;
    this.selectedCharacter = snapshot.character;
    const runner = runners[this.selectedCharacter] ?? runners[0];
    const frame = this.game.textures.get(`${runner.id}-playable`).get('win_0');
    const source = frame.texture.getSourceImage();
    const [x, y, width, height] = runner.crop;
    this.runner.dataset.runner = runner.id;
    this.runner.setAttribute('aria-label', `${runner.name}, victory pose`);
    this.runner.style.backgroundImage = `url('/assets/characters/${runner.id}/${runner.id}-playable-atlas.png')`;
    this.runner.style.backgroundSize = `${source.width / width * 100}% ${source.height / height * 100}%`;
    this.runner.style.backgroundPosition = `${(frame.cutX + x) / (source.width - width) * 100}% ${(frame.cutY + y) / (source.height - height) * 100}%`;
    this.cash.textContent = `$${snapshot.money.toLocaleString()}`;
    this.cash.dataset.compact = String(this.cash.textContent.length > 10);
    this.visible = true;
    this.root.hidden = false;
    this.resize();
    this.runAgain.focus({ preventScroll: true });
  }

  private readonly resize = (): void => {
    if (!this.visible) return;
    const [, , width, height] = (runners[this.selectedCharacter] ?? runners[0]).crop;
    const stage = this.stage.getBoundingClientRect();
    const scale = Math.max(0, Math.min(stage.height / height, stage.width * 0.72 / width, 300 / height));
    this.runner.style.width = `${width * scale}px`;
    this.runner.style.height = `${height * scale}px`;
  };

  private readonly replay = (): void => {
    if (!this.visible) return;
    this.visible = false;
    this.root.hidden = true;
    this.options.onRunAgain(this.selectedCharacter);
  };

  private readonly change = (): void => {
    if (!this.visible) return;
    this.visible = false;
    this.root.hidden = true;
    this.options.onChangeRunner();
  };

  private readonly destroy = (): void => {
    this.resizeObserver.disconnect();
    window.visualViewport?.removeEventListener('resize', this.resize);
    this.runAgain.removeEventListener('click', this.replay);
    this.changeRunner.removeEventListener('click', this.change);
    this.root.remove();
  };
}
