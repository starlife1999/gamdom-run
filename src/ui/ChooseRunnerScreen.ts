import Phaser from 'phaser';
import './chooseRunnerScreen.css';

const cityRoot = '/assets/environment/gamdom-city-new/';
const runners = [
  { name: 'Gamby', id: 'gamby', atlas: { width: 888, height: 1200 }, crop: { x: 670, y: 58, width: 108, height: 134 }, previewScale: 1.14 },
  { name: 'Steve', id: 'steve', atlas: { width: 1176, height: 1056 }, crop: { x: 854, y: 60, width: 183, height: 189 }, previewScale: 1.03 },
  { name: 'Yungreal', id: 'yungreal', atlas: { width: 1176, height: 1320 }, crop: { x: 905, y: 26, width: 163, height: 223 }, previewScale: 0.97 },
] as const;
const widestRunnerAspectRatio = Math.max(...runners.map(({ crop, previewScale }) => crop.width / crop.height * previewScale));

interface ChooseRunnerScreenOptions {
  selectedCharacter: number;
  onBack: () => void;
  onSelect: (character: number) => void;
}

export class ChooseRunnerScreen {
  private readonly root = document.createElement('section');
  private readonly preview = document.createElement('div');
  private readonly previewStage: HTMLElement;
  private readonly selectors = runners.map((runner, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'runner-selector';
    button.textContent = runner.name.toUpperCase();
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => this.selectRunner(index));
    return button;
  });
  private readonly resizeObserver: ResizeObserver | undefined;
  private selectedCharacter: number;
  private visible = false;

  constructor(private readonly game: Phaser.Game, private readonly options: ChooseRunnerScreenOptions) {
    this.selectedCharacter = options.selectedCharacter;
    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(this.resizePreview) : undefined;
    this.root.id = 'choose-runner-screen';
    this.root.setAttribute('aria-label', 'Choose your runner');
    this.root.hidden = true;
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
      <div class="choose-runner-content">
        <header class="choose-runner-header">
          <button class="choose-runner-back" type="button" aria-label="Back to Home">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="m14.5 5-7 7 7 7M8 12h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <h1>CHOOSE YOUR RUNNER</h1>
          <span class="choose-runner-header-spacer" aria-hidden="true"></span>
        </header>
        <div class="choose-runner-preview-stage" role="img">
          <div class="choose-runner-glow" aria-hidden="true"></div>
          <div class="choose-runner-ground-shadow" aria-hidden="true"></div>
        </div>
        <div class="choose-runner-selectors" role="group" aria-label="Runners"></div>
        <button class="choose-runner-select" type="button">SELECT</button>
      </div>`;
    this.preview.className = 'choose-runner-preview';
    this.previewStage = this.root.querySelector<HTMLElement>('.choose-runner-preview-stage')!;
    this.previewStage.append(this.preview);
    const selectorGroup = this.root.querySelector('.choose-runner-selectors')!;
    selectorGroup.append(...this.selectors);
    this.root.querySelector<HTMLButtonElement>('.choose-runner-back')!.addEventListener('click', () => {
      this.visible = false;
      this.root.hidden = true;
      options.onBack();
    });
    this.root.querySelector<HTMLButtonElement>('.choose-runner-select')!.addEventListener('click', this.confirmSelection);
    document.body.append(this.root);
    this.resizeObserver?.observe(this.previewStage);
    window.addEventListener('resize', this.resizePreview);
    window.visualViewport?.addEventListener('resize', this.resizePreview);
    this.updateSelection();
    game.events.once(Phaser.Core.Events.DESTROY, this.destroy);
  }

  show(): void {
    this.visible = true;
    this.root.hidden = false;
    this.resizePreview();
  }

  private readonly selectRunner = (index: number): void => {
    if (this.selectedCharacter === index) return;
    this.selectedCharacter = index;
    this.game.registry.set('selectedCharacter', index);
    this.updateSelection();
  };

  private updateSelection(): void {
    const runner = runners[this.selectedCharacter] ?? runners[0];
    const { atlas, crop } = runner;
    this.preview.dataset.runner = runner.id;
    this.preview.style.aspectRatio = `${crop.width} / ${crop.height}`;
    this.preview.style.backgroundImage = `url('/assets/characters/${runner.id}/${runner.id}-playable-atlas.png')`;
    this.preview.style.backgroundSize = `${atlas.width / crop.width * 100}% ${atlas.height / crop.height * 100}%`;
    this.preview.style.backgroundPosition = `${crop.x / (atlas.width - crop.width) * 100}% ${crop.y / (atlas.height - crop.height) * 100}%`;
    this.previewStage.setAttribute('aria-label', `${runner.name}, running`);
    this.selectors.forEach((button, index) => {
      const selected = index === this.selectedCharacter;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    this.resizePreview();
  }

  private readonly resizePreview = (): void => {
    if (!this.visible) return;
    const runner = runners[this.selectedCharacter] ?? runners[0];
    const stage = this.previewStage.getBoundingClientRect();
    const ratio = runner.crop.width / runner.crop.height;
    const baseHeight = Math.max(1, Math.min(
      stage.height - 8,
      window.innerHeight * 0.48,
      370,
      stage.width * 0.96 / widestRunnerAspectRatio,
    ));
    const maxHeight = baseHeight * runner.previewScale;
    const width = Math.max(1, maxHeight * ratio);
    this.preview.style.width = `${width}px`;
    this.preview.style.height = `${width / ratio}px`;
    this.previewStage.style.setProperty('--runner-shadow-width', `${Math.max(86, width * 0.74)}px`);
  };

  private readonly confirmSelection = (): void => {
    if (!this.visible) return;
    this.visible = false;
    this.root.hidden = true;
    this.options.onSelect(this.selectedCharacter);
  };

  private readonly destroy = (): void => {
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resizePreview);
    window.visualViewport?.removeEventListener('resize', this.resizePreview);
    this.root.remove();
  };
}
