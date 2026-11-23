/**
 * App shell (spec §13.1): four sections (side bar ≥ 900 px, bottom bar below), language and
 * settings always in the header, home one tap away, first-visit intro, theme setting.
 */
import { Suspense, lazy, useEffect, useState } from 'react';
import { type Lang, LangContext, translate } from '../i18n';
import { ExamRun, ExamStart } from './ExamView';
import { AboutPage, Intro, ProgressPage, SettingsPage, StartPage } from './pages';
import { PracticeExercise } from './PracticeExercise';
import { PracticeHome } from './PracticeHome';
import { setLastRoute, useProgress } from './progress';
import { type Route, useRoute } from './router';
import { loadLang, saveLang } from './store';
import { WorkedItem, WorkedList } from './WorkedView';

// theory (KaTeX + texts) is loaded only when opened
const TheoryList = lazy(() => import('./theory/TheoryView').then((m) => ({ default: m.TheoryList })));
const TheoryTopic = lazy(() => import('./theory/TheoryView').then((m) => ({ default: m.TheoryTopic })));

type Section = 'home' | 'teoria' | 'ebatziak' | 'praktika' | 'aurrerapena' | 'other';

const NAV: { key: string; section: Exclude<Section, 'home' | 'other'>; icon: string }[] = [
  { key: 'nav.theory', section: 'teoria', icon: 'T' },
  { key: 'nav.worked', section: 'ebatziak', icon: 'E' },
  { key: 'nav.practice', section: 'praktika', icon: 'P' },
  { key: 'nav.progress', section: 'aurrerapena', icon: 'A' },
];

function sectionOf(r: Route): Section {
  switch (r.name) {
    case 'start':
      return 'home';
    case 'worked':
    case 'workedItem':
      return 'ebatziak';
    case 'theory':
    case 'theoryTopic':
      return 'teoria';
    case 'practice':
    case 'generated':
    case 'pool':
    case 'exam':
    case 'examRun':
      return 'praktika';
    case 'progress':
      return 'aurrerapena';
    default:
      return 'other';
  }
}

export function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const route = useRoute();
  const progress = useProgress();
  const section = sectionOf(route);
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  useEffect(() => {
    document.documentElement.lang = lang;
    saveLang(lang);
  }, [lang]);
  const theme = progress.settings.theme;
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  // "continue where you left off": exercises, worked exercises and theory topics
  useEffect(() => {
    if (['generated', 'pool', 'workedItem', 'theoryTopic'].includes(route.name)) setLastRoute(window.location.hash);
  }, [route]);

  const link = (n: (typeof NAV)[number]) => {
    const on = n.section === section;
    return (
      <a href={`#/${n.section}`} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
        <span className="ico" aria-hidden="true">
          {n.icon}
        </span>
        <span>{t(n.key)}</span>
      </a>
    );
  };

  return (
    <LangContext.Provider value={lang}>
      <div className="app">
        <nav className="side" aria-label={t('nav.main')}>
          <a className="brand" href="#/">
            <small>{t('app.kicker')}</small>
            <b>EkoizpenLab</b>
          </a>
          <ul>
            {NAV.map((n) => (
              <li key={n.key}>{link(n)}</li>
            ))}
          </ul>
          <p className="meta">
            v{__APP_VERSION__} · {__COMMIT__} · {__BUILD_DATE__}
          </p>
        </nav>
        <div className="main">
          <header className="top">
            <a className="brand mobile-only" href="#/" aria-label={t('nav.home')}>
              <b>EkoizpenLab</b>
            </a>
            <a className="home-link" href="#/" aria-current={section === 'home' ? 'page' : undefined}>
              {t('nav.home')}
            </a>
            <div className="lang" role="group" aria-label="Hizkuntza / Idioma">
              {(['eu', 'es'] as const).map((l) => (
                <button key={l} className={l === lang ? 'sel' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a className="settings-link" href="#/ezarpenak" aria-label={t('set.title')} aria-current={route.name === 'settings' ? 'page' : undefined}>
              ⚙
            </a>
          </header>
          <main>
            {route.name === 'start' && <StartPage />}
            {route.name === 'practice' && <PracticeHome />}
            {route.name === 'generated' && (
              <PracticeExercise key={`${route.template}-${route.level}-${route.seed}`} source={{ kind: 'generated', template: route.template, level: route.level, seed: route.seed }} />
            )}
            {route.name === 'pool' && <PracticeExercise key={route.id} source={{ kind: 'pool', id: route.id }} />}
            {route.name === 'worked' && <WorkedList />}
            {route.name === 'workedItem' && <WorkedItem key={route.id} id={route.id} />}
            <Suspense fallback={<p className="note">…</p>}>
              {route.name === 'theory' && <TheoryList />}
              {route.name === 'theoryTopic' && <TheoryTopic key={route.id} id={route.id} />}
            </Suspense>
            {route.name === 'exam' && <ExamStart />}
            {route.name === 'examRun' && <ExamRun key={route.seed} seed={route.seed} minutes={route.minutes} />}
            {route.name === 'progress' && <ProgressPage />}
            {route.name === 'settings' && <SettingsPage setLang={setLang} />}
            {route.name === 'about' && <AboutPage />}
          </main>
        </div>
        <nav className="bottom" aria-label={t('nav.main')}>
          {NAV.map((n) => (
            <span key={n.key} className="bottom-item">
              {link(n)}
            </span>
          ))}
        </nav>
        {!progress.introSeen && <Intro />}
      </div>
    </LangContext.Provider>
  );
}
