import Phaser from 'phaser';
import { requestLandscapePresentation } from '../../mobilePresentation';

interface CharacterOption {
  id: number;
  name: string;
  cardTitle: string;
  label: string;
  texture: string;
}

export class CharacterSelectScene extends Phaser.Scene {
  private characters: CharacterOption[] = [
    { id: 0, name: 'Gamby', cardTitle: 'GAMDOM BOT', label: 'Gamdom robot', texture: 'gamby' },
    { id: 1, name: 'Steve', cardTitle: 'THE LEGEND', label: 'Street legend', texture: 'steve' },
    { id: 2, name: 'Yungreal', cardTitle: 'BALD RUNNER', label: 'City icon', texture: 'yungreal' },
  ];

  private selected = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private readonly cardY = 230;

  constructor() {
    super('CharacterSelect');
  }

  init(data: { selectedCharacter?: number } = {}): void {
    const persistedCharacter = this.registry.get('selectedCharacter');
    const requestedCharacter = data.selectedCharacter ?? (typeof persistedCharacter === 'number' ? persistedCharacter : 0);
    this.selected = Phaser.Math.Clamp(Math.floor(requestedCharacter), 0, this.characters.length - 1);
    this.cards = [];
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#040710');
    this.add.image(width / 2, height / 2, 'casino-city').setDisplaySize(width * 1.15, height).setAlpha(0.35).setDepth(-2);
    this.add.rectangle(width / 2, height / 2, width, height, 0x03110e, 0.72).setDepth(-1);

    this.add.text(width * 0.5, 26, 'CHOOSE YOUR RUNNER', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '32px',
      color: '#39ffac',
      stroke: '#081018',
      strokeThickness: 6,
    }).setOrigin(0.5);

    const cardWidth = 210;
    const cardHeight = 260;
    const startX = width / 2 - (cardWidth * 1.5 + 28);
    this.characters.forEach((character, index) => {
      const card = this.add.container(startX + index * (cardWidth + 28), this.cardY);
      const glow = this.add.rectangle(0, 0, cardWidth + 12, cardHeight + 12, 0x1bff9c, 0.12);
      glow.setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      const body = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x061b16, 0.96);
      body.setStrokeStyle(2, 0x17563d, 1);
      body.setInteractive({ useHandCursor: true });

      const portrait = this.add.sprite(0, -14, character.texture, 0).setScale(1.5);
      card.add([glow, body, portrait]);

      const name = this.add.text(0, 74, character.name.toUpperCase(), {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '18px',
        color: '#39ffac',
        stroke: '#04100c',
        strokeThickness: 4,
      }).setOrigin(0.5);
      const label = this.add.text(0, 98, character.cardTitle, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '13px',
        color: '#d7eee3',
        stroke: '#04100c',
        strokeThickness: 4,
      }).setOrigin(0.5);
      const sub = this.add.text(0, 122, character.label, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        color: '#73efb4',
      }).setOrigin(0.5);
      card.add([name, label, sub]);

      card.setSize(cardWidth, cardHeight);
      card.setData('id', character.id);
      card.setDepth(1);

      body.on('pointerdown', () => {
        this.selectCharacter(character.id);
      });

      this.cards.push(card);
    });

    this.selectCharacter(this.selected);

    const backBtn = this.add.text(36, 36, '← MENU', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '14px',
      color: '#d7f7ff',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('Menu'));

    const playBtn = this.add.container(width * 0.5, 440);
    const playBody = this.add.rectangle(0, 0, 224, 50, 0x20efa0, 1);
    playBody.setStrokeStyle(3, 0xb7ffd9, 0.9);
    const playText = this.add.text(0, 0, 'PLAY', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '26px',
      color: '#031217',
    }).setOrigin(0.5);
    playBtn.add([playBody, playText]);
    playBtn.setSize(224, 50);
    playBtn.setInteractive({ useHandCursor: true });
    playBtn.on('pointerdown', () => {
      requestLandscapePresentation(this.game);
      this.scene.start('Runner', { selectedCharacter: this.selected });
    });
  }

  private selectCharacter(id: number): void {
    this.selected = Phaser.Math.Clamp(Math.floor(id), 0, this.characters.length - 1);
    this.registry.set('selectedCharacter', this.selected);
    this.cards.forEach((card, index) => {
      const glow = card.list[0] as Phaser.GameObjects.Rectangle;
      const body = card.list[1] as Phaser.GameObjects.Rectangle;
      const active = index === this.selected;
      glow.setVisible(active);
      body.setFillStyle(0x061b16, 0.96);
      body.setStrokeStyle(active ? 3 : 1.5, active ? 0x31ffab : 0x17563d, 1);
      card.setScale(active ? 1.04 : 1);
      card.setY(active ? this.cardY - 10 : this.cardY);
    });
  }
}
