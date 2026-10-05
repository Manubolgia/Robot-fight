// The parts catalogue. Every part is bought once and can then be fitted to
// any of your robots. Tiers unlock as the team climbs the circuit.
//
// Balance notes live with the numbers: each weapon family has a job and a
// counter, see docs in README ("Strategies").

import type { ArmorDef, BrainDef, ChassisDef, CoreDef, DriveDef, ModuleDef, PartDef, WeaponDef } from './types.ts';

// ---- frames ----------------------------------------------------------------

export const CHASSIS: ChassisDef[] = [
  {
    id: 'ch_scrapbox', kind: 'chassis', name: 'Scrap Box', tier: 1, price: 0, weight: 24,
    desc: 'A welded steel box. Honest, roomy, and it takes a punch. Has a top mount.',
    shape: 'box', hp: 300, length: 0.95, width: 0.76, height: 0.36,
    low: { front: 0.3, sides: 0.3, rear: 0.3 }, stability: 0.55, invertible: false,
    modules: 2, topMount: true, area: { front: 1.0, sides: 1.4, rear: 0.9, top: 1.5 },
  },
  {
    id: 'ch_ramprat', kind: 'chassis', name: 'Ramp Rat', tier: 1, price: 650, weight: 21,
    desc: 'A sloped wedge frame that slides under anything with a flat front. Top mount for a hammer.',
    shape: 'wedge', hp: 270, length: 1.05, width: 0.72, height: 0.32,
    low: { front: 0.68, sides: 0.3, rear: 0.25 }, stability: 0.6, invertible: false,
    modules: 2, topMount: true, area: { front: 1.25, sides: 1.1, rear: 0.8, top: 1.2 },
  },
  {
    id: 'ch_pancake', kind: 'chassis', name: 'Pancake', tier: 1, price: 800, weight: 19,
    desc: 'Flat, wide and invertible: flip it and it keeps driving. No room on top.',
    shape: 'low', hp: 250, length: 1.0, width: 0.86, height: 0.2,
    low: { front: 0.55, sides: 0.55, rear: 0.55 }, stability: 0.85, invertible: true,
    modules: 2, topMount: false, area: { front: 0.7, sides: 0.9, rear: 0.7, top: 2.0 },
  },
  {
    id: 'ch_bulldog', kind: 'chassis', name: 'Bulldog', tier: 2, price: 2200, weight: 22,
    desc: 'A stiffer box with an extra module bay. The all-rounder of the regional pits.',
    shape: 'box', hp: 390, length: 0.95, width: 0.8, height: 0.38,
    low: { front: 0.32, sides: 0.3, rear: 0.3 }, stability: 0.6, invertible: false,
    modules: 3, topMount: true, area: { front: 1.0, sides: 1.45, rear: 0.9, top: 1.55 },
  },
  {
    id: 'ch_doorstop', kind: 'chassis', name: 'Doorstop', tier: 2, price: 2500, weight: 18,
    desc: 'A double-sided wedge. Low at both ends and it drives upside down.',
    shape: 'wedge', hp: 330, length: 1.1, width: 0.75, height: 0.3,
    low: { front: 0.8, sides: 0.35, rear: 0.7 }, stability: 0.7, invertible: true,
    modules: 3, topMount: false, area: { front: 1.3, sides: 1.0, rear: 1.1, top: 1.2 },
  },
  {
    id: 'ch_turtle', kind: 'chassis', name: 'Turtle Dome', tier: 2, price: 2600, weight: 23,
    desc: 'A rounded shell: blows glance off it, and it rolls itself back over.',
    shape: 'dome', hp: 380, length: 0.95, width: 0.95, height: 0.42,
    low: { front: 0.42, sides: 0.42, rear: 0.42 }, stability: 0.65, invertible: false, rolls: true,
    deflect: 0.15, modules: 2, topMount: false, area: { front: 1.0, sides: 1.4, rear: 1.0, top: 1.3 },
  },
  {
    id: 'ch_tower', kind: 'chassis', name: 'Titan Tower', tier: 3, price: 6000, weight: 25,
    desc: 'A tall frame built around an overhead weapon: top weapons reach further. Top heavy.',
    shape: 'tall', hp: 470, length: 1.1, width: 0.8, height: 0.52,
    low: { front: 0.28, sides: 0.25, rear: 0.25 }, stability: 0.42, invertible: false,
    modules: 3, topMount: true, topReach: 0.18, area: { front: 1.2, sides: 1.6, rear: 1.0, top: 1.4 },
  },
  {
    id: 'ch_stingray', kind: 'chassis', name: 'Stingray', tier: 3, price: 6500, weight: 16,
    desc: 'A featherlight flat frame, invertible and hard to get under. Thin on hit points.',
    shape: 'low', hp: 370, length: 1.05, width: 0.9, height: 0.18,
    low: { front: 0.72, sides: 0.65, rear: 0.65 }, stability: 0.9, invertible: true,
    modules: 3, topMount: false, area: { front: 0.7, sides: 0.9, rear: 0.7, top: 2.0 },
  },
  {
    id: 'ch_bastion', kind: 'chassis', name: 'Bastion', tier: 3, price: 7200, weight: 29,
    desc: 'A heavy fortress of a box: huge hit points and four module bays.',
    shape: 'box', hp: 600, length: 1.0, width: 0.86, height: 0.42,
    low: { front: 0.32, sides: 0.3, rear: 0.3 }, stability: 0.72, invertible: false,
    modules: 4, topMount: true, area: { front: 1.05, sides: 1.5, rear: 0.95, top: 1.6 },
  },
  {
    id: 'ch_kraken', kind: 'chassis', name: 'Kraken Dome', tier: 4, price: 15000, weight: 19,
    desc: 'A titanium-ribbed dome. Deflects a fifth of every heavy blow and rolls back upright.',
    shape: 'dome', hp: 500, length: 0.98, width: 0.98, height: 0.42,
    low: { front: 0.5, sides: 0.5, rear: 0.5 }, stability: 0.72, invertible: false, rolls: true,
    deflect: 0.2, modules: 3, topMount: false, area: { front: 1.0, sides: 1.4, rear: 1.0, top: 1.3 },
  },
  {
    id: 'ch_vanguard', kind: 'chassis', name: 'Vanguard', tier: 4, price: 16500, weight: 15,
    desc: 'A razor-low invertible wedge with a top mount. The control driver\'s dream.',
    shape: 'wedge', hp: 450, length: 1.1, width: 0.76, height: 0.3,
    low: { front: 0.9, sides: 0.4, rear: 0.75 }, stability: 0.75, invertible: true,
    modules: 4, topMount: true, area: { front: 1.3, sides: 1.0, rear: 1.0, top: 1.2 },
  },
  {
    id: 'ch_monolith', kind: 'chassis', name: 'Monolith', tier: 4, price: 18000, weight: 23,
    desc: 'Aerospace box frame: Bastion toughness at Bulldog weight.',
    shape: 'box', hp: 640, length: 1.0, width: 0.86, height: 0.4,
    low: { front: 0.35, sides: 0.32, rear: 0.32 }, stability: 0.78, invertible: false,
    modules: 4, topMount: true, area: { front: 1.05, sides: 1.5, rear: 0.95, top: 1.6 },
  },
  {
    id: 'ch_apex', kind: 'chassis', name: 'Apex', tier: 5, price: 34000, weight: 12,
    desc: 'World-class flat frame. Barely there on the scales, low on every edge.',
    shape: 'low', hp: 520, length: 1.05, width: 0.92, height: 0.17,
    low: { front: 0.85, sides: 0.75, rear: 0.75 }, stability: 0.95, invertible: true,
    modules: 4, topMount: false, area: { front: 0.7, sides: 0.9, rear: 0.7, top: 2.0 },
  },
  {
    id: 'ch_colossus', kind: 'chassis', name: 'Colossus', tier: 5, price: 38000, weight: 20,
    desc: 'The tallest, toughest frame on the circuit. Top weapons reach a long way.',
    shape: 'tall', hp: 700, length: 1.1, width: 0.84, height: 0.54,
    low: { front: 0.3, sides: 0.28, rear: 0.28 }, stability: 0.55, invertible: false,
    modules: 4, topMount: true, topReach: 0.22, area: { front: 1.2, sides: 1.6, rear: 1.0, top: 1.4 },
  },
];

