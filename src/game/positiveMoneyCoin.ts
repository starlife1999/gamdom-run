import Phaser from 'phaser';

export const POSITIVE_COIN = { texture: 'gamdom-coin-game', size: 128, scale: 0.40625 } as const;

interface CoinRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const bounds: CoinRect = { left: 128, top: 128, right: 0, bottom: 0 };
const strips: CoinRect[] = [];

export function createPositiveMoneyCoinCollision(scene: Phaser.Scene): void {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = POSITIVE_COIN.size;
  const context = canvas.getContext('2d')!;
  context.drawImage(scene.textures.get(POSITIVE_COIN.texture).getSourceImage() as HTMLImageElement, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  strips.length = 0;
  Object.assign(bounds, { left: canvas.width, top: canvas.height, right: 0, bottom: 0 });
  let previous = new Map<string, CoinRect>();
  // The collection shape follows opaque pixels, excluding transparent padding/corners.
  for (let y = 0; y < canvas.height; y++) {
    const current = new Map<string, CoinRect>();
    let x = 0;
    while (x < canvas.width) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < 128) {
        x++;
        continue;
      }
      const left = x;
      while (x < canvas.width && pixels[(y * canvas.width + x) * 4 + 3] >= 128) x++;
      const key = `${left}:${x}`;
      const rectangle = previous.get(key) ?? { left, top: y, right: x, bottom: y + 1 };
      if (!previous.has(key)) strips.push(rectangle);
      rectangle.bottom = y + 1;
      current.set(key, rectangle);
      bounds.left = Math.min(bounds.left, left);
      bounds.top = Math.min(bounds.top, y);
      bounds.right = Math.max(bounds.right, x);
      bounds.bottom = Math.max(bounds.bottom, y + 1);
    }
    previous = current;
  }
}

export function getPositiveMoneyCoinCollision() {
  return { bounds, strips };
}
