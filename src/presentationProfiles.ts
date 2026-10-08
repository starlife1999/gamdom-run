export const PORTRAIT_PROTOTYPE_PROFILE = Object.freeze({
  id: 'district-one-portrait-prototype' as const,
  visibleWorldLeft: 160,
  visibleWorldRight: 960,
  visibleWorldWidth: 800,
  atmosphereWeight: 1,
  lowerAreaWeight: 0.45,
});

export type PortraitPrototypeProfile = typeof PORTRAIT_PROTOTYPE_PROFILE;

export function isPortraitPrototypeProfile(value: unknown): value is PortraitPrototypeProfile {
  return value === PORTRAIT_PROTOTYPE_PROFILE;
}

export interface PrototypeSnapshot {
  character: number;
  elapsed: number;
  distance: number;
  speed: number;
  money: number;
  lives: number;
  streak: number;
  cashRush: number;
  paused: boolean;
  ended: 'game-over' | 'run-complete' | null;
  status: string;
  powers: ReadonlyArray<{ name: string; seconds: number }>;
}