// ---- drives ----------------------------------------------------------------

export const DRIVES: DriveDef[] = [
  // Wheels: the speed line. Each tier about 8% faster and 12% stronger, a kilo
  // lighter, for about 20% more power.
  {
    id: 'dr_twin', kind: 'drive', name: 'Twin Wheels', tier: 1, price: 0, weight: 9,
    desc: 'Two wheels and a skid. Light and twitchy, not much push.',
    style: 'wheels2', power: 2.0, force: 650, speed: 4.2, grip: 0.85, turn: 6.0, lateral: 0.9, durability: 1.0,
  },
  {
    id: 'dr_quad', kind: 'drive', name: 'Quad Drive', tier: 1, price: 550, weight: 13,
    desc: 'Four driven wheels: better grip and pushing power.',
    style: 'wheels4', power: 2.8, force: 950, speed: 3.9, grip: 0.95, turn: 5.0, lateral: 1.0, durability: 1.15,
  },
  {
    id: 'dr_sport', kind: 'drive', name: 'Sport 4WD', tier: 2, price: 1900, weight: 12,
    desc: 'Four sport motors: quicker and stronger than the quad, and a little lighter.',
    style: 'wheels4', power: 3.35, force: 1065, speed: 4.2, grip: 0.97, turn: 5.4, lateral: 1.0, durability: 1.15,
  },
  {
    id: 'dr_brushless', kind: 'drive', name: 'Brushless 4WD', tier: 3, price: 5500, weight: 11,
    desc: 'Race-grade brushless motors: fast, light and nimble.',
    style: 'wheels4', power: 4.0, force: 1190, speed: 4.55, grip: 1.0, turn: 5.8, lateral: 1.0, durability: 1.15,
  },
  {
    id: 'dr_turbo', kind: 'drive', name: 'Turbo Wheels', tier: 4, price: 14000, weight: 10,
    desc: 'The fastest wheels on the circuit. Dances around anything slow.',
    style: 'wheels4', power: 4.8, force: 1335, speed: 4.9, grip: 1.0, turn: 6.2, lateral: 1.0, durability: 1.15,
  },
  {
    id: 'dr_hyper', kind: 'drive', name: 'Hyper Wheels', tier: 5, price: 31000, weight: 9,
    desc: 'Race-car hub motors in each wheel: the fastest drive money can buy.',
    style: 'wheels4', power: 5.8, force: 1495, speed: 5.3, grip: 1.02, turn: 6.6, lateral: 1.0, durability: 1.15,
  },

  // Tracks and six-wheelers: the push line. Grip and force first, speed after.
  {
    id: 'dr_treads', kind: 'drive', name: 'Tank Treads', tier: 2, price: 2000, weight: 18,
    desc: 'Rubber tracks. Slow to turn, but they grip like glue and shrug off hits.',
    style: 'treads', power: 3.2, force: 1500, speed: 3.1, grip: 1.25, turn: 3.4, lateral: 1.2, durability: 1.5,
  },
  {
    id: 'dr_six', kind: 'drive', name: 'Six-Wheel Bruiser', tier: 3, price: 6200, weight: 16.5,
    desc: 'Six fat wheels and torque to spare. Built for shoving.',
    style: 'wheels6', power: 3.85, force: 1700, speed: 3.35, grip: 1.28, turn: 3.7, lateral: 1.15, durability: 1.55,
  },
  {
    id: 'dr_crawler', kind: 'drive', name: 'Crawler Treads', tier: 4, price: 15500, weight: 15,
    desc: 'Industrial tracks: monstrous push, almost impossible to break.',
    style: 'treads', power: 4.6, force: 1950, speed: 3.6, grip: 1.33, turn: 3.9, lateral: 1.25, durability: 1.7,
  },
  {
    id: 'dr_titan', kind: 'drive', name: 'Titan Tracks', tier: 5, price: 34000, weight: 14,
    desc: 'Tracks with sports-car pace. Pushes walls over.',
    style: 'treads', power: 5.5, force: 2230, speed: 3.9, grip: 1.38, turn: 4.1, lateral: 1.25, durability: 1.85,
  },

  // Omni wheels: the strafe line. Slide round a slow weapon; little push.
  {
    id: 'dr_mecanum', kind: 'drive', name: 'Mecanum Drive', tier: 2, price: 2300, weight: 12,
    desc: 'Roller wheels that slide sideways: strafe around a slow weapon. Poor push.',
    style: 'mecanum', power: 2.8, force: 800, speed: 3.7, grip: 0.75, turn: 5.2, lateral: 0.35, strafe: true, durability: 0.9,
  },
  {
    id: 'dr_omni4', kind: 'drive', name: 'Omni Drive', tier: 4, price: 14500, weight: 11,
    desc: 'Second-generation omni wheels: grip better, strafe faster.',
    style: 'mecanum', power: 4.0, force: 1000, speed: 4.3, grip: 0.82, turn: 6.0, lateral: 0.38, strafe: true, durability: 1.0,
  },
  {
    id: 'dr_omni', kind: 'drive', name: 'Omni Hyperdrive', tier: 5, price: 32000, weight: 10,
    desc: 'Prototype omni wheels. Fast, strafes, turns on a coin.',
    style: 'mecanum', power: 4.8, force: 1130, speed: 4.65, grip: 0.88, turn: 6.6, lateral: 0.4, strafe: true, durability: 1.05,
  },
];

