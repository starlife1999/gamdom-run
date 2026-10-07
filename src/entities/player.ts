import Phaser from 'phaser';
import {
  AIRJUMP_V, COL, COYOTE_TIME, DASH_BONUS, DASH_TIME, GRAVITY, GROUND_Y, HITBOX_INSET,
  JUMP_BUFFER, JUMP_V, KILL_Y, MAX_FALL, PLAYER_X, SLIDE_H, SLIDE_TIME, STAND_H, STAND_W,
} from '../config';
import { clamp, Rect } from '../core/util';
import { Particles } from './particles';

export interface PlayerInput {
  jumpPressed: boolean;
  slideHeld: boolean;
  dashPressed: boolean;
}

export interface PlayerEvents {
  onJump(double: boolean): void;
  onLand(power: number): void;
  onDash(): void;
  onFall(): void;
}

/**
 * The runner. Custom AABB physics (no Arcade bodies, no textures) plus a
 * Graphics-only renderer: run cycle, slide, dash streaks, shield, squash.
 */
export class Player {
  x = PLAYER_X;
  y = GROUND_Y; // feet
  vy = 0;
  w = STAND_W;
  h = STAND_H;
  onGround = true;
  sliding = false;
  dashing = false;
  alive = true;
  jumpsLeft = 2;
  invuln = 0;
  shield = 0;
  anim = 0;
  squash = 1;
  private dashCooldown = 0;
  private coyote = 0;
  private buffer = 0;
  private slideT = 0;
  private dashT = 0;
  private readonly gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private readonly fx: Particles, private readonly events: PlayerEvents) {
    this.gfx = scene.add.graphics().setDepth(30);
  }

  reset(): void {
    this.x = PLAYER_X;
    this.y = GROUND_Y;
    this.vy = 0;
    this.onGround = true;
    this.sliding = false;
    this.dashing = false;
    this.alive = true;
    this.jumpsLeft = 2;
    this.invuln = 0;
    this.shield = 0;
    this.dashCooldown = 0;
    this.coyote = 0;
    this.buffer = 0;
    this.slideT = 0;
    this.dashT = 0;
    this.squash = 1;
  }

  get dashBoost(): number {
    return this.dashing ? DASH_BONUS : 0;
  }

  hitbox(): Rect {
    return {
      x: this.x - this.w / 2 + HITBOX_INSET,
      y: this.y - this.h + HITBOX_INSET,
      w: this.w - HITBOX_INSET * 2,
      h: this.h - HITBOX_INSET,
    };
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.vy = -500;
    this.invuln = 9999;
  }

  hurt(): 'shield' | 'dead' {
    if (this.invuln > 0 || !this.alive) return 'shield';
    if (this.shield > 0) {
      this.shield -= 1;
      this.invuln = 1.1;
      this.fx.burst(this.x, this.y - this.h / 2, 22, COL.shield, { speed: 320, life: 0.45, size: 5 });
      return 'shield';
    }
    this.kill();
    return 'dead';
  }


  update(dt: number, groundAhead: boolean, input: PlayerInput): void {
    if (!this.alive) {
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      this.anim += dt;
      return;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    this.buffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, this.buffer - dt);

    // slide
    if (input.slideHeld && this.onGround && !this.sliding) {
      this.sliding = true;
      this.slideT = SLIDE_TIME;
    }
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0 || !input.slideHeld) this.sliding = false;
    }
    this.h = this.sliding ? SLIDE_H : STAND_H;

    // dash
    if (input.dashPressed && !this.dashing && this.dashCooldown <= 0) {
      this.dashing = true;
      this.dashT = DASH_TIME;
      this.dashCooldown = 0.9;
      this.fx.burst(this.x - 10, this.y - this.h / 2, 18, COL.body, {
        spread: 1.2, speed: 280, grav: 200, life: 0.4,
      });
      this.events.onDash();
    }
    if (this.dashing) {
      this.dashT -= dt;
      this.vy = 0;
      if (this.dashT <= 0) this.dashing = false;
    }

    // jump (buffered + coyote)
    if (this.buffer > 0 && !this.dashing) {
      if (this.onGround || this.coyote > 0) {
        this.vy = JUMP_V;
        this.onGround = false;
        this.coyote = 0;
        this.sliding = false;
        this.jumpsLeft = 1;
        this.buffer = 0;
        this.squash = 1.25;
        this.events.onJump(false);
      } else if (this.jumpsLeft > 0) {
        this.vy = AIRJUMP_V;
        this.jumpsLeft -= 1;
        this.buffer = 0;
        this.squash = 1.2;
        this.fx.burst(this.x, this.y, 12, COL.body, { spread: 1.6, speed: 200, life: 0.35 });
        this.events.onJump(true);
      }
    }
    if (!input.jumpPressed && this.vy < -260 && !this.onGround) this.vy = -260;

    // integrate
    if (!this.dashing) this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.y += this.vy * dt;

    const floor = groundAhead ? GROUND_Y : Number.POSITIVE_INFINITY;
    if (this.y >= floor && this.vy >= 0) {
      const power = this.vy;
      this.y = floor;
      this.vy = 0;
      if (!this.onGround) {
        this.squash = clamp(1 + power / 2600, 1, 1.45);
        this.events.onLand(power);
        this.fx.burst(this.x, this.y, 10, COL.dust, { spread: 2.4, speed: 150, grav: 700, life: 0.35, size: 5 });
      }
      this.onGround = true;
      this.jumpsLeft = 2;
      this.dashing = false;
    } else if (this.y < floor - 0.5) {
      this.onGround = false;
    }

    if (this.y > KILL_Y && this.alive) {
      this.events.onFall();
      this.kill();
    }

    this.squash += (1 - this.squash) * Math.min(1, dt * 12);
    this.anim += dt * (this.onGround ? 1 : 0.35);
  }

  render(time: number, speedPct: number): void {
    const g = this.gfx;
    g.clear();
    if (this.invuln > 0 && this.invuln < 900 && Math.floor(time * 22) % 2 === 0) return;

    const sy = this.squash;
    const hh = this.h / sy;
    const ww = this.w * (this.sliding ? 1.5 : 1) * Math.min(1.3, 2 - sy);
    const bx = this.x - ww / 2;
    const by = this.y - hh;

    g.fillStyle(COL.ink, 0.25);
    g.fillEllipse(this.x, GROUND_Y + 5, this.w * 1.15, 8);

    if (this.dashing) {
      for (let i = 1; i <= 4; i++) {
        g.fillStyle(COL.body, 0.16 * (5 - i));
        g.fillRoundedRect(bx - i * 16, by + 4, ww, hh - 8, 8);
      }
    }

    if (this.sliding) {
      g.fillStyle(COL.bodyDark, 1);
      g.fillRoundedRect(bx, by + 5, ww, hh - 5, 8);
      g.fillStyle(COL.body, 1);
      g.fillRoundedRect(bx + 3, by + 8, ww - 14, hh - 13, 6);
      g.fillStyle(COL.visor, 1);
      g.fillRect(bx + ww - 17, by + 10, 12, 5);
      g.fillStyle(COL.ink, 0.45);
      g.fillRect(bx - 6, this.y - 3, ww + 12, 3);
    } else {
      const swing = this.onGround ? Math.sin(time * (8 + speedPct * 16)) : 0.5;
      const tuck = this.onGround ? 0 : 7;
      g.fillStyle(COL.bodyDark, 1);
      g.fillRect(this.x - 11, this.y - 15 + tuck, 8, 15 - tuck + swing * 3);
      g.fillRect(this.x + 3, this.y - 15 + tuck, 8, 15 - tuck - swing * 3);
      g.fillStyle(COL.bodyDark, 1);
      g.fillRoundedRect(bx + 2, by + 20, ww - 4, hh - 32, 7);
      g.fillStyle(COL.body, 1);
      g.fillRoundedRect(bx + 4, by + 22, ww - 8, hh - 38, 6);
      const headR = 11;
      const hy = by + headR + 5;
      g.fillStyle(COL.body, 1);
      g.fillCircle(this.x, hy, headR);
      g.fillStyle(COL.ink, 1);
      g.fillCircle(this.x + 4, hy - 1, headR - 4);
      g.fillStyle(COL.visor, 1);
      g.fillRect(this.x + 2, hy - 4, 8, 3);
      g.fillStyle(COL.danger, 0.9);
      for (let i = 0; i < 3; i++) {
        g.fillRect(this.x - 13 - i * 9, by + 24 + Math.sin(time * 14 + i) * 3, 10, 5);
      }
    }

    if (this.shield > 0) {
      g.lineStyle(3, COL.shield, 0.55 + Math.sin(time * 8) * 0.2);
      g.strokeCircle(this.x, this.y - hh / 2, Math.max(ww, hh) * 0.78);
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

