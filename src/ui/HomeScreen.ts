import type Phaser from 'phaser';
import { createElement, Play, Settings, Volume2 } from 'lucide';
import './homeScreen.css';

const cityRoot = '/assets/environment/gamdom-city-new/';
const runners = [
  { name: 'Steve', id: 'steve', atlas: { width: 1176, height: 1056 }, crop: { x: 854, y: 60, width: 183, height: 189 } },
  { name: 'Gamby', id: 'gamby', atlas: { width: 888, height: 1200 }, crop: { x: 670, y: 58, width: 108, height: 134 } },
  { name: 'Yungreal', id: 'yungreal', atlas: { width: 1176, height: 1320 }, crop: { x: 905, y: 26, width: 163, height: 223 } },
] as const;

export class HomeScreen {
  private readonly root = document.createElement('section');
  private readonly play = document.createElement('button');
  private menu?: Phaser.Scene;

  constructor(private readonly game: Phaser.Game) {
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
        <div class="home-controls"></div>
        <img class="home-logo" src="${cityRoot}gamdom-run-logo-game.png" width="1200" height="480" alt="GAMDOM RUN. RUN. DODGE. STACK CASH." fetchpriority="high">
        <div class="home-team" aria-label="The three runners"></div>
        <div class="home-action"></div>
      </div>`;
    const controls = this.root.querySelector('.home-controls')!;
    for (const [label, icon] of [['Sound', Volume2], ['Settings', Settings]] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'home-icon';
      button.disabled = true;
      button.title = `${label} unavailable: not connected`;
      button.setAttribute('aria-label', `${label} unavailable`);
      button.append(createElement(icon, { width: 22, height: 22, 'aria-hidden': 'true' }));
      controls.append(button);
    }
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
    this.play.id = 'home-play';
    this.play.type = 'button';
    this.play.className = 'home-play';
    this.play.disabled = true;
    this.play.append(createElement(Play, { width: 25, height: 25, fill: 'currentColor', 'aria-hidden': 'true' }), document.createTextNode('PLAY'));
    this.root.querySelector('.home-action')!.append(this.play);
    this.play.addEventListener('click', this.start);
    document.body.append(this.root);
    this.setVisible(true);
    game.events.on('home-menu-ready', this.onMenuReady);
    game.events.once('destroy', this.destroy);
  }

  private readonly onMenuReady = (scene: Phaser.Scene): void => {
    this.menu = scene;
    this.play.disabled = false;
    this.setVisible(true);
    scene.events.once('shutdown', this.hide);
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
    if (!this.menu || this.play.disabled) return;
    this.play.disabled = true;
    this.menu.scene.start('CharacterSelect');
  };

  private readonly destroy = (): void => {
    this.game.events.off('home-menu-ready', this.onMenuReady);
    this.menu?.events.off('shutdown', this.hide);
    this.play.removeEventListener('click', this.start);
    this.root.remove();
    delete document.documentElement.dataset.home;
  };
}