// ---- power cores -----------------------------------------------------------
// Each tier has a compact cell and a heavy stack: weight buys energy. Both
// lines give about 20% more power a tier, as fast as the parts' draw grows, so
// the power budget is as tight in the World Cup as in the garage: a full-spec
// robot of its tier fits the stack, and on the cell something has to give.

export const CORES: CoreDef[] = [
  {
    id: 'co_lead', kind: 'core', name: 'Lead-Acid Brick', tier: 1, price: 0, weight: 15,
    desc: 'Heavy, cheap, reliable. 5 kW to go round.',
    output: 5.0, cooling: 4, durability: 1.2,
  },
  {
    id: 'co_twinlead', kind: 'core', name: 'Twin Lead Stack', tier: 1, price: 700, weight: 23,
    desc: 'Two bricks wired together: 7.5 kW, and a lot of weight.',
    output: 7.5, cooling: 4, durability: 1.3,
  },
  {
    id: 'co_life', kind: 'core', name: 'LiFe Cell', tier: 2, price: 1600, weight: 8,
    desc: 'Lithium iron phosphate. Half the weight of lead.',
    output: 6.0, cooling: 4.5, durability: 1.0,
  },
  {
    id: 'co_lifestack', kind: 'core', name: 'LiFe Stack', tier: 2, price: 2300, weight: 13,
    desc: 'A bigger LiFe pack: 9 kW.',
    output: 9.0, cooling: 4.5, durability: 1.05,
  },
  {
    id: 'co_lipo', kind: 'core', name: 'LiPo Pack', tier: 3, price: 4600, weight: 6,
    desc: 'Race LiPo: tiny and punchy. Burns if it gets smashed.',
    output: 7.2, cooling: 5, volatile: true, durability: 0.85,
  },
  {
    id: 'co_lipobank', kind: 'core', name: 'LiPo Bank', tier: 3, price: 6200, weight: 11,
    desc: '10.8 kW of LiPo. Keep it away from axes.',
    output: 10.8, cooling: 5, volatile: true, durability: 0.9,
  },
  {
    id: 'co_graphene', kind: 'core', name: 'Graphene Cell', tier: 4, price: 12500, weight: 5,
    desc: 'Graphene supercell: 8.6 kW from five kilos, and cool running.',
    output: 8.6, cooling: 6, durability: 1.1,
  },
  {
    id: 'co_graphenearray', kind: 'core', name: 'Graphene Array', tier: 4, price: 15500, weight: 9,
    desc: 'Four supercells in parallel: 13 kW.',
    output: 13.0, cooling: 6, durability: 1.15,
  },
  {
    id: 'co_solid', kind: 'core', name: 'Solid-State Core', tier: 5, price: 30000, weight: 4,
    desc: 'Solid-state prototype: 10.4 kW from four kilos.',
    output: 10.4, cooling: 7, durability: 1.2,
  },
  {
    id: 'co_reactor', kind: 'core', name: 'Solid-State Reactor', tier: 5, price: 36000, weight: 8,
    desc: 'The most power a robot has ever carried: 15.6 kW.',
    output: 15.6, cooling: 7, durability: 1.25,
  },
];

// ---- weapons ---------------------------------------------------------------
//
// Every weapon family is an upgrade line with a part at each tier from the one
// it enters. Up a line, each tier hits about 25% harder (flippers and lifters
// throw about 10% further and reload sooner) for about 20% more power, at
// much the same weight: later parts are better at what they do and a little
// better per kilowatt, but they need a bigger core to run at all (see
// minPowerOf). The tests check every line keeps to this.

