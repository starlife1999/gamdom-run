import Phaser from 'phaser';
import { requestLandscapePresentation } from '../../mobilePresentation';

interface ResultData {
  gameOver?: boolean;
  money: number;
  distance: number;
  avoided: number;
  character: number;
  timeSurvived?: number;
  cashRushes?: number;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData): void {
    const { width, height } = this.scale;
    const gameOver = data.gameOver === true;
    const selectedCharacter = Phaser.Math.Clamp(Math.floor(data.character), 0, 2);
    this.registry.set('selectedCharacter', selectedCharacter);
    this.cameras.main.setBackgroundColor('#040710');
    this.add.image(width / 2, height / 2, 'casino-city').setDisplaySize(width * 1.2, height).setAlpha(0.45).setDepth(-2);
    this.add.rectangle(width / 2, height / 2, width, height, 0x03110e, 0.78).setDepth(-1);

    this.add.text(width * 0.5, 90, gameOver ? 'GAME OVER' : 'RUN COMPLETE', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '44px',
      color: gameOver ? '#ff7f8a' : '#39ffac',
      stroke: '#081018',
      strokeThickness: 8,
    }).setOrigin(0.5);

    const characterNames = ['Gamby', 'Steve', 'Yungreal'];
    this.add.text(width * 0.5, 56, characterNames[selectedCharacter], {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#dffcff',
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 160, `MONEY COLLECTED`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#73efb4',
    }).setOrigin(0.5);
    this.add.text(width * 0.5, 200, `$${Math.max(0, data.money).toLocaleString()}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '42px',
      color: '#fef3b0',
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 260, gameOver ? 'TIME SURVIVED' : 'DISTANCE', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#73efb4',
    }).setOrigin(0.5);
    const survivedSeconds = Math.max(0, Math.floor(data.timeSurvived ?? 0));
    const survivedTime = `${Math.floor(survivedSeconds / 60).toString().padStart(2, '0')}:${(survivedSeconds % 60).toString().padStart(2, '0')}`;
    this.add.text(width * 0.5, 300, gameOver ? survivedTime : `${Math.floor(data.distance).toLocaleString()}m`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '34px',
      color: '#d7f8ff',
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 350, gameOver ? 'CASH RUSHES' : 'OBSTACLES AVOIDED', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#73efb4',
    }).setOrigin(0.5);
    this.add.text(width * 0.5, 390, `${gameOver ? data.cashRushes ?? 0 : data.avoided}`, {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '34px',
      color: '#d5ffe8',
    }).setOrigin(0.5);

    const summaryBox = this.add.rectangle(width * 0.5, 270, 540, 300, 0x061b16, 0.92);
    summaryBox.setStrokeStyle(3, 0x31ffab, 0.85);
    summaryBox.setDepth(-1);

    const replay = this.add.container(width * 0.5 - 130, 460);
    const replayBody = this.add.rectangle(0, 0, 190, 50, 0x20efa0, 1);
    const replayLabel = this.add.text(0, 0, gameOver ? 'TRY AGAIN' : 'RUN IT BACK', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#02161d',
    }).setOrigin(0.5);
    replay.add([replayBody, replayLabel]);
    replay.setSize(190, 50).setInteractive({ useHandCursor: true });
    replay.on('pointerdown', () => {
      requestLandscapePresentation(this.game);
      this.scene.start('Runner', { selectedCharacter });
    });

    const share = this.add.container(width * 0.5 + 130, 460);
    const shareBody = this.add.rectangle(0, 0, 150, 50, 0x0a2520, 1).setStrokeStyle(2, 0x31ffab, 0.7);
    const shareLabel = this.add.text(0, 0, 'SHARE', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '20px',
      color: '#dffcff',
    }).setOrigin(0.5);
    share.add([shareBody, shareLabel]);
    share.setSize(150, 50).setInteractive({ useHandCursor: true });
    share.on('pointerdown', () => {
      const text = `I ran ${Math.floor(data.distance).toLocaleString()}m in GAMDOM RUN and collected $${Math.max(0, data.money).toLocaleString()}!`;
      if (navigator.share) {
        navigator.share({ title: 'GAMDOM RUN', text }).catch(() => undefined);
      } else {
        void navigator.clipboard?.writeText(text);
        this.add.text(width * 0.5, 500, 'Summary copied to clipboard', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          color: '#c9f6ff',
        }).setOrigin(0.5);
      }
    });
  }
}
