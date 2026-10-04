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
    id: 'dr_treads', kind: 'drive', name: 'Tank Treads', tier: 2, price: 2000, weight: 18,
    desc: 'Rubber tracks. Slow to turn, but they grip like glue and shrug off hits.',
    style: 'treads', power: 3.2, force: 1500, speed: 3.1, grip: 1.25, turn: 3.4, lateral: 1.2, durability: 1.5,
  },
  {
    id: 'dr_mecanum', kind: 'drive', name: 'Mecanum Drive', tier: 2, price: 2300, weight: 12,
    desc: 'Roller wheels that slide sideways: strafe around a slow weapon. Poor push.',
    style: 'mecanum', power: 2.8, force: 800, speed: 3.7, grip: 0.75, turn: 5.2, lateral: 0.35, strafe: true, durability: 0.9,
  },
  {
    id: 'dr_brushless', kind: 'drive', name: 'Brushless 4WD', tier: 3, price: 5500, weight: 10,
    desc: 'Race-grade brushless motors: fast, light and nimble.',
    style: 'wheels4', power: 4.2, force: 1150, speed: 5.0, grip: 1.0, turn: 6.0, lateral: 1.0, durability: 1.1,
  },
  {
    id: 'dr_six', kind: 'drive', name: 'Six-Wheel Bruiser', tier: 3, price: 6200, weight: 16,
    desc: 'Six fat wheels and torque to spare. Built for shoving.',
    style: 'wheels6', power: 4.6, force: 1800, speed: 3.7, grip: 1.15, turn: 4.0, lateral: 1.1, durability: 1.35,
  },
  {
    id: 'dr_turbo', kind: 'drive', name: 'Turbo Wheels', tier: 4, price: 14000, weight: 9,
    desc: 'The fastest wheels on the circuit. Dances around anything slow.',
    style: 'wheels4', power: 5.5, force: 1250, speed: 6.3, grip: 1.0, turn: 7.0, lateral: 1.0, durability: 1.1,
  },
  {
    id: 'dr_crawler', kind: 'drive', name: 'Crawler Treads', tier: 4, price: 15500, weight: 16,
    desc: 'Industrial tracks: monstrous push, almost impossible to break.',
    style: 'treads', power: 5.5, force: 2300, speed: 3.8, grip: 1.35, turn: 3.8, lateral: 1.25, durability: 1.7,
  },
  {
    id: 'dr_omni', kind: 'drive', name: 'Omni Hyperdrive', tier: 5, price: 32000, weight: 10,
    desc: 'Prototype omni wheels. Fast, strafes, turns on a coin.',
    style: 'mecanum', power: 6.5, force: 1500, speed: 5.8, grip: 0.95, turn: 7.2, lateral: 0.42, strafe: true, durability: 1.1,
  },
  {
    id: 'dr_titan', kind: 'drive', name: 'Titan Tracks', tier: 5, price: 34000, weight: 14,
    desc: 'Tracks with sports-car pace. Pushes walls over.',
    style: 'treads', power: 6.5, force: 2600, speed: 4.5, grip: 1.4, turn: 4.3, lateral: 1.25, durability: 1.8,
  },
];

// ---- power cores -----------------------------------------------------------
// Each tier has a compact cell and a heavy stack: weight buys energy.

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
    output: 8.0, cooling: 5, volatile: true, durability: 0.85,
  },
  {
    id: 'co_lipobank', kind: 'core', name: 'LiPo Bank', tier: 3, price: 6200, weight: 11,
    desc: '12 kW of LiPo. Keep it away from axes.',
    output: 12.0, cooling: 5, volatile: true, durability: 0.9,
  },
  {
    id: 'co_graphene', kind: 'core', name: 'Graphene Cell', tier: 4, price: 12500, weight: 5,
    desc: 'Graphene supercell: 10 kW and cool running.',
    output: 10.0, cooling: 6, durability: 1.1,
  },
  {
    id: 'co_graphenearray', kind: 'core', name: 'Graphene Array', tier: 4, price: 15500, weight: 9,
    desc: 'Four supercells in parallel: 15 kW.',
    output: 15.0, cooling: 6, durability: 1.15,
  },
  {
    id: 'co_solid', kind: 'core', name: 'Solid-State Core', tier: 5, price: 30000, weight: 4,
    desc: 'Solid-state prototype: 12.5 kW from four kilos.',
    output: 12.5, cooling: 7, durability: 1.2,
  },
  {
    id: 'co_reactor', kind: 'core', name: 'Solid-State Reactor', tier: 5, price: 36000, weight: 8,
    desc: 'The most power a robot has ever carried: 18.5 kW.',
    output: 18.5, cooling: 7, durability: 1.25,
  },
];