export const WEAPONS: WeaponDef[] = [
  // Drums: compact, tough, bite hard and often, pop robots into the air.
  {
    id: 'wp_drum', kind: 'weapon', name: 'Bruiser Drum', tier: 1, price: 800, weight: 14,
    desc: 'A compact toothed drum. Bites hard, pops robots into the air, hard to break.',
    type: 'drum', mount: 'front', power: 2.4, dmgType: 'kinetic', reach: 0.12, arc: 28, durability: 1.4,
    lip: 0.45, energy: 8, bite: 0.66, gyro: 0.15, recoil: 0.25, launch: 0.42,
  },
  {
    id: 'wp_twindrum', kind: 'weapon', name: 'Twin-Tooth Drum', tier: 2, price: 2400, weight: 14,
    desc: 'A wider drum with two rows of teeth: more energy, more bite.',
    type: 'drum', mount: 'front', power: 2.9, dmgType: 'kinetic', reach: 0.13, arc: 28, durability: 1.45,
    lip: 0.47, energy: 9.8, bite: 0.67, gyro: 0.16, recoil: 0.24, launch: 0.44,
  },
  {
    id: 'wp_shreddrum', kind: 'weapon', name: 'Shredder Drum', tier: 3, price: 6000, weight: 15,
    desc: 'A long drum lined with hardened teeth: chews armour edges and launches what is left.',
    type: 'drum', mount: 'front', power: 3.5, dmgType: 'kinetic', reach: 0.13, arc: 29, durability: 1.5,
    lip: 0.48, energy: 12, bite: 0.68, gyro: 0.18, recoil: 0.22, launch: 0.46,
  },
  {
    id: 'wp_megadrum', kind: 'weapon', name: 'Mega Drum', tier: 4, price: 15000, weight: 15,
    desc: 'A solid steel drum that never stops biting.',
    type: 'drum', mount: 'front', power: 4.2, dmgType: 'kinetic', reach: 0.14, arc: 30, durability: 1.55,
    lip: 0.5, energy: 14.6, bite: 0.7, gyro: 0.2, recoil: 0.21, launch: 0.48,
  },
  {
    id: 'wp_tungdrum', kind: 'weapon', name: 'Tungsten Drum', tier: 5, price: 33000, weight: 16,
    desc: 'Solid tungsten, spun to a scream. Whatever it touches goes up.',
    type: 'drum', mount: 'front', power: 5, dmgType: 'kinetic', reach: 0.15, arc: 30, durability: 1.6,
    lip: 0.52, energy: 17.8, bite: 0.72, gyro: 0.22, recoil: 0.2, launch: 0.5,
  },

  // Horizontal bars: wide sweeping hits and big recoil. A low wedge deflects them.
  {
    id: 'wp_bar', kind: 'weapon', name: 'Bar Spinner', tier: 1, price: 750, weight: 15,
    desc: 'A horizontal steel bar. Wide arc, big energy, big recoil. Wedges deflect it.',
    type: 'hspin', mount: 'front', power: 2.6, dmgType: 'kinetic', reach: 0.35, arc: 70, durability: 1.0,
    energy: 14, bite: 0.5, gyro: 0, recoil: 0.6, launch: 0.1,
  },
  {
    id: 'wp_flatbar', kind: 'weapon', name: 'Long Flat Bar', tier: 2, price: 2300, weight: 15,
    desc: 'A longer, heavier bar: more energy in every sweep.',
    type: 'hspin', mount: 'front', power: 3.1, dmgType: 'kinetic', reach: 0.36, arc: 70, durability: 1.03,
    energy: 17.5, bite: 0.5, gyro: 0, recoil: 0.57, launch: 0.12,
  },
  {
    id: 'wp_tribar', kind: 'weapon', name: 'Tri-Blade Bar', tier: 3, price: 6200, weight: 16,
    desc: 'Three blades on one hub: spins up quickly and hits nearly twice as hard as a plain bar.',
    type: 'hspin', mount: 'front', power: 3.75, dmgType: 'kinetic', reach: 0.37, arc: 70, durability: 1.06,
    energy: 22, bite: 0.5, gyro: 0, recoil: 0.54, launch: 0.15,
  },
  {
    id: 'wp_undercutter', kind: 'weapon', name: 'Undercutter', tier: 4, price: 14500, weight: 16,
    desc: 'A low horizontal blade that rips wheels off. Hits the drive hard.',
    type: 'hspin', mount: 'front', power: 4.5, dmgType: 'kinetic', reach: 0.39, arc: 66, durability: 1.1,
    energy: 27.5, bite: 0.5, gyro: 0, recoil: 0.52, launch: 0.2, lowHit: 0.5,
  },
  {
    id: 'wp_reaper', kind: 'weapon', name: 'Reaper Bar', tier: 5, price: 33000, weight: 17,
    desc: 'A full-width cutter bar on a reactor-grade motor. Sweeps robots off their wheels.',
    type: 'hspin', mount: 'front', power: 5.4, dmgType: 'kinetic', reach: 0.41, arc: 66, durability: 1.15,
    energy: 34.4, bite: 0.5, gyro: 0, recoil: 0.5, launch: 0.25, lowHit: 0.5,
  },

  // Vertical discs: the biggest single hits, but slow to turn while spun up.
  {
    id: 'wp_disc', kind: 'weapon', name: 'Vertical Disc', tier: 2, price: 2500, weight: 15,
    desc: 'A big vertical disc: sends robots flying. Turns slowly while it is spun up.',
    type: 'vspin', mount: 'front', power: 3.4, dmgType: 'kinetic', reach: 0.28, arc: 22, durability: 1.0,
    energy: 20, bite: 0.56, gyro: 0.45, recoil: 0.35, launch: 0.5,
  },
  {
    id: 'wp_egg', kind: 'weapon', name: 'Eggbeater', tier: 3, price: 5800, weight: 14,
    desc: 'A beater-shaped vertical spinner with savage bite.',
    type: 'vspin', mount: 'front', power: 4.1, dmgType: 'kinetic', reach: 0.24, arc: 24, durability: 1.05,
    energy: 23.5, bite: 0.6, gyro: 0.4, recoil: 0.32, launch: 0.55,
  },
  {
    id: 'wp_shatter', kind: 'weapon', name: 'Shatter Disc', tier: 4, price: 15500, weight: 15.5,
    desc: 'A thick two-toothed disc: huge bites and higher launches.',
    type: 'vspin', mount: 'front', power: 4.9, dmgType: 'kinetic', reach: 0.3, arc: 23, durability: 1.08,
    energy: 29, bite: 0.6, gyro: 0.42, recoil: 0.33, launch: 0.57,
  },
  {
    id: 'wp_megadisc', kind: 'weapon', name: 'Doomsday Disc', tier: 5, price: 34000, weight: 17,
    desc: 'The heaviest disc ever certified. One clean hit ends most fights.',
    type: 'vspin', mount: 'front', power: 5.9, dmgType: 'kinetic', reach: 0.32, arc: 23, durability: 1.1,
    energy: 36.5, bite: 0.6, gyro: 0.45, recoil: 0.34, launch: 0.6,
  },

  // Ring spinners wrap the whole robot: hits from every side, no aiming.
  {
    id: 'wp_ring', kind: 'weapon', name: 'Ring Spinner', tier: 3, price: 6800, weight: 22,
    desc: 'A toothed ring around the whole robot: hits from every side, no aiming needed. Heavy.',
    type: 'ring', mount: 'full', power: 4.4, dmgType: 'kinetic', reach: 0.08, arc: 180, durability: 1.3,
    energy: 30, bite: 0.42, gyro: 0.3, recoil: 0.55, launch: 0.15,
  },
  {
    id: 'wp_cyclone', kind: 'weapon', name: 'Cyclone Ring', tier: 4, price: 16000, weight: 23,
    desc: 'A wider ring with heavier teeth: hits from any side, harder.',
    type: 'ring', mount: 'full', power: 5.3, dmgType: 'kinetic', reach: 0.09, arc: 180, durability: 1.38,
    energy: 37.5, bite: 0.42, gyro: 0.31, recoil: 0.52, launch: 0.17,
  },
  {
    id: 'wp_halo', kind: 'weapon', name: 'Halo Shell', tier: 5, price: 33000, weight: 24,
    desc: 'A full spinning shell: deadly from any side, with frightening energy. Very heavy.',
    type: 'ring', mount: 'full', power: 6.3, dmgType: 'kinetic', reach: 0.1, arc: 180, durability: 1.45,
    energy: 47, bite: 0.42, gyro: 0.32, recoil: 0.5, launch: 0.2,
  },

  // Flippers win by control: throw robots onto their backs and into the hazards.
  {
    id: 'wp_springflip', kind: 'weapon', name: 'Spring Flipper', tier: 1, price: 600, weight: 9,
    desc: 'A spring-loaded flipper. Throw them over; can right you too.',
    type: 'flipper', mount: 'front', power: 1.0, dmgType: 'kinetic', reach: 0.12, arc: 32, durability: 1.0,
    lip: 0.62, impulse: 720, reload: 3.6, damage: 8,
  },
  {
    id: 'wp_pneuflip', kind: 'weapon', name: 'Pneumatic Flipper', tier: 2, price: 2200, weight: 10.5,
    desc: 'Compressed gas: serious launches and a quicker reset.',
    type: 'flipper', mount: 'front', power: 1.18, dmgType: 'kinetic', reach: 0.12, arc: 33, durability: 1.03,
    lip: 0.7, impulse: 790, reload: 3.3, damage: 9.5,
  },
  {
    id: 'wp_ramflip', kind: 'weapon', name: 'Ram Flipper', tier: 3, price: 6200, weight: 11.5,
    desc: 'A long pneumatic flipper with a fast ram: throws further and resets sooner.',
    type: 'flipper', mount: 'front', power: 1.39, dmgType: 'kinetic', reach: 0.12, arc: 34, durability: 1.06,
    lip: 0.76, impulse: 870, reload: 3.0, damage: 11,
  },
  {
    id: 'wp_megaflip', kind: 'weapon', name: 'Catapult Flipper', tier: 4, price: 15500, weight: 12.5,
    desc: 'Throws a heavyweight clean across the arena.',
    type: 'flipper', mount: 'front', power: 1.64, dmgType: 'kinetic', reach: 0.13, arc: 35, durability: 1.1,
    lip: 0.82, impulse: 960, reload: 2.8, damage: 13,
  },
  {
    id: 'wp_launcher', kind: 'weapon', name: 'Launch Pad', tier: 5, price: 32000, weight: 13,
    desc: 'The pneumatic monster. Out of the arena, if there were no roof.',
    type: 'flipper', mount: 'front', power: 1.93, dmgType: 'kinetic', reach: 0.14, arc: 36, durability: 1.15,
    lip: 0.88, impulse: 1055, reload: 2.6, damage: 15,
  },

  // Lifters scoop robots up, carry them where they like and tip them over.
  {
    id: 'wp_lifter', kind: 'weapon', name: 'Lifter Arm', tier: 2, price: 1900, weight: 10,
    desc: 'Scoops robots up so they cannot push back, carries them, then tips them over.',
    type: 'lifter', mount: 'front', power: 1.3, dmgType: 'kinetic', reach: 0.12, arc: 30, durability: 1.1,
    lip: 0.72, impulse: 700, reload: 2.2, hold: 2.2, grab: true, damage: 5,
  },
  {
    id: 'wp_clamp', kind: 'weapon', name: 'Clamp-Lifter', tier: 3, price: 6000, weight: 11,
    desc: 'Grabs, lifts and carries. Walk them into the hazards.',
    type: 'lifter', mount: 'front', power: 1.53, dmgType: 'kinetic', reach: 0.13, arc: 30, durability: 1.2,
    lip: 0.76, impulse: 770, reload: 2.1, hold: 2.5, grab: true, damage: 6,
  },
  {
    id: 'wp_hydrofork', kind: 'weapon', name: 'Hydraulic Forks', tier: 4, price: 14500, weight: 12,
    desc: 'Low forks on a hydraulic arm: slide under, lift high, carry them anywhere.',
    type: 'lifter', mount: 'front', power: 1.81, dmgType: 'kinetic', reach: 0.15, arc: 32, durability: 1.3,
    lip: 0.82, impulse: 850, reload: 2.0, hold: 2.8, grab: true, damage: 7,
  },
  {
    id: 'wp_forklift', kind: 'weapon', name: 'Titan Forklift', tier: 5, price: 32000, weight: 13,
    desc: 'Picks heavyweights up like crates and walks them anywhere it likes.',
    type: 'lifter', mount: 'front', power: 2.13, dmgType: 'kinetic', reach: 0.16, arc: 33, durability: 1.4,
    lip: 0.88, impulse: 935, reload: 1.9, hold: 3.1, grab: true, damage: 8,
  },

  // Overhead weapons strike the top armour, where most robots are thin.
  {
    id: 'wp_sledge', kind: 'weapon', name: 'Sledgehammer', tier: 1, price: 650, weight: 11,
    desc: 'A heavy hammer on a powered arm. Dents the top armour and stuns.',
    type: 'hammer', mount: 'top', power: 1.4, dmgType: 'kinetic', reach: 0.62, arc: 18, durability: 1.2,
    damage: 30, reload: 3.0, stun: 0.35,
  },
  {
    id: 'wp_pickaxe', kind: 'weapon', name: 'Pickaxe', tier: 2, price: 2100, weight: 11,
    desc: 'A pointed axe head: punches through thin top armour.',
    type: 'axe', mount: 'top', power: 1.7, dmgType: 'pierce', reach: 0.68, arc: 16, durability: 1.1,
    damage: 37.5, reload: 2.9, pierce: 0.25,
  },
  {
    id: 'wp_thwack', kind: 'weapon', name: 'Overhead Axe', tier: 3, price: 6000, weight: 12.5,
    desc: 'A titanium axe on a fast arm. Hits hard, resets quickly.',
    type: 'axe', mount: 'top', power: 2.0, dmgType: 'pierce', reach: 0.74, arc: 16, durability: 1.2,
    damage: 47, reload: 2.8, pierce: 0.3,
  },
  {
    id: 'wp_pulverizer', kind: 'weapon', name: 'Pulverizer', tier: 4, price: 14000, weight: 13.5,
    desc: 'A sledgehammer the size of an anvil. Leaves them dazed.',
    type: 'hammer', mount: 'top', power: 2.4, dmgType: 'kinetic', reach: 0.8, arc: 18, durability: 1.3,
    damage: 58.5, reload: 2.7, stun: 0.5,
  },
  {
    id: 'wp_titanhammer', kind: 'weapon', name: 'Titan Hammer', tier: 5, price: 30000, weight: 14.5,
    desc: 'The biggest hammer on the circuit. Two clean hits finish most robots.',
    type: 'hammer', mount: 'top', power: 2.9, dmgType: 'kinetic', reach: 0.85, arc: 18, durability: 1.4,
    damage: 73, reload: 2.6, stun: 0.6,
  },

  // Crushers bite through any armour and hold on.
  {
    id: 'wp_jaw', kind: 'weapon', name: 'Hydraulic Jaw', tier: 2, price: 2700, weight: 16,
    desc: 'A crushing beak. Bites through half the armour and holds them in place.',
    type: 'crusher', mount: 'front', power: 2.0, dmgType: 'pierce', reach: 0.18, arc: 26, durability: 1.3,
    lip: 0.55, damage: 22, dps: 22, hold: 2.5, reload: 3.2, pierce: 0.5,
  },
  {
    id: 'wp_vise', kind: 'weapon', name: 'Vise Jaw', tier: 3, price: 6200, weight: 16.5,
    desc: 'A longer beak with serrated edges: bites deeper and holds tighter.',
    type: 'crusher', mount: 'front', power: 2.4, dmgType: 'pierce', reach: 0.19, arc: 27, durability: 1.35,
    lip: 0.57, damage: 27, dps: 27.5, hold: 2.5, reload: 3.0, pierce: 0.52,
  },
  {
    id: 'wp_megajaw', kind: 'weapon', name: 'Mega Crusher', tier: 4, price: 16000, weight: 17,
    desc: 'Eight tonnes of bite. Armour means little to it.',
    type: 'crusher', mount: 'front', power: 2.9, dmgType: 'pierce', reach: 0.2, arc: 28, durability: 1.4,
    lip: 0.6, damage: 33, dps: 33, hold: 2.6, reload: 2.8, pierce: 0.55,
  },
  {
    id: 'wp_guillotine', kind: 'weapon', name: 'Guillotine Crusher', tier: 5, price: 34000, weight: 18,
    desc: 'Twelve tonnes behind a tungsten tooth. Nothing it closes on comes out the same.',
    type: 'crusher', mount: 'front', power: 3.5, dmgType: 'pierce', reach: 0.21, arc: 28, durability: 1.45,
    lip: 0.62, damage: 41, dps: 41, hold: 2.7, reload: 2.6, pierce: 0.6,
  },

  // Saws grind steadily while they touch: arm saws cut the top panels.
  {
    id: 'wp_buzzsaw', kind: 'weapon', name: 'Buzz Saw', tier: 1, price: 550, weight: 8,
    desc: 'A saw on an arm. Grinds the top panels while it touches.',
    type: 'saw', mount: 'top', power: 1.5, dmgType: 'cut', reach: 0.45, arc: 22, durability: 1.0,
    dps: 15,
  },
  {
    id: 'wp_ripsaw', kind: 'weapon', name: 'Rip Saw', tier: 2, price: 2000, weight: 8.5,
    desc: 'A bigger blade with coarse teeth: rips panels faster.',
    type: 'saw', mount: 'top', power: 1.8, dmgType: 'cut', reach: 0.5, arc: 22, durability: 1.05,
    dps: 18.75,
  },
  {
    id: 'wp_chainsaw', kind: 'weapon', name: 'Chainsaw Arm', tier: 3, price: 5600, weight: 9.5,
    desc: 'A chainsaw on a reaching arm: cuts deep wherever it lands.',
    type: 'saw', mount: 'top', power: 2.15, dmgType: 'cut', reach: 0.55, arc: 24, durability: 1.1,
    dps: 23.4,
  },
  {
    id: 'wp_armsaw', kind: 'weapon', name: 'Circular Saw Arm', tier: 4, price: 13000, weight: 10.5,
    desc: 'A big circular saw on a long arm: cuts the top panels from further away.',
    type: 'saw', mount: 'top', power: 2.6, dmgType: 'cut', reach: 0.6, arc: 26, durability: 1.15,
    dps: 29.3,
  },
  {
    id: 'wp_diamondsaw', kind: 'weapon', name: 'Diamond Saw', tier: 5, price: 30000, weight: 11,
    desc: 'A diamond-edged blade on a long arm: cuts titanium like plywood.',
    type: 'saw', mount: 'top', power: 3.1, dmgType: 'cut', reach: 0.65, arc: 26, durability: 1.2,
    dps: 36.6,
  },
  {
    id: 'wp_twinsaw', kind: 'weapon', name: 'Twin Saws', tier: 3, price: 5000, weight: 12,
    desc: 'Two front saws that chew through plastic and aluminium.',
    type: 'saw', mount: 'front', power: 2.8, dmgType: 'cut', reach: 0.25, arc: 30, durability: 1.1,
    dps: 24, lip: 0.3,
  },

  // Passive weapons need no power: it all goes to the wheels. Wedges get
  // under and pin; rams hit as hard as the robot drives into them.
  {
    id: 'wp_plow', kind: 'weapon', name: 'Steel Plow', tier: 1, price: 300, weight: 8,
    desc: 'A plain steel wedge. Gets under, deflects horizontal spinners, pushes to the hazards.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.2, arc: 40, durability: 1.5,
    lip: 0.75, wedge: 0.75, ram: 0.45,
  },
  {
    id: 'wp_forks', kind: 'weapon', name: 'Hinged Forks', tier: 2, price: 1500, weight: 7,
    desc: 'Knife-edge forks. Nothing gets lower.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.25, arc: 40, durability: 1.6,
    lip: 0.9, wedge: 0.9, ram: 0.56,
  },
  {
    id: 'wp_dozer', kind: 'weapon', name: 'Dozer Blade', tier: 3, price: 5000, weight: 8,
    desc: 'A full-width hardened blade: gets under, holds the line and shoves hard.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.25, arc: 45, durability: 1.9,
    lip: 0.92, wedge: 0.94, ram: 0.7,
  },
  {
    id: 'wp_plough', kind: 'weapon', name: 'Titan Plough', tier: 4, price: 11000, weight: 9,
    desc: 'A full-width titanium plough: gets under everything and takes any hit.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.25, arc: 45, durability: 2.3,
    lip: 0.95, wedge: 0.97, ram: 0.88,
  },
  {
    id: 'wp_aegis', kind: 'weapon', name: 'Aegis Wedge', tier: 5, price: 30000, weight: 9.5,
    desc: 'A sprung tungsten wedge: nothing gets under it, everything goes over it.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.26, arc: 46, durability: 2.8,
    lip: 0.98, wedge: 1.0, ram: 1.1,
  },
  {
    id: 'wp_spikes', kind: 'weapon', name: 'Ram Spikes', tier: 1, price: 350, weight: 7,
    desc: 'Steel spikes on the nose. Damage grows with the speed you hit at.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.18, arc: 35, durability: 1.4,
    ram: 1.0,
  },
  {
    id: 'wp_spikeplate', kind: 'weapon', name: 'Spiked Ram Plate', tier: 2, price: 1800, weight: 8,
    desc: 'A plate of long steel spikes: more points, more punch.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.24, arc: 35, durability: 1.5,
    ram: 1.2,
  },
  {
    id: 'wp_lance', kind: 'weapon', name: 'Titanium Lance', tier: 3, price: 4400, weight: 9,
    desc: 'A long piercing ram. Fast robots turn it into a missile.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.35, arc: 30, durability: 1.6,
    ram: 1.44,
  },
  {
    id: 'wp_ramhead', kind: 'weapon', name: 'Steel Ram Head', tier: 4, price: 12500, weight: 10,
    desc: 'A heavy sprung ram head: hits like a lance and shrugs off the hit it gives.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.3, arc: 35, durability: 1.8,
    ram: 1.73,
  },
  {
    id: 'wp_battering', kind: 'weapon', name: 'Battering Ram', tier: 5, price: 28000, weight: 11,
    desc: 'A sprung tungsten ram head: rams like a lance, wedges like a plow.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.32, arc: 35, durability: 2.0,
    ram: 2.07, lip: 0.6, wedge: 0.6,
  },

  // Flame: little direct damage, but it cooks the electronics.
  {
    id: 'wp_flame', kind: 'weapon', name: 'Flamethrower', tier: 2, price: 2000, weight: 6,
    desc: 'Cooks the electronics: overheats robots that run hot. Plastic armour hates it.',
    type: 'flame', mount: 'top', power: 0.4, dmgType: 'thermal', reach: 1.1, arc: 18, durability: 0.9,
    dps: 5, heat: 17, fuel: 14,
  },
  {
    id: 'wp_torch', kind: 'weapon', name: 'Plasma Torch', tier: 3, price: 6000, weight: 6.5,
    desc: 'A hotter, longer flame: cooks electronics through the armour.',
    type: 'flame', mount: 'top', power: 0.48, dmgType: 'thermal', reach: 1.2, arc: 19, durability: 0.95,
    dps: 6.2, heat: 21.25, fuel: 15,
  },
  {
    id: 'wp_inferno', kind: 'weapon', name: 'Inferno Cannon', tier: 4, price: 13000, weight: 7,
    desc: 'A blowtorch the size of a fire hose.',
    type: 'flame', mount: 'top', power: 0.58, dmgType: 'thermal', reach: 1.3, arc: 20, durability: 1.0,
    dps: 7.8, heat: 26.6, fuel: 16,
  },
  {
    id: 'wp_dragon', kind: 'weapon', name: "Dragon's Breath", tier: 5, price: 30000, weight: 7.5,
    desc: 'A roaring jet of burning fuel. Robots that run hot do not finish the fight.',
    type: 'flame', mount: 'top', power: 0.69, dmgType: 'thermal', reach: 1.4, arc: 20, durability: 1.05,
    dps: 9.8, heat: 33.2, fuel: 18,
  },
];

