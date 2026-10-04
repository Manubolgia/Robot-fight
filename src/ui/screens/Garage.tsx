import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { MAX_BOTS, activeBot, addBot, buy, levelOf, levels, owns, removeBot, type Career } from '../../career/career.ts';
import { ARMORS, BRAINS, CHASSIS, CORES, DRIVES, MODULES, WEAPONS, WEAPON_FAMILY, minPowerOf, part } from '../../data/parts.ts';
import type { ArmorZone, BattlePlan, BotDesign, BrainDef, BrainTrait, PartDef, PowerSplit, WeaponDef } from '../../data/types.ts';
import { MAX_PLATES, WEIGHT_LIMIT } from '../../data/types.ts';
import { ARMOR_KG, MAX_POWER, autoPower, computeStats, coreOutput, designWeight, minShares, powerDraw, ratedDraw, readout, scaledHp, validate, weaponSpecs, type Readout } from '../../sim/stats.ts';
import { sfx } from '../../audio/sfx.ts';
import { Btn, Pips, Stat, Stepper, TabBar, Tip, TopBar, confirm, fmtMoney } from '../components.tsx';
import { Icon, partIcon } from '../icons.tsx';
import { Stage } from '../stage.tsx';
import { app, go, toast, update, useApp } from '../store.ts';
import { PaintPicker } from './NewGame.tsx';

type Tab = 'frame' | 'drive' | 'core' | 'weapons' | 'armor' | 'modules' | 'brain' | 'power' | 'plan' | 'paint' | 'stats';
const TABS: Array<[Tab, string, string]> = [
  ['frame', 'frame', 'Frame'],
  ['drive', 'wheel', 'Drive'],
  ['core', 'battery', 'Core'],
  ['weapons', 'target', 'Weapons'],
  ['armor', 'shield', 'Armour'],
  ['modules', 'chip', 'Modules'],
  ['brain', 'brain', 'Brain'],
  ['power', 'bolt', 'Power'],
  ['plan', 'flag', 'Plan'],
  ['paint', 'brush', 'Paint'],
  ['stats', 'speed', 'Stats'],
];

/** The bot in the career with this id, for screens that edit a robot that may not be the active one. */
const botIn = (cc: Career, id: string) => cc.bots.find((b) => b.id === id) ?? activeBot(cc);

/** Keep the power split legal after a change: rebalance only if it no longer fits. */
export function fixPower(d: BotDesign, c: Career) {
  const r = ratedDraw(d);
  const mins = minShares(d);
  if (!r.front) d.power.front = 1;
  if (!r.top) d.power.top = 1;
  if (!r.aux) d.power.aux = 1;
  // a new part may need more than the old one ran on
  d.power.drive = Math.max(d.power.drive, mins.drive);
  d.power.brain = Math.max(d.power.brain, mins.brain);
  if (r.aux && d.power.aux > 0) d.power.aux = Math.max(d.power.aux, mins.aux);
  if (powerDraw(d) > coreOutput(d, levels(c)) + 1e-6) d.power = autoPower(d, levels(c));
}

function withPart(d: BotDesign, fn: (x: BotDesign) => void): BotDesign {
  const x = structuredClone(d);
  fn(x);
  return x;
}

