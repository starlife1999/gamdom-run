import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { CharacterSelectScene } from './game/scenes/CharacterSelectScene';
import { RunnerScene } from './game/scenes/RunnerScene';
import { ResultScene } from './game/scenes/ResultScene';
import { installMobilePresentation } from './mobilePresentation';
import { HomeScreen } from './ui/HomeScreen';
import './presentation.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 540,
  backgroundColor: '#05060c',
  render: {
    antialias: true,
    pixelArt: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, CharacterSelectScene, RunnerScene, ResultScene],
};

const game = new Phaser.Game(config);
new HomeScreen(game);
installMobilePresentation(game);
if (new URLSearchParams(location.search).get('startupDiagnostic') === '1') {
  void import('./diagnostics/startupDiagnostics').then(module => module.installStartupDiagnostics(game));
}
