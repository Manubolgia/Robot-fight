// Shared data shapes: parts in the catalogue, robot designs, events.

export type Tier = 1 | 2 | 3 | 4 | 5;
export type DmgType = 'kinetic' | 'pierce' | 'cut' | 'thermal';
export type ArmorZone = 'front' | 'sides' | 'rear' | 'top';
/** Where a hit lands on a robot. Sides are tracked separately in a fight. */
export type HitZone = 'front' | 'left' | 'right' | 'rear' | 'top';
export type PartKind = 'chassis' | 'drive' | 'core' | 'weapon' | 'armor' | 'module';

export interface PartBase {
  id: string;
  kind: PartKind;
  name: string;
  tier: Tier;
  price: number;
  /** kg */
  weight: number;
  desc: string;
}

export type ChassisShape = 'box' | 'wedge' | 'low' | 'dome' | 'tall';

export interface ChassisDef extends PartBase {
  kind: 'chassis';
  shape: ChassisShape;
  hp: number;
  /** metres */
  length: number;
  width: number;
  height: number;
  /** 0..1, how low each edge sits: low edges get under others and are hard to get under */
  low: { front: number; sides: number; rear: number };
  /** 0..1 resistance to being flipped over */
  stability: number;
  /** drives just as well upside down */
  invertible: boolean;
  /** rounded shell rolls itself back upright */
  rolls?: boolean;
  /** share of kinetic and pierce damage that glances off */
  deflect?: number;
  modules: number;
  topMount: boolean;
  /** extra reach for top weapons (tall frames) */
  topReach?: number;
  /** armour weight factors per zone (kg per plate level at density 1) */
  area: Record<ArmorZone, number>;
}

export type DriveStyle = 'wheels2' | 'wheels4' | 'wheels6' | 'treads' | 'mecanum';

export interface DriveDef extends PartBase {
  kind: 'drive';
  style: DriveStyle;
  /** rated draw, kW */
  power: number;
  /** stall force at full power, N */
  force: number;
  /** free running speed at full power, m/s */
  speed: number;
  /** traction coefficient */
  grip: number;
  /** max turn rate, rad/s */
  turn: number;
  /** sideways grip relative to grip (mecanum wheels slide) */
  lateral: number;
  strafe?: boolean;
  durability: number;
}

export interface CoreDef extends PartBase {
  kind: 'core';
  /** kW available to share between systems */
  output: number;
  /** heat shed per second */
  cooling: number;
  /** can catch fire when badly damaged */
  volatile?: boolean;
  durability: number;
}

export type WeaponType =
  | 'vspin' // vertical disc / eggbeater
  | 'drum'
  | 'hspin' // horizontal bar / undercutter
  | 'ring' // full body ring spinner
  | 'flipper'
  | 'lifter'
  | 'hammer'
  | 'axe'
  | 'crusher'
  | 'saw'
  | 'wedge'
  | 'ram'
  | 'flame';

export type WeaponMount = 'front' | 'top' | 'full';

export interface WeaponDef extends PartBase {
  kind: 'weapon';
  type: WeaponType;
  mount: WeaponMount;
  /** rated draw, kW (0 for passive weapons) */
  power: number;
  dmgType: DmgType;
  /** metres beyond the frame's edge */
  reach: number;
  /** half angle of the striking zone, degrees */
  arc: number;
  durability: number;
  /** how low the leading edge is (0..1), for getting under */
  lip?: number;
  // spinners
  energy?: number; // kJ stored at full speed
  bite?: number; // share of stored energy delivered per hit
  gyro?: number; // turning penalty while spun up
  recoil?: number;
  launch?: number; // upward share of the knock
  /** spinners aimed at wheels: share of damage that goes to the drive */
  lowHit?: number;
  // active strikes
  damage?: number;
  reload?: number; // seconds at full power
  impulse?: number; // N*s for flippers and lifters
  stun?: number; // seconds
  hold?: number; // seconds a lifter or crusher holds on
  grab?: boolean; // clamps and carries
  pierce?: number; // share of armour ignored
  // continuous
  dps?: number;
  heat?: number; // heat added per second (flame)
  fuel?: number; // seconds of flame
  // passive
  wedge?: number;
  ram?: number;
}

export interface ArmorDef extends PartBase {
  kind: 'armor';
  /** weight factor per plate level */
  density: number;
  /** integrity per plate level per zone */
  hpPerLevel: number;
  /** share of incoming damage the plates soak up while they last */
  resist: Record<DmgType, number>;
  look: 'alu' | 'steel' | 'uhmw' | 'titanium' | 'composite' | 'nano';
}

export type ModuleEffect =
  | 'selfright'
  | 'wedgelets'
  | 'skirts'
  | 'heatsink'
  | 'magnets'
  | 'shock'
  | 'gyro'
  | 'ablative'
  | 'thorns'
  | 'guard'
  | 'capacitor'
  | 'targeting'
  | 'coolant'
  | 'reactive'
  | 'redundant';

export interface ModuleDef extends PartBase {
  kind: 'module';
  effect: ModuleEffect;
  power?: number;
  value?: number;
}

export type PartDef = ChassisDef | DriveDef | CoreDef | WeaponDef | ArmorDef | ModuleDef;

export interface Paint {
  primary: string;
  secondary: string;
  /** decal / pattern on the top panel */
  pattern: 'plain' | 'stripes' | 'checker' | 'flames' | 'hazard' | 'camo' | 'bolt';
}

/** Share of each system's rated draw it is given: 0..1.3 */
export interface PowerSplit {
  drive: number;
  front: number;
  top: number;
  aux: number;
}

export interface BotDesign {
  id: string;
  name: string;
  chassis: string;
  drive: string;
  core: string;
  front: string | null;
  top: string | null;
  armor: { material: string } & Record<ArmorZone, number>;
  modules: string[];
  power: PowerSplit;
  paint: Paint;
}

/** Damage carried between fights of a tournament: everything 0..1 of full. */
export interface Wear {
  hp: number;
  armor: Record<HitZone, number>;
  comp: { drive: number; front: number; top: number; core: number };
  shield: number;
}

export const ZONES: HitZone[] = ['front', 'left', 'right', 'rear', 'top'];
export const ARMOR_ZONES: ArmorZone[] = ['front', 'sides', 'rear', 'top'];
export const MAX_PLATES = 5;
export const WEIGHT_LIMIT = 100;
