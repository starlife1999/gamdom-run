import type Phaser from 'phaser';

export function createHqSilhouetteMask(
  textures: Phaser.Textures.TextureManager, texture: string,
  top: number, baseline: number, left: number, right: number,
): string {
  const key = `${texture}-silhouette-mask`;
  if (textures.exists(key)) return key;
  const source = textures.get(texture).getSourceImage() as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  context.clearRect(0, 0, source.width, source.height);
  context.fillStyle = '#ffffff';
  // Gold roof lighting identifies the authored skyline against its baked-in green sky.
  // Only mask alpha is derived; the existing PNG texture and its colors remain untouched.
  for (let x = left; x < right; x++) {
    let roof = baseline;
    for (let y = top; y < baseline; y++) {
      const index = (y * source.width + x) * 4;
      const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
      if (red > 100 && green > 60 && blue < red * 0.6 && green < red * 1.05) {
        roof = y;
        break;
      }
    }
    if (roof < baseline) context.fillRect(x, roof, 1, baseline - roof + 1);
  }
  textures.addCanvas(key, canvas);
  return key;
}

export function prepareHqSilhouetteMasks(textures: Phaser.Textures.TextureManager): void {
  // Runner uses these even in District 1; do the one-time scan before PLAY-ready.
  createHqSilhouetteMask(textures, 'hq-foundation-distant-skyline', 500, 881, 0, 1920);
  createHqSilhouetteMask(textures, 'hq-foundation-secondary-skyline', 340, 898, 0, 1920);
  createHqSilhouetteMask(textures, 'hq-foundation-distant-main-building', 480, 910, 680, 1280);
}
