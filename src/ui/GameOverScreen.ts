import Phaser from 'phaser';
import type { PrototypeSnapshot } from '../presentationProfiles';
import './gameOverScreen.css';

const cityRoot = '/assets/environment/gamdom-city-new/';
// Use the existing hit_0 atlas crops, without changing the artwork.
const runners = [
  { id: 'gamby', name: 'Gamby', crop: [84, 82, 120, 102] },
  { id: 'steve', name: 'Steve', crop: [70, 93, 240, 152] },
  { id: 'yungreal', name: 'Yungreal', crop: [93, 68, 203, 175] },
] as const;

interface GameOverOptions {
  onTryAgain: (character: number) => void;
  onChangeRunner: () => void;
}

export class GameOverScreen {
  private readonly root = document.createElement('section');
  private readonly runner: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly cash: HTMLElement;
  private readonly tryAgain: HTMLButtonElement;
  private readonly changeRunner: HTMLButtonElement;
  private readonly resizeObserver: ResizeObserver;
  private selectedCharacter = 0;
  private visible = false;

  constructor(private readonly game: Phaser.Game, private readonly options: GameOverOptions) {
    this.root.id = 'game-over-screen';
    this.root.hidden = true;
    this.root.setAttribute('aria-labelledby', 'game-over-title');
    this.root.innerHTML = `
      <div class="over-city" aria-hidden="true">
        <img class="over-skyline" src="${cityRoot}neon-boulevard-distant-skyline.png" alt="">
        <img class="over-landmark" src="${cityRoot}neon-boulevard-grand-casino.png" alt="">
        <img class="over-road" src="${cityRoot}neon-boulevard-road.png" alt="">
      </div>
      <div class="over-content">
        <img class="over-logo" src="${cityRoot}gamdom-run-logo-game.png" alt="Gamdom Run" width="1200" height="480">
        <h1 id="game-over-title">RUN OVER</h1>
        <div class="over-runner-stage">
          <img class="over-bird" src="/assets/environment/gamdom-city/robotic-bird-game.png" alt="" aria-hidden="true" width="80" height="46">
          <img class="over-cone" src="/assets/obstacles/traffic-cone-game.png" alt="" aria-hidden="true" width="50" height="70">
          <div class="over-runner" role="img"></div>
        </div>
        <div class="over-results">
          <strong id="game-over-cash"></strong>
          <span>CASH COLLECTED</span>
        </div>
        <button id="game-over-again" type="button">TRY AGAIN<span class="over-chevron" aria-hidden="true"></span></button>
        <button id="game-over-change" type="button">CHANGE RUNNER</button>
      </div>`;
    this.runner = this.root.querySelector<HTMLElement>('.over-runner')!;
    this.stage = this.root.querySelector<HTMLElement>('.over-runner-stage')!;
    this.cash = this.root.querySelector<HTMLElement>('#game-over-cash')!;
    this.tryAgain = this.root.querySelector<HTMLButtonElement>('#game-over-again')!;
    this.changeRunner = this.root.querySelector<HTMLButtonElement>('#game-over-change')!;
    this.tryAgain.addEventListener('click', this.retry);
    this.changeRunner.addEventListener('click', this.change);
    document.body.append(this.root);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.stage);
    window.visualViewport?.addEventListener('resize', this.resize);
    game.events.once(Phaser.Core.Events.DESTROY, this.destroy);
  }

  show(snapshot: PrototypeSnapshot): void {
    if (this.visible || snapshot.ended !== 'game-over' || snapshot.lives !== 0 || snapshot.elapsed >= 90) return;
    this.selectedCharacter = snapshot.character;
    const runner = runners[this.selectedCharacter] ?? runners[0];
    const frame = this.game.textures.get(`${runner.id}-playable`).get('hit_0');
    const source = frame.texture.getSourceImage();
    const [x, y, width, height] = runner.crop;
    this.runner.dataset.runner = runner.id;
    this.runner.setAttribute('aria-label', `${runner.name}, fallen pose`);
    this.runner.style.backgroundImage = `url('/assets/characters/${runner.id}/${runner.id}-playable-atlas.png')`;
    this.runner.style.backgroundSize = `${source.width / width * 100}% ${source.height / height * 100}%`;
    this.runner.style.backgroundPosition = `${(frame.cutX + x) / (source.width - width) * 100}% ${(frame.cutY + y) / (source.height - height) * 100}%`;
    this.cash.textContent = `$${snapshot.money.toLocaleString()}`;
    this.cash.dataset.compact = String(this.cash.textContent.length > 10);
    this.visible = true;
    this.root.hidden = false;
    this.resize();
    this.tryAgain.focus({ preventScroll: true });
  }

  private readonly resize = (): void => {
    if (!this.visible) return;
    const [, , width, height] = (runners[this.selectedCharacter] ?? runners[0]).crop;
    const stage = this.stage.getBoundingClientRect();
    const scale = Math.max(0, Math.min(stage.height / height, stage.width * 0.85 / width, 260 / height));
    this.runner.style.width = `${width * scale}px`;
    this.runner.style.height = `${height * scale}px`;
  };

  private readonly retry = (): void => {
    if (!this.visible) return;
    this.visible = false;
    this.root.hidden = true;
    this.options.onTryAgain(this.selectedCharacter);
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
    this.tryAgain.removeEventListener('click', this.retry);
    this.changeRunner.removeEventListener('click', this.change);
    this.root.remove();
  };
}