export function Garage() {
  const a = useApp();
  const c = a.career!;
  const bot = activeBot(c);
  const [tab, setTab] = useState<Tab>((a.params.tab as Tab) ?? 'frame');
  const lv = levels(c);
  const r = readout(bot, lv);
  const issues = validate(bot, lv);
  const over = r.weight > WEIGHT_LIMIT + 1e-6;
  const pOver = r.draw > r.output + 1e-6;
  const inEvent = c.tournament?.botId === bot.id;

  return (
    <div class="screen">
      <TopBar title="Garage" sub={inEvent ? 'Pit lane · between fights' : `${c.bots.length}/${MAX_BOTS} robots`} back={a.params.back as 'prefight' | undefined} />
      <div class="botpicker">
        {c.bots.map((b) => (
          <button key={b.id} class={b.id === bot.id ? 'on' : ''} onClick={() => { sfx.click(); update((cc) => (cc.active = b.id)); }}>
            <span class="ellipsis">{b.name}</span>
          </button>
        ))}
        {c.bots.length < MAX_BOTS && (
          <button
            onClick={() => {
              sfx.select();
              update((cc) => {
                const nb = addBot(cc, activeBot(cc));
                if (nb) cc.active = nb.id;
              });
              toast('New robot copied from the current one');
            }}
          >
            <Icon name="plus" size={16} /> New
          </button>
        )}
      </div>
      <div class="garage-stage">
        <Stage design={bot} zoom={1} />
        <div class="over">
          <div>
            <div class="display" style={{ fontSize: '19px', textShadow: '0 2px 6px #000' }}>
              {bot.name}
            </div>
            <div class="tiny" style={{ color: 'var(--cyan)', letterSpacing: '0.12em', textTransform: 'uppercase', textShadow: '0 1px 4px #000' }}>
              {r.label}
            </div>
          </div>
          <span class="tiny muted" style={{ textShadow: '0 1px 4px #000' }}>
            drag to turn
          </span>
        </div>
      </div>
      <div class="budget">
        <div class={`meter weight ${over ? 'over' : ''}`}>
          <i style={{ width: `${Math.min(100, (r.weight / WEIGHT_LIMIT) * 100)}%` }} />
          <div class="txt">
            <span>
              <Icon name="weight" size={12} /> WEIGHT
            </span>
            <span>
              {r.weight.toFixed(1)}/{WEIGHT_LIMIT} kg
            </span>
          </div>
        </div>
        <div class={`meter power ${pOver ? 'over' : ''}`}>
          <i style={{ width: `${Math.min(100, (r.draw / Math.max(0.1, r.output)) * 100)}%` }} />
          <div class="txt">
            <span>
              <Icon name="bolt" size={12} /> POWER
            </span>
            <span>
              {r.draw.toFixed(1)}/{r.output.toFixed(1)} kW
            </span>
          </div>
        </div>
      </div>
      <div class="subtabs">
        {TABS.map(([id, icon, label]) => (
          <button key={id} class={tab === id ? 'on' : ''} onClick={() => { sfx.click(); setTab(id); }}>
            <Icon name={icon} size={14} /> {label}
          </button>
        ))}
      </div>
      <div class="scroll" key={`${tab}-${bot.id}`}>
        {issues.length > 0 && (
          <div class="col" style={{ gap: '6px', marginBottom: '10px' }}>
            {issues.map((i) => (
              <div class={`issue ${i.level === 'warn' ? 'warn' : ''}`} key={i.text}>
                <Icon name="info" size={16} /> {i.text}
              </div>
            ))}
          </div>
        )}
        {tab === 'frame' && <PartList c={c} bot={bot} parts={CHASSIS} current={bot.chassis} apply={(d, id) => (d.chassis = id, trimForFrame(d))} />}
        {tab === 'drive' && <PartList c={c} bot={bot} parts={DRIVES} current={bot.drive} apply={(d, id) => (d.drive = id)} />}
        {tab === 'core' && (
          <>
            <Tip id="core">Heavier cores give more power. Power runs your drive and your weapons: see the Power tab to split it.</Tip>
            <PartList c={c} bot={bot} parts={CORES} current={bot.core} apply={(d, id) => (d.core = id)} />
          </>
        )}
        {tab === 'weapons' && <WeaponsTab c={c} bot={bot} />}
        {tab === 'armor' && <ArmorTab c={c} bot={bot} />}
        {tab === 'modules' && <ModulesTab c={c} bot={bot} />}
        {tab === 'brain' && <BrainTab c={c} bot={bot} />}
        {tab === 'power' && <PowerTab c={c} bot={bot} />}
        {tab === 'plan' && <PlanTab bot={bot} />}
        {tab === 'paint' && <PaintTab c={c} bot={bot} />}
        {tab === 'stats' && <StatsTab r={r} bot={bot} c={c} />}
      </div>
      {!a.params.back && <TabBar />}
      {a.params.back && (
        <div style={{ padding: '8px 16px calc(10px + var(--sab))', borderTop: '1px solid var(--line)' }}>
          <Btn kind="primary" wide disabled={issues.some((i) => i.level === 'error')} onClick={() => go('prefight')}>
            Back to the pit
          </Btn>
        </div>
      )}
    </div>
  );
}

/** A new frame may have fewer bays or no top mount. */
function trimForFrame(d: BotDesign) {
  const ch = part<{ modules: number; topMount: boolean } & PartDef>(d.chassis);
  if (d.modules.length > ch.modules) d.modules = d.modules.slice(0, ch.modules);
  if (!ch.topMount && d.top) d.top = null;
}

// ---- part rows --------------------------------------------------------------------------

function deltaLine(before: Readout, after: Readout): ComponentChildren {
  const items: Array<[string, number, number, string]> = [
    ['kg', after.weight - before.weight, 0.05, 'kg'],
    ['Speed', (after.topSpeed - before.topSpeed) * 3.6, 0.2, 'km/h'],
    ['Push', (after.push - before.push) / 1000, 0.02, 'kN'],
    ['HP', after.hp - before.hp, 1, ''],
    ['Armour', after.armorAvg - before.armorAvg, 1, ''],
    ['Hit', after.hitDamage - before.hitDamage, 1, ''],
    ['Thinks', 1 / after.reaction - 1 / before.reaction, 0.05, '/s'],
    ['Aim', (after.aim - before.aim) * 100, 0.5, '%'],
    ['Reads arena', (after.awareness - before.awareness) * 100, 0.5, '%'],
  ];
  const shown = items.filter(([, v, eps]) => Math.abs(v) >= eps);
  if (!shown.length) return null;
  return (
    <div class="specs" style={{ marginTop: '4px' }}>
      {shown.map(([k, v, , unit]) => {
        const good = k === 'kg' ? v < 0 : v > 0;
        return (
          <span key={k} class={good ? 'up' : 'down'}>
            {k === 'kg' ? '' : `${k} `}
            {v > 0 ? '+' : ''}
            {Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)}
            {unit ? ` ${unit}` : ''}
          </span>
        );
      })}
    </div>
  );
}