// ---- armour ----------------------------------------------------------------
// Aluminium, titanium, Kevlar and nano-laminate are the all-rounders: each
// holds about 20% more per kilo than the one before. Steel (heavy, stops saws)
// and UHMW (light, eats spinners, hates heat and blades) are specialists.

export const ARMORS: ArmorDef[] = [
  {
    id: 'ar_alu', kind: 'armor', name: 'Aluminium', tier: 1, price: 0, weight: 0,
    desc: 'Light and cheap. Middling against everything.',
    density: 1.0, hpPerLevel: 38, resist: { kinetic: 0.45, pierce: 0.35, cut: 0.4, thermal: 0.4 }, look: 'alu',
  },
  {
    id: 'ar_steel', kind: 'armor', name: 'Hardened Steel', tier: 1, price: 450, weight: 0,
    desc: 'Twice the weight of aluminium. Saws barely scratch it.',
    density: 2.0, hpPerLevel: 62, resist: { kinetic: 0.55, pierce: 0.6, cut: 0.75, thermal: 0.6 }, look: 'steel',
  },
  {
    id: 'ar_uhmw', kind: 'armor', name: 'UHMW Plastic', tier: 2, price: 1300, weight: 0,
    desc: 'Soaks up spinner hits like nothing else. Saws and flame go straight through.',
    density: 0.85, hpPerLevel: 46, resist: { kinetic: 0.75, pierce: 0.45, cut: 0.25, thermal: 0.1 }, look: 'uhmw',
  },
  {
    id: 'ar_titanium', kind: 'armor', name: 'Titanium', tier: 3, price: 5200, weight: 0,
    desc: 'Strong against everything at a fair weight.',
    density: 1.05, hpPerLevel: 60, resist: { kinetic: 0.65, pierce: 0.7, cut: 0.6, thermal: 0.5 }, look: 'titanium',
  },
  {
    id: 'ar_composite', kind: 'armor', name: 'Kevlar Composite', tier: 4, price: 12000, weight: 0,
    desc: 'Woven aramid: axes and crushers struggle. Light, but it scorches.',
    density: 0.9, hpPerLevel: 62, resist: { kinetic: 0.6, pierce: 0.8, cut: 0.5, thermal: 0.3 }, look: 'composite',
  },
  {
    id: 'ar_nano', kind: 'armor', name: 'Nano-Laminate', tier: 5, price: 30000, weight: 0,
    desc: 'Prototype laminate. Tough against everything.',
    density: 0.9, hpPerLevel: 76, resist: { kinetic: 0.7, pierce: 0.72, cut: 0.7, thermal: 0.6 }, look: 'nano',
  },
];

