export const CHARACTER_CONFIG = {
  targetVisibleHeight: 98.8,
  slideScaleRatio: 0.54 / 1.65,
  characters: [
    {
      texture: 'gamby',
      visualScale: 98.8 / 62,
      frameBottomPadding: [0, 0, 0, 0, 0, 0, 0],
    },
    {
      texture: 'steve',
      visualScale: 98.8 / 68.5,
      frameBottomPadding: [3, 0, 6, 0, 6, 0, 6],
    },
    {
      texture: 'yungreal',
      visualScale: 98.8 / 71,
      frameBottomPadding: [1, 0, 1, 0, 1, 0, 1],
    },
  ],
} as const;
