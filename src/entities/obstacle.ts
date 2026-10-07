import Phaser from 'phaser';
import { COL, GROUND_Y, HITBOX_INSET } from '../config';
import { Rect } from '../core/util';
import { hash01 } from '../core/rng';
import { Theme } from '../world/theme';

export type ObstacleKind = 'spike' | 'crate' | 'stack' | 'pillar' | 'bar' | 'drone' | 'saw' | 'gap';
export type RequiredAction = 'jump' | 'slide' | 'any';

export interface ObstacleSpec {
  kind: ObstacleKind;
  /** Left edge in screen space at spawn time. */
  x: number;
  w: number;
  h?: number;
}

/** A single hazard. Ground pits are hazards too (isGap), handled by the ground. */
export class Obstacle {
  readonly kind: ObstacleKind;
  x: number;
  w: number;
  h: number;
  y: number;
  private baseY: number;
  private t = 0;
  private rot = 0;
  passed = false;
  extraSpeed = 0;

  constructor(spec: ObstacleSpec) {
    this.kind = spec.kind;
    this.x = spec.x;
    this.w = spec.w;
    const h = spec.h ?? 0;
    this.h = h;
    switch (spec.kind) {
      case 'bar':
        this.y = GROUND_Y - 178;
        this.h = 138;
        break;
      case 'drone':
        this.h = h || 36;
        this.y = GROUND_Y - 92;
        break;
      case 'saw':
        this.h = h || 52;
        this.y = GROUND_Y - this.h;
        this.extraSpeed = 70;
        break;
      case 'gap':
        this.y = GROUND_Y;
        this.h = 0;
        break;
      default:
        this.h = h || 40;
        this.y = GROUND_Y - this.h;
        break;
    }
    this.baseY = this.y;
  }

  get isGap(): boolean {
    return this.kind === 'gap';
  }

  get right(): number {
    return this.x + this.w;
  }

  get offscreen(): boolean {
    return this.right < -120;
  }

  update(dt: number, speed: number): void {
    this.t += dt;
    this.x -= (speed + this.extraSpeed) * dt;
    if (this.kind === 'drone') {
      this.y = this.baseY + Math.sin(this.t * 2.4 + hash01(this.x0Seed()) * 6) * 26;
    }
    if (this.kind === 'saw') this.rot += dt * (6 + speed / 90);
  }

  private x0Seed(): number {
    return Math.abs(Math.round(this.baseY + this.w)) || 1;
  }

  /** Null for pits - the ground collision path handles those. */
  hitbox(): Rect | null {
    if (this.isGap) return null;
    if (this.kind === 'drone') {
      return { x: this.x + 5, y: this.y + 4, w: this.w - 10, h: this.h - 8 };
    }
    return { x: this.x + HITBOX_INSET, y: this.y + HITBOX_INSET, w: this.w - HITBOX_INSET * 2, h: this.h - HITBOX_INSET };
  }

  render(g: Phaser.GameObjects.Graphics, theme: Theme, time: number): void {
    switch (this.kind) {
      case 'spike':
        this.drawSpikes(g);
        break;
      case 'crate':
      case 'stack':
        this.drawCrate(g, theme);
        break;
      case 'pillar':
        this.drawPillar(g, theme);
        break;
      case 'bar':
        this.drawBar(g, theme);
        break;
      case 'drone':
        this.drawDrone(g, theme, time);
        break;
      case 'saw':
        this.drawSaw(g, theme);
        break;
      case 'gap':
        break;
    }
  }

  private drawSpikes(g: Phaser.GameObjects.Graphics): void {
    const n = Math.max(1, Math.round(this.w / 22));
    const step = this.w / n;
    g.fillStyle(COL.ink, 0.35);
    g.fillRect(this.x, GROUND_Y - 4, this.w, 6);
    for (let i = 0; i < n; i++) {
      const x0 = this.x + i * step;
      g.fillStyle(COL.spike, 1);
      g.fillTriangle(x0, GROUND_Y, x0 + step / 2, GROUND_Y - this.h, x0 + step, GROUND_Y);
      g.fillStyle(COL.danger, 1);
      g.fillTriangle(x0 + step * 0.34, GROUND_Y, x0 + step / 2, GROUND_Y - this.h * 0.86, x0 + step * 0.55, GROUND_Y);
    }
  }

