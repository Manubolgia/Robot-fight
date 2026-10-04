import { useMemo } from 'preact/hooks';
import { activeBot } from '../../career/career.ts';
import { archetypeOf, makeBuild } from '../../career/builds.ts';
import { mulberry32 } from '../../sim/rng.ts';
import { sfx } from '../../audio/sfx.ts';
import { Btn, confirm } from '../components.tsx';
import { Icon } from '../icons.tsx';
import { Stage } from '../stage.tsx';
import { backToLibrary, go, inLibrary, setCareer, useApp } from '../store.ts';

export function Logo() {
  return (
    <div class="logo">
      <div class="word">
        KILO
        <Icon name="bolt" size={58} stroke={0} style={{ color: 'var(--cyan)' }} />
        WATT
      </div>
      <div class="tag">Robot Combat League</div>
    </div>
  );
}

export function Title() {
  const a = useApp();
  const c = a.career;
  const showcase = useMemo(
    () => makeBuild(archetypeOf('disc'), 4, mulberry32(7), { name: 'Showcase', paint: { primary: '#ffb000', secondary: '#141414', pattern: 'hazard' } }),
    [],
  );
  const bot = c ? activeBot(c) : showcase;
  return (
    <div class="screen title-screen">
      <div class="stage">
        <Stage design={bot} zoom={0.95} lookY={0.32} />
      </div>
      <div class="shade" />
      <Logo />
      <div style={{ position: 'absolute', top: 'calc(var(--sat) + 10px)', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', zIndex: 3 }}>
        {inLibrary ? (
          <button class="lib-btn" onClick={() => backToLibrary()}>
            <Icon name="back" size={14} /> Library
          </button>
        ) : (
          <span />
        )}
        <button class="iconbtn" aria-label="Settings" onClick={() => { sfx.click(); go('settings', { from: 'title' }); }}>
          <Icon name="settings" />
        </button>
      </div>
      <div class="title-menu">
        {c && (
          <div class="center small muted" style={{ marginBottom: '2px' }}>
            {c.team} · Season {c.season} · {bot.name}
          </div>
        )}
        {c ? (
          <Btn kind="primary" size="big" wide shine sound="select" onClick={() => go(c.tournament ? 'tournament' : 'hub')}>
            <Icon name="play" size={18} /> {c.tournament ? 'Continue tournament' : 'Continue career'}
          </Btn>
        ) : (
          <Btn kind="primary" size="big" wide shine sound="select" onClick={() => go('newgame')}>
            <Icon name="play" size={18} /> Start career
          </Btn>
        )}
        <div class="row">
          <Btn class="grow" onClick={() => go('quick')}>
            <Icon name="target" size={18} /> Quick fight
          </Btn>
          <Btn class="grow" onClick={() => go('howto')}>
            <Icon name="question" size={18} /> How to play
          </Btn>
        </div>
        {c && (
          <Btn
            kind="ghost"
            size="sm"
            onClick={() =>
              confirm('New career?', 'Your current team, money, parts and trophies will be lost.', 'Start over', () => {
                setCareer(null);
                go('newgame');
              }, true)
            }
          >
            New career
          </Btn>
        )}
        <div class="foot">
          <span>BUILD · BALANCE · BATTLE</span>
          <span>v1.0</span>
        </div>
      </div>
    </div>
  );
}
