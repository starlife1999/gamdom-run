import Phaser from 'phaser';
import { CHARACTER_CONFIG } from '../characterConfig';
import { OBSTACLE_TEXTURE_SCALE, OBSTACLE_VISUALS } from '../obstacleTextures';
import { getHangingSignCollision, HANGING_SIGN } from '../hangingSign';
import { getRoboticBirdBounds, getRoboticBirdCollision, ROBOTIC_BIRD } from '../roboticBird';
import { getNegativeMoneyTokenCollision, isNegativeMoneyToken, NEGATIVE_TOKEN_SCALE, NEGATIVE_TOKEN_SIZE, NEGATIVE_TOKEN_TEXTURES } from '../negativeMoneyTokens';
import { getPositiveMoneyCoinCollision, POSITIVE_COIN } from '../positiveMoneyCoin';
import { DistrictTransitionUI, type DistrictTransitionPresentation } from '../districtTransitionUI';
import { CashRushVisuals, type CashRushPresentation } from '../cashRushVisuals';
import { isPortraitPrototypeProfile, type PortraitPrototypeProfile, type PrototypeSnapshot } from '../../presentationProfiles';
import { createHqSilhouetteMask } from '../hqSilhouetteMasks';
import { MIN_SLIDE_SECONDS, RunnerInputState, TOUCH_SLIDE_FRACTION } from '../runnerInputState';

type RunnerItemType = 'coin10' | 'coin20' | 'coin50' | 'coin100' | 'coin500' | 'bad50' | 'bad100' | 'bad500' | 'bird' | 'cone' | 'crate' | 'barrier' | 'tallBarrier' | 'overhead' | 'power' | 'life';
type PowerKind = 'shield' | 'boost' | 'x2' | 'magnet' | 'multiplier';
type CharacterPose = 'idle' | 'run' | 'jump' | 'doubleJump' | 'fall' | 'slide' | 'hit' | 'win';
type RunnerPattern = 'moneyLine' | 'moneyArc' | 'reward' | 'penalty' | 'singleJump' | 'doubleJump' | 'jumpDouble' | 'slide' | 'birdSlide' | 'mixed' | 'doubleReward' | 'slideJump';

interface RunnerItem {
  type: RunnerItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
  active: boolean;
  effect?: PowerKind;
  label?: string;
}

interface PlayerState {
  x: number;
  y: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  jumpCount: number;
  slideTime: number;
  sliding: boolean;
  fastFalling: boolean;
  shield: number;
  pose: CharacterPose;
  flash: number;
}

interface BodyRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ItemLabelVisualState {
  text: string;
  color: string;
  stroke: string;
  strokeThickness: number;
  fontSize: number;
}

interface CityBuildingDesign {
  width: number;
  height: number;
  roof: 'crown' | 'spire' | 'steps' | 'twin' | 'glass' | 'marquee' | 'antenna' | 'atrium';
  accent: number;
  sign: 'gamdom' | 'slots' | 'jackpot' | 'cards' | 'none';
}

interface GamdomCitySpriteConfig {
  image: Phaser.GameObjects.Image;
  baseX: number;
  cycleWidth: number;
  parallax: number;
}

interface CityFoundationLayer {
  images: Phaser.GameObjects.Image[];
  parallax: number;
  tileWidth: number;
}

/** Runner stays on the left third. The street scrolls into this x. */
const PLAYER_X = 320;
/** Keep gameplay padding without increasing the invisible upper margin after the visual reduction. */
const STAND_W = 74;
const STAND_H = 123;
/** Low crouch: still tall enough to clip street obstacles, short enough to pass under the bird. */
const SLIDE_H = 81;
const SLIDE_W = 102;
const HANGING_SIGN_CLEARANCE_HEIGHT = 84;
const FAST_FALL_VELOCITY = 620;
const FAST_FALL_GRAVITY = 3600;
const NORMAL_FALL_GRAVITY = 2900;
const BIRD_CENTER_Y_OFFSET = ROBOTIC_BIRD.centerYOffset;
const ROBOTIC_BIRD_VISUAL_SCALE = ROBOTIC_BIRD.scale * 1.1;
const MAGNET_RADIUS = 300;
const MAGNET_PULL_SPEED = 1250;
const MIN_SPAWN_SPACING = 190;
const HAZARD_SAFETY_GAP = 460;
const MONEY_PATTERN_GAP = 68;
const ELEVATED_MONEY_Y_OFFSET = 245;
const ELEVATED_POWER_Y_OFFSET = 315;
const JUMP_DOUBLE_GAP = 460;
const MIXED_OVERHEAD_GAP = 1050;
const SLIDE_JUMP_GAP = 560;
const RUN_FRAME_DISTANCE = 52;
const GAMBY_VISUAL_SCALE = CHARACTER_CONFIG.targetVisibleHeight / 118;
const GAMBY_BASELINE_PADDING = 12;
const STEVE_VISUAL_SCALE = CHARACTER_CONFIG.targetVisibleHeight / 182;
const STEVE_BASELINE_PADDING = 16;
const YUNGREAL_VISUAL_SCALE = CHARACTER_CONFIG.targetVisibleHeight / 172.8;
const YUNGREAL_BASELINE_PADDING = 16;
const BOOST_SCORE_PER_SECOND = 120;
const SCORE_MULTIPLIER = 2;
const POWER_HAZARD_GAP = 360;
const HIT_FEEDBACK_SECONDS = 0.28;
const HIT_INVULNERABILITY_SECONDS = 1;
const CASH_STREAK_REQUIRED = 10;
const CASH_RUSH_SECONDS = 6;
const STARTING_LIVES = 3;
const MAX_LIVES = 5;
const LIFE_SPAWN_SCHEDULE = [24, 44, 64, 84] as const;
const WORLD_SPEED_KEYFRAMES = [
  { time: 0, speed: 400 },
  { time: 10, speed: 430 },
  { time: 20, speed: 470 },
  { time: 40, speed: 560 },
  { time: 55, speed: 640 },
  { time: 65, speed: 690 },
  { time: 75, speed: 730 },
  { time: 90, speed: 770 },
] as const;
const WORLD_SPEED_MULTIPLIER = 1.05;
const WORLD_SPEED_START = WORLD_SPEED_KEYFRAMES[0].speed * WORLD_SPEED_MULTIPLIER;
const RUN_DURATION_SECONDS = 90;
const CASINO_DISTRICT_START = 25;
const NEON_BOULEVARD_START = 50;
const HQ_APPROACH_START = 70;
const MONEY_TYPES: Array<{ type: RunnerItemType; value: number; label: string }> = [
  { type: 'coin10', value: 10, label: '+$10' },
  { type: 'coin20', value: 20, label: '+$20' },
  { type: 'coin50', value: 50, label: '+$50' },
  { type: 'coin100', value: 100, label: '+$100' },
  { type: 'coin500', value: 500, label: '+$500' },
];
const NEGATIVE_TYPES: Array<{ type: RunnerItemType; value: number; label: string }> = [
  { type: 'bad50', value: -50, label: '-$50' },
  { type: 'bad100', value: -100, label: '-$100' },
  { type: 'bad500', value: -500, label: '-$500' },
];
const POWER_SPAWN_SCHEDULE: Array<{ time: number; effect: PowerKind }> = [
  { time: 8, effect: 'shield' },
  { time: 17, effect: 'x2' },
  { time: 27, effect: 'magnet' },
  { time: 37, effect: 'boost' },
  { time: 47, effect: 'multiplier' },
  { time: 57, effect: 'shield' },
  { time: 67, effect: 'x2' },
  { time: 77, effect: 'magnet' },
  { time: 86, effect: 'boost' },
];

export class RunnerScene extends Phaser.Scene {
  // BEGIN PORTRAIT PROTOTYPE
  private prototypeProfile?: PortraitPrototypeProfile;
  private prototypeEnded: PrototypeSnapshot['ended'] = null;
  // END PORTRAIT PROTOTYPE
  private selectedCharacter = 0;
  private cityBackground!: Phaser.GameObjects.Image;
  private cityBackgroundNext!: Phaser.GameObjects.Image;
  private cityAtmosphere!: Phaser.GameObjects.Graphics;
  private cityFarLayer!: Phaser.GameObjects.Graphics;
  private cityMidLayer!: Phaser.GameObjects.Graphics;
  private cityStreetLayer!: Phaser.GameObjects.Graphics;
  private cityDistantSkyline: GamdomCitySpriteConfig[] = [];
  private citySupportBuildings: GamdomCitySpriteConfig[] = [];
  private citySkyscrapers: Phaser.GameObjects.Image[] = [];
  private cityCasinos: Phaser.GameObjects.Image[] = [];
  private cityStreetBuildings: GamdomCitySpriteConfig[] = [];
  private cityBillboards: Phaser.GameObjects.Image[] = [];
  private cityLamps: Phaser.GameObjects.Image[] = [];
  private cityRoadTiles: Phaser.GameObjects.Image[] = [];
  private foundationSky!: Phaser.GameObjects.Image;
  private foundationLayers: CityFoundationLayer[] = [];
  private foundationRoadTiles: Phaser.GameObjects.Image[] = [];
  private neonSky!: Phaser.GameObjects.Image;
  private neonLayers: CityFoundationLayer[] = [];
  private neonRoadTiles: Phaser.GameObjects.Image[] = [];
  private neonLandmark!: Phaser.GameObjects.Image;
  private hqSky!: Phaser.GameObjects.Image;
  private hqLayers: Array<CityFoundationLayer & { maskImages: Phaser.GameObjects.Image[] }> = [];
  private hqMainBuilding!: Phaser.GameObjects.Image;
  private hqMainMask!: Phaser.GameObjects.Image;
  private hqFinalEntrance!: Phaser.GameObjects.Image;
  private hqCampusArchitecture: Array<{
    image: Phaser.GameObjects.Image;
    baseX: number;
    baseline: number;
    parallax: number;
  }> = [];
  private neonArchitecture: Array<{
    image: Phaser.GameObjects.Image;
    baseX: number;
    parallax: number;
  }> = [];
  private neonSecondary: Array<{
    image: Phaser.GameObjects.Image;
    baseX: number;
    parallax: number;
  }> = [];
  private foundationBuildings: Array<{
    image: Phaser.GameObjects.Image;
    baseX: number;
    parallax: number;
  }> = [];
  private foundationStorefronts: Array<{
    image: Phaser.GameObjects.Image;
    baseX: number;
    parallax: number;
  }> = [];
  private foundationStreetDetails: Array<{
    image: Phaser.GameObjects.Image;
    baseX: number;
    parallax: number;
  }> = [];
  private pedestrian01!: Phaser.GameObjects.Sprite;
  private pedestrian02!: Phaser.GameObjects.Sprite;
  private pedestrian03!: Phaser.GameObjects.Sprite;
  private pedestrian04!: Phaser.GameObjects.Sprite;
  private pedestrian05!: Phaser.GameObjects.Sprite;
  private pedestrian06!: Phaser.GameObjects.Sprite;
  private pedestrian07!: Phaser.GameObjects.Sprite;
  private pedestrian08!: Phaser.GameObjects.Sprite;
  private pedestrian09!: Phaser.GameObjects.Sprite;
  private pedestrian10!: Phaser.GameObjects.Sprite;
  private pedestrian11!: Phaser.GameObjects.Sprite;
  private pedestrian12!: Phaser.GameObjects.Sprite;
  private pedestrian04Slot = -1;
  private pedestrian04WalkOffset = 0;
  private pedestrianFirstVariant = 0;
  private background!: Phaser.GameObjects.Graphics;
  private foreground!: Phaser.GameObjects.Graphics;
  private hudFrame!: Phaser.GameObjects.Graphics;
  private playerGraphics!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private itemSprites = new Map<RunnerItem, Phaser.GameObjects.Image>();
  private itemLabels = new Map<RunnerItem, Phaser.GameObjects.Text>();
  private itemLabelVisualStates = new WeakMap<Phaser.GameObjects.Text, ItemLabelVisualState>();
  private itemSpritePool: Phaser.GameObjects.Image[] = [];
  private itemLabelPool: Phaser.GameObjects.Text[] = [];
  private birdCues = new Map<RunnerItem, Phaser.GameObjects.Text>();
  private birdCuePool: Phaser.GameObjects.Text[] = [];
  private powerLabels = new Map<RunnerItem, Phaser.GameObjects.Text>();
  private powerLabelTexts = new WeakMap<Phaser.GameObjects.Text, string>();
  private powerLabelPool: Phaser.GameObjects.Text[] = [];
  private hud!: Phaser.GameObjects.Text[];
  private pauseText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private cashStreakText!: Phaser.GameObjects.Text;
  private cashRushText!: Phaser.GameObjects.Text;
  private cashStreakMeter!: Phaser.GameObjects.Graphics;
  private cashRushBanner!: Phaser.GameObjects.Text;
  private cashRushBannerDetail!: Phaser.GameObjects.Text;
  private cashRushEdgeGlow!: Phaser.GameObjects.Graphics;
  private cashRushHudGlow!: Phaser.GameObjects.Graphics;
  private cashRushIcon!: Phaser.GameObjects.Graphics;
  private cashRushVisuals!: CashRushVisuals;
  private cashStreakBarX = 0;
  private cashStreakBarY = 0;
  private cashStreakBarWidth = 0;
  private lifeText!: Phaser.GameObjects.Text;
  private lifeHearts!: Phaser.GameObjects.Graphics;
  private lifeHeartStartX = 0;
  private lifeHeartY = 0;
  private arrivalText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private finalGateActivated = false;
  private dead = false;
  private items: RunnerItem[] = [];
  private lastPattern?: RunnerPattern;
  private spawnTimer = 0;
  private nextPowerSpawn = 0;
  private nextLifeSpawn = 0;
  private groundY = 412;
  private speed: number = WORLD_SPEED_START;
  private distance = 0;
  private runElapsed = 0;
  private districtTransition!: DistrictTransitionUI;
  private gambyVisualPose?: CharacterPose;
  private gambyVisualPoseStartedAt = 0;
  private steveVisualPose?: CharacterPose;
  private steveVisualPoseStartedAt = 0;
  private yungrealVisualPose?: CharacterPose;
  private yungrealVisualPoseStartedAt = 0;
  private money = 0;
  private score = 0;
  private avoided = 0;
  private lives = STARTING_LIVES;
  private cashRushes = 0;
  private running = true;
  private paused = false;
  private shieldTimer = 0;
  private boostTimer = 0;
  private x2Timer = 0;
  private magnetTimer = 0;
  private multiplierTimer = 0;
  private hitFeedbackTimer = 0;
  private invulnerabilityTimer = 0;
  private cashStreak = 0;
  private cashRushTimer = 0;
  private statusTimer = 0;
  private hudTimer = 0;
  private completionTimer?: Phaser.Time.TimerEvent;
  private player!: PlayerState;
  private readonly controlInput = new RunnerInputState();
  private readonly heldSlideKeys = this.controlInput.slideKeys;
  private readonly processedKeyEvents = new WeakSet<KeyboardEvent>();

  constructor() {
    super('Runner');
  }