// ---- modules ---------------------------------------------------------------

export const MODULES: ModuleDef[] = [
  { id: 'md_srimech', kind: 'module', name: 'Self-Righter', tier: 1, price: 450, weight: 5, effect: 'selfright', value: 1.4,
    desc: 'A spring arm that rolls you back over when flipped.' },
  { id: 'md_wedgelets', kind: 'module', name: 'Wedgelets', tier: 1, price: 300, weight: 3, effect: 'wedgelets', value: 0.66,
    desc: 'Little wedges on the front corners. Get under, deflect horizontal spinners.' },
  { id: 'md_skirts', kind: 'module', name: 'Side Skirts', tier: 1, price: 350, weight: 4, effect: 'skirts', value: 0.3,
    desc: 'Plates that drag the floor: hard to get under from the sides.' },
  { id: 'md_heatsink', kind: 'module', name: 'Heat Sink', tier: 1, price: 250, weight: 3, effect: 'heatsink', value: 0.6,
    desc: 'Finned copper: sheds heat 60% faster. Overvolt for longer.' },
  { id: 'md_thorns', kind: 'module', name: 'Spiked Bumpers', tier: 1, price: 400, weight: 5, effect: 'thorns', value: 5,
    desc: 'Whoever drives hard into you gets a face full of spikes.' },
  { id: 'md_magnets', kind: 'module', name: 'Downforce Magnets', tier: 2, price: 1600, weight: 4, effect: 'magnets', power: 0.6, value: 0.55,
    desc: 'Clamp to the steel floor: 55% more grip and push, much harder to flip. Draws power.' },
  { id: 'md_shock', kind: 'module', name: 'Shock Mounts', tier: 2, price: 1200, weight: 3, effect: 'shock', value: 0.4,
    desc: 'Rubber-mounted internals: 40% less component damage, less knockback.' },
  { id: 'md_gyro', kind: 'module', name: 'Gyro Stabilizer', tier: 2, price: 1500, weight: 4, effect: 'gyro', value: 0.6,
    desc: 'Cancels most of a spinner\'s gyroscopic drag on turning. Steadier when hit.' },
  { id: 'md_ablative', kind: 'module', name: 'Ablative Plating', tier: 2, price: 1400, weight: 6, effect: 'ablative', value: 90,
    desc: 'Sacrificial panels: the first 90 damage of a fight is soaked up entirely.' },
  { id: 'md_guard', kind: 'module', name: 'Weapon Guard', tier: 2, price: 1000, weight: 4, effect: 'guard', value: 0.55,
    desc: 'Cages the weapon mounts: 55% less damage to your weapons.' },
  { id: 'md_capacitor', kind: 'module', name: 'Capacitor Bank', tier: 3, price: 4200, weight: 3, effect: 'capacitor', value: 1,
    desc: 'Doubles the BOOST surge and recharges it faster.' },
  { id: 'md_targeting', kind: 'module', name: 'Targeting AI', tier: 3, price: 4800, weight: 1, effect: 'targeting', power: 0.2, value: 0.3,
    desc: 'Smarter weapon timing: 30% wider striking zone, a little more reach.' },
  { id: 'md_redundant', kind: 'module', name: 'Redundant Drive', tier: 3, price: 5000, weight: 4, effect: 'redundant', value: 0.35,
    desc: 'Backup motors: your drive never drops below 35%.' },
  { id: 'md_coolant', kind: 'module', name: 'Coolant Injector', tier: 4, price: 11000, weight: 2, effect: 'coolant', value: 55,
    desc: 'Dumps 55 heat in an instant when you run too hot. Once every 15 s.' },
  { id: 'md_reactive', kind: 'module', name: 'Reactive Armour', tier: 4, price: 13000, weight: 7, effect: 'reactive', value: 0.5,
    desc: 'Explosive tiles: halves the next big hit, then recharges for 8 s.' },
];