// ---- weapons ---------------------------------------------------------------

export const WEAPONS: WeaponDef[] = [
  // Spinners store energy and dump it in one hit, then need time to spin up.
  {
    id: 'wp_drum', kind: 'weapon', name: 'Bruiser Drum', tier: 1, price: 800, weight: 14,
    desc: 'A compact toothed drum. Bites hard, pops robots into the air, hard to break.',
    type: 'drum', mount: 'front', power: 2.4, dmgType: 'kinetic', reach: 0.12, arc: 28, durability: 1.4,
    lip: 0.45, energy: 8, bite: 0.66, gyro: 0.15, recoil: 0.25, launch: 0.42,
  },
  {
    id: 'wp_twindrum', kind: 'weapon', name: 'Twin-Tooth Drum', tier: 2, price: 2400, weight: 15,
    desc: 'A wider drum with two rows of teeth: more energy, more bite.',
    type: 'drum', mount: 'front', power: 3.4, dmgType: 'kinetic', reach: 0.13, arc: 28, durability: 1.45,
    lip: 0.48, energy: 14, bite: 0.68, gyro: 0.17, recoil: 0.24, launch: 0.45,
  },
  {
    id: 'wp_bar', kind: 'weapon', name: 'Bar Spinner', tier: 1, price: 750, weight: 15,
    desc: 'A horizontal steel bar. Wide arc, big energy, big recoil. Wedges deflect it.',
    type: 'hspin', mount: 'front', power: 2.6, dmgType: 'kinetic', reach: 0.35, arc: 70, durability: 1.0,
    energy: 14, bite: 0.5, gyro: 0, recoil: 0.6, launch: 0.1,
  },
  {
    id: 'wp_disc', kind: 'weapon', name: 'Vertical Disc', tier: 2, price: 2500, weight: 15,
    desc: 'A big vertical disc: sends robots flying. Turns slowly while it is spun up.',
    type: 'vspin', mount: 'front', power: 3.4, dmgType: 'kinetic', reach: 0.28, arc: 22, durability: 1.0,
    energy: 20, bite: 0.56, gyro: 0.45, recoil: 0.35, launch: 0.5,
  },
  {
    id: 'wp_ring', kind: 'weapon', name: 'Ring Spinner', tier: 3, price: 6800, weight: 22,
    desc: 'A toothed ring around the whole robot: hits from every side, no aiming needed. Heavy.',
    type: 'ring', mount: 'full', power: 4.4, dmgType: 'kinetic', reach: 0.08, arc: 180, durability: 1.3,
    energy: 30, bite: 0.42, gyro: 0.3, recoil: 0.55, launch: 0.15,
  },
  {
    id: 'wp_egg', kind: 'weapon', name: 'Eggbeater', tier: 3, price: 5800, weight: 14,
    desc: 'A beater-shaped vertical spinner with savage bite.',
    type: 'vspin', mount: 'front', power: 4.0, dmgType: 'kinetic', reach: 0.2, arc: 24, durability: 1.1,
    energy: 24, bite: 0.6, gyro: 0.35, recoil: 0.3, launch: 0.55,
  },
  {
    id: 'wp_tribar', kind: 'weapon', name: 'Tri-Blade Bar', tier: 3, price: 6200, weight: 16,
    desc: 'Three blades on one hub: spins up faster than a bar and hits nearly as hard.',
    type: 'hspin', mount: 'front', power: 4.0, dmgType: 'kinetic', reach: 0.36, arc: 70, durability: 1.05,
    energy: 22, bite: 0.48, gyro: 0, recoil: 0.5, launch: 0.15,
  },
  {
    id: 'wp_undercutter', kind: 'weapon', name: 'Undercutter', tier: 4, price: 14500, weight: 17,
    desc: 'A low horizontal blade that rips wheels off. Hits the drive hard.',
    type: 'hspin', mount: 'front', power: 5.2, dmgType: 'kinetic', reach: 0.4, arc: 65, durability: 1.1,
    energy: 34, bite: 0.5, gyro: 0, recoil: 0.55, launch: 0.25, lowHit: 0.5,
  },
  {
    id: 'wp_megadrum', kind: 'weapon', name: 'Mega Drum', tier: 4, price: 15000, weight: 16,
    desc: 'A solid steel drum that never stops biting.',
    type: 'drum', mount: 'front', power: 5.0, dmgType: 'kinetic', reach: 0.14, arc: 30, durability: 1.5,
    lip: 0.5, energy: 27, bite: 0.7, gyro: 0.2, recoil: 0.2, launch: 0.48,
  },
  {
    id: 'wp_megadisc', kind: 'weapon', name: 'Doomsday Disc', tier: 5, price: 34000, weight: 17,
    desc: 'The heaviest disc ever certified. One clean hit ends most fights.',
    type: 'vspin', mount: 'front', power: 6.5, dmgType: 'kinetic', reach: 0.32, arc: 22, durability: 1.1,
    energy: 46, bite: 0.56, gyro: 0.45, recoil: 0.35, launch: 0.6,
  },
  {
    id: 'wp_halo', kind: 'weapon', name: 'Halo Shell', tier: 5, price: 33000, weight: 25,
    desc: 'A full spinning shell: deadly from any side, with frightening energy. Very heavy.',
    type: 'ring', mount: 'full', power: 6.0, dmgType: 'kinetic', reach: 0.1, arc: 180, durability: 1.45,
    energy: 44, bite: 0.42, gyro: 0.32, recoil: 0.5, launch: 0.2,
  },

  // Flippers and lifters win by control: throw robots onto their backs,
  // into the pit and against the hazards.
  {
    id: 'wp_springflip', kind: 'weapon', name: 'Spring Flipper', tier: 1, price: 600, weight: 9,
    desc: 'A spring-loaded flipper. Throw them over; can right you too.',
    type: 'flipper', mount: 'front', power: 1.0, dmgType: 'kinetic', reach: 0.1, arc: 28, durability: 1.0,
    lip: 0.62, impulse: 720, reload: 3.6, damage: 8,
  },
  {
    id: 'wp_pneuflip', kind: 'weapon', name: 'Pneumatic Flipper', tier: 2, price: 2200, weight: 12,
    desc: 'Compressed gas, serious launches.',
    type: 'flipper', mount: 'front', power: 1.5, dmgType: 'kinetic', reach: 0.11, arc: 30, durability: 1.0,
    lip: 0.72, impulse: 650, reload: 3.3, damage: 10,
  },
  {
    id: 'wp_lifter', kind: 'weapon', name: 'Lifter Arm', tier: 2, price: 1900, weight: 10,
    desc: 'Scoops robots up so they cannot push back, then tips them over.',
    type: 'lifter', mount: 'front', power: 1.3, dmgType: 'kinetic', reach: 0.12, arc: 30, durability: 1.1,
    lip: 0.72, impulse: 700, reload: 2.0, hold: 2.2, damage: 5,
  },
  {
    id: 'wp_clamp', kind: 'weapon', name: 'Clamp-Lifter', tier: 3, price: 6000, weight: 14,
    desc: 'Grabs, lifts and carries. Walk them into the hazards.',
    type: 'lifter', mount: 'front', power: 2.2, dmgType: 'kinetic', reach: 0.13, arc: 30, durability: 1.2,
    lip: 0.75, impulse: 1000, reload: 2.4, hold: 3.2, grab: true, damage: 6,
  },
  {
    id: 'wp_megaflip', kind: 'weapon', name: 'Catapult Flipper', tier: 4, price: 15500, weight: 14,
    desc: 'Throws a heavyweight clean across the arena.',
    type: 'flipper', mount: 'front', power: 2.6, dmgType: 'kinetic', reach: 0.12, arc: 32, durability: 1.1,
    lip: 0.82, impulse: 950, reload: 2.8, damage: 14,
  },
  {
    id: 'wp_hydrofork', kind: 'weapon', name: 'Hydraulic Forks', tier: 4, price: 14500, weight: 15,
    desc: 'Low forks on a hydraulic arm: slide under, lift high, carry them anywhere.',
    type: 'lifter', mount: 'front', power: 3.0, dmgType: 'kinetic', reach: 0.16, arc: 32, durability: 1.35,
    lip: 0.88, impulse: 1250, reload: 2.0, hold: 3.4, grab: true, damage: 8,
  },
  {
    id: 'wp_launcher', kind: 'weapon', name: 'Launch Pad', tier: 5, price: 32000, weight: 13,
    desc: 'The pneumatic monster. Out of the arena, if there were no roof.',
    type: 'flipper', mount: 'front', power: 3.2, dmgType: 'kinetic', reach: 0.13, arc: 34, durability: 1.2,
    lip: 0.88, impulse: 1200, reload: 2.4, damage: 18,
  },

  // Overhead weapons strike the top armour, where most robots are thin.
  {
    id: 'wp_sledge', kind: 'weapon', name: 'Sledgehammer', tier: 1, price: 650, weight: 11,
    desc: 'An overhead hammer: dents the top armour and rattles the electronics.',
    type: 'hammer', mount: 'top', power: 1.4, dmgType: 'kinetic', reach: 0.62, arc: 18, durability: 1.2,
    damage: 30, reload: 3.0, stun: 0.35,
  },
  {
    id: 'wp_pickaxe', kind: 'weapon', name: 'Pickaxe', tier: 2, price: 2100, weight: 11,
    desc: 'An axe on an arm: punches through plates from above.',
    type: 'axe', mount: 'top', power: 1.8, dmgType: 'pierce', reach: 0.7, arc: 16, durability: 1.1,
    damage: 42, reload: 3.0, pierce: 0.25,
  },
  {
    id: 'wp_thwack', kind: 'weapon', name: 'Overhead Axe', tier: 3, price: 6000, weight: 13,
    desc: 'A titanium-tipped axe. Deep punctures, long reach.',
    type: 'axe', mount: 'top', power: 2.6, dmgType: 'pierce', reach: 0.78, arc: 16, durability: 1.2,
    damage: 58, reload: 2.8, pierce: 0.3,
  },
  {
    id: 'wp_pulverizer', kind: 'weapon', name: 'Pulverizer', tier: 4, price: 14000, weight: 14,
    desc: 'A hydraulic hammer that flattens top armour and stuns.',
    type: 'hammer', mount: 'top', power: 3.2, dmgType: 'kinetic', reach: 0.8, arc: 18, durability: 1.3,
    damage: 76, reload: 2.7, stun: 0.5,
  },
  {
    id: 'wp_titanhammer', kind: 'weapon', name: 'Titan Hammer', tier: 5, price: 30000, weight: 15,
    desc: 'The heaviest hammer on the circuit. Each blow a small earthquake.',
    type: 'hammer', mount: 'top', power: 4.0, dmgType: 'kinetic', reach: 0.85, arc: 18, durability: 1.4,
    damage: 100, reload: 2.5, stun: 0.6,
  },

  // Crushers bite through any armour and hold on.
  {
    id: 'wp_jaw', kind: 'weapon', name: 'Hydraulic Jaw', tier: 2, price: 2700, weight: 16,
    desc: 'A crushing beak. Bites through half the armour and holds them in place.',
    type: 'crusher', mount: 'front', power: 2.0, dmgType: 'pierce', reach: 0.18, arc: 26, durability: 1.3,
    lip: 0.55, damage: 22, dps: 22, hold: 2.5, reload: 3.2, pierce: 0.5,
  },
  {
    id: 'wp_megajaw', kind: 'weapon', name: 'Mega Crusher', tier: 4, price: 16000, weight: 18,
    desc: 'Eight tonnes of bite. Armour means little to it.',
    type: 'crusher', mount: 'front', power: 3.6, dmgType: 'pierce', reach: 0.2, arc: 28, durability: 1.4,
    lip: 0.6, damage: 40, dps: 38, hold: 3.0, reload: 2.6, pierce: 0.55,
  },

  // Saws grind steadily while they touch.
  {
    id: 'wp_buzzsaw', kind: 'weapon', name: 'Buzz Saw', tier: 1, price: 550, weight: 8,
    desc: 'A saw on an arm. Grinds the top panels while it touches.',
    type: 'saw', mount: 'top', power: 1.5, dmgType: 'cut', reach: 0.45, arc: 22, durability: 1.0,
    dps: 15,
  },
  {
    id: 'wp_twinsaw', kind: 'weapon', name: 'Twin Saws', tier: 3, price: 5000, weight: 12,
    desc: 'Two front saws that chew through plastic and aluminium.',
    type: 'saw', mount: 'front', power: 2.8, dmgType: 'cut', reach: 0.25, arc: 30, durability: 1.1,
    dps: 24, lip: 0.3,
  },
  {
    id: 'wp_armsaw', kind: 'weapon', name: 'Circular Saw Arm', tier: 4, price: 13000, weight: 11,
    desc: 'A big circular saw on a reaching arm: cuts the top panels from further away.',
    type: 'saw', mount: 'top', power: 2.6, dmgType: 'cut', reach: 0.6, arc: 26, durability: 1.15,
    dps: 26,
  },

  // Passive weapons need no power: it all goes to the wheels.
  {
    id: 'wp_plow', kind: 'weapon', name: 'Steel Plow', tier: 1, price: 300, weight: 8,
    desc: 'A plain steel wedge. Gets under, deflects horizontal spinners, pushes to the hazards.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.2, arc: 40, durability: 1.5,
    lip: 0.75, wedge: 0.75, ram: 0.45,
  },
  {
    id: 'wp_spikes', kind: 'weapon', name: 'Ram Spikes', tier: 1, price: 350, weight: 7,
    desc: 'Steel spikes on the nose. Damage grows with the speed you hit at.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.18, arc: 35, durability: 1.4,
    ram: 1.0,
  },
  {
    id: 'wp_forks', kind: 'weapon', name: 'Hinged Forks', tier: 2, price: 1500, weight: 6,
    desc: 'Knife-edge forks. Nothing gets lower.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.25, arc: 40, durability: 1.2,
    lip: 0.95, wedge: 0.95, ram: 0.25,
  },
  {
    id: 'wp_plough', kind: 'weapon', name: 'Titan Plough', tier: 4, price: 11000, weight: 10,
    desc: 'A full-width titanium plough: gets under everything and takes any hit.',
    type: 'wedge', mount: 'front', power: 0, dmgType: 'kinetic', reach: 0.25, arc: 45, durability: 2.4,
    lip: 0.95, wedge: 1.0, ram: 0.7,
  },
  {
    id: 'wp_lance', kind: 'weapon', name: 'Titanium Lance', tier: 3, price: 4400, weight: 9,
    desc: 'A long piercing ram. Fast robots turn it into a missile.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.35, arc: 30, durability: 1.5,
    ram: 1.6,
  },
  {
    id: 'wp_ramhead', kind: 'weapon', name: 'Steel Ram Head', tier: 4, price: 12500, weight: 10,
    desc: 'A heavy sprung ram head: hits like a lance and shrugs off the hit it gives.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.3, arc: 35, durability: 1.8,
    ram: 1.8,
  },
  {
    id: 'wp_battering', kind: 'weapon', name: 'Battering Ram', tier: 5, price: 28000, weight: 12,
    desc: 'A sprung tungsten ram head: rams like a lance, wedges like a plow.',
    type: 'ram', mount: 'front', power: 0, dmgType: 'pierce', reach: 0.3, arc: 35, durability: 1.8,
    ram: 2.0, lip: 0.6, wedge: 0.6,
  },

  // Flame: little direct damage, but it cooks the electronics.
  {
    id: 'wp_flame', kind: 'weapon', name: 'Flamethrower', tier: 2, price: 2000, weight: 6,
    desc: 'Cooks the electronics: overheats robots that run hot. Plastic armour hates it.',
    type: 'flame', mount: 'top', power: 0.4, dmgType: 'thermal', reach: 1.1, arc: 18, durability: 0.9,
    dps: 5, heat: 26, fuel: 14,
  },
  {
    id: 'wp_inferno', kind: 'weapon', name: 'Inferno Cannon', tier: 4, price: 13000, weight: 7,
    desc: 'A blowtorch the size of a fire hose.',
    type: 'flame', mount: 'top', power: 0.8, dmgType: 'thermal', reach: 1.3, arc: 20, durability: 1.0,
    dps: 9, heat: 40, fuel: 18,
  },
];