  init(data: { selectedCharacter?: number; presentationProfile?: PortraitPrototypeProfile } = {}): void {
    // BEGIN PORTRAIT PROTOTYPE
    this.prototypeProfile = isPortraitPrototypeProfile(data.presentationProfile) ? data.presentationProfile : undefined;
    this.prototypeEnded = null;
    // END PORTRAIT PROTOTYPE
    const persistedCharacter = this.registry.get('selectedCharacter');
    const requestedCharacter = data.selectedCharacter ?? (typeof persistedCharacter === 'number' ? persistedCharacter : 0);
    this.selectedCharacter = Phaser.Math.Clamp(Math.floor(requestedCharacter), 0, CHARACTER_CONFIG.characters.length - 1);
    this.registry.set('selectedCharacter', this.selectedCharacter);
    this.items.length = 0;
    this.lastPattern = undefined;
    this.itemSprites.clear();
    this.itemLabels.clear();
    this.itemSpritePool.length = 0;
    this.itemLabelPool.length = 0;
    this.birdCues.clear();
    this.birdCuePool.length = 0;
    this.powerLabels.clear();
    this.powerLabelPool.length = 0;
    this.spawnTimer = 0.75;
    this.nextPowerSpawn = 0;
    this.nextLifeSpawn = 0;
    // Decoration selection must not consume the gameplay spawner's random stream.
    this.pedestrianFirstVariant = crypto.getRandomValues(new Uint8Array(1))[0] % 12;
    this.pedestrian04Slot = -1;
    this.pedestrian04WalkOffset = 0;
    this.groundY = 412;
    this.speed = WORLD_SPEED_START;
    this.distance = 0;
    this.runElapsed = 0;
    this.gambyVisualPose = undefined;
    this.gambyVisualPoseStartedAt = 0;
    this.steveVisualPose = undefined;
    this.steveVisualPoseStartedAt = 0;
    this.yungrealVisualPose = undefined;
    this.yungrealVisualPoseStartedAt = 0;
    this.money = 0;
    this.score = 0;
    this.avoided = 0;
    this.lives = STARTING_LIVES;
    this.cashRushes = 0;
    this.running = true;
    this.paused = false;
    this.shieldTimer = 0;
    this.boostTimer = 0;
    this.x2Timer = 0;
    this.magnetTimer = 0;
    this.multiplierTimer = 0;
    this.hitFeedbackTimer = 0;
    this.invulnerabilityTimer = 0;
    this.cashStreak = 0;
    this.cashRushTimer = 0;
    this.statusTimer = 0;
    this.hudTimer = 0;
    this.completionTimer = undefined;
    this.finalGateActivated = false;
    this.dead = false;
    this.controlInput.clear();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#040a11');
    const { width, height } = this.scale;
    this.foundationSky = this.add.image(width / 2, height / 2, 'gamdom-city-new-sky')
      .setDepth(-3.5).setVisible(false);
    const skySource = this.foundationSky.texture.getSourceImage();
    this.foundationSky.setScale(Math.max(width / skySource.width, height / skySource.height));
    this.foundationLayers = [
      { texture: 'cloud-layer', scale: 1.2, y: 250, depth: -3.4, parallax: 0.008 },
      { texture: 'distant-skyline', scale: 0.62, y: 356, depth: -3.3, parallax: 0.06 },
      { texture: 'secondary-skyline', scale: 0.58, y: 366, depth: -3.2, parallax: 0.14 },
      { texture: 'sidewalk-tile', scale: 0.4, y: 409.8, depth: 4.5, parallax: 0.9 },
    ].map(config => {
      const texture = `gamdom-city-new-${config.texture}`;
      const tileWidth = this.textures.get(texture).getSourceImage().width * config.scale;
      // A mirrored repeat matches both artwork edges without editing the source.
      const count = Math.ceil(width / tileWidth) + 2;
      const images = Array.from({ length: count }, () => this.add.image(0, config.y, texture)
        .setOrigin(0.5, 1).setScale(config.scale).setDepth(config.depth).setVisible(false));
      return { images, tileWidth, parallax: config.parallax };
    });
    // Keep the approved sidewalk's curb; the cropped asphalt starts above gameplay ground.
    this.foundationRoadTiles = Array.from({ length: Math.ceil(width / 960) + 2 }, () =>
      this.add.image(0, 376, 'gamdom-city-new-road')
        .setOrigin(0, 0).setScale(1).setCrop(0, 26, 960, 138).setDepth(5).setVisible(false));
    this.foundationBuildings = [
      { texture: 'corporate-tower', baseX: 180, scale: 0.38, depth: -2.9 },
      { texture: 'wide-office', baseX: 820, scale: 0.42, depth: -2.6 },
      { texture: 'residential-tower', baseX: 1510, scale: 0.4, depth: -2.7 },
      { texture: 'glass-office-tower', baseX: 2130, scale: 0.4, depth: -2.8 },
      { texture: 'wide-office', baseX: 2750, scale: 0.4, depth: -2.6 },
      { texture: 'corporate-tower', baseX: 3460, scale: 0.35, depth: -2.9 },
      { texture: 'residential-tower', baseX: 4100, scale: 0.44, depth: -2.7 },
      { texture: 'wide-office', baseX: 4790, scale: 0.44, depth: -2.6 },
      { texture: 'glass-office-tower', baseX: 5480, scale: 0.37, depth: -2.8 },
    ].map(config => ({
      image: this.add.image(config.baseX, 360, `gamdom-city-new-${config.texture}`)
        .setOrigin(0.5, 1).setScale(config.scale).setDepth(config.depth).setVisible(false),
      baseX: config.baseX,
      parallax: 0.34,
    }));
    this.foundationStorefronts = [
      { texture: 'flagship-store', baseX: 350, scale: 0.52 },
      { texture: 'cafe', baseX: 1180, scale: 0.44 },
      { texture: 'retail-block', baseX: 2060, scale: 0.5 },
      { texture: 'office-lobby', baseX: 2910, scale: 0.48 },
      { texture: 'cafe', baseX: 3840, scale: 0.44 },
      { texture: 'flagship-store', baseX: 4680, scale: 0.52 },
      { texture: 'office-lobby', baseX: 5520, scale: 0.48 },
      { texture: 'retail-block', baseX: 6470, scale: 0.5 },
      { texture: 'cafe', baseX: 7350, scale: 0.44 },
      { texture: 'office-lobby', baseX: 8180, scale: 0.48 },
      { texture: 'flagship-store', baseX: 9170, scale: 0.52 },
    ].map(config => ({
      image: this.add.image(config.baseX, 360, `gamdom-city-new-${config.texture}`)
        .setOrigin(0.5, 1).setScale(config.scale).setDepth(1).setVisible(false),
      baseX: config.baseX,
      parallax: 0.56,
    }));
    this.foundationStreetDetails = [
      { texture: 'digital-billboard', scale: 0.7, baseline: 374, bottomPadding: 10, depth: 4.6, anchors: [600, 7300] },
      { texture: 'vertical-ad-screen', scale: 0.4, baseline: 376, bottomPadding: 10, depth: 4.6, anchors: [3550, 5750, 10460] },
      { texture: 'street-banner', scale: 0.6, baseline: 378, bottomPadding: 6, depth: 4.6, anchors: [1820, 3930, 6530, 10950] },
      { texture: 'street-lamp', scale: 0.66, baseline: 378, bottomPadding: 5, depth: 4.6, anchors: [260, 1490, 3150, 4860, 6110, 7710, 9950, 10680] },
      { texture: 'tree-planter', scale: 0.55, baseline: 379, bottomPadding: 6, depth: 4.65, anchors: [1040, 3260, 5240, 8010, 10840] },
      { texture: 'bus-stop', scale: 0.65, baseline: 382, bottomPadding: 10, depth: 4.7, anchors: [2350, 9250] },
      { texture: 'bench', scale: 0.55, baseline: 383, bottomPadding: 6, depth: 4.75, anchors: [2580, 6870, 9560] },
      { texture: 'planter-wide', scale: 0.4, baseline: 381, bottomPadding: 6, depth: 4.75, anchors: [4400, 8530] },
      { texture: 'planter-small', scale: 0.35, baseline: 383, bottomPadding: 6, depth: 4.75, anchors: [870, 5710, 7870] },
      { texture: 'bin', scale: 0.28, baseline: 383, bottomPadding: 6, depth: 4.75, anchors: [2740, 9720] },
      { texture: 'bollard', scale: 0.2, baseline: 383, bottomPadding: 6, depth: 4.75, anchors: [4570, 4630, 8720, 8780] },
      { texture: 'bike-rack', scale: 0.36, baseline: 382, bottomPadding: 6, depth: 4.75, anchors: [1610, 6000] },
    ].flatMap(config => config.anchors.map(baseX => ({
      // Compensate for transparent bottom padding so the visible plinth rests on the pavement.
      image: this.add.image(baseX, config.baseline + config.bottomPadding * config.scale, `gamdom-city-new-${config.texture}`)
        .setOrigin(0.5, 1).setScale(config.scale).setDepth(config.depth).setVisible(false),
      baseX,
      parallax: 0.9,
    })));
    this.neonSky = this.add.image(width / 2, height / 2, 'neon-boulevard-night-background')
      .setDepth(-3.5).setVisible(false);
    const neonSkySource = this.neonSky.texture.getSourceImage();
    this.neonSky.setScale(Math.max(width / neonSkySource.width, height / neonSkySource.height));
    this.neonLayers = [
      { texture: 'distant-skyline', scale: 0.45, y: 403, depth: -2.7, parallax: 0.06, alpha: 0.72 },
      { texture: 'mid-skyline', scale: 0.4, y: 408, depth: -1.8, parallax: 0.15, alpha: 0.88 },
      { texture: 'elevated-transit', scale: 0.27, y: 395, depth: -1.2, parallax: 0.24, alpha: 0.9 },
    ].map(config => {
      const texture = `neon-boulevard-${config.texture}`;
      // Mirrored edges and a one-pixel overlap prevent hard joins and sampling gaps.
      const tileWidth = this.textures.get(texture).getSourceImage().width * config.scale - 1;
      const count = Math.ceil(width / tileWidth) + 2;
      const images = Array.from({ length: count }, () => this.add.image(0, config.y, texture)
        .setOrigin(0.5, 1).setScale(config.scale).setAlpha(config.alpha).setDepth(config.depth).setVisible(false));
      return { images, tileWidth, parallax: config.parallax };
    });
    this.neonArchitecture = [
      { texture: 'luxury-tower-a', scale: 0.48, baseX: 12500 },
      { texture: 'luxury-shops', scale: 0.5, baseX: 13580 },
      { texture: 'luxury-tower-b', scale: 0.4, baseX: 14620 },
      { texture: 'luxury-shops', scale: 0.5, baseX: 15720 },
      { texture: 'luxury-tower-a', scale: 0.48, baseX: 16720 },
      { texture: 'luxury-tower-b', scale: 0.4, baseX: 17850 },
      { texture: 'luxury-shops', scale: 0.5, baseX: 18910 },
      { texture: 'luxury-tower-a', scale: 0.48, baseX: 19900 },
      { texture: 'luxury-shops', scale: 0.5, baseX: 21010 },
      { texture: 'luxury-tower-b', scale: 0.4, baseX: 22050 },
      { texture: 'luxury-tower-a', scale: 0.48, baseX: 23150 },
    ].map(config => {
      // Align the visible plinth, rather than transparent source padding, with the street.
      const bottomPadding = config.texture === 'luxury-tower-a' ? 14
        : config.texture === 'luxury-tower-b' ? 4 : 36;
      return {
        image: this.add.image(config.baseX, this.groundY + bottomPadding * config.scale, `neon-boulevard-${config.texture}`)
          .setOrigin(0.5, 1).setScale(config.scale).setDepth(-0.4).setVisible(false),
        baseX: config.baseX,
        parallax: 0.52,
      };
    });
    this.neonSecondary = [15126, 18336, 20415].map(baseX => ({
      // One transparent source row below the visible frontage keeps its base aligned with the street.
      image: this.add.image(baseX, this.groundY + 0.4, 'neon-boulevard-vip-lounge')
        .setOrigin(0.5, 1).setScale(0.4).setDepth(0.6).setVisible(false),
      baseX,
      parallax: 0.52,
    }));
    this.neonLandmark = this.add.image(17300, this.groundY, 'neon-boulevard-hotel')
      .setOrigin(0.5, 1).setScale(0.4).setDepth(0.6).setVisible(false);
    this.neonRoadTiles = Array.from({ length: 3 }, (_, index) =>
      this.add.image((index - 1) * 960, this.groundY - 26, 'neon-boulevard-road')
        .setOrigin(0, 0).setScale(1).setDepth(5).setVisible(false)
    );
    this.hqSky = this.add.image(width / 2, height / 2, 'hq-foundation-approach-sky')
      .setScale(0.5).setDepth(-8).setVisible(false);
    this.hqLayers = [
      { texture: 'distant-skyline', scale: 0.5, y: 499.5, depth: -7, parallax: 0.1, alpha: 0.72, top: 500, baseline: 881 },
      { texture: 'secondary-skyline', scale: 0.45, y: 493.9, depth: -6, parallax: 0.18, alpha: 0.9, top: 340, baseline: 898 },
    ].map(config => {
      const texture = `hq-foundation-${config.texture}`;
      const tileWidth = this.textures.get(texture).getSourceImage().width * config.scale - 1;
      const maskKey = this.createHqSilhouetteMask(texture, config.top, config.baseline, 0, 1920);
      const maskImages: Phaser.GameObjects.Image[] = [];
      const images = Array.from({ length: Math.ceil(width / tileWidth) + 2 }, () =>
        this.add.image(0, config.y, texture).setOrigin(0.5, 1).setScale(config.scale)
          .setAlpha(config.alpha).setDepth(config.depth).setVisible(false)
      );
      images.forEach(image => {
        const maskImage = this.make.image({ key: maskKey, add: false }).setOrigin(0.5, 1).setScale(config.scale).setY(config.y);
        maskImages.push(maskImage);
        image.setMask(new Phaser.Display.Masks.BitmapMask(this, maskImage));
      });
      return { images, maskImages, tileWidth, parallax: config.parallax };
    });
    this.hqMainBuilding = this.add.image(10400, 480, 'hq-foundation-distant-main-building')
      .setOrigin(0.5, 1).setScale(0.4).setDepth(-4.5).setVisible(false);
    this.hqMainMask = this.make.image({
      key: this.createHqSilhouetteMask('hq-foundation-distant-main-building', 480, 910, 680, 1280), add: false,
    }).setOrigin(0.5, 1).setScale(0.4).setY(480);
    this.hqMainBuilding.setMask(new Phaser.Display.Masks.BitmapMask(this, this.hqMainMask));
    const hqMaskedImages = [...this.hqLayers.flatMap(layer => layer.images), this.hqMainBuilding];
    const hqMaskImages = [...this.hqLayers.flatMap(layer => layer.maskImages), this.hqMainMask];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      hqMaskedImages.forEach(image => image.clearMask(true));
      hqMaskImages.forEach(image => image.destroy());
    });
    this.hqCampusArchitecture = [
      { texture: 'hq-office-tower-a-neutral', baseX: 16130, scale: 0.42, baseline: 424, depth: -2.8, parallax: 0.38 },
      { texture: 'hq-office-tower-b-neutral', baseX: 18835, scale: 0.43, baseline: 426, depth: -2.7, parallax: 0.42 },
      { texture: 'hq-campus-building-purple', baseX: 22690, scale: 0.45, baseline: 428, depth: -2.5, parallax: 0.48 },
      { texture: 'hq-security-entrance-purple', baseX: 26685, scale: 0.48, baseline: 430, depth: -2.2, parallax: 0.54 },
      { texture: 'hq-monumental-building-purple-clean', baseX: 29480, scale: 0.50, baseline: 432, depth: -2.0, parallax: 0.58 },
      { texture: 'hq-futuristic-street-lamp-purple', baseX: 40680, scale: 0.40, baseline: 410, depth: 1.5, parallax: 0.82 },
      { texture: 'hq-futuristic-street-lamp-purple', baseX: 42545, scale: 0.40, baseline: 410, depth: 1.5, parallax: 0.82 },
      { texture: 'hq-landscaped-tree-planter-purple', baseX: 41607, scale: 0.32, baseline: 411, depth: 1.2, parallax: 0.86 },
      { texture: 'hq-landscaped-tree-planter-purple', baseX: 43047, scale: 0.32, baseline: 411, depth: 1.2, parallax: 0.86 },
      { texture: 'hq-landscaped-tree-planter-purple', baseX: 45327, scale: 0.32, baseline: 411, depth: 1.2, parallax: 0.86 },
      { texture: 'hq-corporate-banner-purple', baseX: 41404, scale: 0.36, baseline: 411, depth: 1.35, parallax: 0.84 },
      { texture: 'hq-corporate-banner-purple', baseX: 43690, scale: 0.36, baseline: 411, depth: 1.35, parallax: 0.84 },
      { texture: 'hq-fountain-monument-green', baseX: 35135, scale: 0.40, baseline: 414, depth: 0.4, parallax: 0.68 },
      { texture: 'hq-infrastructure-green', baseX: 33580, scale: 0.36, baseline: 414, depth: 0.2, parallax: 0.64 },
    ].map(config => ({
      image: this.add.image(config.baseX, config.baseline, config.texture)
        .setOrigin(0.5, 1).setScale(config.scale).setDepth(config.depth).setVisible(false),
      baseX: config.baseX,
      baseline: config.baseline,
      parallax: config.parallax,
    }));
    this.hqFinalEntrance = this.add.image(27075, 420, 'hq-final-entrance-green-clean')
      .setOrigin(0.5, 1).setScale(0.62).setDepth(-1.0).setVisible(false);
    this.cityBackground = this.add.image(width / 2, height / 2, 'casino-city')
      .setDisplaySize(width * 1.35, height)
      .setDepth(-3);
    this.cityBackgroundNext = this.add.image(width / 2 + width * 1.35, height / 2, 'casino-city')
      .setDisplaySize(width * 1.35, height)
      .setDepth(-3);
    this.cityBackground.setData('parallax', 0.12);
    this.cityBackgroundNext.setData('parallax', 0.12);
    this.cityAtmosphere = this.add.graphics().setDepth(-2.8);
    this.cityFarLayer = this.add.graphics().setDepth(-2).setAlpha(0.72);
    this.cityMidLayer = this.add.graphics().setDepth(0).setAlpha(0.68);
    this.cityStreetLayer = this.add.graphics().setDepth(3).setAlpha(0.88);
    this.cityDistantSkyline = [543, 1605, 2667, 3729].map((baseX) => ({
      image: this.add.image(0, 368, 'gamdom-distant-skyline')
        .setOrigin(0.5, 1)
        .setDisplaySize(1086, 362)
        .setAlpha(0.64)
        .setTint(0x6f947d)
        .setDepth(-2.6),
      baseX,
      cycleWidth: 4248,
      parallax: 0.1,
    }));
    this.citySupportBuildings = [
      { texture: 'gamdom-support-tower-a', baseX: 160, width: 384, height: 256, y: this.groundY - 36, depth: -2, alpha: 0.72, parallax: 0.18 },
      { texture: 'gamdom-wide-building', baseX: 620, width: 510, height: 340, y: this.groundY - 32, depth: -1.9, alpha: 0.72, parallax: 0.2 },
      { texture: 'gamdom-support-tower-b', baseX: 1130, width: 420, height: 280, y: this.groundY - 34, depth: -2, alpha: 0.74, parallax: 0.22 },
      { texture: 'gamdom-support-tower-a', baseX: 1720, width: 420, height: 280, y: this.groundY - 38, depth: -2, alpha: 0.7, parallax: 0.18 },
      { texture: 'gamdom-wide-building', baseX: 2280, width: 480, height: 320, y: this.groundY - 32, depth: -1.9, alpha: 0.72, parallax: 0.2 },
      { texture: 'gamdom-support-tower-b', baseX: 2870, width: 390, height: 260, y: this.groundY - 36, depth: -2, alpha: 0.72, parallax: 0.22 },
    ].map((config) => ({
      image: this.add.image(0, config.y, config.texture)
        .setOrigin(0.5, 1)
        .setDisplaySize(config.width, config.height)
        .setAlpha(config.alpha)
        .setTint(0xb4c8b9)
        .setDepth(config.depth),
      baseX: config.baseX,
      cycleWidth: 3300,
      parallax: config.parallax,
    }));
    this.citySkyscrapers = Array.from({ length: 2 }, () => this.add.image(0, this.groundY - 28, 'gamdom-skyscraper')
      .setOrigin(0.5, 1)
      .setDisplaySize(366, 360)
      .setAlpha(0.84)
      .setDepth(-1.5));
    this.cityCasinos = Array.from({ length: 2 }, () => this.add.image(0, this.groundY - 18, 'gamdom-casino')
      .setOrigin(0.5, 1)
      .setDisplaySize(382, 310)
      .setAlpha(0.88)
      .setDepth(-0.5));
    this.cityStreetBuildings = [
      { texture: 'gamdom-commercial-facade', baseX: 380, width: 348, height: 232, y: this.groundY - 22, parallax: 0.4 },
      { texture: 'gamdom-arcade-shop', baseX: 1260, width: 330, height: 220, y: this.groundY - 20, parallax: 0.44 },
      { texture: 'gamdom-commercial-facade', baseX: 2050, width: 378, height: 252, y: this.groundY - 22, parallax: 0.4 },
      { texture: 'gamdom-commercial-facade', baseX: 3020, width: 330, height: 220, y: this.groundY - 24, parallax: 0.38 },
    ].map((config) => ({
      image: this.add.image(0, config.y, config.texture)
        .setOrigin(0.5, 1)
        .setDisplaySize(config.width, config.height)
        .setAlpha(0.82)
        .setTint(0xd1ddd4)
        .setDepth(0.8),
      baseX: config.baseX,
      cycleWidth: 3840,
      parallax: config.parallax,
    }));
    this.cityBillboards = Array.from({ length: 3 }, () => this.add.image(0, this.groundY - 4, 'gamdom-billboard')
      .setOrigin(0.5, 1)
      .setDisplaySize(238, 208)
      .setAlpha(0.9)
      .setDepth(1.5));
    this.cityLamps = Array.from({ length: 5 }, () => this.add.image(0, this.groundY, 'gamdom-street-lamp')
      .setOrigin(0.5, 1)
      .setDisplaySize(127, 190)
      .setAlpha(0.92)
      .setDepth(3));
    const roadDisplayHeight = 264;
    const roadSurfaceOffset = roadDisplayHeight * (430 / 793);
    this.cityRoadTiles = Array.from({ length: 7 }, () => this.add.image(0, this.groundY - roadSurfaceOffset, 'gamdom-road')
      .setOrigin(0, 0)
      .setDisplaySize(660, roadDisplayHeight)
      .setCrop(0, 300, 1983, 493)
      .setDepth(5));
    this.background = this.add.graphics().setDepth(4);
    this.pedestrian01 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-01-walk', 6)
      .setOrigin(0.5, 156 / 160)
      .setScale(0.50)
      .setDepth(6);
    this.pedestrian02 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-02-walk', 1)
      .setOrigin(0.5, 156 / 160)
      .setScale(0.55)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian03 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-03-walk', 0)
      .setOrigin(0.5, 156 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian04 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-04-cheer', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian05 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-05-cheer', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian06 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-06-walk', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian07 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-07-photo', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian08 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-08-talk', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian09 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-09-pair', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian10 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-10-cheer', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian11 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-11-drink', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.pedestrian12 = this.add.sprite(1200, this.groundY - 26, 'pedestrian-12-walk', 0)
      .setOrigin(0.5, 154 / 160)
      .setScale(0.50)
      .setDepth(6)
      .setVisible(false);
    this.foreground = this.add.graphics().setDepth(10);
    this.hudFrame = this.add.graphics().setDepth(19);
    this.playerGraphics = this.add.graphics();
    this.playerGraphics.setDepth(13);

    this.setupInput();
    this.setupHud();
    this.districtTransition = new DistrictTransitionUI(this, [
      { name: 'CASINO DISTRICT', time: CASINO_DISTRICT_START },
      { name: 'NEON BOULEVARD', time: NEON_BOULEVARD_START },
      { name: 'HQ APPROACH', time: HQ_APPROACH_START },
    ]);
    this.resetPlayer();
    const characterDisplay = CHARACTER_CONFIG.characters[this.selectedCharacter];
    this.playerSprite = this.add.sprite(this.player.x, this.player.y,
      this.selectedCharacter === 0 ? 'gamby-playable' : this.selectedCharacter === 1 ? 'steve-playable' : this.selectedCharacter === 2 ? 'yungreal-playable' : characterDisplay.texture,
      this.selectedCharacter === 0 || this.selectedCharacter === 1 || this.selectedCharacter === 2 ? 'idle_0' : 0)
      .setOrigin(0.5, 1)
      .setScale(this.selectedCharacter === 0 ? GAMBY_VISUAL_SCALE : this.selectedCharacter === 1 ? STEVE_VISUAL_SCALE : this.selectedCharacter === 2 ? YUNGREAL_VISUAL_SCALE : characterDisplay.visualScale)
      .setDepth(14);
    if (this.selectedCharacter === 0) this.renderGamby(this.player.pose);
    else if (this.selectedCharacter === 1) this.renderSteve(this.player.pose);
    else if (this.selectedCharacter === 2) this.renderYungreal(this.player.pose);
    this.spawnTimer = 0.75;

    this.pauseText = this.add.text(this.scale.width / 2, this.scale.height / 2, 'PAUSED', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '30px',
      color: '#e9ffff',
      stroke: '#0a1015',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(1000).setVisible(false);

    this.powerText = this.add.text(24, 78, 'POWER: NONE', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '10px',
      color: '#baffd9',
      backgroundColor: '#03110f',
      stroke: '#071014',
      strokeThickness: 3,
      padding: { x: 7, y: 4 },
    }).setDepth(20).setVisible(false);

    this.statusText = this.add.text(this.scale.width / 2, 170, '', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#071014',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    this.arrivalText = this.add.text(this.scale.width / 2, this.scale.height * 0.28, 'GAMDOM HQ', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '34px',
      color: '#dffcff',
      stroke: '#071014',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    // BEGIN PORTRAIT PROTOTYPE
    if (this.prototypeProfile) {
      this.cameras.main.ignore(this.children.list.filter(object =>
        (object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth).depth >= 18));
    }
    // END PORTRAIT PROTOTYPE
    this.events.once('shutdown', () => {
      this.cashRushVisuals.destroy();
      this.districtTransition.destroy();
      this.completionTimer?.remove(false);
      this.items.length = 0;
      this.itemSprites.clear();
      this.itemLabels.clear();
      this.birdCues.clear();
      this.powerLabels.clear();
      this.itemSpritePool.length = 0;
      this.itemLabelPool.length = 0;
      this.birdCuePool.length = 0;
      this.powerLabelPool.length = 0;
      this.controlInput.clear();
      this.completionTimer = undefined;
    });
  }

  override update(time: number, delta: number): void {
    if (!this.running) {
      return;
    }

    const elapsedDt = Math.max(0, delta / 1000);
    const dt = Math.min(elapsedDt, 1 / 30);

    if (this.paused) {
      this.pauseText.setVisible(true);
      if (this.selectedCharacter === 0 || this.selectedCharacter === 1 || this.selectedCharacter === 2) this.renderPlayer();
      return;
    }

    if (this.finalGateActivated) {
      this.renderBackground();
      this.renderPlayer();
      this.renderItems();
      return;
    }

    this.controlInput.advance(elapsedDt);
    this.runElapsed = Math.min(RUN_DURATION_SECONDS, this.runElapsed + elapsedDt);
    this.districtTransition.update(this.runElapsed);
    if (this.runElapsed >= RUN_DURATION_SECONDS) {
      this.activateFinalGate();
      this.updateHud();
      this.renderBackground();
      this.renderPlayer();
      this.renderItems();
      return;
    }

    this.pauseText.setVisible(false);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    if (this.shieldTimer <= 0) this.player.shield = 0;
    this.boostTimer = Math.max(0, this.boostTimer - dt);
    this.x2Timer = Math.max(0, this.x2Timer - dt);
    this.magnetTimer = Math.max(0, this.magnetTimer - dt);
    this.multiplierTimer = Math.max(0, this.multiplierTimer - dt);
    this.hitFeedbackTimer = Math.max(0, this.hitFeedbackTimer - dt);
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    if (this.cashRushTimer > 0) {
      this.cashRushTimer = Math.max(0, this.cashRushTimer - elapsedDt);
      if (this.cashRushTimer === 0) {
        this.cashStreak = 0;
        this.showCashRushEnded();
      }
    }
    this.updateCashRushActiveIndicator();
    this.statusTimer = Math.max(0, this.statusTimer - dt);
    if (this.statusTimer <= 0) {
      this.statusText.setVisible(false);
    }

    this.speed = this.getBaseWorldSpeed() * this.getCashRushSpeedMultiplier();
    const worldStep = this.speed * elapsedDt;
    this.distance += worldStep;
    const scoreMultiplier = this.multiplierTimer > 0 ? SCORE_MULTIPLIER : 1;
    this.score += worldStep * 0.14 * scoreMultiplier;
    if (this.boostTimer > 0) this.score += BOOST_SCORE_PER_SECOND * dt;

    this.updatePlayer(dt);
    this.updateWorld(dt, worldStep);
    this.handleCollisions();
    this.handleSpawning(dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.updateHud();
    }

    this.renderBackground();
    this.renderPlayer();
    this.renderItems();

  }

  private getBaseWorldSpeed(): number {
    for (let index = 1; index < WORLD_SPEED_KEYFRAMES.length; index++) {
      const previous = WORLD_SPEED_KEYFRAMES[index - 1];
      const next = WORLD_SPEED_KEYFRAMES[index];
      if (this.runElapsed <= next.time) {
        const progress = (this.runElapsed - previous.time) / (next.time - previous.time);
        return Phaser.Math.Linear(previous.speed, next.speed, Phaser.Math.Clamp(progress, 0, 1)) * WORLD_SPEED_MULTIPLIER;
      }
    }
    return WORLD_SPEED_KEYFRAMES[WORLD_SPEED_KEYFRAMES.length - 1].speed * WORLD_SPEED_MULTIPLIER;
  }

  private getCashRushSpeedMultiplier(): number {
    if (this.cashRushTimer <= 0) return 1;
    const rampIn = Phaser.Math.Clamp((CASH_RUSH_SECONDS - this.cashRushTimer) / 0.25, 0, 1);
    const rampOut = Phaser.Math.Clamp(this.cashRushTimer / 0.35, 0, 1);
    return 1 + 0.15 * Math.min(rampIn, rampOut);
  }

  private getHqEntrancePresentationDistance(): number {
    let distance = 0;
    for (let index = 1; index < WORLD_SPEED_KEYFRAMES.length; index++) {
      const previous = WORLD_SPEED_KEYFRAMES[index - 1];
      const next = WORLD_SPEED_KEYFRAMES[index];
      const seconds = Phaser.Math.Clamp(this.runElapsed - previous.time, 0, next.time - previous.time);
      const endSpeed = Phaser.Math.Linear(previous.speed, next.speed, seconds / (next.time - previous.time));
      distance += (previous.speed + endSpeed) * 0.5 * seconds;
      if (this.runElapsed <= next.time) break;
    }
    return distance;
  }

  private activateFinalGate(): void {
    if (this.runElapsed < RUN_DURATION_SECONDS || this.dead || !this.running || this.finalGateActivated) return;
    this.finalGateActivated = true;
    this.cashRushVisuals.reset();
    this.clearControlInput();
    this.arrivalText.setVisible(true);
    this.player.pose = 'win';
    this.completionTimer = this.time.delayedCall(1500, () => {
      this.completionTimer = undefined;
      if (this.running) {
        this.completeRun();
      }
    });
  }

  private setupInput(): void {
    const clearPresentationInput = (): void => this.clearControlInput();
    if (this.input.manager.pointers.length < 3) this.input.addPointer(3 - this.input.manager.pointers.length);
    this.game.events.on(Phaser.Core.Events.PAUSE, clearPresentationInput);
    window.addEventListener('blur', clearPresentationInput);
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.PAUSE, clearPresentationInput);
      window.removeEventListener('blur', clearPresentationInput);
    });
    const keyboardManager = this.input.keyboard!.manager as Phaser.Input.Keyboard.KeyboardManager & { queue?: KeyboardEvent[] };
    for (const event of keyboardManager.queue ?? []) this.processedKeyEvents.add(event);
    const oncePerEvent = (command: (event: KeyboardEvent) => void) => (event: KeyboardEvent): void => {
      if (this.processedKeyEvents.has(event)) return;
      this.processedKeyEvents.add(event);
      command(event);
    };
    const jumpOnPress = oncePerEvent((event: KeyboardEvent): void => { if (!event.repeat) this.jump(); });
    this.input.keyboard!.on('keydown-W', jumpOnPress);
    this.input.keyboard!.on('keydown-UP', jumpOnPress);
    this.input.keyboard!.on('keydown-S', oncePerEvent(() => this.setSlideKey('S', true)));
    this.input.keyboard!.on('keyup-S', oncePerEvent(() => this.setSlideKey('S', false)));
    this.input.keyboard!.on('keydown-DOWN', oncePerEvent(() => this.setSlideKey('DOWN', true)));
    this.input.keyboard!.on('keyup-DOWN', oncePerEvent(() => this.setSlideKey('DOWN', false)));
    this.input.keyboard!.on('keydown-SPACE', jumpOnPress);
    this.input.keyboard!.on('keydown-P', oncePerEvent(event => { if (!event.repeat) this.togglePause(); }));
    this.input.keyboard!.on('keydown-R', oncePerEvent(event => { if (!event.repeat) this.restartRun(); }));

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on(Phaser.Input.Events.GAME_OUT, this.handleCanvasExit, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.running || this.paused || this.dead || this.finalGateActivated || !this.isControlPointerInBand(pointer)) return;
    if (!this.prototypeProfile && pointer.x >= this.scale.width - 52
      && pointer.x <= this.scale.width - 8 && pointer.y >= 10 && pointer.y <= 54) return;
    if (this.controlInput.pointers.has(pointer.id) || (!pointer.wasTouch && pointer.button !== 0)) return;
    const left = this.prototypeProfile?.visibleWorldLeft ?? 0;
    const width = this.prototypeProfile?.visibleWorldWidth ?? this.scale.width;
    const action = pointer.wasTouch && pointer.x < left + width * TOUCH_SLIDE_FRACTION ? 'slide' : 'jump';
    this.controlInput.pointers.set(pointer.id, action);
    if (action === 'slide') this.slide();
    else this.jump(pointer.id);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isControlPointerInBand(pointer)) this.releaseControlPointer(pointer.id, true);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    this.releaseControlPointer(pointer.id, pointer.wasCanceled || !this.isControlPointerInBand(pointer));
  }

  private handleCanvasExit(_time: number, event: MouseEvent | TouchEvent): void {
    if (!('changedTouches' in event)) {
      this.releaseControlPointer(0, true);
      return;
    }
    const bounds = this.game.canvas.getBoundingClientRect();
    for (const touch of Array.from(event.changedTouches)) {
      const x = (touch.clientX - bounds.left) * this.scale.width / bounds.width;
      const y = (touch.clientY - bounds.top) * this.scale.height / bounds.height;
      if (x >= (this.prototypeProfile?.visibleWorldLeft ?? 0) && x <= this.scale.width && y >= 0 && y <= this.scale.height) continue;
      const pointer = this.input.manager.pointers.find(candidate => candidate.wasTouch && candidate.identifier === touch.identifier);
      if (pointer) this.releaseControlPointer(pointer.id, true);
    }
  }

  private isControlPointerInBand(pointer: Phaser.Input.Pointer): boolean {
    return pointer.x >= (this.prototypeProfile?.visibleWorldLeft ?? 0)
      && pointer.x <= (this.prototypeProfile?.visibleWorldRight ?? this.scale.width)
      && pointer.y >= 0 && pointer.y <= this.scale.height;
  }

  private releaseControlPointer(id: number, cancelled: boolean): void {
    const action = this.controlInput.pointers.get(id);
    this.controlInput.pointers.delete(id);
    if (cancelled && this.controlInput.jumpPointerId === id) this.controlInput.clearJump();
    if (action === 'slide' && !this.controlInput.slideHeld && this.player.sliding) {
      if (cancelled) this.player.slideTime = 0;
      if (this.player.slideTime <= 0) this.stopSlide();
    }
  }

  private clearControlInput(): void {
    this.controlInput.clear();
    if (this.player?.sliding) this.stopSlide();
    this.input.keyboard?.resetKeys();
    this.input.resetPointers();
  }

  private setupHud(): void {
    const { width } = this.scale;
    const timePanel = { x: 18, y: 12, w: 188, h: 54 };
    const moneyPanel = { x: width / 2 - 120, y: 12, w: 240, h: 54 };
    const livesPanel = { x: width - 218, y: 12, w: 166, h: 54 };
    const streakPanel = { x: width / 2 - 90, y: 72, w: 180, h: 34 };
    const drawPanel = (panel: { x: number; y: number; w: number; h: number }, accent: number): void => {
      this.hudFrame.fillStyle(0x020b09, 0.9);
      this.hudFrame.fillRoundedRect(panel.x, panel.y, panel.w, panel.h, 6);
      this.hudFrame.lineStyle(2, accent, 0.88);
      this.hudFrame.strokeRoundedRect(panel.x, panel.y, panel.w, panel.h, 6);
      this.hudFrame.fillStyle(accent, 0.9);
      this.hudFrame.fillRect(panel.x + 10, panel.y, 34, 3);
      this.hudFrame.lineStyle(2, accent, 0.55);
      this.hudFrame.lineBetween(panel.x + panel.w - 24, panel.y + 2, panel.x + panel.w - 4, panel.y + 22);
    };
    drawPanel(timePanel, 0x31ef9f);
    drawPanel(moneyPanel, 0x31ef9f);
    drawPanel(livesPanel, 0x31ef9f);
    drawPanel(streakPanel, 0x1bbf80);

    this.hudFrame.fillStyle(0x0a251c, 1);
    this.hudFrame.fillCircle(timePanel.x + 25, timePanel.y + 28, 13);
    this.hudFrame.lineStyle(2, 0x8bffd1, 1);
    this.hudFrame.strokeCircle(timePanel.x + 25, timePanel.y + 28, 10);
    this.hudFrame.lineBetween(timePanel.x + 25, timePanel.y + 28, timePanel.x + 25, timePanel.y + 21);
    this.hudFrame.lineBetween(timePanel.x + 25, timePanel.y + 28, timePanel.x + 31, timePanel.y + 32);

    this.hudFrame.fillStyle(0x5a4108, 1);
    this.hudFrame.fillCircle(moneyPanel.x + 28, moneyPanel.y + 28, 14);
    this.hudFrame.lineStyle(2, 0xffd95a, 1);
    this.hudFrame.strokeCircle(moneyPanel.x + 28, moneyPanel.y + 28, 11);

    const valueStyle = { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#fff1a8', stroke: '#04110d', strokeThickness: 4 };
    const labelStyle = { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '9px', color: '#72f3b5', stroke: '#04110d', strokeThickness: 2 };
    const timeValueStyle = { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '14px', color: '#f4fff9', stroke: '#04110d', strokeThickness: 3 };
    this.hud = [
      this.add.text(width / 2, 16, 'MONEY', labelStyle).setOrigin(0.5, 0).setDepth(20),
      this.add.text(width / 2, 29, '$ 0', valueStyle).setOrigin(0.5, 0).setDepth(20),
      this.add.text(timePanel.x + 48, 18, 'TIME', labelStyle).setDepth(20),
      this.add.text(timePanel.x + 48, 35, '00:00 / 01:30', timeValueStyle).setDepth(20),
      this.add.text(-200, -200, 'SCORE', valueStyle).setDepth(20).setVisible(false),
      this.add.text(-200, -200, '0', valueStyle).setDepth(20).setVisible(false),
    ];
    this.add.text(moneyPanel.x + 28, moneyPanel.y + 28, '$', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '15px',
      color: '#fff4b0',
      stroke: '#4a3204',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);

    this.cashStreakBarX = streakPanel.x + 14;
    this.cashStreakBarY = streakPanel.y + 23;
    this.cashStreakBarWidth = streakPanel.w - 28;
    this.cashStreakText = this.add.text(width / 2, streakPanel.y + 5, 'CASH STREAK  0 / 10', labelStyle).setOrigin(0.5, 0).setDepth(20);
    this.cashStreakMeter = this.add.graphics().setDepth(20);
    this.cashRushHudGlow = this.add.graphics().setDepth(19.5).setVisible(false);
    this.cashRushHudGlow.fillStyle(0xffd95a, 0.1);
    this.cashRushHudGlow.fillRoundedRect(streakPanel.x, streakPanel.y, streakPanel.w, streakPanel.h, 6);
    this.cashRushHudGlow.lineStyle(2, 0xffe36f, 0.95);
    this.cashRushHudGlow.strokeRoundedRect(streakPanel.x, streakPanel.y, streakPanel.w, streakPanel.h, 6);
    this.cashRushIcon = this.add.graphics().setDepth(20).setVisible(false);
    const flameX = streakPanel.x + 24;
    const flameY = streakPanel.y + streakPanel.h / 2;
    this.cashRushIcon.fillStyle(0xffa928, 1);
    this.cashRushIcon.fillTriangle(flameX - 7, flameY + 8, flameX + 7, flameY + 8, flameX + 2, flameY - 10);
    this.cashRushIcon.fillCircle(flameX, flameY + 3, 7);
    this.cashRushIcon.fillStyle(0xffef8a, 1);
    this.cashRushIcon.fillTriangle(flameX - 3, flameY + 7, flameX + 4, flameY + 7, flameX + 1, flameY - 3);
    this.cashRushText = this.add.text(width / 2 + 8, streakPanel.y + streakPanel.h / 2, 'CASH RUSH\nx2 CASH  6.0s', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '11px',
      color: '#fff3a6',
      stroke: '#3b2504',
      strokeThickness: 3,
      lineSpacing: 0,
      align: 'center',
    }).setOrigin(0.5).setDepth(20).setVisible(false);
    this.cashRushBanner = this.add.text(width / 2, 122, 'CASH RUSH!', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '24px',
      color: '#ffe36f',
      stroke: '#3b2504',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(40).setVisible(false);
    this.cashRushBannerDetail = this.add.text(width / 2, 146, 'x2 CASH  |  6.0s', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '12px',
      color: '#fff5bd',
      stroke: '#3b2504',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(40).setVisible(false);
    this.cashRushEdgeGlow = this.add.graphics().setDepth(10.2).setAlpha(0).setVisible(false);
    this.cashRushVisuals = new CashRushVisuals(this, this.cashRushEdgeGlow,
      this.prototypeProfile?.visibleWorldLeft ?? 0, this.prototypeProfile?.visibleWorldRight ?? width, CASH_RUSH_SECONDS);
    this.lifeText = this.add.text(livesPanel.x + 18, livesPanel.y + livesPanel.h / 2, 'LIVES', {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontSize: '12px',
      color: '#f4fff9',
      stroke: '#04110d',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(20);
    this.lifeHeartStartX = livesPanel.x + 80;
    this.lifeHeartY = livesPanel.y + livesPanel.h / 2 - 2;
    this.lifeHearts = this.add.graphics().setDepth(20);
    this.updateLifeDisplay();

    const pause = this.add.container(width - 28, 39);
    const body = this.add.rectangle(0, 0, 40, 46, 0x020b09, 0.94).setStrokeStyle(2, 0x72f3b5, 0.9);
    const bars = this.add.graphics();
    bars.fillStyle(0xf0fff7, 1);
    bars.fillRoundedRect(-7, -10, 5, 20, 2);
    bars.fillRoundedRect(2, -10, 5, 20, 2);
    pause.add([body, bars]);
    pause.setSize(42, 42).setInteractive({ useHandCursor: true });
    pause.on('pointerdown', () => this.togglePause());
    // BEGIN PORTRAIT PROTOTYPE
    if (this.prototypeProfile) {
      pause.disableInteractive();
      this.cameras.main.ignore(pause);
    }
    // END PORTRAIT PROTOTYPE
  }

  private resetPlayer(): void {
    this.player = {
      x: PLAYER_X,
      y: this.groundY,
      vy: 0,
      w: STAND_W,
      h: STAND_H,
      onGround: true,
      jumpCount: 0,
      slideTime: 0,
      sliding: false,
      fastFalling: false,
      shield: 0,
      pose: 'idle',
      flash: 0,
    };
  }

  private jump(pointerId?: number): void {
    if (!this.running || this.paused || this.dead || this.finalGateActivated) return;
    if (this.executeJump()) this.controlInput.clearJump();
    else this.controlInput.bufferJump(pointerId);
  }

  private executeJump(): boolean {
    if (this.player.onGround) {
      this.player.sliding = false;
      this.player.fastFalling = false;
      this.player.slideTime = 0;
      this.player.h = STAND_H;
      this.player.vy = -840;
      this.player.onGround = false;
      this.player.jumpCount = 1;
      if (this.prototypeProfile) this.game.events.emit('portrait-audio-cue', 'jump');
      return true;
    }
    if (this.player.jumpCount < 2) {
      this.player.fastFalling = false;
      this.player.vy = -720;
      this.player.jumpCount += 1;
      if (this.prototypeProfile) this.game.events.emit('portrait-audio-cue', 'double-jump');
      return true;
    }
    return false;
  }

  private slide(): void {
    if (!this.running || this.paused || this.dead) return;
    if (!this.player.onGround) {
      this.startFastFall();
      return;
    }
    this.startSlide(MIN_SLIDE_SECONDS);
  }

  private setSlideKey(key: 'S' | 'DOWN', pressed: boolean): void {
    if (pressed) {
      this.heldSlideKeys.add(key);
      if (!this.running || this.paused || this.dead) return;
      if (this.player.onGround && !this.player.sliding) this.startSlide(MIN_SLIDE_SECONDS);
      else this.startFastFall();
      return;
    }

    this.heldSlideKeys.delete(key);
    if (!this.controlInput.slideHeld && this.player.sliding && this.player.slideTime <= 0) {
      this.stopSlide();
    }
  }

  private startSlide(duration: number): void {
    if (!this.player.onGround) return;
    if (this.prototypeProfile && !this.player.sliding) this.game.events.emit('portrait-audio-cue', 'slide');
    this.player.y = this.groundY;
    this.player.sliding = true;
    this.player.slideTime = duration;
    this.player.h = SLIDE_H;
  }

  private stopSlide(): void {
    this.player.sliding = false;
    this.player.slideTime = 0;
    this.player.h = STAND_H;
  }

  private startFastFall(): void {
    if (this.player.onGround) return;
    this.player.fastFalling = true;
    this.player.vy = Math.max(this.player.vy, FAST_FALL_VELOCITY);
  }

  private togglePause(): void {
    if (!this.running) return;
    this.clearControlInput();
    this.paused = !this.paused;
    if (this.completionTimer) this.completionTimer.paused = this.paused;
    this.pauseText.setVisible(this.paused);
    this.updateCharacterPose();
  }

  private restartRun(): void {
    // BEGIN PORTRAIT PROTOTYPE
    if (this.prototypeProfile) {
      this.scene.restart({ selectedCharacter: this.selectedCharacter, presentationProfile: this.prototypeProfile });
      return;
    }
    // END PORTRAIT PROTOTYPE
    this.scene.restart({ selectedCharacter: this.selectedCharacter });
  }

  private updatePlayer(dt: number): void {
    const gravity = this.player.fastFalling
      ? FAST_FALL_GRAVITY
      : this.player.vy > 0
        ? NORMAL_FALL_GRAVITY
        : 2200;
    this.player.x = PLAYER_X;

    if (!this.player.onGround) {
      this.player.vy += gravity * dt;
      this.player.y += this.player.vy * dt;
      if (this.player.y >= this.groundY) {
        this.player.y = this.groundY;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.jumpCount = 0;
        this.player.fastFalling = false;
        if (this.controlInput.jumpBuffer > 0) {
          this.executeJump();
          this.controlInput.clearJump();
        } else if (this.controlInput.slideHeld) this.startSlide(MIN_SLIDE_SECONDS);
        else {
          this.player.sliding = false;
          this.player.h = STAND_H;
        }
      }
    } else if (this.player.sliding) {
      this.player.h = SLIDE_H;
      this.player.slideTime = Math.max(0, this.player.slideTime - dt);
      if (!this.controlInput.slideHeld && this.player.slideTime <= 0) this.stopSlide();
    } else if (this.distance > 0) {
      this.player.h = STAND_H;
    }

    if (this.player.flash > 0) {
      this.player.flash = Math.max(0, this.player.flash - dt * 2.5);
    }
    this.updateCharacterPose();
  }

  private updateCharacterPose(): void {
    if (this.finalGateActivated) {
      this.player.pose = 'win';
      return;
    }
    if (this.hitFeedbackTimer > 0) {
      this.player.pose = 'hit';
      return;
    }
    if (!this.player.onGround) {
      if (this.player.fastFalling || this.player.vy > 50) this.player.pose = 'fall';
      else if (this.player.jumpCount >= 2) this.player.pose = 'doubleJump';
      else this.player.pose = 'jump';
      return;
    }
    if (this.player.sliding) {
      this.player.pose = 'slide';
      return;
    }
    this.player.pose = this.running && !this.paused && this.distance > 0 ? 'run' : 'idle';
  }

  private handleSpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const runProgress = this.runElapsed / RUN_DURATION_SECONDS;
      this.spawnTimer = Phaser.Math.FloatBetween(0.78, 1.12) - runProgress * 0.24;
      this.spawnWave();
    }
    this.handlePowerSpawning();
    this.handleLifeSpawning();
  }

  private handleLifeSpawning(): void {
    while (this.nextLifeSpawn < LIFE_SPAWN_SCHEDULE.length
      && this.runElapsed >= LIFE_SPAWN_SCHEDULE[this.nextLifeSpawn]) {
      this.nextLifeSpawn += 1;
      // Skip missed slots instead of emitting several hearts together after a stall.
      if (this.nextLifeSpawn < LIFE_SPAWN_SCHEDULE.length
        && this.runElapsed >= LIFE_SPAWN_SCHEDULE[this.nextLifeSpawn]) continue;
      if (this.lives >= MAX_LIVES) continue;
      let spawnX = this.getSafeSpawnX(false);
      for (const item of this.items) {
        if (item.active && this.isHazard(item)) {
          spawnX = Math.max(spawnX, item.x + POWER_HAZARD_GAP);
        }
      }
      this.items.push({ type: 'life', x: spawnX, y: this.groundY - 70, w: 64, h: 64, value: 0, active: true });
    }
  }

  private handlePowerSpawning(): void {
    while (this.nextPowerSpawn < POWER_SPAWN_SCHEDULE.length
      && this.runElapsed >= POWER_SPAWN_SCHEDULE[this.nextPowerSpawn].time) {
      const scheduledPower = POWER_SPAWN_SCHEDULE[this.nextPowerSpawn];
      this.spawnPower(scheduledPower.effect);
      this.nextPowerSpawn += 1;
    }
  }

  private spawnPower(effect: PowerKind): void {
    let spawnX = this.getSafeSpawnX(false);
    for (const item of this.items) {
      if (item.active && this.isHazard(item)) {
        spawnX = Math.max(spawnX, item.x + POWER_HAZARD_GAP);
      }
    }
    const elevated = this.runElapsed >= CASINO_DISTRICT_START && this.nextPowerSpawn % 4 === 2;
    this.items.push({
      type: 'power',
      x: spawnX,
      y: this.groundY - (elevated ? ELEVATED_POWER_Y_OFFSET : 70),
      w: 34,
      h: 34,
      value: 0,
      active: true,
      effect,
    });
  }

  private spawnWave(): void {
    const pool = this.getPatternPool();
    const choices = pool.filter((pattern) => pattern !== this.lastPattern);
    const pattern = choices[Phaser.Math.Between(0, choices.length - 1)] ?? pool[0];
    this.lastPattern = pattern;
    this.spawnPattern(pattern);
  }

  private getPatternPool(): RunnerPattern[] {
    const pool = this.getBasePatternPool();
    return pool.flatMap((pattern) => {
      const hasSign = pattern === 'slide' || pattern === 'mixed' || pattern === 'slideJump';
      if (hasSign) return this.runElapsed < 12 ? [] : [pattern];
      return [pattern, pattern, pattern];
    });
  }

  private getBasePatternPool(): RunnerPattern[] {
    if (this.runElapsed < 20) {
      return ['moneyLine', 'moneyLine', 'moneyLine', 'moneyArc', 'moneyArc', 'singleJump', 'singleJump', 'singleJump', 'singleJump', 'penalty', 'slide', 'birdSlide'];
    }
    if (this.runElapsed < 40) {
      return ['moneyLine', 'moneyLine', 'moneyLine', 'moneyArc', 'moneyArc', 'reward', 'penalty', 'singleJump', 'singleJump', 'singleJump', 'singleJump', 'slide', 'birdSlide', 'doubleJump', 'doubleJump', 'jumpDouble', 'doubleReward'];
    }
    if (this.runElapsed < 55) {
      return ['moneyLine', 'moneyLine', 'moneyArc', 'moneyArc', 'reward', 'penalty', 'singleJump', 'singleJump', 'singleJump', 'slide', 'slide', 'birdSlide', 'birdSlide', 'doubleJump', 'doubleJump', 'jumpDouble', 'mixed', 'doubleReward', 'slideJump'];
    }
    if (this.runElapsed < 70) {
      return ['moneyLine', 'moneyLine', 'moneyArc', 'moneyArc', 'reward', 'penalty', 'singleJump', 'singleJump', 'singleJump', 'slide', 'slide', 'birdSlide', 'doubleJump', 'doubleJump', 'jumpDouble', 'jumpDouble', 'jumpDouble', 'mixed', 'mixed', 'doubleReward', 'doubleReward', 'slideJump', 'slideJump'];
    }
    return ['moneyLine', 'moneyLine', 'moneyArc', 'moneyArc', 'reward', 'penalty', 'singleJump', 'singleJump', 'singleJump', 'slide', 'slide', 'birdSlide', 'birdSlide', 'doubleJump', 'doubleJump', 'doubleJump', 'jumpDouble', 'jumpDouble', 'jumpDouble', 'mixed', 'mixed', 'mixed', 'doubleReward', 'doubleReward', 'slideJump', 'slideJump', 'slideJump'];
  }

  private spawnPattern(pattern: RunnerPattern): void {
    if (pattern === 'moneyLine') {
      this.spawnMoneyLine(this.getSafeSpawnX(false), 3);
      return;
    }
    if (pattern === 'moneyArc') {
      this.spawnMoneyArc(this.getSafeSpawnX(false), 4);
      return;
    }
    if (pattern === 'reward') {
      const pick = MONEY_TYPES[Phaser.Math.Between(3, 4)];
      this.pushMoney(pick, this.getSafeSpawnX(false), this.groundY - 40);
      return;
    }

    const startX = this.getSafeSpawnX(true);
    if (pattern === 'penalty') {
      const pick = NEGATIVE_TYPES[Phaser.Math.Between(0, NEGATIVE_TYPES.length - 1)];
      this.items.push({ type: pick.type, x: startX, y: this.groundY - 24, w: NEGATIVE_TOKEN_SIZE * NEGATIVE_TOKEN_SCALE, h: NEGATIVE_TOKEN_SIZE * NEGATIVE_TOKEN_SCALE, value: pick.value, active: true, label: pick.label });
      return;
    }
    if (pattern === 'singleJump') {
      this.spawnSmallGroundObstacle(startX);
      return;
    }
    if (pattern === 'doubleJump') {
      this.spawnTallGroundObstacle(startX);
      return;
    }
    if (pattern === 'jumpDouble') {
      this.spawnSmallGroundObstacle(startX);
      this.spawnTallGroundObstacle(startX + JUMP_DOUBLE_GAP);
      return;
    }
    if (pattern === 'slide') {
      this.spawnOverheadObstacle(startX);
      return;
    }
    if (pattern === 'birdSlide') {
      this.spawnBird(startX);
      return;
    }
    if (pattern === 'mixed') {
      this.spawnSmallGroundObstacle(startX);
      this.spawnMoneyArc(startX + 180, 4, 68);
      this.spawnOverheadObstacle(startX + MIXED_OVERHEAD_GAP);
      return;
    }
    if (pattern === 'doubleReward') {
      this.spawnSmallGroundObstacle(startX);
      this.spawnElevatedMoneyArc(startX + 240, 5, 112);
      return;
    }
    this.spawnOverheadObstacle(startX);
    this.spawnSmallGroundObstacle(startX + SLIDE_JUMP_GAP);
  }

  private spawnSmallGroundObstacle(x: number): void {
    if (Phaser.Math.Between(0, 1) === 0) {
      this.items.push({ type: 'cone', x, y: this.groundY - 42, w: 42, h: 48, value: 0, active: true });
      return;
    }
    this.items.push({ type: 'crate', x, y: this.groundY - 38, w: 56, h: 52, value: 0, active: true });
  }

  private spawnTallGroundObstacle(x: number): void {
    // Keep existing patterns and other obstacles; accept one third of late-run tall containers.
    if (this.runElapsed >= 40 && Phaser.Math.Between(0, 2) !== 0) return;
    this.items.push({ type: 'tallBarrier', x, y: this.groundY - 88, w: 74, h: 176, value: 0, active: true });
  }

  private spawnOverheadObstacle(x: number): void {
    this.items.push({ type: 'overhead', x, y: 190, w: 112, h: 240, value: 0, active: true });
  }

  private spawnBird(x: number): void {
    this.items.push({
      type: 'bird',
      x,
      y: this.groundY - BIRD_CENTER_Y_OFFSET,
      w: ROBOTIC_BIRD.width * ROBOTIC_BIRD.scale,
      h: ROBOTIC_BIRD.height * ROBOTIC_BIRD.scale,
      value: -50,
      active: true,
      label: '-$50',
    });
  }

  private getSafeSpawnX(forHazard: boolean): number {
    let spawnX = this.scale.width + 90;
    for (const item of this.items) {
      if (!item.active) continue;
      spawnX = Math.max(spawnX, item.x + MIN_SPAWN_SPACING);
      if (forHazard && this.isHazard(item)) {
        spawnX = Math.max(spawnX, item.x + HAZARD_SAFETY_GAP);
      }
      if (forHazard && (item.type === 'power' || item.type === 'life')) {
        spawnX = Math.max(spawnX, item.x + POWER_HAZARD_GAP);
      }
    }
    return spawnX;
  }

  private isHazard(item: RunnerItem): boolean {
    return item.type.startsWith('bad')
      || item.type === 'bird'
      || item.type === 'cone'
      || item.type === 'crate'
      || item.type === 'barrier'
      || item.type === 'tallBarrier'
      || item.type === 'overhead';
  }

  private pushMoney(pick: (typeof MONEY_TYPES)[number], x: number, y: number): void {
    this.items.push({
      type: pick.type,
      x,
      y,
      w: POSITIVE_COIN.size * POSITIVE_COIN.scale,
      h: POSITIVE_COIN.size * POSITIVE_COIN.scale,
      value: pick.value,
      active: true,
      label: pick.label,
    });
  }

  private spawnMoneyLine(startX: number, count: number): void {
    for (let index = 0; index < count; index++) {
      const pick = MONEY_TYPES[Phaser.Math.Between(0, 2)];
      this.pushMoney(pick, startX + index * MONEY_PATTERN_GAP, this.groundY - 38);
    }
  }

  private spawnMoneyArc(startX: number, count: number, arcHeight = 62): void {
    for (let index = 0; index < count; index++) {
      const progress = count === 1 ? 0 : index / (count - 1);
      const pick = index === count - 1 && Phaser.Math.FloatBetween(0, 1) < 0.12
        ? MONEY_TYPES[Phaser.Math.Between(3, 4)]
        : MONEY_TYPES[Phaser.Math.Between(0, 2)];
      const y = this.groundY - 42 - Math.sin(progress * Math.PI) * arcHeight;
      this.pushMoney(pick, startX + index * MONEY_PATTERN_GAP, y);
    }
  }

  private spawnElevatedMoneyArc(startX: number, count: number, arcHeight = 105): void {
    for (let index = 0; index < count; index++) {
      const progress = count === 1 ? 0 : index / (count - 1);
      const pick = index === Math.floor(count / 2) && Phaser.Math.FloatBetween(0, 1) < 0.25
        ? MONEY_TYPES[Phaser.Math.Between(3, 4)]
        : MONEY_TYPES[Phaser.Math.Between(0, 2)];
      const arc = Math.sin(progress * Math.PI);
      // Relax only the elevated arc's shoulders/apex; keep its endpoint lane intact.
      const y = this.groundY - ELEVATED_MONEY_Y_OFFSET - arc * arcHeight + 16 * arc * arc + 10;
      this.pushMoney(pick, startX + index * MONEY_PATTERN_GAP, y);
    }
  }

  private updateWorld(dt: number, worldStep: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.x -= worldStep;

      if (this.magnetTimer > 0 && item.type.startsWith('coin')) {
        const deltaX = this.player.x - item.x;
        const deltaY = (this.player.y - 64) - item.y;
        const dist = Math.hypot(deltaX, deltaY);
        if (dist < MAGNET_RADIUS && dist > 0.5) {
          const step = Math.min(dist, MAGNET_PULL_SPEED * dt);
          item.x += (deltaX / dist) * step;
          item.y += (deltaY / dist) * step;
        }
      }

      if (item.type === 'bird') {
        item.y = this.groundY - BIRD_CENTER_Y_OFFSET + Math.sin(this.distance / 80) * 6;
      }

      if (item.x < -90) {
        this.items.splice(i, 1);
      }
    }
  }

  private playerRect(): BodyRect {
    const height = this.player.sliding ? SLIDE_H : STAND_H;
    const width = this.player.sliding ? SLIDE_W : STAND_W;
    return {
      left: this.player.x - width / 2,
      top: this.player.y - height,
      right: this.player.x + width / 2,
      bottom: this.player.y,
    };
  }

  /** Boxes follow the drawn sprite, so a jump or slide matches what is on screen. */
  private itemRect(item: RunnerItem): BodyRect {
    const box = (cx: number, cy: number, w: number, h: number): BodyRect => ({
      left: cx - w / 2,
      top: cy - h / 2,
      right: cx + w / 2,
      bottom: cy + h / 2,
    });
    if (item.type.startsWith('coin')) {
      const { bounds } = getPositiveMoneyCoinCollision();
      const left = item.x - POSITIVE_COIN.size * POSITIVE_COIN.scale / 2;
      const top = item.y - POSITIVE_COIN.size * POSITIVE_COIN.scale / 2;
      return {
        left: left + bounds.left * POSITIVE_COIN.scale,
        top: top + bounds.top * POSITIVE_COIN.scale,
        right: left + bounds.right * POSITIVE_COIN.scale,
        bottom: top + bounds.bottom * POSITIVE_COIN.scale,
      };
    }
    if (isNegativeMoneyToken(item.type)) {
      const { bounds } = getNegativeMoneyTokenCollision(item.type);
      const left = item.x - NEGATIVE_TOKEN_SIZE * NEGATIVE_TOKEN_SCALE / 2;
      const top = item.y - NEGATIVE_TOKEN_SIZE * NEGATIVE_TOKEN_SCALE / 2;
      return {
        left: left + bounds.left * NEGATIVE_TOKEN_SCALE,
        top: top + bounds.top * NEGATIVE_TOKEN_SCALE,
        right: left + bounds.right * NEGATIVE_TOKEN_SCALE,
        bottom: top + bounds.bottom * NEGATIVE_TOKEN_SCALE,
      };
    }
    if (item.type === 'bird') {
      const bounds = getRoboticBirdBounds();
      const left = item.x - item.w / 2;
      const top = item.y - item.h / 2;
      return {
        left: left + bounds.left * ROBOTIC_BIRD.scale,
        top: top + bounds.top * ROBOTIC_BIRD.scale,
        right: left + bounds.right * ROBOTIC_BIRD.scale,
        bottom: top + bounds.bottom * ROBOTIC_BIRD.scale,
      };
    }
    if (item.type === 'cone') {
      // Scale the existing inset body around the ground line with the artwork.
      const sizeRatio = OBSTACLE_VISUALS.cone.displayWidth / 48;
      return box(item.x, this.groundY - 24 * sizeRatio, item.w * 0.9 * sizeRatio, item.h * 0.92 * sizeRatio);
    }
    if (item.type === 'crate' || item.type === 'barrier' || item.type === 'tallBarrier') {
      const visual = OBSTACLE_VISUALS[item.type];
      const scale = visual.displayWidth / visual.width;
      const bounds = visual.visibleBounds;
      return {
        left: item.x + (bounds.left - visual.width / 2) * scale,
        top: this.groundY - (bounds.bottom - bounds.top) * scale,
        right: item.x + (bounds.right - visual.width / 2) * scale,
        bottom: this.groundY,
      };
    }
    if (item.type === 'overhead') {
      return box(item.x, this.hangingSignY(), HANGING_SIGN.width * HANGING_SIGN.scale, HANGING_SIGN.height * HANGING_SIGN.scale);
    }
    if (item.type === 'life') {
      // Opaque heart bounds in the 128px texture at uniform 0.5 scale.
      return { left: item.x - 23.5, top: item.y - 20, right: item.x + 25.5, bottom: item.y + 20 };
    }
    if (item.type === 'power' && item.effect === 'multiplier') {
      // Opaque artwork bounds in the 128px texture, displayed at uniform 0.5 scale.
      return { left: item.x - 23.5, top: item.y - 28.5, right: item.x + 28, bottom: item.y + 28 };
    }
    if (item.type === 'power' && item.effect === 'boost') {
      // Opaque artwork bounds in the 128px texture, displayed at uniform 0.5 scale.
      return { left: item.x - 26.5, top: item.y - 26, right: item.x + 27.5, bottom: item.y + 26 };
    }
    if (item.type === 'power' && item.effect === 'shield') {
      // Opaque artwork bounds in the 128px texture, displayed at uniform 0.5 scale.
      return { left: item.x - 25, top: item.y - 28.5, right: item.x + 29, bottom: item.y + 27.5 };
    }
    if (item.type === 'power' && item.effect === 'x2') {
      // Opaque artwork bounds in the 128px texture, displayed at uniform 0.5 scale.
      return { left: item.x - 27.5, top: item.y - 26, right: item.x + 29, bottom: item.y + 25.5 };
    }
    if (item.type === 'power' && item.effect === 'magnet') {
      // Opaque artwork bounds in the 128px texture, displayed at uniform 0.5 scale.
      return { left: item.x - 26, top: item.y - 20, right: item.x + 25.5, bottom: item.y + 19 };
    }
    if (item.type === 'power') return box(item.x, item.y, 34, 34);
    return { left: item.x, top: item.y, right: item.x + item.w, bottom: item.y + item.h };
  }

  private rectsOverlap(a: BodyRect, b: BodyRect): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  private hangingSignY(): number {
    return this.groundY - HANGING_SIGN_CLEARANCE_HEIGHT - HANGING_SIGN.slideMargin
      + (HANGING_SIGN.height / 2 - HANGING_SIGN.visibleBottom) * HANGING_SIGN.scale;
  }

  private itemOverlapsPlayer(item: RunnerItem, player: BodyRect): boolean {
    if (!this.rectsOverlap(player, this.itemRect(item))) return false;
    if (item.type.startsWith('coin')) {
      const left = item.x - POSITIVE_COIN.size * POSITIVE_COIN.scale / 2;
      const top = item.y - POSITIVE_COIN.size * POSITIVE_COIN.scale / 2;
      return getPositiveMoneyCoinCollision().strips.some(rect => this.rectsOverlap(player, {
        left: left + rect.left * POSITIVE_COIN.scale,
        top: top + rect.top * POSITIVE_COIN.scale,
        right: left + rect.right * POSITIVE_COIN.scale,
        bottom: top + rect.bottom * POSITIVE_COIN.scale,
      }));
    }
    if (isNegativeMoneyToken(item.type)) {
      const left = item.x - NEGATIVE_TOKEN_SIZE * NEGATIVE_TOKEN_SCALE / 2;
      const top = item.y - NEGATIVE_TOKEN_SIZE * NEGATIVE_TOKEN_SCALE / 2;
      return getNegativeMoneyTokenCollision(item.type).strips.some(rect => this.rectsOverlap(player, {
        left: left + rect.left * NEGATIVE_TOKEN_SCALE,
        top: top + rect.top * NEGATIVE_TOKEN_SCALE,
        right: left + rect.right * NEGATIVE_TOKEN_SCALE,
        bottom: top + rect.bottom * NEGATIVE_TOKEN_SCALE,
      }));
    }
    if (item.type === 'bird') {
      const left = item.x - item.w / 2;
      const top = item.y - item.h / 2;
      return getRoboticBirdCollision().some(rect => this.rectsOverlap(player, {
        left: left + rect.left * ROBOTIC_BIRD.scale,
        top: top + rect.top * ROBOTIC_BIRD.scale,
        right: left + rect.right * ROBOTIC_BIRD.scale,
        bottom: top + rect.bottom * ROBOTIC_BIRD.scale,
      }));
    }
    if (item.type !== 'overhead') return true;
    const left = item.x - HANGING_SIGN.width * HANGING_SIGN.scale / 2;
    const top = this.hangingSignY() - HANGING_SIGN.height * HANGING_SIGN.scale / 2;
    return getHangingSignCollision().some((rect) => this.rectsOverlap(player, {
      left: left + rect.left * HANGING_SIGN.scale,
      top: top + rect.top * HANGING_SIGN.scale,
      right: left + rect.right * HANGING_SIGN.scale,
      bottom: top + rect.bottom * HANGING_SIGN.scale,
    }));
  }

  private handleCollisions(): void {
    if (this.dead || this.finalGateActivated) return;
    const player = this.playerRect();

    for (const item of this.items) {
      if (!item.active || !this.itemOverlapsPlayer(item, player)) continue;

      if (item.type === 'life') {
        if (this.lives < MAX_LIVES) {
          this.lives = Math.min(MAX_LIVES, this.lives + 1);
          this.updateLifeDisplay();
          this.flashStatus('+1 LIFE', '#ff8baf');
        }
        item.active = false;
        continue;
      }

      if (item.type.startsWith('coin')) {
        const cashRushActivated = this.advanceCashStreak();
        const cashMultiplier = (this.x2Timer > 0 ? 2 : 1) * (this.cashRushTimer > 0 ? 2 : 1);
        const scoreMultiplier = this.multiplierTimer > 0 ? SCORE_MULTIPLIER : 1;
        const payout = Math.round(item.value * cashMultiplier);
        this.money += payout;
        if (this.prototypeProfile && !cashRushActivated) this.game.events.emit('portrait-audio-cue', 'coin');
        this.score += 120 * scoreMultiplier;
        if (!cashRushActivated) this.flashStatus(`+$${payout.toLocaleString()}`, '#a9ffb4');
        if (this.cashRushTimer > 0) this.showCashRushCollection(item.x, item.y);
        item.active = false;
        continue;
      }

      if (item.type === 'power') {
        this.applyPower(item.effect!);
        this.flashStatus(this.effectLabel(item.effect!), '#d9fbff');
        item.active = false;
        continue;
      }

      if (isNegativeMoneyToken(item.type)) {
        if (this.prototypeProfile) this.game.events.emit('portrait-audio-cue', 'negative');
        const penalty = Math.abs(item.value);
        this.money = Math.max(0, this.money - penalty);
        this.cashStreak = 0;
        this.score = Math.max(0, this.score - 90);
        this.player.flash = 1;
        this.player.pose = 'hit';
        this.hitFeedbackTimer = HIT_FEEDBACK_SECONDS;
        item.active = false;
        this.flashStatus(`-$${penalty.toLocaleString()}`, '#ffb0b0');
        this.cameras.main.shake(90, 0.002);
        continue;
      }

      this.hitObstacle(item);
    }

    this.avoided = Math.floor(this.distance / 140);
  }

  private hitObstacle(item: RunnerItem): void {
    if (this.invulnerabilityTimer > 0) {
      item.active = false;
      return;
    }

    this.cashStreak = 0;

    if (this.player.shield > 0 && this.shieldTimer > 0) {
      this.player.shield = 0;
      this.shieldTimer = 0;
      this.invulnerabilityTimer = HIT_INVULNERABILITY_SECONDS;
      item.active = false;
      this.flashStatus('BLOCKED', '#d9fbff');
      if (this.prototypeProfile) this.game.events.emit('portrait-audio-cue', 'shield');
      return;
    }

    const penalty = item.type.startsWith('bad') ? Math.abs(item.value)
      : item.type === 'bird' ? 50
        : item.type === 'barrier' || item.type === 'tallBarrier' || item.type === 'overhead' ? 35
          : 30;
    this.money = Math.max(0, this.money - penalty);
    this.score = Math.max(0, this.score - 90);
    this.player.flash = 1;
    this.player.pose = 'hit';
    this.hitFeedbackTimer = HIT_FEEDBACK_SECONDS;
    this.invulnerabilityTimer = HIT_INVULNERABILITY_SECONDS;
    this.lives = Math.max(0, this.lives - 1);
    if (this.prototypeProfile) this.game.events.emit('portrait-audio-cue', 'damage');
    item.active = false;
    this.flashStatus(`-$${penalty.toLocaleString()}`, '#ffb0b0');
    this.cameras.main.shake(90, 0.002);
    this.updateLifeDisplay();
    if (this.lives === 0) this.triggerGameOver();
  }

  private advanceCashStreak(): boolean {
    this.cashStreak = Math.min(CASH_STREAK_REQUIRED, this.cashStreak + 1);
    if (this.cashRushTimer > 0) return false;
    if (this.cashStreak < CASH_STREAK_REQUIRED) return false;
    this.cashRushTimer = CASH_RUSH_SECONDS;
    this.cashRushes += 1;
    this.showCashRushActivated();
    if (this.prototypeProfile) this.game.events.emit('portrait-audio-cue', 'rush');
    return true;
  }

  private showCashRushActivated(): void {
    this.cashRushVisuals.activate(this.runElapsed);
    this.updateCashRushActiveIndicator();
    this.tweens.killTweensOf([
      this.cashRushBanner,
      this.cashRushBannerDetail,
      this.cashRushEdgeGlow,
      this.cashRushHudGlow,
    ]);
    this.statusText.setVisible(false);
    this.cashRushBanner
      .setText('CASH RUSH!')
      .setColor('#ffe36f')
      .setAlpha(1)
      .setVisible(true);
    this.cashRushBannerDetail
      .setText(`x2 CASH  |  ${CASH_RUSH_SECONDS.toFixed(1)}s`)
      .setAlpha(1)
      .setVisible(true);
    this.cashRushHudGlow.setVisible(true).setAlpha(1);
    this.tweens.add({
      targets: [this.cashRushBanner, this.cashRushBannerDetail],
      alpha: 0,
      delay: 450,
      duration: 180,
      onComplete: () => {
        this.cashRushBanner.setVisible(false);
        this.cashRushBannerDetail.setVisible(false);
      },
    });
  }

  private showCashRushEnded(): void {
    this.tweens.killTweensOf([
      this.cashRushBanner,
      this.cashRushBannerDetail,
      this.cashRushEdgeGlow,
      this.cashRushHudGlow,
    ]);
    this.cashRushVisuals.reset();
    this.cashRushBanner.setVisible(false).setAlpha(0);
    this.cashRushBannerDetail.setVisible(false).setAlpha(0);
    this.cashRushHudGlow.setVisible(false).setAlpha(0);
  }

  private updateCashRushActiveIndicator(): void {
    const active = this.cashRushTimer > 0 && this.running && !this.dead && !this.finalGateActivated;
    this.cashRushVisuals.update(this.runElapsed, active ? this.cashRushTimer : 0);
    this.cashStreakText.setVisible(!active);
    this.cashStreakMeter.setVisible(!active);
    this.cashRushIcon.setVisible(active);
    this.cashRushText
      .setText(`CASH RUSH\nx2 CASH  ${this.cashRushTimer.toFixed(1)}s`)
      .setVisible(active);
    const pulse = this.cashRushVisuals.getPresentation().activationPulse;
    this.cashRushHudGlow.setVisible(active).setAlpha(active ? 0.82 + 0.08 * Math.sin(this.runElapsed * 4) + pulse * 0.1 : 0);
  }

  private showCashRushCollection(x: number, y: number): void {
    this.cashRushVisuals.collect(x, y, this.runElapsed);
  }

  private applyPower(effect: PowerKind): void {
    if (this.prototypeProfile) this.game.events.emit('portrait-audio-cue', 'power');
    switch (effect) {
      case 'shield':
        this.player.shield = 1;
        this.shieldTimer = 5.5;
        break;
      case 'boost':
        this.boostTimer = 5;
        break;
      case 'x2':
        this.x2Timer = 6;
        break;
      case 'magnet':
        this.magnetTimer = 7;
        break;
      case 'multiplier':
        this.multiplierTimer = 8;
        break;
    }
  }

  private effectLabel(effect: PowerKind): string {
    const labels: Record<PowerKind, string> = {
      shield: 'SHIELD',
      boost: 'BOOST',
      x2: '2X CASH',
      magnet: 'MONEY MAGNET',
      multiplier: 'MULTIPLIER',
    };
    return labels[effect];
  }

  private flashStatus(text: string, color: string): void {
    this.statusText.setText(text);
    this.statusText.setColor(color);
    this.statusText.setVisible(true);
    this.statusTimer = 0.9;
  }

  private renderBackground(): void {
    const { width, height } = this.scale;
    if (!this.finalGateActivated) this.renderPedestrians(width);
    const gamdomCityActive = this.runElapsed >= CASINO_DISTRICT_START
      && this.runElapsed < NEON_BOULEVARD_START
      && !this.finalGateActivated;
    const foundationActive = this.runElapsed >= 0
      && this.runElapsed < CASINO_DISTRICT_START
      && !this.finalGateActivated;
    const neonActive = this.runElapsed >= NEON_BOULEVARD_START
      && this.runElapsed < HQ_APPROACH_START
      && !this.finalGateActivated;
    const hqActive = this.runElapsed >= HQ_APPROACH_START
      && this.runElapsed <= RUN_DURATION_SECONDS;
    this.cityBackground.setVisible(!gamdomCityActive && !foundationActive && !neonActive && !hqActive);
    this.cityBackgroundNext.setVisible(!gamdomCityActive && !foundationActive && !neonActive && !hqActive);
    if (this.finalGateActivated) {
      this.cityBackground.setPosition(width / 2 - width * 0.34, height / 2 + height * 0.053);
    } else {
      const parallax = (this.cityBackground.getData('parallax') as number) ?? 0.22;
      const tileWidth = width * 1.35;
      const scrollX = (this.distance * parallax) % tileWidth;
      const backgroundX = width / 2 - scrollX;
      this.cityBackground.setX(backgroundX);
      this.cityBackgroundNext.setX(backgroundX + tileWidth);
    }
    const cityBackdropAlpha = gamdomCityActive ? 0.92 : 0.72;
    this.cityBackground.setAlpha(this.finalGateActivated ? 1 : cityBackdropAlpha);
    this.cityBackgroundNext.setAlpha(this.finalGateActivated ? 1 : cityBackdropAlpha);
    this.renderGamdomCityEnvironment(width, height);
    this.renderCityFoundation(foundationActive);
    this.renderCityArchitecture(foundationActive);
    this.renderCityStorefronts(foundationActive);
    this.renderCityStreetDetails(foundationActive);
    this.renderNeonFoundation(neonActive);
    this.renderNeonArchitecture(neonActive);
    this.renderNeonSecondary(neonActive);
    this.renderNeonLandmark(neonActive);
    this.renderNeonRoad(neonActive);
    this.renderHqFoundation(hqActive);
    this.renderHqCampusArchitecture(hqActive);
    const hqFinalEntranceActive = this.runElapsed >= 88 && this.runElapsed <= RUN_DURATION_SECONDS;
    this.hqFinalEntrance.setVisible(hqFinalEntranceActive);
    if (hqFinalEntranceActive) {
      const revealProgress = Phaser.Math.Clamp((this.runElapsed - 88) / 2, 0, 1);
      const revealOffset = Phaser.Math.Linear(-300, 0, revealProgress);
      // This scheduled reveal must not overshoot when gameplay speed or Cash Rush changes distance.
      this.hqFinalEntrance.setX(27075 - this.getHqEntrancePresentationDistance() * 0.50 + revealOffset);
    }
    this.background.clear();
    if (gamdomCityActive) return;
    if (foundationActive) {
      this.background.fillStyle(0x081310, 1);
      this.background.fillRect(0, this.groundY, width, height - this.groundY);
      return;
    }
    this.background.fillStyle(0x02080a, 0.2);
    this.background.fillRect(0, 0, width, this.groundY);
    if (neonActive) return;
    this.background.fillStyle(0x081310, 0.72);
    this.background.fillRect(0, this.groundY, width, height - this.groundY);
    this.background.fillStyle(0x15352b, 0.88);
    this.background.fillRect(0, this.groundY, width, 5);
    this.background.lineStyle(3, 0x27f0a0, 0.9);
    this.background.lineBetween(0, this.groundY, width, this.groundY);
    this.background.lineStyle(2, 0xf1cb55, 0.72);
    this.background.lineBetween(0, this.groundY + 6, width, this.groundY + 6);
    this.background.fillStyle(0x0c1c18, 0.76);
    this.background.fillRect(0, this.groundY + 10, width, height - this.groundY - 10);

    const panelOffset = (this.distance * 0.8) % 156;
    for (let i = -1; i < 9; i++) {
      const x = i * 156 - panelOffset;
      this.background.lineStyle(1, 0x3b6a53, 0.48);
      this.background.lineBetween(x, this.groundY + 14, x, height);
      this.background.fillStyle(0x1e4d37, 0.52);
      this.background.fillRoundedRect(x + 14, this.groundY + 20, 38, 4, 2);
      this.background.fillStyle(0xc7a34e, 0.72);
      this.background.fillRect(x + 110, this.groundY + 28, 22, 3);
    }
    this.background.lineStyle(1, 0x6d8d79, 0.52);
    this.background.lineBetween(0, this.groundY + 16, width, this.groundY + 16);
    this.background.lineStyle(2, 0x1d342b, 0.9);
    this.background.lineBetween(0, height - 9, width, height - 9);

    const dashOffset = (this.distance * 1.6) % 146;
    for (let i = -1; i < 9; i++) {
      const x = i * 146 - dashOffset;
      this.background.fillStyle(0x9bb7a7, 0.5);
      this.background.fillTriangle(x, this.groundY + 50, x + 46, this.groundY + 50, x + 39, this.groundY + 57);
      this.background.fillTriangle(x, this.groundY + 50, x + 39, this.groundY + 57, x - 7, this.groundY + 57);
      this.background.fillStyle(0x19d987, 0.52);
      this.background.fillRect(x + 10, this.groundY + 14, 28, 3);
    }
    for (let i = 0; i < 13; i++) {
      const x = ((i * 83 - this.distance * 2.2) % (width + 90)) - 45;
      this.background.fillStyle(i % 3 === 0 ? 0x20e99c : 0x243d37, 0.86);
      this.background.fillRoundedRect(x, this.groundY + 13, 42, 6, 2);
    }
  }

  private renderPedestrians(width: number): void {
    // Match the street-lamp parallax; the small positive offset is the NPC's walking pace.
    const cycleWidth = 2400;
    const halfWidth = this.pedestrian01.displayWidth / 2;
    const offset = 1200 - this.distance * 0.66 + this.runElapsed * 18;
    const x = ((offset + halfWidth) % cycleWidth + cycleWidth) % cycleWidth - halfWidth;
    const slot = -Math.floor((offset + halfWidth) / cycleWidth);
    const variant = (this.pedestrianFirstVariant + slot) % 12;
    if (slot !== this.pedestrian04Slot) {
      this.pedestrian04Slot = slot;
      // Retain the existing slots, but anchor this spectator to the sidewalk.
      this.pedestrian04WalkOffset = this.runElapsed * 18;
    }
    const cheerX = 1200 - this.distance * 0.66 + slot * cycleWidth + this.pedestrian04WalkOffset;
    const visible = !this.finalGateActivated && x >= -halfWidth && x <= width + halfWidth;
    const walkFrames02 = [1, 2, 3, 5, 6, 7];
    this.pedestrian01
      .setPosition(x, this.groundY - 26)
      .setFrame(6 + Math.floor(this.runElapsed * 6) % 4)
      .setVisible(visible && variant === 0);
    this.pedestrian02
      .setPosition(x, this.groundY - 26)
      .setFrame(walkFrames02[Math.floor(this.runElapsed * 6) % walkFrames02.length])
      .setVisible(visible && variant === 1);
    this.pedestrian03
      .setPosition(x, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(visible && variant === 2);
    this.pedestrian04
      .setPosition(cheerX, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(!this.finalGateActivated && variant === 3 && cheerX >= -halfWidth && cheerX <= width + halfWidth);
    this.pedestrian05
      .setPosition(cheerX, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(!this.finalGateActivated && variant === 4 && cheerX >= -halfWidth && cheerX <= width + halfWidth);
    this.pedestrian06
      .setPosition(x, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(visible && variant === 5);
    this.pedestrian07
      .setPosition(cheerX, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(!this.finalGateActivated && variant === 6 && cheerX >= -halfWidth && cheerX <= width + halfWidth);
    this.pedestrian08
      .setPosition(cheerX, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(!this.finalGateActivated && variant === 7 && cheerX >= -halfWidth && cheerX <= width + halfWidth);
    this.pedestrian09
      .setPosition(cheerX, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(!this.finalGateActivated && variant === 8 && cheerX >= -halfWidth && cheerX <= width + halfWidth);
    this.pedestrian10
      .setPosition(cheerX, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(!this.finalGateActivated && variant === 9 && cheerX >= -halfWidth && cheerX <= width + halfWidth);
    this.pedestrian11
      .setPosition(cheerX, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(!this.finalGateActivated && variant === 10 && cheerX >= -halfWidth && cheerX <= width + halfWidth);
    this.pedestrian12
      .setPosition(x, this.groundY - 26)
      .setFrame(Math.floor(this.runElapsed * 6) % 8)
      .setVisible(visible && variant === 11);
  }

  private renderHqFoundation(active: boolean): void {
    this.hqSky.setVisible(active);
    this.hqLayers.forEach(({ images, maskImages, tileWidth, parallax }) => {
      const offset = this.distance * parallax;
      const firstTile = Math.floor(offset / tileWidth);
      const remainder = offset % tileWidth;
      images.forEach((image, index) => {
        image.setVisible(active);
        if (active) image.setX((index - 1) * tileWidth - remainder + image.displayWidth / 2)
          .setFlipX((firstTile + index - 1) % 2 !== 0);
        maskImages[index].setX(image.x).setFlipX(image.flipX);
      });
    });
    this.hqMainBuilding.setVisible(active);
    if (active) this.hqMainBuilding.setX(10400 - this.distance * 0.24);
    this.hqMainMask.setX(this.hqMainBuilding.x);
  }

  private renderHqCampusArchitecture(active: boolean): void {
    this.hqCampusArchitecture.forEach(({ image, baseX, baseline, parallax }) => {
      image.setVisible(active);
      if (active) image.setPosition(baseX - this.distance * parallax, baseline);
    });
  }

  private createHqSilhouetteMask(texture: string, top: number, baseline: number, left: number, right: number): string {
    return createHqSilhouetteMask(this.textures, texture, top, baseline, left, right);
  }

  private renderNeonLandmark(active: boolean): void {
    this.neonLandmark.setVisible(active);
    if (active) this.neonLandmark.setX(17300 - this.distance * 0.52);
  }

  private renderNeonRoad(active: boolean): void {
    const tileWidth = this.neonRoadTiles[0].displayWidth;
    const offset = this.distance % tileWidth;
    this.neonRoadTiles.forEach((image, index) => {
      image.setVisible(active);
      if (active) image.setX((index - 1) * tileWidth - offset);
    });
  }

  private renderNeonSecondary(active: boolean): void {
    this.neonSecondary.forEach(({ image, baseX, parallax }) => {
      image.setVisible(active);
      if (active) image.setX(baseX - this.distance * parallax);
    });
  }

  private renderNeonArchitecture(active: boolean): void {
    this.neonArchitecture.forEach(({ image, baseX, parallax }) => {
      image.setVisible(active);
      if (active) image.setX(baseX - this.distance * parallax);
    });
  }

  private renderNeonFoundation(active: boolean): void {
    this.neonSky.setVisible(active);
    this.neonLayers.forEach(({ images, tileWidth, parallax }) => {
      const offset = this.distance * parallax;
      const firstTile = Math.floor(offset / tileWidth);
      const remainder = offset % tileWidth;
      images.forEach((image, index) => {
        image.setVisible(active);
        if (active) image.setX((index - 1) * tileWidth - remainder + image.displayWidth / 2)
          .setFlipX((firstTile + index - 1) % 2 !== 0);
      });
    });
  }

  private renderCityFoundation(active: boolean): void {
    this.foundationSky.setVisible(active);
    this.foundationLayers.forEach(({ images, tileWidth, parallax }) => {
      const offset = this.distance * parallax;
      const firstTile = Math.floor(offset / tileWidth);
      const remainder = offset % tileWidth;
      images.forEach((image, index) => {
        image.setVisible(active);
        if (active) image.setX((index - 1) * tileWidth - remainder + tileWidth / 2)
          .setFlipX((firstTile + index - 1) % 2 !== 0);
      });
    });
    const roadTileStep = 960;
    const roadOffset = this.distance % roadTileStep;
    this.foundationRoadTiles.forEach((tile, index) => {
      tile.setVisible(active);
      if (active) tile.setX((index - 1) * roadTileStep - roadOffset);
    });
  }

  private renderCityArchitecture(active: boolean): void {
    // A fixed, non-looping sequence lets each landmark pass the viewport without recycling in this district.
    this.foundationBuildings.forEach(({ image, baseX, parallax }) => {
      image.setVisible(active);
      if (active) image.setX(baseX - this.distance * parallax);
    });
  }

  private renderCityStorefronts(active: boolean): void {
    this.foundationStorefronts.forEach(({ image, baseX, parallax }) => {
      image.setVisible(active);
      if (active) image.setX(baseX - this.distance * parallax);
    });
  }

  private renderCityStreetDetails(active: boolean): void {
    this.foundationStreetDetails.forEach(({ image, baseX, parallax }) => {
      image.setVisible(active);
      if (active) image.setX(baseX - this.distance * parallax);
    });
  }

  private renderGamdomCityEnvironment(width: number, height: number): void {
    const active = this.runElapsed >= CASINO_DISTRICT_START
      && this.runElapsed < NEON_BOULEVARD_START
      && !this.finalGateActivated;
    this.cityAtmosphere.setVisible(active);
    this.cityFarLayer.setVisible(false).clear();
    this.cityMidLayer.setVisible(false).clear();
    this.cityStreetLayer.setVisible(false).clear();
    const illustratedLayers = [
      ...this.cityDistantSkyline.map((entry) => entry.image),
      ...this.citySupportBuildings.map((entry) => entry.image),
      ...this.citySkyscrapers,
      ...this.cityCasinos,
      ...this.cityStreetBuildings.map((entry) => entry.image),
      ...this.cityBillboards,
      ...this.cityLamps,
      ...this.cityRoadTiles,
    ];
    illustratedLayers.forEach((image) => image.setVisible(active));
    if (!active) return;

    this.cityAtmosphere.clear();
    this.cityAtmosphere.fillStyle(0x010605, 1);
    this.cityAtmosphere.fillRect(0, 0, width, height);
    this.cityAtmosphere.fillStyle(0x073526, 0.24);
    this.cityAtmosphere.fillRect(0, 88, width, this.groundY - 88);
    this.cityAtmosphere.fillStyle(0x0b6b47, 0.08);
    this.cityAtmosphere.fillCircle(width * 0.55, this.groundY * 0.7, width * 0.48);

    const placeLooped = (
      images: Phaser.GameObjects.Image[],
      anchors: number[],
      cycleWidth: number,
      parallax: number,
    ): void => {
      images.forEach((image, index) => {
        let x = anchors[index] - this.distance * parallax;
        while (x < -image.displayWidth * 0.5) x += cycleWidth;
        while (x > width + image.displayWidth * 0.5) x -= cycleWidth;
        image.setX(x);
      });
    };

    const placeConfigured = (entries: GamdomCitySpriteConfig[]): void => {
      entries.forEach(({ image, baseX, cycleWidth, parallax }) => {
        let x = baseX - this.distance * parallax;
        while (x < -image.displayWidth * 0.5) x += cycleWidth;
        while (x > width + image.displayWidth * 0.5) x -= cycleWidth;
        image.setX(x);
      });
    };

    placeConfigured(this.cityDistantSkyline);
    placeConfigured(this.citySupportBuildings);
    placeLooped(this.citySkyscrapers, [960, 3220], 4520, 0.28);
    placeLooped(this.cityCasinos, [520, 2590], 4140, 0.32);
    placeConfigured(this.cityStreetBuildings);
    placeLooped(this.cityBillboards, [1540, 3860, 6180], 6960, 0.52);
    placeLooped(this.cityLamps, [110, 560, 1030, 1510, 2000], 2350, 0.66);

    const roadTileStep = 654;
    const roadOffset = this.distance % roadTileStep;
    this.cityRoadTiles.forEach((tile, index) => {
      tile.setX((index - 2) * roadTileStep - roadOffset);
    });
  }

  private drawGamdomCityBuilding(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    ground: number,
    design: CityBuildingDesign,
    index: number,
  ): void {
    const top = ground - design.height;
    const inset = design.roof === 'glass' ? 15 : 0;
    graphics.fillStyle(index % 2 === 0 ? 0x03100d : 0x051510, 0.88);
    graphics.fillRoundedRect(x + inset, top, design.width - inset * 2, design.height, design.roof === 'atrium' ? 20 : 6);

    graphics.fillStyle(0x071e17, 0.96);
    if (design.roof === 'crown') {
      graphics.fillTriangle(x + 12, top + 3, x + design.width - 12, top + 3, x + design.width * 0.5, top - 38);
      graphics.fillRect(x + 32, top - 12, design.width - 64, 18);
    } else if (design.roof === 'spire' || design.roof === 'antenna') {
      graphics.fillTriangle(x + inset, top + 2, x + design.width - inset, top + 2, x + design.width * 0.5, top - 30);
      graphics.lineStyle(design.roof === 'antenna' ? 3 : 2, design.accent, 0.56);
      graphics.lineBetween(x + design.width * 0.5, top - 27, x + design.width * 0.5, top - 62);
    } else if (design.roof === 'steps') {
      graphics.fillRect(x + 18, top - 18, design.width - 36, 20);
      graphics.fillRect(x + 40, top - 34, design.width - 80, 18);
    } else if (design.roof === 'twin') {
      graphics.fillTriangle(x + 10, top + 4, x + design.width * 0.46, top + 4, x + design.width * 0.25, top - 42);
      graphics.fillTriangle(x + design.width * 0.54, top + 4, x + design.width - 10, top + 4, x + design.width * 0.75, top - 42);
    } else if (design.roof === 'glass') {
      graphics.fillTriangle(x + 15, top + 2, x + design.width - 15, top + 2, x + design.width - 15, top - 42);
    } else if (design.roof === 'marquee') {
      graphics.fillRoundedRect(x - 8, top - 18, design.width + 16, 28, 8);
    } else if (design.roof === 'atrium') {
      graphics.lineStyle(9, 0x09251b, 1);
      graphics.strokeCircle(x + design.width * 0.5, top + 22, design.width * 0.34);
    }

    graphics.lineStyle(2, design.accent, 0.46);
    graphics.lineBetween(x + inset + 5, top + 10, x + inset + 5, ground);
    graphics.lineBetween(x + design.width - inset - 5, top + 10, x + design.width - inset - 5, ground);
    graphics.fillStyle(design.accent, 0.14);
    graphics.fillRect(x + design.width * 0.5 - 3, top + 14, 6, design.height - 26);

    const windowColumns = Math.max(3, Math.floor((design.width - 34) / 24));
    const windowRows = Math.max(3, Math.floor((design.height - 100) / 28));
    for (let row = 0; row < windowRows; row += 1) {
      for (let column = 0; column < windowColumns; column += 1) {
        if ((row * 2 + column + index) % 4 === 0) continue;
        const windowX = x + 20 + column * ((design.width - 40) / windowColumns);
        const windowY = top + 64 + row * 27;
        graphics.fillStyle((row + column + index) % 7 === 0 ? 0xe0be55 : design.accent, 0.38);
        graphics.fillRoundedRect(windowX, windowY, 7, 11, 1);
      }
    }

    if (design.sign !== 'none') this.drawBuildingSign(graphics, x + design.width * 0.5, top + 36, design.width - 34, design.sign, design.accent);

    const entranceWidth = design.roof === 'atrium' ? 86 : 58;
    const entranceX = x + (design.width - entranceWidth) * 0.5;
    graphics.fillStyle(0x020a08, 1);
    graphics.fillRoundedRect(entranceX, ground - 58, entranceWidth, 58, 8);
    graphics.lineStyle(3, design.accent, 0.72);
    graphics.strokeRoundedRect(entranceX, ground - 58, entranceWidth, 58, 8);
    graphics.fillStyle(design.accent, 0.18);
    graphics.fillRect(entranceX + 9, ground - 48, entranceWidth - 18, 48);
    graphics.fillStyle(0xe1bd55, 0.55);
    graphics.fillRect(entranceX + 8, ground - 6, entranceWidth - 16, 3);
  }

  private drawBuildingSign(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    width: number,
    type: CityBuildingDesign['sign'],
    accent: number,
  ): void {
    const signWidth = Math.min(116, width);
    graphics.fillStyle(0x020907, 0.96);
    graphics.fillRoundedRect(centerX - signWidth * 0.5, centerY - 15, signWidth, 30, 5);
    graphics.lineStyle(2, accent, 0.72);
    graphics.strokeRoundedRect(centerX - signWidth * 0.5, centerY - 15, signWidth, 30, 5);
    if (type === 'gamdom') {
      graphics.fillStyle(0x55ffc0, 0.84);
      graphics.fillTriangle(centerX - 19, centerY - 7, centerX - 6, centerY, centerX - 19, centerY + 7);
      graphics.fillTriangle(centerX + 19, centerY - 7, centerX + 6, centerY, centerX + 19, centerY + 7);
      graphics.fillRect(centerX - 7, centerY - 3, 14, 7);
    } else if (type === 'slots') {
      for (let reel = -1; reel <= 1; reel += 1) {
        graphics.fillStyle(0xf4e6b0, 0.82);
        graphics.fillRoundedRect(centerX + reel * 22 - 8, centerY - 9, 16, 18, 3);
        graphics.fillStyle(0xd85e42, 0.9);
        graphics.fillRect(centerX + reel * 22 - 3, centerY - 5, 6, 10);
      }
    } else if (type === 'jackpot') {
      graphics.fillStyle(0xe0bd52, 0.9);
      graphics.fillTriangle(centerX - 30, centerY + 7, centerX + 30, centerY + 7, centerX, centerY - 9);
      graphics.fillStyle(0x4cffb7, 0.78);
      graphics.fillRect(centerX - 22, centerY + 2, 44, 3);
    } else if (type === 'cards') {
      graphics.lineStyle(2, 0xe9f7ef, 0.78);
      graphics.strokeRoundedRect(centerX - 18, centerY - 10, 17, 22, 2);
      graphics.strokeRoundedRect(centerX + 2, centerY - 12, 17, 22, 2);
      graphics.fillStyle(0x4cffb7, 0.8);
      graphics.fillCircle(centerX + 10, centerY - 1, 3);
    }
  }

  private drawStreetLamp(graphics: Phaser.GameObjects.Graphics, x: number): void {
    graphics.fillStyle(0xffd86c, 0.09);
    graphics.fillCircle(x, this.groundY - 105, 34);
    graphics.fillStyle(0x4dffc0, 0.05);
    graphics.fillCircle(x, this.groundY - 105, 48);
    graphics.lineStyle(6, 0x030b09, 1);
    graphics.lineBetween(x, this.groundY - 99, x, this.groundY);
    graphics.lineStyle(2, 0x26a879, 0.62);
    graphics.lineBetween(x - 3, this.groundY - 98, x - 3, this.groundY - 3);
    graphics.fillStyle(0xffdd75, 0.9);
    graphics.fillCircle(x, this.groundY - 105, 6);
  }

  private drawCasinoAdBoard(graphics: Phaser.GameObjects.Graphics, x: number, accent: number, brandMark: boolean): void {
    const y = this.groundY - 82;
    graphics.fillStyle(0x020a08, 0.96);
    graphics.fillRoundedRect(x, y, 88, 58, 5);
    graphics.lineStyle(3, accent, 0.68);
    graphics.strokeRoundedRect(x, y, 88, 58, 5);
    graphics.fillStyle(accent, 0.12);
    graphics.fillRect(x + 8, y + 8, 72, 42);
    if (brandMark) {
      graphics.fillStyle(0x50ffc0, 0.8);
      graphics.fillTriangle(x + 24, y + 20, x + 38, y + 29, x + 24, y + 38);
      graphics.fillTriangle(x + 64, y + 20, x + 50, y + 29, x + 64, y + 38);
      graphics.fillRect(x + 37, y + 26, 14, 7);
    } else {
      graphics.fillStyle(0xe4c157, 0.82);
      graphics.fillCircle(x + 44, y + 29, 16);
      graphics.fillStyle(0x07110e, 1);
      graphics.fillCircle(x + 44, y + 29, 10);
      graphics.lineStyle(3, 0xe4c157, 0.9);
      graphics.lineBetween(x + 36, y + 29, x + 52, y + 29);
    }
  }

  private drawNpcGroup(graphics: Phaser.GameObjects.Graphics, x: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      const personX = x + index * 22;
      const height = 35 + (index % 2) * 7;
      graphics.fillStyle(0x020806, 0.9);
      graphics.fillCircle(personX, this.groundY - height - 7, 6);
      graphics.fillRoundedRect(personX - 5, this.groundY - height, 10, height - 9, 4);
      graphics.lineStyle(3, 0x020806, 0.9);
      graphics.lineBetween(personX - 2, this.groundY - 11, personX - 7, this.groundY);
      graphics.lineBetween(personX + 2, this.groundY - 11, personX + 7, this.groundY);
      graphics.fillStyle(index === 1 ? 0xd2ad48 : 0x239d70, 0.52);
      graphics.fillRect(personX - 4, this.groundY - height + 6, 8, 4);
    }
  }

  private drawVehicleSilhouette(graphics: Phaser.GameObjects.Graphics, x: number): void {
    const y = this.groundY - 31;
    graphics.fillStyle(0x020806, 0.96);
    graphics.fillRoundedRect(x, y, 142, 25, 9);
    graphics.fillTriangle(x + 27, y, x + 112, y, x + 86, y - 23);
    graphics.fillTriangle(x + 27, y, x + 86, y - 23, x + 53, y - 23);
    graphics.fillStyle(0x0c4636, 0.7);
    graphics.fillTriangle(x + 45, y - 3, x + 73, y - 19, x + 82, y - 3);
    graphics.fillTriangle(x + 87, y - 19, x + 104, y - 3, x + 87, y - 3);
    graphics.lineStyle(2, 0x32d99d, 0.5);
    graphics.lineBetween(x + 9, y + 13, x + 132, y + 13);
    graphics.fillStyle(0xe4c157, 0.66);
    graphics.fillRect(x + 130, y + 6, 9, 5);
    graphics.fillStyle(0x020605, 1);
    graphics.fillCircle(x + 34, this.groundY - 5, 11);
    graphics.fillCircle(x + 111, this.groundY - 5, 11);
  }

  private renderGamby(pose: CharacterPose): void {
    if (this.gambyVisualPose !== pose) {
      this.gambyVisualPose = pose;
      this.gambyVisualPoseStartedAt = this.time.now;
    }
    const poseElapsed = Math.max(0, (this.time.now - this.gambyVisualPoseStartedAt) / 1000);
    let frame: string;
    switch (pose) {
      case 'run': frame = `run_${Math.floor(this.distance / RUN_FRAME_DISTANCE) % 4}`; break;
      case 'idle': frame = `idle_${Math.floor(poseElapsed / 0.8) % 2}`; break;
      case 'jump': frame = `jump_${poseElapsed >= 0.12 ? 1 : 0}`; break;
      case 'doubleJump': frame = `double_jump_${poseElapsed >= 0.12 ? 1 : 0}`; break;
      case 'fall': frame = `fall_${poseElapsed >= 0.12 ? 1 : 0}`; break;
      case 'slide': frame = `slide_${Math.floor(poseElapsed / 0.12) % 2}`; break;
      case 'hit': frame = `hit_${this.hitFeedbackTimer > HIT_FEEDBACK_SECONDS / 2 ? 0 : 1}`; break;
      case 'win': frame = 'win_0'; break;
    }
    // The body baseline is 12 pixels above the atlas canvas bottom; physics stays untouched.
    if (!this.prototypeProfile || this.playerSprite.frame.name !== frame) this.playerSprite.setFrame(frame);
    this.playerSprite.setPosition(this.player.x, this.player.y + GAMBY_BASELINE_PADDING * GAMBY_VISUAL_SCALE)
      .setScale(GAMBY_VISUAL_SCALE).setRotation(0).setAlpha(1).setVisible(true);
  }

  private renderSteve(pose: CharacterPose): void {
    if (this.steveVisualPose !== pose) {
      this.steveVisualPose = pose;
      this.steveVisualPoseStartedAt = this.time.now;
    }
    const poseElapsed = Math.max(0, (this.time.now - this.steveVisualPoseStartedAt) / 1000);
    let frame: string;
    switch (pose) {
      case 'idle': frame = `idle_${Math.floor(poseElapsed / 0.8) % 2}`; break;
      case 'run': frame = 'run_0'; break;
      case 'jump': frame = 'jump_0'; break;
      case 'doubleJump': frame = 'double_jump_0'; break;
      case 'fall': frame = `fall_${poseElapsed >= 0.12 ? 1 : 0}`; break;
      case 'slide': frame = `slide_${Math.floor(poseElapsed / 0.12) % 2}`; break;
      case 'hit': frame = `hit_${this.hitFeedbackTimer > HIT_FEEDBACK_SECONDS / 2 ? 0 : 1}`; break;
      case 'win': frame = 'win_0'; break;
    }
    // Only compensate atlas padding; real low slide artwork uses the same uniform scale.
    if (!this.prototypeProfile || this.playerSprite.frame.name !== frame) this.playerSprite.setFrame(frame);
    this.playerSprite.setPosition(this.player.x, this.player.y + STEVE_BASELINE_PADDING * STEVE_VISUAL_SCALE)
      .setScale(STEVE_VISUAL_SCALE).setRotation(0).setAlpha(1).setVisible(true);
  }

  private renderYungreal(pose: CharacterPose): void {
    if (this.yungrealVisualPose !== pose) {
      this.yungrealVisualPose = pose;
      this.yungrealVisualPoseStartedAt = this.time.now;
    }
    const poseElapsed = Math.max(0, (this.time.now - this.yungrealVisualPoseStartedAt) / 1000);
    let frame: string;
    switch (pose) {
      case 'idle': frame = `idle_${Math.floor(poseElapsed / 0.8) % 2}`; break;
      case 'run': frame = `run_${Math.floor(this.distance / RUN_FRAME_DISTANCE) % 3}`; break;
      case 'jump': frame = 'jump_0'; break;
      case 'doubleJump': frame = `double_jump_${poseElapsed >= 0.12 ? 1 : 0}`; break;
      case 'fall': frame = 'fall_0'; break;
      case 'slide': frame = `slide_${Math.floor(poseElapsed / 0.12) % 2}`; break;
      case 'hit': frame = `hit_${this.hitFeedbackTimer > HIT_FEEDBACK_SECONDS / 2 ? 0 : 1}`; break;
      case 'win': frame = 'win_0'; break;
    }
    // Preprocessing owns body normalization; every pose uses one runtime scale.
    if (!this.prototypeProfile || this.playerSprite.frame.name !== frame) this.playerSprite.setFrame(frame);
    this.playerSprite.setPosition(this.player.x, this.player.y + YUNGREAL_BASELINE_PADDING * YUNGREAL_VISUAL_SCALE)
      .setScale(YUNGREAL_VISUAL_SCALE).setRotation(0).setAlpha(1).setVisible(true);
  }

  private renderPlayer(): void {
    this.playerGraphics.clear();
    const { x, y, sliding, pose } = this.player;
    if (this.selectedCharacter === 0) {
      this.renderGamby(pose);
    } else if (this.selectedCharacter === 1) {
      this.renderSteve(pose);
    } else if (this.selectedCharacter === 2) {
      this.renderYungreal(pose);
    } else {
      const frames: Record<CharacterPose, number> = { idle: 0, run: 0, jump: 4, doubleJump: 6, fall: 4, slide: 0, hit: 2, win: 6 };
      const runFrame = pose === 'run' ? (Math.floor(this.distance / RUN_FRAME_DISTANCE) % 2 === 0 ? 0 : 2) : frames[pose];
      const characterDisplay = CHARACTER_CONFIG.characters[this.selectedCharacter];
      const scaleY = sliding
        ? characterDisplay.visualScale * CHARACTER_CONFIG.slideScaleRatio
        : characterDisplay.visualScale;
      const visibleGroundOffset = characterDisplay.frameBottomPadding[runFrame] * scaleY;
      this.playerSprite
        .setFrame(runFrame)
        .setPosition(x, y + visibleGroundOffset)
        .setScale(characterDisplay.visualScale, scaleY)
        .setRotation(pose === 'hit' ? -0.2 : pose === 'jump' || pose === 'doubleJump' ? -0.06 : 0)
        .setAlpha(1)
        .setVisible(true);
    }
    if (this.hitFeedbackTimer > 0) this.playerSprite.setTint(0xffa0a0);
    else this.playerSprite.clearTint();

    this.playerGraphics.fillStyle(0x020a08, 0.55);
    this.playerGraphics.fillEllipse(x, this.groundY + 7, 48, 10);

    if (this.player.shield > 0 && this.shieldTimer > 0) {
      this.playerGraphics.lineStyle(3, 0x6ea8ff, 0.8);
      this.playerGraphics.strokeCircle(x, y - 34, 42);
    }
    if (this.boostTimer > 0) {
      this.playerGraphics.lineStyle(2, 0x7ef3d1, 0.9);
      this.playerGraphics.strokeEllipse(x, y - 24, 72, 34);
    }
    if (this.cashRushTimer > 0) {
      const glowAlpha = 0.48 + Math.sin(this.runElapsed * 8) * 0.12;
      this.playerGraphics.lineStyle(2, 0xffd95a, glowAlpha);
      this.playerGraphics.strokeEllipse(x, y - 48, 88, 116);
    }
  }

  private renderItems(): void {
    this.foreground.clear();
    for (const item of this.itemSprites.keys()) {
      if (!item.active || item.x < -90) this.releaseItem(item);
    }
    for (const item of this.powerLabels.keys()) {
      if (!item.active || item.x < -90) this.releasePowerLabel(item);
    }

    for (const item of this.items) {
      if (!item.active) continue;

      if (item.type.startsWith('coin')) {
        const cashRushGold = this.cashRushTimer > 0;
        this.foreground.fillStyle(cashRushGold ? 0xffd95a : 0x72ffb0, cashRushGold ? 0.2 : 0.16);
        this.foreground.fillCircle(item.x, item.y, 34);
        this.foreground.lineStyle(2, cashRushGold ? 0xffef9b : 0xb9ffd1, cashRushGold ? 0.9 : 0.72);
        this.foreground.strokeCircle(item.x, item.y, 29);
      } else if (item.type === 'cone' || item.type === 'crate') {
        const centerY = item.type === 'cone' ? item.y + 18 : item.y + 16;
        this.foreground.fillStyle(0x050807, 0.58);
        this.foreground.fillEllipse(item.x, this.groundY + 3, item.type === 'cone' ? 52 : 64, 12);
        this.foreground.lineStyle(2, item.type === 'cone' ? 0xffc35c : 0xffdf78, 0.76);
        this.foreground.strokeRoundedRect(item.x - 31, centerY - 28, 62, 56, 5);
      } else if (item.type === 'tallBarrier') {
        this.foreground.fillStyle(0x050807, 0.58);
        this.foreground.fillEllipse(item.x, this.groundY + 4, 86, 14);
      } else if (item.type === 'overhead') {
        // Decorative suspension reaches off-screen; only the PNG has solid collision strips.
        const railBottom = this.hangingSignY() + (90 - HANGING_SIGN.height / 2) * HANGING_SIGN.scale;
        for (const sourceX of HANGING_SIGN.railCenters) {
          const railX = item.x + (sourceX - HANGING_SIGN.width / 2) * HANGING_SIGN.scale;
          this.foreground.fillStyle(0x080d10, 1);
          this.foreground.fillRect(railX - 3, -16, 6, railBottom + 16);
          this.foreground.fillStyle(0x47504e, 1);
          this.foreground.fillRect(railX - 3, -16, 1, railBottom + 16);
          this.foreground.fillStyle(0x242c2b, 1);
          this.foreground.fillRect(railX + 1, -16, 1, railBottom + 16);
        }
      }

      const obstacleVisual = item.type === 'cone' || item.type === 'crate' || item.type === 'barrier' || item.type === 'tallBarrier'
        ? OBSTACLE_VISUALS[item.type] : undefined;
      const directVisual = item.type === 'cone' || item.type === 'crate' || item.type === 'barrier' || item.type === 'tallBarrier' ? OBSTACLE_VISUALS[item.type] : undefined;
      const texture = directVisual ? directVisual.source
        : obstacleVisual ? `${obstacleVisual.source}-filtered`
        : item.type === 'life' ? 'life-pickup-game'
        : item.type === 'power' && item.effect === 'multiplier' ? 'multiplier-game'
        : item.type === 'power' && item.effect === 'boost' ? 'boost-game'
        : item.type === 'power' && item.effect === 'shield' ? 'shield-game'
        : item.type === 'power' && item.effect === 'x2' ? '2x-cash-game'
        : item.type === 'power' && item.effect === 'magnet' ? 'money-magnet-game'
        : item.type.startsWith('coin') ? POSITIVE_COIN.texture
        : isNegativeMoneyToken(item.type) ? NEGATIVE_TOKEN_TEXTURES[item.type]
          : item.type === 'bird' ? ROBOTIC_BIRD.texture
            : item.type === 'overhead' ? HANGING_SIGN.texture : undefined;
      if (texture) {
        const textureFrame = item.type === 'tallBarrier' || (obstacleVisual && !directVisual) ? 'gameplay' : undefined;
        let sprite = this.itemSprites.get(item);
        if (!sprite) {
          sprite = this.itemSpritePool.pop() ?? this.add.image(item.x, item.y, texture, textureFrame).setDepth(11);
          sprite.setTexture(texture, textureFrame).clearTint().setAlpha(1).setActive(true).setVisible(true);
          this.itemSprites.set(item, sprite);
        }
        const imageY = item.type === 'overhead' ? this.hangingSignY() : directVisual
          ? this.groundY + (directVisual.height / 2 - directVisual.visibleBounds.bottom)
            * (directVisual.displayWidth / directVisual.width)
          : obstacleVisual
            ? this.groundY - obstacleVisual.displayWidth * obstacleVisual.height / obstacleVisual.width / 2
          : item.y;
        const scale = item.type === 'life' ? 0.5
          : item.type === 'power' && item.effect === 'multiplier' ? 0.5
          : item.type === 'power' && item.effect === 'boost' ? 0.5
          : item.type === 'power' && item.effect === 'shield' ? 0.5
          : item.type === 'power' && item.effect === 'x2' ? 0.5
          : item.type === 'power' && item.effect === 'magnet' ? 0.5
          : item.type.startsWith('coin') ? POSITIVE_COIN.scale
          : isNegativeMoneyToken(item.type) ? NEGATIVE_TOKEN_SCALE
            : item.type === 'bird' ? ROBOTIC_BIRD_VISUAL_SCALE
              : 0.66;
        const depth = item.type.startsWith('coin') ? 11 : item.type === 'power' || item.type === 'life' ? 12 : 13;
        const imageScale = item.type === 'overhead' ? HANGING_SIGN.scale
          : directVisual ? directVisual.displayWidth / directVisual.width
          : obstacleVisual ? 1 / OBSTACLE_TEXTURE_SCALE : scale;
        sprite.setPosition(item.x, imageY).setScale(imageScale);
        // Phaser queues a display-list sort even when setDepth receives the current value.
        if (!this.prototypeProfile || sprite.depth !== depth) sprite.setDepth(depth);
        if (item.type === 'overhead') sprite.setCrop(0, HANGING_SIGN.cropTop, HANGING_SIGN.width, HANGING_SIGN.height - HANGING_SIGN.cropTop);
        else sprite.setCrop();
        if (item.type.startsWith('coin') && this.cashRushTimer > 0) sprite.setTint(0xffe08a);
        else sprite.clearTint();
        if (item.type === 'bird') this.renderBirdCue(item);
        if (item.type === 'power') this.renderPowerLabel(item);
        if (item.type.startsWith('coin') || item.type.startsWith('bad')) {
          const positive = item.type.startsWith('coin');
          const labelText = item.label ?? `${positive ? '+' : '-'}$${Math.abs(item.value)}`;
          let label = this.itemLabels.get(item);
          if (!label) {
            label = this.itemLabelPool.pop();
            if (label) {
              label.setActive(true).setVisible(true);
            } else {
              label = this.add.text(item.x, item.y, labelText, {
                fontFamily: 'Arial Black, Arial, sans-serif',
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#04110d',
                strokeThickness: 4,
              }).setOrigin(0.5).setDepth(12);
            }
            this.itemLabels.set(item, label);
          }
          this.updateItemLabelVisual(label, labelText, positive, this.cashRushTimer > 0);
          label.setPosition(item.x, item.y - 38);
        }
      } else if (item.type === 'power') {
        const glow = item.effect === 'shield' ? 0x6ea8ff : item.effect === 'boost' ? 0x2ff3d0 : item.effect === 'x2' ? 0xff7ad9 : item.effect === 'magnet' ? 0xf5d56d : 0x7dfa8d;
        this.foreground.fillStyle(glow, 0.24);
        this.foreground.fillCircle(item.x, item.y, 30);
        this.foreground.lineStyle(2, 0xffffff, 0.8);
        this.foreground.strokeCircle(item.x, item.y, 23);
        this.foreground.fillStyle(0x112a24, 1);
        this.foreground.fillTriangle(item.x, item.y - 19, item.x + 19, item.y, item.x, item.y + 19);
        this.foreground.fillTriangle(item.x, item.y - 19, item.x, item.y + 19, item.x - 19, item.y);
        this.foreground.lineStyle(3, glow, 1);
        this.foreground.lineBetween(item.x, item.y - 19, item.x + 19, item.y);
        this.foreground.lineBetween(item.x + 19, item.y, item.x, item.y + 19);
        this.foreground.lineBetween(item.x, item.y + 19, item.x - 19, item.y);
        this.foreground.lineBetween(item.x - 19, item.y, item.x, item.y - 19);
        this.foreground.fillStyle(glow, 1);
        this.foreground.fillCircle(item.x, item.y, 6);
        this.renderPowerLabel(item);
      }
    }
  }

  private releaseItem(item: RunnerItem): void {
    const sprite = this.itemSprites.get(item);
    if (sprite) {
      sprite.setVisible(false).setActive(false);
      this.itemSpritePool.push(sprite);
      this.itemSprites.delete(item);
    }

    const label = this.itemLabels.get(item);
    if (label) {
      label.setVisible(false).setActive(false);
      this.itemLabelPool.push(label);
      this.itemLabels.delete(item);
    }

    const birdCue = this.birdCues.get(item);
    if (birdCue) {
      birdCue.setVisible(false).setActive(false);
      this.birdCuePool.push(birdCue);
      this.birdCues.delete(item);
    }
  }

  private updateItemLabelVisual(
    label: Phaser.GameObjects.Text,
    text: string,
    positive: boolean,
    cashRushGold: boolean,
  ): void {
    const color = positive ? (cashRushGold ? '#fff0a8' : '#c6ffd8') : '#ff8b91';
    const stroke = positive ? (cashRushGold ? '#5b3b05' : '#063d25') : '#4a0810';
    const strokeThickness = 4;
    const fontSize = 12;
    const previous = this.itemLabelVisualStates.get(label);
    if (this.prototypeProfile && previous?.text === text && previous.color === color
      && previous.stroke === stroke && previous.strokeThickness === strokeThickness && previous.fontSize === fontSize) return;
    if (previous?.text !== text) label.setText(text);
    if (previous?.color !== color) label.setColor(color);
    if (previous?.stroke !== stroke || previous?.strokeThickness !== strokeThickness) label.setStroke(stroke, strokeThickness);
    if (previous?.fontSize !== fontSize) label.setFontSize(fontSize);
    this.itemLabelVisualStates.set(label, { text, color, stroke, strokeThickness, fontSize });
  }

  private renderBirdCue(item: RunnerItem): void {
    const showCue = item.x <= this.player.x + 520 && item.x > this.player.x - item.w / 2;
    let cue = this.birdCues.get(item);
    if (!showCue) {
      cue?.setVisible(false);
      return;
    }

    if (!cue) {
      cue = this.birdCuePool.pop() ?? this.add.text(item.x, item.y - item.h / 2 - 14, 'SLIDE ↓', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '10px',
        color: '#b8ffdf',
        backgroundColor: '#061310',
        stroke: '#020807',
        strokeThickness: 2,
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(13);
      this.birdCues.set(item, cue);
    }

    cue.setPosition(item.x, item.y - item.h / 2 - 14).setActive(true).setVisible(true);
  }

  private renderPowerLabel(item: RunnerItem): void {
    let label = this.powerLabels.get(item);
    if (!label) {
      label = this.powerLabelPool.pop() ?? this.add.text(item.x, item.y - 34, '', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '9px',
        color: '#effff8',
        backgroundColor: '#061310',
        stroke: '#020807',
        strokeThickness: 2,
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(12);
      this.powerLabels.set(item, label);
    }

    const text = this.effectLabel(item.effect!);
    if (this.powerLabelTexts.get(label) !== text) {
      label.setText(text);
      this.powerLabelTexts.set(label, text);
    }
    label
      .setPosition(item.x, item.y - 36)
      .setActive(true)
      .setVisible(true);
  }

  private releasePowerLabel(item: RunnerItem): void {
    const label = this.powerLabels.get(item);
    if (!label) return;
    label.setVisible(false).setActive(false);
    this.powerLabelPool.push(label);
    this.powerLabels.delete(item);
  }

  private updateHud(): void {
    const moneyText = this.hud[1];
    const timeText = this.hud[3];
    const scoreText = this.hud[5];
    moneyText.setText(`$ ${Math.max(0, this.money).toLocaleString()}`);
    const elapsedSeconds = Math.min(RUN_DURATION_SECONDS, Math.floor(this.runElapsed));
    const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
    timeText.setText(`${minutes}:${seconds} / 01:30`);
    scoreText.setText(`${Math.floor(this.score).toLocaleString()}`);
    this.updateLifeDisplay();
    const streakProgress = this.cashStreak / CASH_STREAK_REQUIRED;
    const cashRushActive = this.cashRushTimer > 0;
    this.cashStreakText
      .setText(`CASH STREAK  ${this.cashStreak} / ${CASH_STREAK_REQUIRED}`)
      .setVisible(!cashRushActive);
    this.cashStreakMeter.clear();
    this.cashStreakMeter.fillStyle(0x102d25, 1);
    this.cashStreakMeter.fillRoundedRect(this.cashStreakBarX, this.cashStreakBarY, this.cashStreakBarWidth, 6, 3);
    if (streakProgress > 0) {
      this.cashStreakMeter.fillStyle(this.cashRushTimer > 0 ? 0xffd95a : 0x31ef9f, 1);
      this.cashStreakMeter.fillRoundedRect(this.cashStreakBarX, this.cashStreakBarY, this.cashStreakBarWidth * streakProgress, 6, 3);
    }
    this.updateCashRushActiveIndicator();
    if (cashRushActive && this.cashRushBanner.visible && this.cashRushBanner.text === 'CASH RUSH!') {
      this.cashRushBannerDetail.setText(`x2 CASH  |  ${this.cashRushTimer.toFixed(1)}s`);
    }

    let activeEffects = '';
    if (this.shieldTimer > 0) activeEffects = 'SHIELD';
    if (this.boostTimer > 0) activeEffects += `${activeEffects ? ' / ' : ''}BOOST`;
    if (this.x2Timer > 0) activeEffects += `${activeEffects ? ' / ' : ''}2X CASH`;
    if (this.multiplierTimer > 0) activeEffects += `${activeEffects ? ' / ' : ''}SCORE X${SCORE_MULTIPLIER}`;
    if (this.magnetTimer > 0) activeEffects += `${activeEffects ? ' / ' : ''}MAGNET`;
    if (activeEffects) {
      this.powerText.setText(`POWER: ${activeEffects}`);
      this.powerText.setColor('#d5fff5');
      this.powerText.setVisible(true);
    } else {
      this.powerText.setVisible(false);
    }
  }

  private updateLifeDisplay(): void {
    this.lifeHearts.clear();
    for (let index = 0; index < this.lives; index += 1) {
      const x = this.lifeHeartStartX + index * 14;
      this.lifeHearts.fillStyle(0xff6f7d, 1);
      this.lifeHearts.fillCircle(x - 2.8, this.lifeHeartY - 1.4, 3.5);
      this.lifeHearts.fillCircle(x + 2.8, this.lifeHeartY - 1.4, 3.5);
      this.lifeHearts.fillTriangle(x - 6.3, this.lifeHeartY, x + 6.3, this.lifeHeartY, x, this.lifeHeartY + 7.7);
    }
  }

  private triggerGameOver(): void {
    if (this.dead) return;
    this.dead = true;
    this.cashRushVisuals.reset();
    this.running = false;
    this.paused = false;
    this.clearControlInput();
    this.completionTimer?.remove(false);
    this.completionTimer = this.time.delayedCall(500, () => {
      this.completionTimer = undefined;
      // BEGIN PORTRAIT PROTOTYPE
      if (this.prototypeProfile) {
        this.endPrototype('game-over');
        return;
      }
      // END PORTRAIT PROTOTYPE
      this.scene.start('Result', {
        gameOver: true,
        money: this.money,
        distance: this.distance,
        avoided: this.avoided,
        character: this.selectedCharacter,
        timeSurvived: this.runElapsed,
        cashRushes: this.cashRushes,
      });
    });
  }

  // BEGIN PORTRAIT PROTOTYPE
  public getDistrictTransitionPresentation(): Readonly<DistrictTransitionPresentation> {
    return this.districtTransition.getPresentation();
  }

  public getCashRushPresentation(): Readonly<CashRushPresentation> {
    return this.cashRushVisuals.getPresentation();
  }

  public getPrototypeSnapshot(): PrototypeSnapshot | undefined {
    if (!this.prototypeProfile || !this.player) return undefined;
    return {
      character: this.selectedCharacter, elapsed: this.runElapsed, distance: this.distance,
      speed: this.speed, money: this.money, lives: this.lives, streak: this.cashStreak,
      cashRush: this.cashRushTimer, paused: this.paused, ended: this.prototypeEnded,
      status: this.statusText?.visible ? this.statusText.text : '',
      powers: [
        { name: this.effectLabel('shield'), seconds: this.shieldTimer },
        { name: this.effectLabel('boost'), seconds: this.boostTimer },
        { name: this.effectLabel('x2'), seconds: this.x2Timer },
        { name: this.effectLabel('magnet'), seconds: this.magnetTimer },
        { name: this.effectLabel('multiplier'), seconds: this.multiplierTimer },
      ].filter(power => power.seconds > 0),
    };
  }

  public setPrototypePaused(paused: boolean): void {
    if (this.prototypeProfile && !this.prototypeEnded && this.paused !== paused) this.togglePause();
  }

  public preparePrototypeCountdown(): void {
    if (!this.prototypeProfile) return;
    this.clearControlInput();
    this.renderBackground();
    this.renderPlayer();
    this.renderItems();
    this.input.enabled = false;
    if (this.input.keyboard) this.input.keyboard.enabled = false;
    this.sys.pause();
  }

  public finishPrototypeCountdown(startRun: boolean): void {
    if (!this.prototypeProfile) return;
    this.clearControlInput();
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    if (startRun) this.sys.resume();
  }

  public cancelPrototypeGesture(): void {
    if (this.prototypeProfile) {
      this.controlInput.clearPointers();
      if (!this.controlInput.slideHeld && this.player?.sliding) this.stopSlide();
    }
  }

  private endPrototype(reason: NonNullable<PrototypeSnapshot['ended']>): void {
    if (!this.prototypeProfile) return;
    this.prototypeEnded = reason;
    this.paused = true;
    this.clearControlInput();
    this.scene.pause();
  }
  // END PORTRAIT PROTOTYPE
  private completeRun(): void {
    if (!this.running || this.dead) return;
    this.running = false;
    // BEGIN PORTRAIT PROTOTYPE
    if (this.prototypeProfile) {
      this.endPrototype('run-complete');
      return;
    }
    // END PORTRAIT PROTOTYPE
    this.scene.start('Result', {
      money: this.money,
      distance: this.distance,
      avoided: this.avoided,
      character: this.selectedCharacter,
      gameOver: false,
      timeSurvived: this.runElapsed,
      cashRushes: this.cashRushes,
    });
  }
}
