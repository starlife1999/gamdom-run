import Phaser from 'phaser';
import { requestLandscapePresentation } from '../../mobilePresentation';

export class MenuScene extends Phaser.Scene {
  private musicOn = true;
  private soundOn = true;
  private selectedCharacter = 0;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#12231c');
    this.game.events.emit('home-menu-ready', this);
  }

  private createLegacyMenu(): void {
    const { width, height } = this.scale;
    const persistedCharacter = this.registry.get('selectedCharacter');
    this.selectedCharacter = Phaser.Math.Clamp(
      Math.floor(typeof persistedCharacter === 'number' ? persistedCharacter : 0),
      0,
      2,
    );
    this.registry.set('selectedCharacter', this.selectedCharacter);

    this.cameras.main.setBackgroundColor('#040710');

    this.add.image(width / 2, height / 2, 'casino-city').setDisplaySize(width * 1.22, height).setAlpha(0.96).setDepth(-3);
    this.add.rectangle(width / 2, height / 2, width, height, 0x03110e, 0.15).setDepth(-2);
    const panel = this.add.graphics().setDepth(-1);
    panel.fillStyle(0x03100e, 0.97);
    panel.fillRect(0, 0, 320, height);
    panel.lineStyle(3, 0x1ce99a, 0.9);
    panel.lineBetween(319, 0, 319, height);
    panel.lineStyle(1, 0x6affbd, 0.36);
    panel.lineBetween(314, 0, 314, height);

    const mark = this.add.graphics().setDepth(1);
    mark.fillStyle(0x22f0a0, 1);
    mark.fillPoints([new Phaser.Geom.Point(24, 52), new Phaser.Geom.Point(39, 38), new Phaser.Geom.Point(54, 52), new Phaser.Geom.Point(54, 62), new Phaser.Geom.Point(39, 54), new Phaser.Geom.Point(24, 62)], true);
    mark.fillPoints([new Phaser.Geom.Point(24, 66), new Phaser.Geom.Point(39, 58), new Phaser.Geom.Point(54, 66), new Phaser.Geom.Point(54, 88), new Phaser.Geom.Point(39, 98), new Phaser.Geom.Point(24, 88)], true);
    mark.fillStyle(0x0a2018, 1);
    mark.fillRect(35, 44, 8, 10);
    mark.fillRect(31, 72, 16, 8);
    this.add.text(69, 58, 'GAMDOM', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '42px',
      color: '#39ffac',
      stroke: '#081018',
      strokeThickness: 6,
    }).setOrigin(0, 0.5);

    this.add.text(166, 105, 'RUN', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '39px',
      color: '#27f2a1',
      stroke: '#081018',
      strokeThickness: 8,
      fontStyle: 'italic',
    }).setOrigin(0.5);

    this.add.text(160, 151, 'RUN THE CITY. MAKE IT COUNT.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      color: '#d7eee3',
      letterSpacing: 1,
    }).setOrigin(0.5);

    const portraits = [
      { texture: 'gamby', name: 'GAMDOM BOT', subtitle: 'Gamby' },
      { texture: 'steve', name: 'THE LEGEND', subtitle: 'Steve' },
      { texture: 'yungreal', name: 'BALD RUNNER', subtitle: 'Yungreal' },
    ];
    const cards: Phaser.GameObjects.Rectangle[] = [];
    const glows: Phaser.GameObjects.Rectangle[] = [];
    const selectedPortrait = portraits[this.selectedCharacter];
    const hero = this.add.sprite(393, 373, selectedPortrait.texture, 0).setScale(1.2).setDepth(2);
    portraits.forEach((portrait, index) => {
      const x = 54 + index * 106;
      const glow = this.add.rectangle(x, 285, 102, 182, 0x1bff9c, 0.12).setDepth(0);
      glow.setBlendMode(Phaser.BlendModes.ADD).setVisible(index === this.selectedCharacter);
      glows.push(glow);
      const initiallySelected = index === this.selectedCharacter;
      const card = this.add.rectangle(x, 285, 94, 174, 0x061b16, 0.96).setStrokeStyle(initiallySelected ? 3 : 1.5, initiallySelected ? 0x31ffab : 0x17563d, 1).setDepth(1);
      cards.push(card);
      const sprite = this.add.sprite(x, 267, portrait.texture, 0).setScale(1.4).setDepth(2);
      this.add.text(x, 335, portrait.name, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '9px',
        color: '#d7eee3',
        stroke: '#04100c',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(2);
      this.add.text(x, 351, portrait.subtitle.toUpperCase(), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '8px',
        color: '#73efb4',
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(2);
      const choose = (): void => {
        this.selectedCharacter = index;
        this.registry.set('selectedCharacter', index);
        cards.forEach((entry, cardIndex) => {
          const active = cardIndex === index;
          entry.setStrokeStyle(active ? 3 : 1.5, active ? 0x31ffab : 0x17563d, 1);
          glows[cardIndex].setVisible(active);
        });
        hero.setTexture(portrait.texture, 0);
      };
      card.setInteractive({ useHandCursor: true }).on('pointerdown', choose);
      sprite.setInteractive({ useHandCursor: true }).on('pointerdown', choose);
    });

    this.tweens.add({ targets: hero, x: 423, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    let runFrame = 0;
    this.time.addEvent({ delay: 150, loop: true, callback: () => { runFrame = runFrame === 0 ? 2 : 0; hero.setFrame(runFrame); } });
    [493, 540, 587, 634].forEach((x, index) => {
      this.add.image(x, 404 - (index % 2) * 3, 'cash-coin').setDisplaySize(36, 36).setDepth(2);
    });
    this.add.image(704, 393, 'cash-crate').setDisplaySize(60, 52).setDepth(2);
    this.add.text(704, 400, '-$100', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '9px',
      color: '#ff6660',
      stroke: '#270b13',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3);
    this.add.image(779, 395, 'traffic-cone').setDisplaySize(42, 48).setDepth(2);
    this.add.image(765, 280, 'bird').setDisplaySize(76, 46).setDepth(2);

    const previewHud = this.add.graphics().setDepth(2);
    previewHud.fillStyle(0x03110f, 0.94);
    previewHud.fillRoundedRect(340, 15, 145, 46, 7);
    previewHud.lineStyle(2, 0x1ee99b, 0.9);
    previewHud.strokeRoundedRect(340, 15, 145, 46, 7);
    previewHud.fillStyle(0x03110f, 0.94);
    previewHud.fillRoundedRect(493, 15, 128, 46, 7);
    previewHud.lineStyle(2, 0x1ee99b, 0.7);
    previewHud.strokeRoundedRect(493, 15, 128, 46, 7);
    this.add.text(355, 19, '$ 1,240', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '17px', color: '#f5fff9', stroke: '#04110d', strokeThickness: 3 }).setDepth(3);
    this.add.text(508, 19, '876 m', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '17px', color: '#f5fff9', stroke: '#04110d', strokeThickness: 3 }).setDepth(3);
    const pauseIcon = this.add.graphics().setDepth(3);
    pauseIcon.fillStyle(0x061310, 0.96);
    pauseIcon.fillRoundedRect(width - 47, 12, 38, 38, 7);
    pauseIcon.lineStyle(2, 0xa4e9ca, 0.9);
    pauseIcon.strokeRoundedRect(width - 47, 12, 38, 38, 7);
    pauseIcon.fillStyle(0xf0fff7, 1);
    pauseIcon.fillRoundedRect(width - 36, 21, 5, 20, 2);
    pauseIcon.fillRoundedRect(width - 26, 21, 5, 20, 2);

    const startButton = this.add.container(160, 407);
    const buttonBody = this.add.rectangle(0, 0, 224, 50, 0x20efa0, 1);
    const playIcon = this.add.graphics();
    playIcon.fillStyle(0x031217, 1);
    playIcon.fillTriangle(-58, -12, -58, 12, -34, 0);
    const buttonText = this.add.text(12, 0, 'PLAY', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '26px',
      color: '#031217',
    }).setOrigin(0.5);
    startButton.add([buttonBody, playIcon, buttonText]);
    buttonBody.setStrokeStyle(3, 0xb7ffd9, 0.9);
    startButton.setSize(224, 50);
    startButton.setInteractive({ useHandCursor: true });
    startButton.on('pointerover', () => {
      buttonBody.setFillStyle(0x5affb5, 1);
    });
    startButton.on('pointerout', () => {
      buttonBody.setFillStyle(0x20efa0, 1);
    });
    startButton.on('pointerdown', () => {
      requestLandscapePresentation(this.game);
      this.scene.start('Runner', { selectedCharacter: this.selectedCharacter });
    });

    const makeFooterIcon = (x: number, draw: (g: Phaser.GameObjects.Graphics) => void, onClick: () => void): void => {
      const wrap = this.add.container(x, 480);
      const ring = this.add.circle(0, 0, 16, 0x061310, 0.96).setStrokeStyle(2, 0x31ffab, 0.85);
      const icon = this.add.graphics();
      draw(icon);
      wrap.add([ring, icon]);
      wrap.setSize(34, 34).setInteractive({ useHandCursor: true });
      wrap.on('pointerdown', onClick);
    };
    makeFooterIcon(42, (g) => {
      g.lineStyle(2, 0xd7f7ff, 1);
      g.lineBetween(-5, -6, -5, 8);
      g.lineBetween(0, -8, 0, 10);
      g.lineBetween(5, -4, 5, 6);
    }, () => { this.musicOn = !this.musicOn; });
    makeFooterIcon(108, (g) => {
      g.lineStyle(2, 0xd7f7ff, 1);
      g.strokeCircle(0, 0, 7);
      g.lineBetween(0, -10, 0, -4);
    }, () => { this.soundOn = !this.soundOn; });
    makeFooterIcon(174, (g) => {
      g.lineStyle(2, 0xd7f7ff, 1);
      g.strokeCircle(0, 0, 7);
      g.lineBetween(0, 2, 0, 6);
      g.fillStyle(0xd7f7ff, 1);
      g.fillCircle(0, -1, 1.5);
    }, () => { this.scene.start('CharacterSelect'); });
    this.add.text(216, 480, 'SETTINGS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#d7f7ff',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.scene.start('CharacterSelect');
    });
  }
}
