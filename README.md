# Kilowatt · Robot Combat League

Design a combat robot inside a **100 kg weight limit** and the output of **one
power core**, give it a **brain** and a **battle plan**, and send it through a
career: from a four-robot scrap in a garage, through the regional, national and
continental circuits, to the **Kilowatt World Cup** with its group stage and
knockouts.

It is an installable web app (PWA) made for iPhone in portrait. Everything is
drawn in 3D in the browser and every sound is synthesised, so it works offline
once installed. Single player, no accounts, no network play.

Live: `https://manubolgia.github.io/Robot-fight/` (also in the
[MNBG tape library](https://manubolgia.github.io/mnbglibrary/#kilowatt)).

---

## Playing

**You build, the robot fights.** Nobody drives in the arena: you design the
robot, split its power and give it a battle plan, and its brain does the rest.
Watch at 1×, 2× or 4×, or skip straight to the result. Each robot's current
intent shows under its health bar (going in, spinning up, flanking, biding
time, carrying, rebooting...).

**Winning.** Destroy the other robot, drop it in the pit, or leave it unable to
move for ten seconds (on its back with no way to self-right, or with its drive
wrecked). After 90 seconds three judges score damage (4), control (4) and
aggression (3).

## Designing

Every part is a trade:

| | |
| --- | --- |
| **Weight** | All parts and armour plates count against 100 kg. Heavy robots accelerate and turn slower, light ones lose pushing matches (traction is weight times grip). |
| **Power** | The core makes a fixed number of kilowatts. Drive, front weapon, top weapon, modules and the brain share it; the Power tab sets each between its minimum and 130%. Less power weakens a system; past 100% it **overvolts**: stronger, but it heats up. An overheated robot runs at half power and takes damage. |
| **Minimum power** | Every powered part needs a minimum share to run (bigger, later parts need more). Below it a weapon is switched off; the drive and the brain cannot be set lower. A core that cannot keep every running part at its minimum is not legal: switch something off or carry a bigger, heavier core. The top weapon, drive and brain together need most of the biggest core, leaving little to overvolt and little weight for armour. |
| **Brain** | Nine control boards from Relay Logic to Overmind. A sharper brain reacts sooner, aims and times its weapon better and reads the hazards, but draws up to 3.4 kW and weighs up to 4.5 kg. If the power reaching it (its share, less what core damage and overheating take) drops under its minimum mid-fight, it reboots and the robot freezes for a moment. Some brains have a quirk: reckless (never backs off), cautious (keeps its guard), hunter (goes for the sides and rear), adaptive (strikes right after the other robot commits). |
| **Battle plan** | Stance (aggressive, balanced, defensive), approach (head-on, flank, counter) and whether to use the hazards. Set it in the garage or in the pit before each fight, after scouting the opponent. |
| **Armour** | One material, plates on the front, sides, rear and top. Plates soak up a share of each hit until they are knocked off. Aluminium is light, steel stops saws, UHMW plastic shrugs off spinners but melts under flame, titanium is good at everything, Kevlar stops axes and crushers. |
| **Internals** | Hits that get through damage the drive, the weapons and the core. Lose the drive or the core and you are counted out. |

Parts: 14 frames (box, wedge, flat invertible, self-rolling dome, tall tower),
10 drives (wheels, tracks, strafing mecanum), 10 cores (each tier has a light
cell and a heavy stack), 37 weapons in 13 families, 6 armour materials,
15 modules (self-righter, wedgelets, skirts, magnets, heat sink, shock mounts,
gyro, ablative plates, spikes, weapon guard, capacitor boost, targeting,
redundant drive, coolant, reactive armour) and 9 brains. Parts are bought once
and fit any of your robots; the workshop upgrades them (Mk 1 to Mk 5, +7% per
mark; a brain thinks faster and aims better with each mark).

### Strategies

Every family has a job and a counter; the balance is checked by simulation (see
below).

| Family | Strong against | Weak against |
| --- | --- | --- |
| Vertical discs | wedges, flippers, lifters | fast flankers, thick UHMW |
| Drums | low pushers, rammers | hammers, crushers |
| Horizontal bars | boxes, crushers | low wedges, flippers |
| Ring spinners | saws, crushers, wedges | overhead weapons, flippers |
| Flippers and lifters | robots that cannot self-right | saws, rammers, low frames |
| Hammers and axes | thin top armour | flippers, fast robots |
| Crushers | heavy armour, ring spinners | vertical spinners |
| Saws | pushers, plastic armour | steel, spinners |
| Rammers | flippers, wedges | drums, spinners |
| Wedges | horizontal spinners, hazards | vertical spinners, hammers |
| Flamethrowers | overvolted robots, UHMW | heat sinks, coolant |

## The career

| Tier | Events | Licence for the next tier |
| --- | --- | --- |
| Garage League | Garage Rumble, Scrapyard Scuffle, Basement Bash | win any event |
| Regional Circuit | Regional Open, Thunderdome Classic, Iron Valley Cup | win any event |
| National Series | National Championship, Gauntlet Invitational (groups) | win any event |
| Continental Masters | Masters of Metal (16 robots), Continental Crown (groups) | reach a final |
| World Cup | 16 robots: 4 groups of 4, then quarter-finals, semis, final | lift it: a new, harder season begins |

Between fights the pit crew repairs part of the damage for free (better crews
repair more); the rest carries into the next fight unless you pay for a full
repair. Before each fight you can scout the opponent, retune the power split
or swap parts. Sponsors pay for knockouts, throws, big hits or reaching the
final. Twelve rival teams (each with its own robot, driver and taunt) follow you
up the circuit and keep a head-to-head record. Eight arenas bring floor saws,
a centre hammer, fire vents, spiked walls and a pit that opens mid-fight.

## How it is built

```
src/
  data/       parts catalogue, arenas, events and tiers
  sim/        the fight: stats from a design, the 2.5D physics and weapons,
              the robots' brains, seeded randomness
  career/     the team, money and licences; tournaments (brackets, groups,
              simulated AI-vs-AI fights); robot recipes; names and rivals
  render/     three.js: robots built from their parts, arenas, particles,
              the fight camera, the garage turntable, thumbnails
  audio/      synthesised sound (WebAudio)
  ui/         Preact screens and the touch HUD
tools/        balance and tuning runs, icons, screenshots
tests/        vitest: parts, fights, every tournament format, licences
```

- **The fight** is a fixed 120 Hz simulation: robots are capsules with mass,
  inertia, motor curves, traction, a height and a tumble for flips. Both
  robots are driven by their brains (`src/sim/ai.ts`), so it is deterministic
  for a seed and runs headless, which is how computer teams fight each other
  in tournaments and how the game is balanced.
- **Balance**: `node tools/balance.ts [tier] [fights]` plays every robot
  strategy that tier's parts can build against every other and prints the win
  matrix; `node tools/tune.ts [tiers] [fights] [rounds]` plays every tier at
  once (a worker each) and adjusts each weapon's damage trim (`TUNE` in
  `src/sim/stats.ts`) until every strategy wins about half its fights in
  every tier.
- **One WebGL renderer** is shared by the garage, the thumbnails and the arena
  (phones limit how many a page may hold).
- **In the MNBG library** the game says hello to the deck and shows a "Library"
  button on the title screen; it uses `--mnbg-safe-*` for the notch.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # typecheck + production build into dist/
node tools/balance.ts 3 8
```

## Deploy

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
tests, build, then GitHub Pages. In the repo's **Settings → Pages**, set
**Source** to **GitHub Actions** (once).

On iPhone, open the page in Safari and use **Share → Add to Home Screen**.