export function specsOf(p: PartDef): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (p.kind !== 'armor') out.push(['weight', `${p.weight} kg`]);
  switch (p.kind) {
    case 'chassis':
      out.push(['heart', `${scaledHp(p.hp)} HP`], ['chip', `${p.modules} bays`]);
      if (p.topMount) out.push(['hammer', 'top mount']);
      if (p.invertible) out.push(['flip', 'invertible']);
      if (p.rolls) out.push(['turn', 'self-rolling']);
      break;
    case 'drive':
      out.push(['bolt', `${p.power} kW`], ['speed', `${(p.speed * 3.6).toFixed(0)} km/h`], ['push', `${(p.force / 1000).toFixed(2)} kN`], ['turn', `${Math.round((p.turn * 180) / Math.PI)}°/s`]);
      if (p.strafe) out.push(['next', 'strafes']);
      break;
    case 'core':
      out.push(['bolt', `${p.output} kW out`], ['heat', `cools ${p.cooling}/s`]);
      if (p.volatile) out.push(['fire', 'volatile']);
      break;
    case 'weapon':
      if (p.power) out.push(['bolt', `${p.power} kW`]);
      if (p.energy) out.push(['spinner', `${p.energy} kJ`]);
      out.push(...weaponSpecs(p));
      if (p.impulse) out.push(['flip', `${p.impulse} N·s`]);
      if (p.reload) out.push(['turn', `${p.reload}s reload`]);
      if (p.wedge) out.push(['wedge', `wedge ${Math.round(p.wedge * 100)}`]);
      if (p.heat) out.push(['heat', `+${p.heat} heat/s`]);
      out.push(['next', `${p.reach} m reach`]);
      break;
    case 'armor':
      out.push(['weight', `×${p.density} weight`], ['shield', `${scaledHp(p.hpPerLevel)}/plate`]);
      break;
    case 'module':
      if (p.power) out.push(['bolt', `${p.power} kW`]);
      break;
    case 'brain':
      out.push(['bolt', `${p.power} kW · min ${Math.round(p.minPower * 100)}%`], ['speed', `${(1 / p.reaction).toFixed(1)} decisions/s`], ['target', `aim ${Math.round(p.aim * 100)}%`], ['globe', `reads arena ${Math.round(p.awareness * 100)}%`]);
      if (p.trait) out.push(['star', TRAIT_LABEL[p.trait]]);
      break;
  }
  if ((p.kind === 'weapon' || p.kind === 'drive') && minPowerOf(p) > 0) out.push(['boltO', `runs from ${Math.round(minPowerOf(p) * 100)}%`]);
  return out;
}

export const TRAIT_LABEL: Record<BrainTrait, string> = { reckless: 'reckless', cautious: 'cautious', hunter: 'hunter', adaptive: 'adaptive' };
export const TRAIT_TEXT: Record<BrainTrait, string> = {
  reckless: 'Reckless: never backs off and pays no mind to the hazards.',
  cautious: 'Cautious: keeps its weapon between it and trouble, backs off when exposed.',
  hunter: 'Hunter: circles to the sides and rear before it strikes.',
  adaptive: 'Adaptive: reads the other robot and strikes right after it commits.',
};

function PartRow({ c, bot, p, equipped, onEquip, onRemove, note, preview }: { c: Career; bot: BotDesign; p: PartDef; equipped: boolean; onEquip: () => void; onRemove?: () => void; note?: string; preview?: (d: BotDesign, id: string) => void }) {
  const have = owns(c, p.id);
  const locked = p.tier > c.tier;
  const lvl = levelOf(c, p.id);
  return (
    <div
      class={`card ${equipped ? 'sel' : ''} ${locked ? 'locked' : ''} ${have && !equipped ? 'tap' : ''}`}
      onClick={() => {
        if (have && !equipped) onEquip();
      }}
      style={{ cursor: have && !equipped ? 'pointer' : 'default' }}
    >
      <div class="part">
        <div class="ic">
          <Icon name={partIcon(p.kind, (p as WeaponDef).type)} />
        </div>
        <div class="grow">
          <h3>
            {p.name}
            {have && lvl > 1 && <span class="badge gold">Mk {lvl}</span>}
          </h3>
          <div class="row" style={{ gap: '6px', marginTop: '3px' }}>
            <span class={`badge t${p.tier}`}>T{p.tier}</span>
            {p.kind === 'weapon' && <span class="badge">{WEAPON_FAMILY[(p as WeaponDef).type]}</span>}
            {note && <span class="badge">{note}</span>}
          </div>
          <div class="desc">{p.desc}</div>
          <div class="specs">
            {specsOf(p).map(([icon, t]) => (
              <span key={t}>
                <Icon name={icon} size={12} /> {t}
              </span>
            ))}
          </div>
          {!equipped && !locked && preview && <PartDelta c={c} bot={bot} p={p} apply={preview} />}
        </div>
      </div>
      <div class="row" style={{ marginTop: '10px', justifyContent: 'flex-end', gap: '8px' }}>
        {equipped ? (
          <>
            <span class="badge cyan">
              <Icon name="check" size={12} /> Fitted
            </span>
            {onRemove && (
              <Btn size="xs" kind="ghost" onClick={onRemove}>
                Remove
              </Btn>
            )}
          </>
        ) : have ? (
          <Btn size="sm" onClick={onEquip}>
            Fit
          </Btn>
        ) : locked ? (
          <span class="badge">
            <Icon name="lock" size={12} /> Tier {p.tier} licence
          </span>
        ) : (
          <Btn
            size="sm"
            kind="primary"
            disabled={c.money < p.price}
            sound="none"
            onClick={() => {
              let ok = false;
              update((cc) => {
                ok = buy(cc, p.id);
              });
              if (ok) {
                sfx.buy();
                toast(`Bought ${p.name}`, 'gold');
                onEquip();
              } else sfx.error();
            }}
          >
            Buy {fmtMoney(p.price)}
          </Btn>
        )}
      </div>
    </div>
  );
}