  private drawCrate(g: Phaser.GameObjects.Graphics, theme: Theme): void {
    g.fillStyle(COL.ink, 0.3);
    g.fillRect(this.x + 4, this.y + 6, this.w, this.h);
    g.fillStyle(COL.hazard, 1);
    g.fillRect(this.x, this.y, this.w, this.h);
    g.fillStyle(COL.ink, 0.55);
    g.fillRect(this.x + 5, this.y + 5, this.w - 10, this.h - 10);
    g.fillStyle(theme.accent, 0.9);
    g.fillRect(this.x + 9, this.y + this.h / 2 - 2, this.w - 18, 4);
  }

  private drawPillar(g: Phaser.GameObjects.Graphics, theme: Theme): void {
    g.fillStyle(COL.ink, 0.3);
    g.fillRect(this.x + 5, this.y + 6, this.w, this.h);
    g.fillStyle(theme.city, 1);
    g.fillRect(this.x, this.y, this.w, this.h);
    g.fillStyle(theme.accent, 1);
    g.fillRect(this.x, this.y, this.w, 6);
    g.lineStyle(2, theme.accent, 0.5);
    g.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(theme.cityLit, 0.85);
      g.fillRect(this.x + this.w / 2 - 3, this.y + 16 + i * (this.h / 5), 6, 8);
    }
  }

  private drawBar(g: Phaser.GameObjects.Graphics, theme: Theme): void {
    // hanging laser gate: bottom edge sits at GROUND_Y - 40, so only a slide fits
    const bottom = this.y + this.h;
    g.fillStyle(theme.city, 1);
    g.fillRect(this.x, 0, this.w, this.y + 8);
    g.fillStyle(COL.ink, 1);
    g.fillRect(this.x - 4, this.y, this.w + 8, 12);
    g.fillStyle(COL.danger, 0.9);
    g.fillRect(this.x, bottom - 26, this.w, 8);
    g.lineStyle(3, COL.danger, 0.55 + Math.sin(this.t * 12) * 0.35);
    g.lineBetween(this.x, this.y + 14, this.x, bottom - 22);
    g.lineBetween(this.x + this.w, this.y + 14, this.x + this.w, bottom - 22);
    g.fillStyle(theme.accent, 1);
    g.fillRect(this.x - 4, bottom - 8, this.w + 8, 8);
  }

  private drawDrone(g: Phaser.GameObjects.Graphics, theme: Theme, time: number): void {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    g.fillStyle(COL.ink, 0.9);
    g.fillRoundedRect(this.x, this.y + 6, this.w, this.h - 10, 8);
    g.fillStyle(theme.cityLit, 1);
    g.fillRect(this.x + 6, this.y + this.h - 16, this.w - 12, 5);
    g.fillStyle(COL.danger, 1);
    g.fillCircle(cx, cy - 2, 6);
    g.lineStyle(3, theme.accent, 0.8);
    const spin = Math.sin(this.t * 20) * 12;
    g.lineBetween(cx - 20 - spin * 0.2, this.y + 2, cx + 20 + spin * 0.2, this.y + 2);
  }

  private drawSaw(g: Phaser.GameObjects.Graphics, theme: Theme): void {
    const r = this.w / 2;
    const cx = this.x + r;
    const cy = GROUND_Y - r + 6;
    g.fillStyle(COL.ink, 0.3);
    g.fillEllipse(cx, GROUND_Y + 4, this.w, 8);
    g.fillStyle(COL.spike, 1);
    for (let i = 0; i < 10; i++) {
      const a = this.rot + (i / 10) * Math.PI * 2;
      const a2 = a + 0.22;
      g.fillTriangle(
        cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6),
        cx + Math.cos(a2) * (r - 6), cy + Math.sin(a2) * (r - 6),
        cx + Math.cos((a + a2) / 2) * (r + 8), cy + Math.sin((a + a2) / 2) * (r + 8),
      );
    }
    g.fillStyle(COL.danger, 1);
    g.fillCircle(cx, cy, r - 8);
    g.fillStyle(theme.pit, 1);
    g.fillCircle(cx, cy, 5);
  }
}

