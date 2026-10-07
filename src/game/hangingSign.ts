import Phaser from 'phaser';

export const HANGING_SIGN = {
  texture: 'gamdom-hanging-sign-game',
  width: 330,
  height: 260,
  scale: 0.5,
  visibleBottom: 244,
  slideMargin: 12,
  cropTop: 52,
  railCenters: [54, 277],
} as const;

export interface SignRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const solidRects: SignRect[] = [];

export function createHangingSignCollision(scene: Phaser.Scene): void {
  const canvas = document.createElement('canvas');
  canvas.width = HANGING_SIGN.width;
  canvas.height = HANGING_SIGN.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(scene.textures.get(HANGING_SIGN.texture).getSourceImage() as HTMLImageElement, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  solidRects.length = 0;
  let previous = new Map<string, SignRect>();
  // Merge opaque horizontal runs vertically; glow and transparent openings are not solid.
  for (let y = HANGING_SIGN.cropTop; y < canvas.height; y += 1) {
    const current = new Map<string, SignRect>();
    let x = 0;
    while (x < canvas.width) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < 128) {
        x += 1;
        continue;
      }
      const left = x;
      while (x < canvas.width && pixels[(y * canvas.width + x) * 4 + 3] >= 128) x += 1;
      const key = `${left}:${x}`;
      const rectangle = previous.get(key) ?? { left, top: y, right: x, bottom: y + 1 };
      if (!previous.has(key)) solidRects.push(rectangle);
      rectangle.bottom = y + 1;
      current.set(key, rectangle);
    }
    previous = current;
  }
}

export function getHangingSignCollision(): readonly SignRect[] {
  return solidRects;
}