// ---- lookup ----------------------------------------------------------------

// ---- brains ----------------------------------------------------------------
// The control board fights the robot. A sharper brain reacts sooner, aims
// and times its weapon better and reads the hazards, but it draws power the
// weapons and wheels could have had, and it needs a minimum to stay awake.

export const BRAINS: BrainDef[] = [
  {
    id: 'br_relay', kind: 'brain', name: 'Relay Logic', tier: 1, price: 0, weight: 0.5,
    desc: 'A box of relays and a prayer. Slow to react, wobbly aim, blind to the hazards. Sips power.',
    power: 0.1, minPower: 0.3, reaction: 0.42, aim: 0.45, awareness: 0.2, durability: 1.0,
  },
  {
    id: 'br_hobby', kind: 'brain', name: 'Hobby Board', tier: 1, price: 450, weight: 1,
    desc: 'A hobbyist microcontroller: quicker and steadier than relays, still easy to fool.',
    power: 0.35, minPower: 0.4, reaction: 0.33, aim: 0.56, awareness: 0.4, durability: 1.0,
  },
  {
    id: 'br_berserker', kind: 'brain', name: 'Berserker Chip', tier: 2, price: 1500, weight: 1,
    desc: 'Fast, cheap and furious. Never backs off, never looks where it is going.',
    power: 0.5, minPower: 0.45, reaction: 0.22, aim: 0.6, awareness: 0.15, trait: 'reckless', durability: 1.1,
  },
  {
    id: 'br_tactical', kind: 'brain', name: 'Tactical CPU', tier: 2, price: 2100, weight: 2,
    desc: 'A proper combat controller: reads the arena and picks its moments.',
    power: 0.9, minPower: 0.5, reaction: 0.27, aim: 0.66, awareness: 0.6, durability: 1.0,
  },
  {
    id: 'br_sentinel', kind: 'brain', name: 'Sentinel Core', tier: 3, price: 5200, weight: 3,
    desc: 'Defensive firmware: keeps its weapon between it and trouble, never wanders into a hazard.',
    power: 1.1, minPower: 0.5, reaction: 0.22, aim: 0.72, awareness: 0.9, trait: 'cautious', durability: 1.2,
  },
  {
    id: 'br_combat', kind: 'brain', name: 'Combat Computer', tier: 3, price: 6000, weight: 2.5,
    desc: 'Military surplus. Sharp, fast and power hungry.',
    power: 1.4, minPower: 0.55, reaction: 0.19, aim: 0.78, awareness: 0.72, durability: 1.0,
  },
  {
    id: 'br_predator', kind: 'brain', name: 'Predator AI', tier: 4, price: 13500, weight: 2,
    desc: 'Built to stalk: circles to the sides and rear and strikes there. Careless about the arena.',
    power: 1.9, minPower: 0.6, reaction: 0.13, aim: 0.93, awareness: 0.55, trait: 'hunter', durability: 1.0,
  },
  {
    id: 'br_neural', kind: 'brain', name: 'Neural Net', tier: 4, price: 15000, weight: 3.5,
    desc: 'Learns the other robot as it fights: waits for it to commit, then punishes.',
    power: 2.3, minPower: 0.6, reaction: 0.14, aim: 0.87, awareness: 0.84, trait: 'adaptive', durability: 1.0,
  },
  {
    id: 'br_overmind', kind: 'brain', name: 'Overmind', tier: 5, price: 33000, weight: 4.5,
    desc: 'The sharpest mind on the circuit, and the hungriest: it needs a big core to feed it.',
    power: 3.4, minPower: 0.65, reaction: 0.09, aim: 0.96, awareness: 0.94, trait: 'adaptive', durability: 1.1,
  },
];