function PartDelta({ c, bot, p, apply }: { c: Career; bot: BotDesign; p: PartDef; apply: (d: BotDesign, id: string) => void }) {
  const after = withPart(bot, (x) => {
    apply(x, p.id);
    fixPower(x, c);
  });
  return <>{deltaLine(readout(bot, levels(c)), readout(after, levels(c)))}</>;
}

function sortParts<T extends PartDef>(c: Career, list: T[], current: string | null): T[] {
  return [...list].sort((a, b) => {
    const ka = (a.id === current ? -1000 : 0) + (owns(c, a.id) ? -100 : 0) + (a.tier > c.tier ? 100 : 0) + a.tier * 2 + a.price / 1e6;
    const kb = (b.id === current ? -1000 : 0) + (owns(c, b.id) ? -100 : 0) + (b.tier > c.tier ? 100 : 0) + b.tier * 2 + b.price / 1e6;
    return ka - kb;
  });
}

function PartList<T extends PartDef>({ c, bot, parts, current, apply, filter }: { c: Career; bot: BotDesign; parts: T[]; current: string | null; apply: (d: BotDesign, id: string) => void; filter?: (p: T) => boolean }) {
  const list = sortParts(c, parts.filter((p) => !filter || filter(p)), current).filter((p) => p.tier <= c.tier + 1 || owns(c, p.id));
  return (
    <div class="list">
      {list.map((p) => (
        <PartRow
          key={p.id}
          c={c}
          bot={bot}
          p={p}
          equipped={p.id === current}
          preview={apply}
          onEquip={() => {
            sfx.equip();
            update((cc) => {
              const b = activeBot(cc);
              apply(b, p.id);
              fixPower(b, cc);
            });
          }}
        />
      ))}
    </div>
  );
}

// ---- weapons ----------------------------------------------------------------------------

