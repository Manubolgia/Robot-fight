import { useState } from 'preact/hooks';
import { buy, levelOf, owns, upgrade, upgradeCap } from '../../career/career.ts';
import { ARMORS, BRAINS, CHASSIS, CORES, DRIVES, MAX_LEVEL, MODULES, WEAPONS, WEAPON_FAMILY, upgradeCost } from '../../data/parts.ts';
import type { PartDef, WeaponDef } from '../../data/types.ts';
import { sfx } from '../../audio/sfx.ts';
import { Btn, Pips, TabBar, Tip, TopBar, fmtMoney } from '../components.tsx';
import { Icon, partIcon } from '../icons.tsx';
import { toast, update, useApp } from '../store.ts';
import { specsOf } from './Garage.tsx';

type Cat = 'chassis' | 'drive' | 'core' | 'weapon' | 'armor' | 'module' | 'brain';
const CATS: Array<[Cat, string, string, PartDef[]]> = [
  ['weapon', 'target', 'Weapons', WEAPONS],
  ['chassis', 'frame', 'Frames', CHASSIS],
  ['drive', 'wheel', 'Drives', DRIVES],
  ['core', 'battery', 'Cores', CORES],
  ['armor', 'shield', 'Armour', ARMORS],
  ['module', 'chip', 'Modules', MODULES],
  ['brain', 'brain', 'Brains', BRAINS],
];

export function Shop() {
  const a = useApp();
  const c = a.career!;
  const [mode, setMode] = useState<'buy' | 'upgrade'>('buy');
  const [cat, setCat] = useState<Cat>('weapon');
  const list = CATS.find((x) => x[0] === cat)![3];
  const cap = upgradeCap(c);
  return (
    <div class="screen">
      <TopBar title={mode === 'buy' ? 'Parts shop' : 'Workshop'} sub={mode === 'buy' ? `Licence tier ${c.tier}` : `Upgrades up to Mk ${cap}`} />
      <div style={{ padding: '0 16px 6px' }}>
        <div class="seg">
          <button class={mode === 'buy' ? 'on' : ''} onClick={() => { sfx.click(); setMode('buy'); }}>
            Buy parts
          </button>
          <button class={mode === 'upgrade' ? 'on' : ''} onClick={() => { sfx.click(); setMode('upgrade'); }}>
            Upgrade
          </button>
        </div>
      </div>
      <div class="subtabs">
        {CATS.map(([id, icon, label]) => (
          <button key={id} class={cat === id ? 'on' : ''} onClick={() => { sfx.click(); setCat(id); }}>
            <Icon name={icon} size={14} /> {label}
          </button>
        ))}
      </div>
      <div class="scroll" key={`${mode}-${cat}`}>
        {mode === 'buy' ? (
          <>
            <Tip id="shop">Buy a part once and fit it to any of your robots. Higher tiers unlock with each licence.</Tip>
            <div class="list">
              {[...list]
                .filter((p) => !owns(c, p.id))
                .sort((x, y) => x.tier - y.tier || x.price - y.price)
                .map((p) => (
                  <ShopRow key={p.id} p={p} />
                ))}
              {list.every((p) => owns(c, p.id)) && <div class="empty">You own every part in this category.</div>}
            </div>
          </>
        ) : (
          <>
            <Tip id="workshop">Each upgrade adds 7% to a part's main numbers: more power, force, energy, hit points or damage. Higher licences allow higher marks.</Tip>
            <div class="list">
              {list.filter((p) => owns(c, p.id)).map((p) => (
                <UpgradeRow key={p.id} p={p} cap={cap} />
              ))}
              {!list.some((p) => owns(c, p.id)) && <div class="empty">You don't own anything here yet.</div>}
            </div>
          </>
        )}
        <div style={{ height: '8px' }} />
      </div>
      <TabBar />
    </div>
  );
}

function ShopRow({ p }: { p: PartDef }) {
  const a = useApp();
  const c = a.career!;
  const locked = p.tier > c.tier;
  return (
    <div class={`card ${locked ? 'locked' : ''}`}>
      <div class="part">
        <div class="ic">
          <Icon name={partIcon(p.kind, (p as WeaponDef).type)} />
        </div>
        <div class="grow">
          <h3>{p.name}</h3>
          <div class="row" style={{ gap: '6px', marginTop: '3px' }}>
            <span class={`badge t${p.tier}`}>T{p.tier}</span>
            {p.kind === 'weapon' && <span class="badge">{WEAPON_FAMILY[(p as WeaponDef).type]}</span>}
          </div>
          <div class="desc">{p.desc}</div>
          <div class="specs">
            {specsOf(p).map(([icon, t]) => (
              <span key={t}>
                <Icon name={icon} size={12} /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div class="row" style={{ marginTop: '10px' }}>
        <span class="prize grow" style={{ fontSize: '17px' }}>
          {fmtMoney(p.price)}
        </span>
        {locked ? (
          <span class="badge">
            <Icon name="lock" size={12} /> Tier {p.tier} licence
          </span>
        ) : (
          <Btn
            size="sm"
            kind="primary"
            sound="none"
            disabled={c.money < p.price}
            onClick={() => {
              let ok = false;
              update((cc) => (ok = buy(cc, p.id)));
              if (ok) {
                sfx.buy();
                toast(`${p.name} is in the garage`, 'gold');
              } else sfx.error();
            }}
          >
            {c.money < p.price ? 'Too dear' : 'Buy'}
          </Btn>
        )}
      </div>
    </div>
  );
}

function UpgradeRow({ p, cap }: { p: PartDef; cap: number }) {
  const a = useApp();
  const c = a.career!;
  const lvl = levelOf(c, p.id);
  const maxed = lvl >= MAX_LEVEL;
  const capped = lvl >= cap;
  const cost = maxed ? 0 : upgradeCost(p, lvl + 1);
  return (
    <div class="card">
      <div class="part">
        <div class="ic">
          <Icon name={partIcon(p.kind, (p as WeaponDef).type)} />
        </div>
        <div class="grow">
          <h3>
            {p.name} <span class="badge gold">Mk {lvl}</span>
          </h3>
          <div style={{ margin: '8px 0 4px' }}>
            <Pips n={lvl} max={MAX_LEVEL} />
          </div>
          <div class="small muted">
            {maxed ? 'Fully upgraded: +28% over stock.' : `Now +${7 * (lvl - 1)}% over stock · Mk ${lvl + 1} gives +${7 * lvl}%`}
          </div>
        </div>
      </div>
      {!maxed && (
        <div class="row" style={{ marginTop: '10px' }}>
          <span class="prize grow" style={{ fontSize: '17px' }}>
            {fmtMoney(cost)}
          </span>
          {capped ? (
            <span class="badge">
              <Icon name="lock" size={12} /> Next licence
            </span>
          ) : (
            <Btn
              size="sm"
              kind="cyan"
              sound="none"
              disabled={c.money < cost}
              onClick={() => {
                let ok = false;
                update((cc) => (ok = upgrade(cc, p.id)));
                if (ok) {
                  sfx.levelUp();
                  toast(`${p.name} upgraded to Mk ${lvl + 1}`, 'good');
                } else sfx.error();
              }}
            >
              Upgrade
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}