export const ALL_PARTS: PartDef[] = [...CHASSIS, ...DRIVES, ...CORES, ...WEAPONS, ...ARMORS, ...MODULES, ...BRAINS];
const BY_ID = new Map<string, PartDef>(ALL_PARTS.map((p) => [p.id, p]));

export function part<T extends PartDef = PartDef>(id: string): T {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown part ${id}`);
  return p as T;
}

export function hasPart(id: string | null | undefined): boolean {
  return !!id && BY_ID.has(id);
}

export const chassisOf = (id: string) => part<ChassisDef>(id);
export const driveOf = (id: string) => part<DriveDef>(id);
export const coreOf = (id: string) => part<CoreDef>(id);
export const weaponOf = (id: string) => part<WeaponDef>(id);
export const armorOf = (id: string) => part<ArmorDef>(id);
export const moduleOf = (id: string) => part<ModuleDef>(id);
export const brainOf = (id: string) => part<BrainDef>(id);

const SPIN_TYPES = ['vspin', 'drum', 'hspin', 'ring'];

/**
 * The least share of its rated draw a powered part works on. Below it a
 * weapon will not run, a drive stalls and a brain browns out. Bigger, later
 * parts need more: they cannot be fitted and then starved. Always a whole
 * step of the power split (5%), so the minimum can be set exactly.
 */
export function minPowerOf(p: PartDef): number {
  const step = (v: number) => Math.ceil(v * 20 - 1e-9) / 20;
  switch (p.kind) {
    case 'brain':
      return step(p.minPower);
    case 'drive':
      return step(0.3 + 0.04 * (p.tier - 1));
    case 'weapon':
      if (p.power <= 0) return 0;
      return step(SPIN_TYPES.includes(p.type) ? 0.35 + 0.05 * (p.tier - 1) : 0.25 + 0.04 * (p.tier - 1));
    case 'module':
      return p.power ? 0.5 : 0;
    default:
      return 0;
  }
}

/** Upgrade levels run 1..5; each adds 7% to the part's main numbers. */
export const MAX_LEVEL = 5;
export const levelMult = (level: number) => 1 + 0.07 * (Math.max(1, Math.min(MAX_LEVEL, level)) - 1);

export function upgradeCost(p: PartDef, toLevel: number): number {
  const base = Math.max(p.price, 400);
  const f = [0, 0, 0.35, 0.6, 0.9, 1.3][toLevel] ?? 1.3;
  return Math.round((base * f) / 50) * 50;
}

export const WEAPON_FAMILY: Record<string, string> = {
  vspin: 'Vertical spinner',
  drum: 'Drum spinner',
  hspin: 'Horizontal spinner',
  ring: 'Ring spinner',
  flipper: 'Flipper',
  lifter: 'Lifter',
  hammer: 'Hammer',
  axe: 'Axe',
  crusher: 'Crusher',
  saw: 'Saw',
  wedge: 'Wedge',
  ram: 'Rammer',
  flame: 'Flamethrower',
};
