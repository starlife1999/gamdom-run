import { PHASE_LENGTH, VIEW_H } from '../config';
import { clamp, lerp, mixColor } from '../core/util';

interface RawPalette {
  name: string;
  skyTop: number;
  skyBottom: number;
  sun: number;
  hillFar: number;
  hillNear: number;
  city: number;
  cityLit: number;
  cloud: number;
  ground: number;
  groundEdge: number;
  pit: number;
  accent: number;
  star: number;
}

/** Difficulty phases, each with its own color script. */
const PALETTES: RawPalette[] = [
  {
    name: 'DAWN GRID',
    skyTop: 0x1b2358, skyBottom: 0xff9a6b, sun: 0xffe08a, hillFar: 0x39406e, hillNear: 0x2a2f56,
    city: 0x232848, cityLit: 0xffd166, cloud: 0xffb08a, ground: 0x2c2440, groundEdge: 0xff8a5c,
    pit: 0x120e1c, accent: 0x2ff3d0, star: 0xffffff,
  },
  {
    name: 'NOON PLAINS',
    skyTop: 0x2f7fd6, skyBottom: 0xbfeaff, sun: 0xfff6c8, hillFar: 0x63a6a1, hillNear: 0x3f7f86,
    city: 0x38607f, cityLit: 0xfff0a8, cloud: 0xffffff, ground: 0x3a5f4b, groundEdge: 0x9ef01a,
    pit: 0x14251d, accent: 0x9ef01a, star: 0xffffff,
  },
  {
    name: 'RUST CANYON',
    skyTop: 0x4a1e4f, skyBottom: 0xff7a4d, sun: 0xffd06a, hillFar: 0x7a3b52, hillNear: 0x54263c,
    city: 0x3c1f34, cityLit: 0xffb35c, cloud: 0xff9f7a, ground: 0x4a2a2a, groundEdge: 0xffb35c,
    pit: 0x1b0f12, accent: 0xffb35c, star: 0xffe0c0,
  },
  {
    name: 'MIDNIGHT SPIRE',
    skyTop: 0x050818, skyBottom: 0x1b2b5e, sun: 0xa9c6ff, hillFar: 0x1a2246, hillNear: 0x121735,
    city: 0x0e1330, cityLit: 0x6ee7ff, cloud: 0x2a3a6b, ground: 0x151a33, groundEdge: 0x6ea8ff,
    pit: 0x05070f, accent: 0x6ea8ff, star: 0xffffff,
  },
  {
    name: 'NEON CASCADE',
    skyTop: 0x120428, skyBottom: 0x4a0f6b, sun: 0xff7ad9, hillFar: 0x3d1060, hillNear: 0x2a0b47,
    city: 0x1b0836, cityLit: 0x2ff3d0, cloud: 0x8a3fbf, ground: 0x22083f, groundEdge: 0xff2e88,
    pit: 0x0b0218, accent: 0xff2e88, star: 0xd8b4ff,
  },
  {
    name: 'NULL SECTOR',
    skyTop: 0x000308, skyBottom: 0x062028, sun: 0x2ff3d0, hillFar: 0x08222b, hillNear: 0x051820,
    city: 0x03141a, cityLit: 0x2ff3d0, cloud: 0x0d3540, ground: 0x0a1d22, groundEdge: 0x2ff3d0,
    pit: 0x000205, accent: 0xe6fbff, star: 0x9fffff,
  },
];

export const PHASE_COUNT = PALETTES.length;

/** Mutable, frame-updated color set. Read fields instead of indexing palettes. */
export class Theme {
  name = PALETTES[0].name;
  index = 0;
  night = 0;
  skyTop = PALETTES[0].skyTop;
  skyBottom = PALETTES[0].skyBottom;
  sun = PALETTES[0].sun;
  hillFar = PALETTES[0].hillFar;
  hillNear = PALETTES[0].hillNear;
  city = PALETTES[0].city;
  cityLit = PALETTES[0].cityLit;
  cloud = PALETTES[0].cloud;
  ground = PALETTES[0].ground;
  groundEdge = PALETTES[0].groundEdge;
  pit = PALETTES[0].pit;
  accent = PALETTES[0].accent;
  star = PALETTES[0].star;

  /** Recomputes every color for the given distance travelled. */
  update(distance: number): void {
    const t = Math.max(0, distance) / PHASE_LENGTH;
    const i = Math.floor(t) % PHASE_COUNT;
    const j = (i + 1) % PHASE_COUNT;
    const u = t % 1;
    // Hold each palette for 70% of its phase, then cross-fade.
    let f = u < 0.7 ? 0 : (u - 0.7) / 0.3;
    f = f * f * (3 - 2 * f);

    const a = PALETTES[i];
    const b = PALETTES[j];
    this.index = i;
    this.name = a.name;
    this.skyTop = mixColor(a.skyTop, b.skyTop, f);
    this.skyBottom = mixColor(a.skyBottom, b.skyBottom, f);
    this.sun = mixColor(a.sun, b.sun, f);
    this.hillFar = mixColor(a.hillFar, b.hillFar, f);
    this.hillNear = mixColor(a.hillNear, b.hillNear, f);
    this.city = mixColor(a.city, b.city, f);
    this.cityLit = mixColor(a.cityLit, b.cityLit, f);
    this.cloud = mixColor(a.cloud, b.cloud, f);
    this.ground = mixColor(a.ground, b.ground, f);
    this.groundEdge = mixColor(a.groundEdge, b.groundEdge, f);
    this.pit = mixColor(a.pit, b.pit, f);
    this.accent = mixColor(a.accent, b.accent, f);
    this.star = mixColor(a.star, b.star, f);
    // Star strength: strongest in the two dark palettes.
    const dark = i === 3 || i === 4 || i === 5 ? 1 : i === 0 ? 0.45 : 0;
    const darkNext = j === 3 || j === 4 || j === 5 ? 1 : j === 0 ? 0.45 : 0;
    this.night = clamp(lerp(dark, darkNext, f), 0, 1);
  }

  /** 0..1 -> 0..VIEW_H horizon helper used by the background painter. */
  horizon(): number {
    return Math.round(VIEW_H * 0.62);
  }
}
