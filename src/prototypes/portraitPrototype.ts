import Phaser from 'phaser';
import { BootScene } from '../game/scenes/BootScene';
import { ResultScene } from '../game/scenes/ResultScene';
import { RunnerScene } from '../game/scenes/RunnerScene';
import { PORTRAIT_PROTOTYPE_PROFILE } from '../presentationProfiles';
import { HomeScreen } from '../ui/HomeScreen';
import { PortraitPresentation } from './portraitPresentation';
import './portraitPrototype.css';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'portrait-app',
  width: 960,
  height: 540,
  backgroundColor: '#040a11',
  render: { antialias: true, pixelArt: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
  scene: [new BootScene(PORTRAIT_PROTOTYPE_PROFILE), RunnerScene, ResultScene],
});

const presentation = new PortraitPresentation(game, PORTRAIT_PROTOTYPE_PROFILE);
const startPanel = document.querySelector<HTMLElement>('#portrait-start')!;
startPanel.hidden = true;
new HomeScreen(game, {
  readyEvent: 'portrait-prototype-ready',
  onPlay: () => { startPanel.hidden = false; },
});
if (new URLSearchParams(location.search).get('frameDiagnostic') === '1') {
  void import('../diagnostics/portraitFrameDiagnostics').then(module => module.installPortraitFrameDiagnostics(game, presentation));
}
if (new URLSearchParams(location.search).get('startupDiagnostic') === '1') {
  void import('../diagnostics/startupDiagnostics').then(module => module.installStartupDiagnostics(game));
}
