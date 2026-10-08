import Phaser from 'phaser';
import { BootScene } from '../game/scenes/BootScene';
import { ResultScene } from '../game/scenes/ResultScene';
import { RunnerScene } from '../game/scenes/RunnerScene';
import { PORTRAIT_PROTOTYPE_PROFILE } from '../presentationProfiles';
import { ChooseRunnerScreen } from '../ui/ChooseRunnerScreen';
import { HomeScreen } from '../ui/HomeScreen';
import { HowToRunScreen } from '../ui/HowToRunScreen';
import { RunCompleteScreen } from '../ui/RunCompleteScreen';
import { GameOverScreen } from '../ui/GameOverScreen';
import { PortraitPresentation } from './portraitPresentation';
import './portraitPrototype.css';
import { PortraitAudio } from '../audio/portraitAudio';

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

let runComplete: RunCompleteScreen;
let gameOver: GameOverScreen;
new PortraitAudio(game);
const presentation = new PortraitPresentation(game, PORTRAIT_PROTOTYPE_PROFILE,
  snapshot => runComplete.show(snapshot), snapshot => gameOver.show(snapshot));
const startPanel = document.querySelector<HTMLElement>('#portrait-start')!;
const character = document.querySelector<HTMLSelectElement>('#portrait-character')!;
const portraitPlay = document.querySelector<HTMLButtonElement>('#portrait-play')!;
const storedCharacter = game.registry.get('selectedCharacter');
const initialCharacter = typeof storedCharacter === 'number' && Number.isInteger(storedCharacter)
  && storedCharacter >= 0 && storedCharacter < 3 ? storedCharacter : 0;
character.value = String(initialCharacter);
startPanel.hidden = true;
let home: HomeScreen;
const howToRun = new HowToRunScreen(game, {
  onBack: () => chooseRunner.show(),
  onRun: () => presentation.startWithCountdown(() => howToRun.show(Number(character.value))),
});
const chooseRunner = new ChooseRunnerScreen(game, {
  selectedCharacter: initialCharacter,
  onBack: () => home.show(),
  onSelect: selected => {
    character.value = String(selected);
    howToRun.show(selected);
  },
});
runComplete = new RunCompleteScreen(game, {
  onRunAgain: selectedCharacter => {
    character.value = String(selectedCharacter);
    presentation.startWithCountdown(() => howToRun.show(selectedCharacter));
  },
  onChangeRunner: () => {
    presentation.leaveCompletedRun();
    chooseRunner.show();
  },
});
gameOver = new GameOverScreen(game, {
  onTryAgain: selectedCharacter => {
    character.value = String(selectedCharacter);
    presentation.startWithCountdown(() => howToRun.show(selectedCharacter));
  },
  onChangeRunner: () => {
    presentation.leaveGameOverRun();
    chooseRunner.show();
  },
});
home = new HomeScreen(game, {
  readyEvent: 'portrait-prototype-ready',
  onPlay: () => chooseRunner.show(),
});
if (import.meta.env.DEV && new URLSearchParams(location.search).get('frameDiagnostic') === '1') {
  void import('../diagnostics/portraitFrameDiagnostics').then(module => module.installPortraitFrameDiagnostics(game, presentation));
}
if (import.meta.env.DEV && new URLSearchParams(location.search).get('startupDiagnostic') === '1') {
  void import('../diagnostics/startupDiagnostics').then(module => module.installStartupDiagnostics(game));
}
