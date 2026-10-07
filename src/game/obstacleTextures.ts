import Phaser from 'phaser';

const PADDING = 2;
export const OBSTACLE_TEXTURE_SCALE = 2;

export const OBSTACLE_VISUALS = {
  cone: { source: 'traffic-cone-game', x: 0, y: 0, width: 96, height: 106, displayWidth: 62,
    visibleBounds: { left: 2, top: 10, right: 92, bottom: 104 } },
  crate: { source: 'small-crate-game-orange', x: 0, y: 0, width: 140, height: 90, displayWidth: 105,
    visibleBounds: { left: 5, top: 5, right: 134, bottom: 84 } },
  barrier: { source: 'ground-barrier-game', x: 0, y: 0, width: 240, height: 104, displayWidth: 120,
    visibleBounds: { left: 8, top: 9, right: 232, bottom: 99 } },
  tallBarrier: { source: 'stacked-containers-game-tight', x: 5, y: 0, width: 230, height: 160, displayWidth: 184,
    visibleBounds: { left: 0, top: 1, right: 230, bottom: 158 } },
} as const;

export function createObstacleTextures(scene: Phaser.Scene): void {
  for (const [type, visual] of Object.entries(OBSTACLE_VISUALS)) {
    if (type === 'tallBarrier') {
      // Crop the sides in the original texture; retain the uniform 0.8 scale.
      const texture = scene.textures.get(visual.source);
      if (!texture.has('gameplay')) texture.add('gameplay', 0, visual.x, visual.y, visual.width, visual.height);
      continue;
    }
    if (type === 'cone' || type === 'crate' || type === 'barrier' || type === 'tallBarrier') continue;
    const key = `${visual.source}-filtered`;
    if (scene.textures.exists(key)) continue;
    const source = scene.textures.get(visual.source).getSourceImage() as HTMLImageElement;
    let canvas = document.createElement('canvas');
    canvas.width = visual.width;
    canvas.height = visual.height;
    canvas.getContext('2d')!.drawImage(source, visual.x, visual.y, visual.width, visual.height, 0, 0, visual.width, visual.height);

    const displayHeight = visual.displayWidth * visual.height / visual.width;
    const targetWidth = visual.displayWidth * OBSTACLE_TEXTURE_SCALE;
    const targetHeight = displayHeight * OBSTACLE_TEXTURE_SCALE;
    const padding = PADDING * OBSTACLE_TEXTURE_SCALE;
    // Progressive reductions average fine detail without dropping the source alpha.
    while (canvas.width > targetWidth * 2) {
      const next = document.createElement('canvas');
      next.width = Math.ceil(canvas.width / 2);
      next.height = Math.ceil(canvas.height / 2);
      const context = next.getContext('2d')!;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(canvas, 0, 0, next.width, next.height);
      canvas = next;
    }

    const filtered = document.createElement('canvas');
    filtered.width = Math.ceil(targetWidth + padding * 2);
    filtered.height = Math.ceil(targetHeight + padding * 2);
    const context = filtered.getContext('2d')!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, padding, padding, targetWidth, targetHeight);
    const texture = scene.textures.addCanvas(key, filtered)!;
    // Keep the fractional frame height so the artwork retains its exact aspect ratio.
    texture.add('gameplay', 0, 0, 0, targetWidth + padding * 2, targetHeight + padding * 2);
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
