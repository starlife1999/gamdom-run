import Phaser from 'phaser';

export interface CashRushPresentation {
  active: boolean;
  activationPulse: number;
  remainingFraction: number;
}

interface RewardSpark {
  image: Phaser.GameObjects.Graphics;
  startedAt: number;
  x: number;
  y: number;
}

export class CashRushVisuals {
  private readonly streaks: Phaser.GameObjects.Graphics[] = [];
  private readonly sparks: RewardSpark[] = [];
  private readonly presentation: CashRushPresentation = { active: false, activationPulse: 0, remainingFraction: 0 };
  private activatedAt = -Infinity;
  private nextSpark = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly pulse: Phaser.GameObjects.Graphics,
    private readonly left: number,
    private readonly right: number,
    private readonly duration: number,
  ) {
    const { height } = scene.scale;
    pulse.setName('cash-rush-pulse').clear().lineStyle(2, 0xffe36f, 0.85);
    for (const x of [left + 6, right - 6]) for (const y of [104, height - 8]) {
      const dx = x < (left + right) / 2 ? 22 : -22;
      const dy = y < height / 2 ? 16 : -16;
      pulse.lineBetween(x, y, x + dx, y).lineBetween(x, y, x, y + dy);
    }
    const lanes = [112, 130, 148, height - 18, height - 34, height - 50];
    for (const y of lanes) {
      const image = scene.add.graphics().setDepth(10.2).setName('cash-rush-streak').setVisible(false).setActive(false);
      image.lineStyle(1.5, 0xffd95a, 0.72).lineBetween(0, 0, 36, 0);
      image.lineStyle(1, 0xfff1b0, 0.9).lineBetween(36, 0, 48, 0);
      image.setY(y);
      this.streaks.push(image);
    }
    for (let i = 0; i < 6; i++) {
      const image = scene.add.graphics().setDepth(10.5).setName('cash-rush-reward').setVisible(false).setActive(false);
      image.lineStyle(1.5, 0xffe36f, 0.9);
      image.lineBetween(-14, 0, -5, 0).lineBetween(5, 0, 14, 0);
      image.lineBetween(0, -12, 0, -5).lineBetween(0, 5, 0, 12);
      image.fillStyle(0xfff1b0, 0.85).fillCircle(-10, -8, 1.5).fillCircle(11, 7, 1.5);
      this.sparks.push({ image, startedAt: -Infinity, x: 0, y: 0 });
    }
  }

  getPresentation(): Readonly<CashRushPresentation> {
    return this.presentation;
  }

  activate(elapsed: number): void {
    this.activatedAt = elapsed;
    this.presentation.active = true;
    this.presentation.activationPulse = 1;
    this.pulse.setVisible(true).setActive(true).setAlpha(1);
  }

  collect(x: number, y: number, elapsed: number): void {
    const spark = this.sparks[this.nextSpark];
    this.nextSpark = (this.nextSpark + 1) % this.sparks.length;
    spark.startedAt = elapsed;
    spark.x = x;
    spark.y = y;
    spark.image.setPosition(x, y).setScale(0.65).setAlpha(0.75).setActive(true).setVisible(true);
  }

  update(elapsed: number, remaining: number): void {
    if (remaining <= 0) {
      if (this.presentation.active) this.reset();
      return;
    }
    this.presentation.active = true;
    this.presentation.remainingFraction = Phaser.Math.Clamp(remaining / this.duration, 0, 1);
    const pulse = Math.max(0, 1 - (elapsed - this.activatedAt) / 0.32);
    this.presentation.activationPulse = pulse;
    this.pulse.setVisible(pulse > 0).setActive(pulse > 0).setAlpha(pulse * pulse);
    const fade = Math.min(1, remaining / 0.25);
    const span = this.right - this.left + 48;
    this.streaks.forEach((image, i) => {
      const x = this.right - ((elapsed * (220 + i * 23) + i * 137) % span);
      image.setX(x).setAlpha((0.22 + 0.06 * Math.sin(elapsed * 3 + i)) * fade).setActive(true).setVisible(true);
    });
    for (const spark of this.sparks) {
      const age = elapsed - spark.startedAt;
      if (age >= 0.3) {
        spark.image.setVisible(false).setActive(false);
        continue;
      }
      const progress = age / 0.3;
      spark.image.setPosition(spark.x - 70 * age, spark.y - 28 * age)
        .setScale(0.65 + progress * 0.3).setAlpha(0.75 * (1 - progress) ** 2);
    }
  }

  reset(): void {
    this.presentation.active = false;
    this.presentation.activationPulse = 0;
    this.presentation.remainingFraction = 0;
    this.activatedAt = -Infinity;
    this.nextSpark = 0;
    this.pulse.setVisible(false).setActive(false).setAlpha(0);
    for (const image of this.streaks) image.setVisible(false).setActive(false).setAlpha(0);
    for (const spark of this.sparks) {
      spark.startedAt = -Infinity;
      spark.image.setVisible(false).setActive(false).setAlpha(0);
    }
  }

  destroy(): void {
    this.presentation.active = false;
    this.presentation.activationPulse = 0;
    this.presentation.remainingFraction = 0;
    for (const image of this.streaks) image.destroy();
    for (const spark of this.sparks) spark.image.destroy();
  }
}
