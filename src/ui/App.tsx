import { useEffect } from 'preact/hooks';
import { sfx } from '../audio/sfx.ts';
import { setQuality } from '../render/gfx.ts';
import { onThumbsReady } from '../render/thumbs.ts';
import { Overlays } from './components.tsx';
import { Events } from './screens/Events.tsx';
import { Fight } from './screens/Fight.tsx';
import { Garage } from './screens/Garage.tsx';
import { Hub } from './screens/Hub.tsx';
import { HowTo, QuickFight, Settings } from './screens/Misc.tsx';
import { NewGame } from './screens/NewGame.tsx';
import { Prefight } from './screens/Prefight.tsx';
import { Results } from './screens/Results.tsx';
import { Shop } from './screens/Shop.tsx';
import { Team } from './screens/Team.tsx';
import { Title } from './screens/Title.tsx';
import { Tournament } from './screens/Tournament.tsx';
import { app, emit, go, helloLibrary, useApp } from './store.ts';

export function App() {
  const a = useApp();
  useEffect(() => {
    helloLibrary();
    setQuality(app.settings.quality);
    sfx.enabled = app.settings.sound;
    onThumbsReady(() => emit());
    // iOS only lets audio start from a touch
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // a career screen without a career goes back to the title
  const needsCareer = !['title', 'newgame', 'quick', 'settings', 'howto', 'fight', 'results'].includes(a.screen);
  if (needsCareer && !a.career) {
    queueMicrotask(() => go('title'));
    return null;
  }

  let screen;
  switch (a.screen) {
    case 'title': screen = <Title />; break;
    case 'newgame': screen = <NewGame />; break;
    case 'hub': screen = <Hub />; break;
    case 'events': screen = <Events />; break;
    case 'garage': screen = <Garage />; break;
    case 'shop': screen = <Shop />; break;
    case 'team': screen = <Team />; break;
    case 'tournament': screen = <Tournament />; break;
    case 'prefight': screen = <Prefight />; break;
    case 'fight': screen = <Fight />; break;
    case 'results': screen = <Results />; break;
    case 'quick': screen = <QuickFight />; break;
    case 'settings': screen = <Settings />; break;
    case 'howto': screen = <HowTo />; break;
    default: screen = <Title />;
  }
  return (
    <div class="frame">
      {screen}
      <Overlays />
      <div class="rotate-hint">
        <div>
          <div class="display" style={{ fontSize: '22px' }}>Turn your phone upright</div>
          <div class="muted small">Kilowatt is made for portrait.</div>
        </div>
      </div>
    </div>
  );
}
