import Phaser from 'phaser';

export const ROBOTIC_BIRD = {
  texture: 'robotic-bird-game',
  width: 320,
  height: 192,
  scale: 0.3,
  // Solid bottom stays 15 px above the 84 px slide body, including the +6 px bob.
  centerYOffset: 132,
} as const;

interface BirdRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const solidRects: BirdRect[] = [];
const solidBounds: BirdRect = { left: 320, top: 192, right: 0, bottom: 0 };

export function createRoboticBirdCollision(scene: Phaser.Scene): void {
  const canvas = document.createElement('canvas');
  canvas.width = ROBOTIC_BIRD.width;
  canvas.height = ROBOTIC_BIRD.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(scene.textures.get(ROBOTIC_BIRD.texture).getSourceImage() as HTMLImageElement, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  solidRects.length = 0;
  Object.assign(solidBounds, { left: canvas.width, top: canvas.height, right: 0, bottom: 0 });
  let previous = new Map<string, BirdRect>();
  // Opaque runs follow the wings/body; transparent gaps and faint edge pixels are not solid.
  for (let y = 0; y < canvas.height; y++) {
    const current = new Map<string, BirdRect>();
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
      if (!previous.has(key)) solidRects.push(rectangle);
      rectangle.bottom = y + 1;
      current.set(key, rectangle);
      solidBounds.left = Math.min(solidBounds.left, left);
      solidBounds.top = Math.min(solidBounds.top, y);
      solidBounds.right = Math.max(solidBounds.right, x);
      solidBounds.bottom = Math.max(solidBounds.bottom, y + 1);
    }
    previous = current;
  }
}

export function getRoboticBirdBounds(): Readonly<BirdRect> {
  return solidBounds;
}

export function getRoboticBirdCollision(): readonly BirdRect[] {
  return solidRects;
}