// ---- armour ----------------------------------------------------------------

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
    density: 1.25, hpPerLevel: 60, resist: { kinetic: 0.65, pierce: 0.7, cut: 0.6, thermal: 0.5 }, look: 'titanium',
  },
  {
    id: 'ar_composite', kind: 'armor', name: 'Kevlar Composite', tier: 4, price: 12000, weight: 0,
    desc: 'Woven aramid: axes and crushers struggle. Light, but it scorches.',
    density: 0.9, hpPerLevel: 58, resist: { kinetic: 0.6, pierce: 0.8, cut: 0.5, thermal: 0.3 }, look: 'composite',
  },
  {
    id: 'ar_nano', kind: 'armor', name: 'Nano-Laminate', tier: 5, price: 30000, weight: 0,
    desc: 'Prototype laminate. Tough against everything.',
    density: 0.95, hpPerLevel: 72, resist: { kinetic: 0.7, pierce: 0.72, cut: 0.7, thermal: 0.6 }, look: 'nano',
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
  { id: 'md_thorns', kind: 'module', name: 'Spiked Bumpers', tier: 1, price: 400, weight: 5, effect: 'thorns', value: 12,
    desc: 'Whoever rams you gets a face full of spikes.' },
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
 * parts need more: they cannot be fitted and then starved.
 */
export function minPowerOf(p: PartDef): number {
  switch (p.kind) {
    case 'brain':
      return p.minPower;
    case 'drive':
      return Math.round((0.3 + 0.04 * (p.tier - 1)) * 100) / 100;
    case 'weapon':
      if (p.power <= 0) return 0;
      return Math.round(((SPIN_TYPES.includes(p.type) ? 0.35 : 0.25) + (SPIN_TYPES.includes(p.type) ? 0.05 : 0.04) * (p.tier - 1)) * 100) / 100;
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
