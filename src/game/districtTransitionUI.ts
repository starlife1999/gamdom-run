import Phaser from 'phaser';

interface DistrictBoundary {
  name: string;
  time: number;
}

const HALF_DURATION = 0.7;

export interface DistrictTransitionPresentation {
  active: boolean;
  name: string;
  veilAlpha: number;
  titleAlpha: number;
  titleOffset: number;
  sweepProgress: number;
  sweepAlpha: number;
}

export class DistrictTransitionUI {
  private readonly veil: Phaser.GameObjects.Rectangle;
  private readonly sweep: Phaser.GameObjects.Graphics;
  private readonly accent: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private nextBoundary = 0;
  private active?: DistrictBoundary;
  private readonly centerX: number;
  private readonly titleY: number;
  private readonly presentation: DistrictTransitionPresentation = {
    active: false, name: '', veilAlpha: 0, titleAlpha: 0,
    titleOffset: 0, sweepProgress: 0, sweepAlpha: 0,
  };

  constructor(private readonly scene: Phaser.Scene, private readonly boundaries: readonly DistrictBoundary[]) {
    const { width, height } = scene.scale;
    this.centerX = width / 2;
    this.titleY = height * 0.4;
    this.veil = scene.add.rectangle(0, 0, width, height, 0x020b09)
      .setOrigin(0).setDepth(18.2).setVisible(false);
    this.sweep = scene.add.graphics().setDepth(18.3).setVisible(false);
    this.accent = scene.add.graphics().setDepth(18.4).setVisible(false);
    this.accent.fillStyle(0x31ef9f, 0.12).fillRect(this.centerX - 66, this.titleY + 25, 132, 5);
    this.accent.fillStyle(0x31ef9f, 0.85).fillRect(this.centerX - 66, this.titleY + 27, 96, 1);
    this.accent.fillStyle(0xd9b95d, 0.9).fillRect(this.centerX + 34, this.titleY + 27, 32, 1);
    const sweepY = this.titleY + 40;
    this.sweep.fillStyle(0x31ef9f, 0.04).fillRect(0, sweepY - 5, 240, 10);
    this.sweep.fillStyle(0x31ef9f, 0.12).fillRect(0, sweepY - 2, 240, 4);
    this.sweep.fillStyle(0x90ffd0, 0.65).fillRect(0, sweepY, 240, 1);
    this.title = scene.add.text(this.centerX, this.titleY, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#f1fff8',
      stroke: '#04110d',
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 0, color: '#31ef9f', blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(18.5).setVisible(false);
  }

  getPresentation(): Readonly<DistrictTransitionPresentation> {
    return this.presentation;
  }

  update(runElapsed: number): void {
    // Advancing this cursor, rather than starting tweens every frame, guarantees one entry per run.
    while (this.nextBoundary < this.boundaries.length
      && runElapsed >= this.boundaries[this.nextBoundary].time - HALF_DURATION) {
      const boundary = this.boundaries[this.nextBoundary++];
      if (runElapsed < boundary.time + HALF_DURATION) {
        this.active = boundary;
        this.title.setText(boundary.name);
      }
    }

    if (!this.active) return;
    const relative = runElapsed - this.active.time;
    if (relative >= HALF_DURATION) {
      this.hide();
      this.active = undefined;
      return;
    }

    const enter = Phaser.Math.SmoothStep(relative, -HALF_DURATION, -0.15);
    const exit = Phaser.Math.SmoothStep(relative, 0.15, HALF_DURATION);
    const titleAlpha = enter * (1 - exit);
    const titleX = this.centerX - 28 * (1 - enter) + 28 * exit;
    // Hold peak masking across the swap and neighboring frames, using the run clock only.
    const cover = Phaser.Math.SmoothStep(relative, -HALF_DURATION, -0.08);
    const reveal = Phaser.Math.SmoothStep(relative, 0.08, HALF_DURATION);
    const veilAlpha = 0.82 * cover * (1 - reveal);
    this.veil.setVisible(true).setAlpha(veilAlpha);
    this.title.setVisible(true).setPosition(titleX, this.titleY).setAlpha(titleAlpha);
    this.accent.setVisible(true).setAlpha(titleAlpha).setX(titleX - this.centerX);

    const sweepProgress = Phaser.Math.Clamp((relative + 0.18) / 0.36, 0, 1);
    const sweepAlpha = Math.sin(Math.PI * sweepProgress);
    this.sweep.setVisible(sweepProgress > 0 && sweepProgress < 1);
    if (this.sweep.visible) {
      const x = Phaser.Math.Linear(-240, this.scene.scale.width, sweepProgress);
      this.sweep.setX(x).setAlpha(sweepAlpha);
    }
    Object.assign(this.presentation, {
      active: true, name: this.active.name, veilAlpha, titleAlpha,
      titleOffset: titleX - this.centerX, sweepProgress, sweepAlpha,
    });
  }

  private hide(): void {
    Object.assign(this.presentation, { active: false, name: '', veilAlpha: 0, titleAlpha: 0, sweepAlpha: 0 });
    this.veil.setVisible(false);
    this.title.setVisible(false).setText('');
    this.accent.setVisible(false);
    this.sweep.setVisible(false);
  }

  destroy(): void {
    this.active = undefined;
    this.presentation.active = false;
    this.veil.destroy();
    this.title.destroy();
    this.accent.destroy();
    this.sweep.destroy();
  }
}
