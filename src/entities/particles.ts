import Phaser from 'phaser';
import { hash01 } from '../core/rng';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  grav: number;
  square: boolean;
}

/** Pooled Graphics-only particle puff (dust, sparks, coin bursts). */
export class Particles {
  private list: Particle[] = [];
  private readonly max = 320;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private seed = 1;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(20);
  }

  burst(
    x: number,
    y: number,
    count: number,
    color: number,
    opts: { spread?: number; speed?: number; up?: number; grav?: number; life?: number; size?: number; square?: boolean } = {},
  ): void {
    const spread = opts.spread ?? Math.PI * 2;
    const speed = opts.speed ?? 180;
    const up = opts.up ?? 0;
    const grav = opts.grav ?? 900;
    const life = opts.life ?? 0.5;
    const size = opts.size ?? 4;
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = -Math.PI / 2 + (hash01(this.seed + i) - 0.5) * spread;
      const s = speed * (0.35 + hash01(this.seed + i * 3.7) * 0.75);
      this.seed += 1;
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - up,
        life,
        maxLife: life,
        size: size * (0.6 + hash01(this.seed * 1.7) * 0.8),
        color,
        grav,
        square: opts.square ?? true,
      });
    }
  }

  update(dt: number, scroll: number): void {
    const g = this.gfx;
    g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += (p.vx - scroll * 0.6) * dt;
      p.y += p.vy * dt;
      const k = p.life / p.maxLife;
      const s = Math.max(1, p.size * k);
      g.fillStyle(p.color, Math.min(1, k * 1.2));
      if (p.square) g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      else g.fillCircle(p.x, p.y, s / 2);
    }
  }

  clear(): void {
    this.list.length = 0;
    this.gfx.clear();
  }
}
