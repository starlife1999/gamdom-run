import Phaser from 'phaser';
import { COL, GROUND_Y } from '../config';
import { Rect } from '../core/util';
import { Theme } from '../world/theme';

export type PickupKind = 'coin' | 'shield' | 'x2';

/** Spinning coin / power-up drawn with Graphics only. */
export class Pickup {
  x: number;
  y: number;
  r = 11;
  taken = false;
  readonly kind: PickupKind;
  private t: number;

  constructor(kind: PickupKind, x: number, y: number, seed = 0) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.t = seed;
    if (kind !== 'coin') this.r = 15;
  }

  get offscreen(): boolean {
    return this.x < -60;
  }

  hitbox(): Rect {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 };
  }

  update(dt: number, speed: number): void {
    this.t += dt;
    this.x -= speed * dt;
  }

  render(g: Phaser.GameObjects.Graphics, theme: Theme): void {
    const bob = Math.sin(this.t * 4) * 4;
    const cx = this.x;
    const cy = this.y + bob;

    if (this.kind === 'coin') {
      const squash = Math.abs(Math.cos(this.t * 3.4));
      const rw = Math.max(2.5, this.r * squash);
      g.fillStyle(COL.coin, 0.22);
      g.fillCircle(cx, cy, this.r + 5);
      g.fillStyle(COL.coin, 1);
      g.fillEllipse(cx, cy, rw * 2, this.r * 2);
      g.fillStyle(0xfff3c4, 1);
      g.fillEllipse(cx - rw * 0.25, cy - 2, rw, this.r * 0.9);
      g.fillStyle(theme.ground, 0.55);
      g.fillRect(cx - 1, cy - this.r * 0.5, 2, this.r);
    } else if (this.kind === 'shield') {
      g.fillStyle(COL.shield, 0.2 + Math.sin(this.t * 6) * 0.1);
      g.fillCircle(cx, cy, this.r + 7);
      g.fillStyle(COL.shield, 1);
      g.fillPoints(
        [
          { x: cx, y: cy - this.r },
          { x: cx + this.r, y: cy - this.r * 0.35 },
          { x: cx, y: cy + this.r },
          { x: cx - this.r, y: cy - this.r * 0.35 },
        ],
        true,
      );
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(cx - 2, cy - 7, 4, 14);
      g.fillRect(cx - 7, cy - 2, 14, 4);
    } else {
      g.fillStyle(COL.x2, 0.2 + Math.sin(this.t * 6) * 0.1);
      g.fillCircle(cx, cy, this.r + 7);
      g.fillStyle(COL.x2, 1);
      g.fillRoundedRect(cx - this.r, cy - this.r * 0.75, this.r * 2, this.r * 1.5, 5);
      g.fillStyle(0x08060f, 1);
      g.fillRect(cx - 9, cy - 1, 6, 3);
      g.fillRect(cx + 3, cy - 1, 6, 3);
      g.fillRect(cx - 8, cy - 6, 3, 5);
      g.fillRect(cx + 5, cy + 1, 3, 5);
    }
    // shadow on the floor keeps pickups readable against the ground line
    g.fillStyle(COL.ink, 0.14);
    g.fillEllipse(cx, GROUND_Y + 4, this.r * 1.6, 5);
  }
}