function WeaponsTab({ c, bot }: { c: Career; bot: BotDesign }) {
  const [slot, setSlot] = useState<'front' | 'top'>('front');
  const ch = part<{ topMount: boolean } & PartDef>(bot.chassis);
  const ring = bot.front && part<WeaponDef>(bot.front).mount === 'full';
  const apply = slot === 'front' ? (d: BotDesign, id: string) => {
    d.front = id;
    if (part<WeaponDef>(id).mount === 'full') d.top = null;
  } : (d: BotDesign, id: string) => (d.top = id);
  const pool = WEAPONS.filter((w) => (slot === 'front' ? w.mount !== 'top' : w.mount === 'top'));
  const current = slot === 'front' ? bot.front : bot.top;
  const list = sortParts(c, pool, current).filter((p) => p.tier <= c.tier + 1 || owns(c, p.id));
  return (
    <>
      <div class="seg" style={{ marginBottom: '10px' }}>
        <button class={slot === 'front' ? 'on' : ''} onClick={() => { sfx.click(); setSlot('front'); }}>
          Front · {bot.front ? part(bot.front).name : 'empty'}
        </button>
        <button class={slot === 'top' ? 'on' : ''} onClick={() => { sfx.click(); setSlot('top'); }}>
          Top · {bot.top ? part(bot.top).name : ch.topMount ? 'empty' : 'no mount'}
        </button>
      </div>
      <Tip id="weapons">
        Spinners store energy and need time to spin back up. Flippers and lifters win by control. Hammers and axes strike the top armour. A wedge on the front with a hammer on top is a classic.
      </Tip>
      {slot === 'top' && !ch.topMount ? (
        <div class="empty">
          <Icon name="lock" size={28} />
          <div style={{ marginTop: '8px' }}>This frame has no top mount. Box, wedge and tower frames do.</div>
        </div>
      ) : slot === 'top' && ring ? (
        <div class="empty">A ring spinner wraps the whole robot: there is no room on top.</div>
      ) : (
        <div class="list">
          {list.map((p) => (
            <PartRow
              key={p.id}
              c={c}
              bot={bot}
              p={p}
              equipped={p.id === current}
              preview={apply}
              onEquip={() => {
                sfx.equip();
                update((cc) => {
                  const b = activeBot(cc);
                  apply(b, p.id);
                  fixPower(b, cc);
                });
              }}
              onRemove={() => {
                sfx.click();
                update((cc) => {
                  const b = activeBot(cc);
                  if (slot === 'front') b.front = null;
                  else b.top = null;
                  fixPower(b, cc);
                });
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---- armour -----------------------------------------------------------------------------

const ZONE_LABEL: Record<ArmorZone, string> = { front: 'Front', sides: 'Sides', rear: 'Rear', top: 'Top' };

function ArmorTab({ c, bot }: { c: Career; bot: BotDesign }) {
  const ch = part<{ area: Record<ArmorZone, number> } & PartDef>(bot.chassis);
  const ar = part<{ density: number; hpPerLevel: number; resist: Record<string, number> } & PartDef>(bot.armor.material);
  const s = computeStats(bot, levels(c));
  const room = WEIGHT_LIMIT - designWeight(bot);
  return (
    <>
      <Tip id="armor">
        Plates soak up a share of each hit until they are smashed off. Each zone is hit by different things: spinners hit the front and sides, hammers and crushers the top. Plates cost weight.
      </Tip>
      <div class="zone-grid">
        {(['front', 'sides', 'rear', 'top'] as ArmorZone[]).map((z) => {
          const kg = ar.density * ch.area[z] * ARMOR_KG * (z === 'sides' ? 1 : 1);
          const n = bot.armor[z];
          return (
            <div class="zone" key={z}>
              <div class="row">
                <b class="grow">{ZONE_LABEL[z]}</b>
                <span class="tiny muted">{kg.toFixed(1)} kg/plate</span>
              </div>
              <Pips n={n} max={MAX_PLATES} />
              <div class="row">
                <span class="small grow">{Math.round(z === 'sides' ? s.armorMax.left : s.armorMax[z as 'front'])} pts</span>
                <Stepper
                  value={n}
                  min={0}
                  max={MAX_PLATES}
                  onChange={(v) => {
                    if (v > n && kg > room + 1e-6) {
                      toast(`Too heavy: ${room.toFixed(1)} kg left`, 'bad');
                      sfx.error();
                      return;
                    }
                    update((cc) => (activeBot(cc).armor[z] = v));
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div class="row" style={{ marginTop: '10px', gap: '8px' }}>
        <Btn size="sm" class="grow" onClick={() => update((cc) => fillArmor(activeBot(cc)))}>
          Fill to the limit
        </Btn>
        <Btn size="sm" kind="ghost" class="grow" onClick={() => update((cc) => Object.assign(activeBot(cc).armor, { front: 0, sides: 0, rear: 0, top: 0 }))}>
          Strip all
        </Btn>
      </div>
      <div class="section-title">Material</div>
      <div class="list">
        {sortParts(c, ARMORS, bot.armor.material)
          .filter((p) => p.tier <= c.tier + 1 || owns(c, p.id))
          .map((p) => (
            <PartRow
              key={p.id}
              c={c}
              bot={bot}
              p={p}
              equipped={p.id === bot.armor.material}
              preview={(d, id) => (d.armor.material = id)}
              note={`kin ${Math.round(p.resist.kinetic * 100)} · prc ${Math.round(p.resist.pierce * 100)} · cut ${Math.round(p.resist.cut * 100)} · heat ${Math.round(p.resist.thermal * 100)}`}
              onEquip={() => {
                sfx.equip();
                update((cc) => {
                  const b = activeBot(cc);
                  b.armor.material = p.id;
                  // keep it legal: shed plates if the new material is heavier
                  while (designWeight(b) > WEIGHT_LIMIT) {
                    const z = (['top', 'rear', 'sides', 'front'] as ArmorZone[]).find((k) => b.armor[k] > 0);
                    if (!z) break;
                    b.armor[z]--;
                  }
                });
              }}
            />
          ))}
      </div>
    </>
  );
}

/** Add plates round the robot until the weight limit, front and sides first. */
export function fillArmor(b: BotDesign) {
  const order: ArmorZone[] = ['front', 'sides', 'front', 'sides', 'rear', 'top'];
  let added = true;
  while (added) {
    added = false;
    for (const z of order) {
      if (b.armor[z] >= MAX_PLATES) continue;
      b.armor[z]++;
      if (designWeight(b) > WEIGHT_LIMIT) b.armor[z]--;
      else added = true;
    }
  }
}

// ---- modules ----------------------------------------------------------------------------

function ModulesTab({ c, bot }: { c: Career; bot: BotDesign }) {
  const ch = part<{ modules: number } & PartDef>(bot.chassis);
  const full = bot.modules.length >= ch.modules;
  const list = sortParts(c, MODULES, null).filter((p) => p.tier <= c.tier + 1 || owns(c, p.id));
  list.sort((a, b) => (bot.modules.includes(b.id) ? 1 : 0) - (bot.modules.includes(a.id) ? 1 : 0));
  return (
    <>
      <div class="row" style={{ marginBottom: '10px' }}>
        <span class="label grow">
          Bays used: {bot.modules.length}/{ch.modules}
        </span>
        <Pips n={bot.modules.length} max={ch.modules} cls="cyan" />
      </div>
      <div class="list">
        {list.map((p) => {
          const on = bot.modules.includes(p.id);
          return (
            <PartRow
              key={p.id}
              c={c}
              bot={bot}
              p={p}
              equipped={on}
              preview={full ? undefined : (d, id) => {
                if (!d.modules.includes(id)) d.modules.push(id);
              }}
              onEquip={() => {
                if (full) {
                  toast('All module bays are full', 'bad');
                  sfx.error();
                  return;
                }
                sfx.equip();
                update((cc) => {
                  const b = activeBot(cc);
                  if (!b.modules.includes(p.id)) b.modules.push(p.id);
                  fixPower(b, cc);
                });
              }}
              onRemove={() => {
                sfx.click();
                update((cc) => {
                  const b = activeBot(cc);
                  b.modules = b.modules.filter((m) => m !== p.id);
                  fixPower(b, cc);
                });
              }}
            />
          );
        })}
      </div>
    </>
  );
}

// ---- power ----------------------------------------------------------------------------

export function PowerTab({ c, bot }: { c: Career; bot: BotDesign }) {
  const lv = levels(c);
  const rated = ratedDraw(bot);
  const mins = minShares(bot);
  const out = coreOutput(bot, lv);
  const draw = powerDraw(bot);
  const s = computeStats(bot, lv);
  const r = readout(bot, lv);
  // a weapon or the modules can be switched off; the drive and the brain cannot
  const rows: Array<{ key: keyof PowerSplit; label: string; icon: string; kw: number; min: number; off: boolean; effect: string }> = [];
  rows.push({ key: 'drive', label: `Drive · ${part(bot.drive).name}`, icon: 'wheel', kw: rated.drive, min: mins.drive, off: false, effect: `${(s.driveSpeed * 3.6).toFixed(1)} km/h · ${(s.driveForce / 1000).toFixed(2)} kN · ${Math.round((s.turnRate * 180) / Math.PI)}°/s` });
  if (rated.front && s.front) rows.push({ key: 'front', label: `Front · ${s.front.def.name}`, icon: partIcon('weapon', s.front.def.type), kw: rated.front, min: mins.front, off: true, effect: weaponEffect(s.front) });
  if (rated.top && s.top) rows.push({ key: 'top', label: `Top · ${s.top.def.name}`, icon: partIcon('weapon', s.top.def.type), kw: rated.top, min: mins.top, off: true, effect: weaponEffect(s.top) });
  if (rated.aux) rows.push({ key: 'aux', label: 'Modules', icon: 'chip', kw: rated.aux, min: mins.aux, off: true, effect: bot.power.aux > 0 ? 'magnets and sensors' : 'switched off' });
  rows.push({ key: 'brain', label: `Brain · ${s.brain.name}`, icon: 'brain', kw: rated.brain, min: mins.brain, off: false, effect: `${(1 / r.reaction).toFixed(1)} decisions/s · aim ${Math.round(r.aim * 100)}%` });
  const heat = s.driveHeat + s.brainHeat + (s.front?.overvoltHeat ?? 0) + (s.top?.overvoltHeat ?? 0);
  return (
    <>
      <Tip id="power">
        Your core makes a fixed amount of power. Give a system less and it gets weaker; push it past 100% (overvolt) and it gets stronger but builds heat. Every part needs a minimum (the red mark): below it a weapon is switched off, and the drive and the brain will not go lower. Overheat and everything runs at half power, which can drop a brain kept at its minimum into a reboot.
      </Tip>
      <div class="card" style={{ marginBottom: '10px' }}>
        <div class="row">
          <Icon name="battery" style={{ color: 'var(--cyan)' }} />
          <div class="grow">
            <b>{part(bot.core).name}</b>
            <div class="small muted">
              Using {draw.toFixed(2)} of {out.toFixed(2)} kW · {(out - draw).toFixed(2)} kW spare
            </div>
          </div>
          <Btn size="xs" onClick={() => update((cc) => (botIn(cc, bot.id).power = autoPower(botIn(cc, bot.id), levels(cc))))}>
            Auto
          </Btn>
        </div>
        <div class="row" style={{ marginTop: '8px' }}>
          <Icon name="heat" size={16} style={{ color: heat > s.cooling ? 'var(--orange)' : 'var(--muted)' }} />
          <span class="small" style={{ color: heat > s.cooling ? 'var(--orange)' : 'var(--muted)' }}>
            Overvolt heat {heat.toFixed(1)}/s at full use · cooling {s.cooling.toFixed(1)}/s
          </span>
        </div>
      </div>
      <div class="list">
        {rows.map((row) => {
          const v = bot.power[row.key];
          const others = draw - row.kw * v;
          const maxByCore = row.kw > 0 ? (out - others) / row.kw : MAX_POWER;
          const max = Math.max(row.min, Math.min(MAX_POWER, Math.floor(maxByCore * 20 + 1e-6) / 20));
          const low = v < row.min - 1e-9;
          return (
            <div class="power-row" key={row.key}>
              <div class="head">
                <Icon name={row.icon} size={18} style={{ color: 'var(--accent)' }} />
                <b class="ellipsis small">{row.label}</b>
                <span class={`pct ${v > 1 ? 'over' : ''}`} style={low ? { color: 'var(--red)' } : undefined}>
                  {v <= 0 ? 'OFF' : `${Math.round(v * 100)}%`}
                </span>
              </div>
              <div class="slider-wrap">
                <input
                  class="slider"
                  type="range"
                  min={0}
                  max={130}
                  step={5}
                  value={Math.round(v * 100)}
                  style={{ '--p': `${(v / 1.3) * 100}%`, '--fill': v > 1 ? 'var(--orange)' : 'var(--cyan)' }}
                  onInput={(e) => {
                    let nv = Number((e.target as HTMLInputElement).value) / 100;
                    // below the minimum: off if it can be, else held at the minimum
                    if (nv < row.min - 1e-9) nv = row.off && nv < row.min / 2 ? 0 : row.min;
                    nv = Math.min(max, nv);
                    (e.target as HTMLInputElement).value = String(Math.round(nv * 100));
                    update((cc) => (botIn(cc, bot.id).power[row.key] = Math.round(nv * 20) / 20));
                  }}
                />
                {row.min > 0 && <i class="min-mark" style={{ left: `calc(13px + (100% - 26px) * ${row.min / 1.3})` }} />}
              </div>
              <div class="row tiny muted">
                <span class="grow">{row.effect}</span>
                <span>
                  {(row.kw * v).toFixed(2)} kW · min {Math.round(row.min * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---- brain ------------------------------------------------------------------------------

function BrainTab({ c, bot }: { c: Career; bot: BotDesign }) {
  const r = readout(bot, levels(c));
  const b = part<BrainDef>(bot.brain);
  return (
    <>
      <Tip id="brain">
        The brain fights the robot for you. A sharper one reacts sooner, aims and times its weapon better and reads the hazards, but it draws power your weapons and wheels could have had, and it weighs more. Each needs a minimum share of its power: lose power mid-fight (core damage, overheating) below that and it reboots, frozen for a moment.
      </Tip>
      <div class="card col" style={{ gap: '6px', marginBottom: '10px' }}>
        <div class="row">
          <Icon name="brain" style={{ color: 'var(--cyan)' }} />
          <b class="grow">{b.name}</b>
          {b.trait && <span class="badge cyan">{TRAIT_LABEL[b.trait]}</span>}
        </div>
        <Stat icon="speed" label="Decisions" value={1 / r.reaction} max={12} unit="/s" fmt={(v) => v.toFixed(1)} color="yellow" />
        <Stat icon="target" label="Aim" value={r.aim * 100} max={100} unit="%" fmt={(v) => v.toFixed(0)} />
        <Stat icon="globe" label="Reads arena" value={r.awareness * 100} max={100} unit="%" fmt={(v) => v.toFixed(0)} color="green" />
        {b.trait && <div class="small muted">{TRAIT_TEXT[b.trait]}</div>}
        <div class="tiny muted">At {Math.round(bot.power.brain * 100)}% power. Overvolt it in the Power tab to think faster; it heats up.</div>
      </div>
      <PartList c={c} bot={bot} parts={BRAINS} current={bot.brain} apply={(d, id) => (d.brain = id)} />
    </>
  );
}

// ---- battle plan ------------------------------------------------------------------------

const STANCES: Array<[BattlePlan['stance'], string, string]> = [
  ['aggressive', 'Aggressive', 'Presses even with a half-ready weapon, never gives ground. Judges love it; spinners and hammers punish it.'],
  ['balanced', 'Balanced', 'Attacks when its weapon is ready, gives ground while it is not.'],
  ['defensive', 'Defensive', 'Waits for clean openings and backs off when hurt. Safer, but it scores less aggression.'],
];
const APPROACHES: Array<[BattlePlan['approach'], string, string]> = [
  ['direct', 'Head-on', 'Straight at them, weapon first.'],
  ['flank', 'Flank', 'Circles to their side or rear before striking: good against front-heavy weapons, slow against fast robots.'],
  ['counter', 'Counter', 'Keeps its distance until they commit or their weapon is spent, then punishes.'],
];

export function PlanTab({ bot }: { bot: BotDesign }) {
  const plan = bot.plan;
  const set = (p: Partial<BattlePlan>) => {
    sfx.click();
    update((cc) => {
      const b = botIn(cc, bot.id);
      b.plan = { ...b.plan, ...p };
    });
  };
  const stance = STANCES.find(([k]) => k === plan.stance)!;
  const approach = APPROACHES.find(([k]) => k === plan.approach)!;
  return (
    <>
      <Tip id="plan">
        You do not drive in the arena: the brain does, following this plan. Better brains carry it out better.
      </Tip>
      <div class="card col" style={{ gap: '10px' }}>
        <div class="label">Stance</div>
        <div class="seg">
          {STANCES.map(([k, label]) => (
            <button key={k} class={plan.stance === k ? 'on' : ''} onClick={() => set({ stance: k })}>
              {label}
            </button>
          ))}
        </div>
        <div class="small muted">{stance[2]}</div>
        <div class="label">Approach</div>
        <div class="seg">
          {APPROACHES.map(([k, label]) => (
            <button key={k} class={plan.approach === k ? 'on' : ''} onClick={() => set({ approach: k })}>
              {label}
            </button>
          ))}
        </div>
        <div class="small muted">{approach[2]}</div>
        <div class="label">Hazards</div>
        <div class="seg">
          <button class={plan.hazards ? 'on' : ''} onClick={() => set({ hazards: true })}>
            Use them
          </button>
          <button class={!plan.hazards ? 'on' : ''} onClick={() => set({ hazards: false })}>
            Avoid them
          </button>
        </div>
        <div class="small muted">{plan.hazards ? 'Shoves them toward the pit, the saws and the spiked walls when it can.' : 'Fights in the open and keeps well clear of every hazard.'}</div>
      </div>
    </>
  );
}

function weaponEffect(w: NonNullable<ReturnType<typeof computeStats>['front']>): string {
  const t = w.def.type;
  if (w.p <= 0) return 'switched off';
  if (w.energyMax > 0) {
    const e = w.energyMax * (w.def.bite ?? 0.5);
    return `${((w.energyMax / 1000)).toFixed(1)} kJ · hit ${((e / 1000) * w.perKJ).toFixed(0)} · respin ${(e / Math.max(1, w.spinPower)).toFixed(1)}s`;
  }
  if (t === 'flipper' || t === 'lifter') return `${Math.round(w.impulse)} N·s · reload ${w.reload.toFixed(1)}s`;
  if (t === 'hammer' || t === 'axe') return `${w.damage.toFixed(0)} dmg · reload ${w.reload.toFixed(1)}s`;
  if (t === 'crusher') return `bite ${w.damage.toFixed(0)} + ${w.dps.toFixed(0)}/s · reload ${w.reload.toFixed(1)}s`;
  if (t === 'saw') return `${w.dps.toFixed(0)} dmg/s`;
  if (t === 'flame') return `${w.heat.toFixed(0)} heat/s · ${w.fuel.toFixed(0)}s fuel`;
  return '';
}

// ---- paint & name ------------------------------------------------------------------------

function PaintTab({ c, bot }: { c: Career; bot: BotDesign }) {
  const inEvent = c.tournament?.botId === bot.id;
  return (
    <>
      <div class="label" style={{ marginBottom: '6px' }}>
        Name
      </div>
      <input
        class="field"
        value={bot.name}
        maxLength={18}
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value.trim();
          if (v) update((cc) => (activeBot(cc).name = v));
        }}
      />
      <div style={{ height: '14px' }} />
      <PaintPicker paint={bot.paint} onChange={(p) => update((cc) => (activeBot(cc).paint = p))} />
      <div class="section-title">Robot</div>
      <div class="row">
        <Btn
          size="sm"
          class="grow"
          disabled={c.bots.length >= MAX_BOTS}
          onClick={() => {
            update((cc) => {
              const nb = addBot(cc, activeBot(cc));
              if (nb) cc.active = nb.id;
            });
            toast('Copied: tweak the copy and compare');
          }}
        >
          <Icon name="copy" size={16} /> Duplicate
        </Btn>
        <Btn
          size="sm"
          kind="danger"
          class="grow"
          disabled={c.bots.length <= 1 || inEvent}
          onClick={() =>
            confirm('Scrap this robot?', `${bot.name} will be taken apart. You keep all the parts.`, 'Scrap it', () => {
              update((cc) => removeBot(cc, bot.id));
            }, true)
          }
        >
          <Icon name="trash" size={16} /> Scrap
        </Btn>
      </div>
    </>
  );
}

// ---- stats ----------------------------------------------------------------------------

function StatsTab({ r, bot, c }: { r: Readout; bot: BotDesign; c: Career }) {
  const s = computeStats(bot, levels(c));
  return (
    <>
      <div class="card col" style={{ gap: '6px' }}>
        <div class="label">Mobility</div>
        <Stat icon="speed" label="Top speed" value={r.topSpeed * 3.6} max={25} unit=" km/h" fmt={(v) => v.toFixed(1)} />
        <Stat icon="bolt" label="0-11 km/h" value={r.accel} max={2} unit=" s" fmt={(v) => v.toFixed(2)} color="yellow" />
        <Stat icon="push" label="Push" value={r.push / 1000} max={2.5} unit=" kN" fmt={(v) => v.toFixed(2)} />
        <Stat icon="turn" label="Turning" value={r.turn} max={450} unit="°/s" fmt={(v) => v.toFixed(0)} />
        <div class="label" style={{ marginTop: '8px' }}>
          Toughness
        </div>
        <Stat icon="heart" label="Hit points" value={r.hp} max={2000} fmt={(v) => v.toFixed(0)} color="green" />
        <Stat icon="shield" label="Armour avg" value={r.armorAvg} max={750} fmt={(v) => v.toFixed(0)} color="green" />
        <Stat icon="flip" label="Stability" value={s.stability * 100} max={100} fmt={(v) => v.toFixed(0)} color="green" />
        <div class="label" style={{ marginTop: '8px' }}>
          Weapons
        </div>
        <Stat icon="target" label="Main hit" value={r.hitDamage} max={250} fmt={(v) => v.toFixed(0)} color="red" />
        <Stat icon="turn" label="Every" value={r.hitEvery} max={8} unit=" s" fmt={(v) => v.toFixed(1)} color="yellow" />
        <Stat icon="fire" label="Damage/s" value={r.dpsEstimate} max={80} fmt={(v) => v.toFixed(1)} color="red" />
        <div class="label" style={{ marginTop: '8px' }}>
          Brain · {r.brain}
        </div>
        <Stat icon="speed" label="Decisions" value={1 / r.reaction} max={12} unit="/s" fmt={(v) => v.toFixed(1)} color="yellow" />
        <Stat icon="target" label="Aim" value={r.aim * 100} max={100} unit="%" fmt={(v) => v.toFixed(0)} />
        <Stat icon="globe" label="Reads arena" value={r.awareness * 100} max={100} unit="%" fmt={(v) => v.toFixed(0)} color="green" />
      </div>
      <div class="card" style={{ marginTop: '10px', padding: '4px 14px' }}>
        <div class="kv">
          <span>Self-righting</span>
          <b>{s.invertible ? 'Invertible' : s.selfRight ? `${s.selfRightBy} · ${s.selfRight.toFixed(1)}s` : 'None'}</b>
        </div>
        <div class="kv">
          <span>Front wedge</span>
          <b>{Math.round(s.frontWedge * 100)}%</b>
        </div>
        <div class="kv">
          <span>Ground clearance (low = good)</span>
          <b>
            F {Math.round((1 - s.low.front) * 100)} · S {Math.round((1 - s.low.sides) * 100)}
          </b>
        </div>
        <div class="kv">
          <span>Heat at full overvolt</span>
          <b class={r.heatRate > 0 ? 'down' : 'up'}>{r.heatRate > 0 ? `+${r.heatRate.toFixed(1)}/s` : 'stays cool'}</b>
        </div>
        <div class="kv">
          <span>Part value</span>
          <b>{fmtMoney([bot.chassis, bot.drive, bot.core, bot.front, bot.top, bot.armor.material, bot.brain, ...bot.modules].filter((x): x is string => !!x).reduce((t, id) => t + part(id).price, 0))}</b>
        </div>
      </div>
      <div class="small muted" style={{ marginTop: '10px' }}>
        {app.career && bot.id === app.career.active ? 'This robot is your active entry.' : ''}
      </div>
    </>
  );
}
