import Phaser from 'phaser';

export const NEGATIVE_TOKEN_TEXTURES = {
  bad50: 'negative-50-token-game',
  bad100: 'negative-100-token-game',
  bad500: 'negative-500-token-game',
} as const;
export const NEGATIVE_TOKEN_SIZE = 128;
export const NEGATIVE_TOKEN_SCALE = 0.5;
type NegativeTokenType = keyof typeof NEGATIVE_TOKEN_TEXTURES;

interface TokenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const collisions = new Map<NegativeTokenType, { bounds: TokenRect; strips: TokenRect[] }>();

export function isNegativeMoneyToken(type: string): type is NegativeTokenType {
  return type === 'bad50' || type === 'bad100' || type === 'bad500';
}

export function createNegativeMoneyTokenCollisions(scene: Phaser.Scene): void {
  for (const type of Object.keys(NEGATIVE_TOKEN_TEXTURES) as NegativeTokenType[]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = NEGATIVE_TOKEN_SIZE;
    const context = canvas.getContext('2d')!;
    context.drawImage(scene.textures.get(NEGATIVE_TOKEN_TEXTURES[type]).getSourceImage() as HTMLImageElement, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const bounds: TokenRect = { left: canvas.width, top: canvas.height, right: 0, bottom: 0 };
    const strips: TokenRect[] = [];
    let previous = new Map<string, TokenRect>();
    // Only opaque token pixels collect; transparent corners/padding remain passable.
    for (let y = 0; y < canvas.height; y++) {
      const current = new Map<string, TokenRect>();
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
    collisions.set(type, { bounds, strips });
  }
}

export function getNegativeMoneyTokenCollision(type: NegativeTokenType) {
  return collisions.get(type)!;
}
