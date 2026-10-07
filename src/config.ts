// Global tuning for the Phase 2 endless runner. All units are pixels / seconds.
export const VIEW_W = 960;
export const VIEW_H = 540;
export const GROUND_Y = 448; // world Y of the ground surface (feet rest here)
export const KILL_Y = VIEW_H + 90; // fell in a pit below this -> dead
export const PLAYER_X = 190; // player is locked horizontally

// --- player physics ---
export const GRAVITY = 2600;
export const JUMP_V = -880;
export const AIRJUMP_V = -740;
export const MAX_FALL = 1500;
export const STAND_W = 34;
export const STAND_H = 58;
export const SLIDE_H = 28;
export const SLIDE_TIME = 0.55;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.14;
export const DASH_TIME = 0.24;
export const DASH_BONUS = 520;

// --- run / difficulty ---
export const BASE_SPEED = 330;
export const MAX_SPEED = 760;
export const SPEED_ACCEL = 8.5;
export const PHASE_LENGTH = 1100; // distance px per difficulty phase
export const COMBO_WINDOW = 2.6; // seconds a combo stays alive
export const HITBOX_INSET = 6; // forgiveness applied to every hitbox

export const SCORE_PER_PX = 0.1;
export const SCORE_COIN = 25;
export const SCORE_NEAR_MISS = 60;

export const COL = {
  body: 0x2ff3d0,
  bodyDark: 0x0f8f8f,
  visor: 0xffd166,
  ink: 0x080a12,
  coin: 0xffcf4d,
  shield: 0x6ea8ff,
  x2: 0xff7ad9,
  danger: 0xff5470,
  hazard: 0xff8a5c,
  spike: 0xcfd8ff,
  dust: 0xffffff,
};
