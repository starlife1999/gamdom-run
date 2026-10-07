import Phaser from 'phaser';
import { createObstacleTextures } from '../obstacleTextures';
import { createHangingSignCollision } from '../hangingSign';
import { createRoboticBirdCollision } from '../roboticBird';
import { createNegativeMoneyTokenCollisions, NEGATIVE_TOKEN_TEXTURES } from '../negativeMoneyTokens';
import { createPositiveMoneyCoinCollision, POSITIVE_COIN } from '../positiveMoneyCoin';
import { prepareHqSilhouetteMasks } from '../hqSilhouetteMasks';
import { isPortraitPrototypeProfile, type PortraitPrototypeProfile } from '../../presentationProfiles';

export class BootScene extends Phaser.Scene {
  constructor(private readonly prototypeProfile?: PortraitPrototypeProfile) {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet('gamby', '/art/gamby.svg', { frameWidth: 80, frameHeight: 80 });
    this.load.atlas('gamby-playable',
      '/assets/characters/gamby/gamby-playable-atlas.png',
      '/assets/characters/gamby/gamby-playable-atlas.json');
    this.load.spritesheet('steve', '/art/steve.svg', { frameWidth: 80, frameHeight: 80 });
    this.load.atlas('steve-playable',
      '/assets/characters/steve/steve-playable-atlas.png',
      '/assets/characters/steve/steve-playable-atlas.json');
    this.load.spritesheet('yungreal', '/art/yungreal.svg', { frameWidth: 80, frameHeight: 80 });
    this.load.atlas('yungreal-playable',
      '/assets/characters/yungreal/yungreal-playable-atlas.png',
      '/assets/characters/yungreal/yungreal-playable-atlas.json');
    this.load.svg('casino-city', '/art/casino-city.svg', { width: 1200, height: 540 });
    this.load.image(POSITIVE_COIN.texture, '/assets/environment/gamdom-city/gamdom-coin-game.png');
    this.load.image('money-magnet-game', '/assets/environment/gamdom-city/money-magnet-game.png');
    this.load.image('2x-cash-game', '/assets/environment/gamdom-city/2x-cash-game.png');
    this.load.image('shield-game', '/assets/environment/gamdom-city/shield-game.png');
    this.load.image('boost-game', '/assets/environment/gamdom-city/boost-game.png');
    this.load.image('multiplier-game', '/assets/environment/gamdom-city/multiplier-game.png');
    this.load.image('life-pickup-game', '/assets/environment/gamdom-city/life-pickup-game.png');
    this.load.spritesheet('pedestrian-01-walk', '/assets/environment/gamdom-city/pedestrian-01-walk-game.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-02-walk', '/assets/environment/gamdom-city/pedestrian-02-walk-game.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-03-walk', '/assets/environment/gamdom-city/pedestrian-03-walk-game-FINAL-CLEAN.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-04-cheer', '/assets/environment/gamdom-city/pedestrian-04-cheer-game-FINAL-CLEAN.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-05-cheer', '/assets/environment/gamdom-city/pedestrian-05-cheer-game-clean.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-06-walk', '/assets/environment/gamdom-city/pedestrian-06-walk-game-clean.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-07-photo', '/assets/environment/gamdom-city/pedestrian-07-photo-game-clean.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-08-talk', '/assets/environment/gamdom-city/pedestrian-08-talk-game-FINAL.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-09-pair', '/assets/environment/gamdom-city/pedestrian-09-pair-game-FINAL-CLEAN.png', { frameWidth: 192, frameHeight: 160 });
    this.load.spritesheet('pedestrian-10-cheer', '/assets/environment/gamdom-city/pedestrian-10-cheer-game.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-11-drink', '/assets/environment/gamdom-city/pedestrian-11-drink-game.png', { frameWidth: 128, frameHeight: 160 });
    this.load.spritesheet('pedestrian-12-walk', '/assets/environment/gamdom-city/pedestrian-12-walk-game-CLEAN.png', { frameWidth: 128, frameHeight: 160 });
    this.load.svg('cash-crate', '/art/cash-crate.svg', { width: 80, height: 68 });
    this.load.image('robotic-bird-game', '/assets/environment/gamdom-city/robotic-bird-game.png');
    for (const texture of Object.values(NEGATIVE_TOKEN_TEXTURES)) {
      this.load.image(texture, `/assets/environment/gamdom-city/${texture}.png`);
    }
    this.load.svg('traffic-cone', '/art/traffic-cone.svg', { width: 56, height: 64 });
    this.load.image('traffic-cone-game', '/assets/obstacles/traffic-cone-game.png');
    this.load.image('small-crate-game-orange', '/assets/obstacles/small-crate-game-orange.png');
    this.load.image('ground-barrier-game', '/assets/obstacles/ground-barrier-game.png');
    this.load.image('stacked-containers-game-tight', '/assets/environment/gamdom-city/stacked-containers-game-tight.png');
    this.load.image('gamdom-hanging-sign-game', '/assets/environment/gamdom-city/gamdom-hanging-sign-game.png');
    this.load.image('gamdom-skyscraper', '/assets/environment/gamdom-city/gamdom-skyscraper.png');
    this.load.image('gamdom-casino', '/assets/environment/gamdom-city/gamdom-casino.png');
    this.load.image('gamdom-support-tower-a', '/assets/environment/gamdom-city/gamdom-support-tower-a.png');
    this.load.image('gamdom-support-tower-b', '/assets/environment/gamdom-city/gamdom-support-tower-b.png');
    this.load.image('gamdom-wide-building', '/assets/environment/gamdom-city/gamdom-wide-building.png');
    this.load.image('gamdom-commercial-facade', '/assets/environment/gamdom-city/gamdom-commercial-facade.png');
    this.load.image('gamdom-arcade-shop', '/assets/environment/gamdom-city/gamdom-arcade-shop.png');
    this.load.image('gamdom-distant-skyline', '/assets/environment/gamdom-city/gamdom-distant-skyline.png');
    this.load.image('gamdom-billboard', '/assets/environment/gamdom-city/gamdom-billboard.png');
    this.load.image('gamdom-street-lamp', '/assets/environment/gamdom-city/gamdom-street-lamp.png');
    this.load.image('gamdom-road', '/assets/environment/gamdom-city/gamdom-road.png');
    this.load.image('gamdom-city-new-road', '/assets/environment/gamdom-city-new/gamdom-city-road.png');
    for (const asset of ['corporate-tower', 'glass-office-tower', 'residential-tower', 'wide-office']) {
      this.load.image(`gamdom-city-new-${asset}`, `/assets/environment/gamdom-city-new/gamdom-city-${asset}.png`);
    }
    for (const asset of ['flagship-store', 'cafe', 'retail-block', 'office-lobby']) {
      this.load.image(`gamdom-city-new-${asset}`, `/assets/environment/gamdom-city-new/gamdom-city-${asset}.png`);
    }
    for (const asset of [
      'digital-billboard', 'vertical-ad-screen', 'street-banner', 'street-lamp',
      'tree-planter', 'bus-stop', 'bench', 'planter-wide', 'planter-small', 'bin', 'bollard', 'bike-rack',
    ]) {
      this.load.image(`gamdom-city-new-${asset}`, `/assets/environment/gamdom-city-new/gamdom-city-${asset}.png`);
    }
    for (const asset of ['sky', 'cloud-layer', 'distant-skyline', 'secondary-skyline', 'sidewalk-tile']) {
      this.load.image(`gamdom-city-new-${asset}`, `/assets/environment/gamdom-city-new/gamdom-city-${asset}.png`);
    }
    for (const asset of ['night-background', 'distant-skyline', 'mid-skyline', 'elevated-transit']) {
      this.load.image(`neon-boulevard-${asset}`, `/assets/environment/gamdom-city-new/neon-boulevard-${asset}.png`);
    }
    for (const asset of ['luxury-tower-a', 'luxury-tower-b', 'luxury-shops']) {
      this.load.image(`neon-boulevard-${asset}`, `/assets/environment/gamdom-city-new/neon-boulevard-${asset}.png`);
    }
    this.load.image('neon-boulevard-vip-lounge', '/assets/environment/gamdom-city-new/neon-boulevard-vip-lounge.png');
    this.load.image('neon-boulevard-road', '/assets/environment/gamdom-city-new/neon-boulevard-road.png');
    this.load.image('neon-boulevard-hotel', '/assets/environment/gamdom-city-new/stevewilldoit-hotel.png');
    for (const asset of ['approach-sky', 'distant-skyline', 'secondary-skyline', 'distant-main-building']) {
      this.load.image(`hq-foundation-${asset}`, `/assets/environment/gamdom-city-new/gamdom-hq-${asset}-game.png`);
    }
    this.load.image('hq-office-tower-a-neutral', '/assets/environment/gamdom-city-new/hq-office-tower-a-neutral-game.png');
    this.load.image('hq-office-tower-b-neutral', '/assets/environment/gamdom-city-new/hq-office-tower-b-neutral-game.png');
    this.load.image('hq-campus-building-purple', '/assets/environment/gamdom-city-new/hq-campus-building-purple-game-CLEAN.png');
    this.load.image('hq-security-entrance-purple', '/assets/environment/gamdom-city-new/hq-security-entrance-purple-game-CLEAN.png');
    this.load.image('hq-monumental-building-purple-clean', '/assets/environment/gamdom-city-new/hq-monumental-building-purple-game-CLEAN.png');
    this.load.image('hq-futuristic-street-lamp-purple', '/assets/environment/gamdom-city-new/hq-futuristic-street-lamp-purple-game.png');
    this.load.image('hq-landscaped-tree-planter-purple', '/assets/environment/gamdom-city-new/hq-landscaped-tree-planter-purple-game.png');
    this.load.image('hq-corporate-banner-purple', '/assets/environment/gamdom-city-new/hq-corporate-banner-purple-game.png');
    this.load.image('hq-fountain-monument-green', '/assets/environment/gamdom-city-new/hq-fountain-monument-green-game.png');
    this.load.image('hq-infrastructure-green', '/assets/environment/gamdom-city-new/hq-sidewalk-foreground-green-game.png');
    this.load.image('hq-final-entrance-green-clean', '/assets/environment/gamdom-city-new/hq-final-entrance-green-game-CLEAN.png');
  }

  create(): void {
    prepareHqSilhouetteMasks(this.textures);
    createObstacleTextures(this);
    createHangingSignCollision(this);
    createRoboticBirdCollision(this);
    createNegativeMoneyTokenCollisions(this);
    createPositiveMoneyCoinCollision(this);
    // BEGIN PORTRAIT PROTOTYPE
    if (isPortraitPrototypeProfile(this.prototypeProfile)) {
      this.game.events.emit('portrait-prototype-ready');
      return;
    }
    // END PORTRAIT PROTOTYPE
    this.scene.start('Menu');
  }
}
