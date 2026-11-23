/** Phase 8 screens (spec §13.1): learning path, first-visit intro, progress, settings, about. */
import { useRef, useState } from 'react';
import { TOPIC_IDS } from '../content/theory/ids';
import { POOL } from '../data/pool';
import { type Lang, useT } from '../i18n';
import { exerciseTitle } from './describe';
import { exportJSON, importJSON, ratesBy, resetProgress, setIntroSeen, setSettings, topMistakes, useProgress } from './progress';
import { askKeyLabel, DIAG_TOPIC } from './record';
import { hrefOf } from './router';
import { WORKED } from './worked';

const pct = (ok: number, n: number) => (n ? Math.round((100 * ok) / n) : 0);

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${max ? (100 * value) / max : 0}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
export function StartPage() {
  const { t } = useT();
  const p = useProgress();
  const levels = [1, 2, 3] as const;
  const ope = POOL.filter((e) => e.origin === 'ope');
  const theory = p.theorySeen.filter((x) => TOPIC_IDS.includes(x)).length;
  const worked = p.workedDone.filter((x) => WORKED.some((w) => w.id === x)).length;
  return (
    <section className="card">
      <h1>{t('home.title')}</h1>
      <p className="lead">{t('home.lead')}</p>
      {p.lastRoute && p.lastRoute !== '#/' && (
        <p>
          <a className="btn primary" href={p.lastRoute}>
            {t('start.continue')} →
          </a>
        </p>
      )}
      <h2 className="sec">{t('home.path')}</h2>
      <ol className="path">
        <li className="step-card">
          <span className="num">1</span>
          <div>
            <b>{t('home.step.theory')}</b>
            <small>{t('start.of', { n: theory, total: TOPIC_IDS.length })}</small>
            <Bar value={theory} max={TOPIC_IDS.length} label={t('home.step.theory')} />
          </div>
          <a className="btn" href={hrefOf({ name: 'theory' })}>
            {t('start.go')}
          </a>
        </li>
        <li className="step-card">
          <span className="num">2</span>
          <div>
            <b>{t('home.step.worked')}</b>
            <small>{t('start.of', { n: worked, total: WORKED.length })}</small>
            <Bar value={worked} max={WORKED.length} label={t('home.step.worked')} />
          </div>
          <a className="btn" href={hrefOf({ name: 'worked' })}>
            {t('start.go')}
          </a>
        </li>
        <li className="step-card">
          <span className="num">3</span>
          <div>
            <b>{t('home.step.practice')}</b>
            {levels.map((lv) => {
              const a = p.attempts.filter((x) => x.level === lv && x.status !== 'missing');
              const ok = a.filter((x) => x.status === 'correct').length;
              return (
                <div key={lv}>
                  <small>{t('start.level', { n: lv, ok, total: a.length })}</small>
                  <Bar value={ok} max={a.length} label={`${t('home.step.practice')} ${lv}`} />
                </div>
              );
            })}
          </div>
          <a className="btn" href={hrefOf({ name: 'practice' })}>
            {t('start.go')}
          </a>
        </li>
        <li className="step-card">
          <span className="num">4</span>
          <div>
            <b>{t('home.step.exam')}</b>
            <small>{t('start.examSub')}</small>
            <ul className="plain">
              {ope.map((e) => (
                <li key={e.id}>
                  <a href={hrefOf({ name: 'pool', id: e.id })}>{exerciseTitle(e, t)}</a>
                </li>
              ))}
            </ul>
          </div>
          <a className="btn" href={hrefOf({ name: 'exam' })}>
            {t('start.go')}
          </a>
        </li>
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
export function Intro() {
  const { t } = useT();
  const [k, setK] = useState(1);
  return (
    <div className="intro-backdrop" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="intro card">
        <p className="tags">
          <span className="tag">{k} / 3</span>
        </p>
        <h2 id="intro-title">{t(`intro.${k}.title`)}</h2>
        <p>{t(`intro.${k}.text`)}</p>
        <div className="actions">
          <button onClick={setIntroSeen}>{t('intro.skip')}</button>
          {k < 3 ? (
            <button className="primary" onClick={() => setK(k + 1)}>
              {t('intro.next')}
            </button>
          ) : (
            <button className="primary" onClick={setIntroSeen}>
              {t('intro.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ProgressPage() {
  const { t, lang } = useT();
  const p = useProgress();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const answered = p.attempts.filter((a) => a.status !== 'missing');
  const ok = answered.filter((a) => a.status === 'correct').length;
  const byAsk = ratesBy(p.attempts, (a) => a.ask);
  const byTpl = ratesBy(p.attempts, (a) => a.template ?? (a.origin === 'generated' ? undefined : a.exercise));
  const mistakes = topMistakes(p.attempts);
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ekoizpenlab-aurrerapena.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const tplName = (k: string) => {
    const v = t(`tpl.${k}`);
    if (v !== `tpl.${k}`) return v;
    const e = POOL.find((x) => x.id === k);
    return e ? exerciseTitle(e, t) : k;
  };
  return (
    <section className="card">
      <h1>{t('prog.title')}</h1>
      {answered.length === 0 ? (
        <p className="note">{t('prog.empty')}</p>
      ) : (
        <>
          <p className="lead">{t('prog.total', { n: answered.length, ok, pct: pct(ok, answered.length) })}</p>
          <h2 className="sec">{t('prog.byAsk')}</h2>
          <table className="stats">
            <tbody>
              {byAsk.map((r) => (
                <tr key={r.key}>
                  <td>{askKeyLabel(r.key, t)}</td>
                  <td>
                    {r.correct} / {r.total}
                  </td>
                  <td className="w-bar">
                    <Bar value={r.correct} max={r.total} label={askKeyLabel(r.key, t)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {byTpl.length > 0 && (
            <>
              <h2 className="sec">{t('prog.byTemplate')}</h2>
              <table className="stats">
                <tbody>
                  {byTpl.map((r) => (
                    <tr key={r.key}>
                      <td>{tplName(r.key)}</td>
                      <td>
                        {r.correct} / {r.total}
                      </td>
                      <td className="w-bar">
                        <Bar value={r.correct} max={r.total} label={tplName(r.key)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {mistakes.length > 0 && (
            <>
              <h2 className="sec">{t('prog.mistakes')}</h2>
              <ul className="mistakes">
                {mistakes.map((m) => (
                  <li key={m.code}>
                    <span>{t(`diag.${m.code}`, { d: '…' })}</span> <span className="tag">{t('prog.times', { n: m.count })}</span>{' '}
                    {DIAG_TOPIC[m.code] && <a href={hrefOf({ name: 'theoryTopic', id: DIAG_TOPIC[m.code]! })}>{t('wk.toTheory')}</a>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2 className="sec">{t('prog.history')}</h2>
          <ul className="history">
            {[...p.attempts]
              .reverse()
              .slice(0, 15)
              .map((a, i) => (
                <li key={i}>
                  <span className={`chip ${a.status === 'partial' ? 'missing' : a.status}`}>{a.status === 'correct' ? '✓' : a.status === 'wrong' ? '✗' : a.status === 'partial' ? '◐' : '!'}</span> {askKeyLabel(a.ask, t)} ·{' '}
                  {new Date(a.ts).toLocaleString(lang === 'eu' ? 'eu-ES' : 'es-ES')}
                </li>
              ))}
          </ul>
        </>
      )}
      <div className="actions">
        <button onClick={download}>{t('prog.export')}</button>
        <button onClick={() => file.current?.click()}>{t('prog.import')}</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setMsg(importJSON(await f.text()) ? t('prog.importOk') : t('prog.importBad'));
            e.target.value = '';
          }}
        />
        <button
          onClick={() => {
            if (window.confirm(t('prog.resetConfirm'))) resetProgress();
          }}
        >
          {t('prog.reset')}
        </button>
      </div>
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
export function SettingsPage({ setLang }: { setLang: (l: Lang) => void }) {
  const { t, lang } = useT();
  const s = useProgress().settings;
  return (
    <section className="card settings">
      <h1>{t('set.title')}</h1>
      <h2 className="sec">{t('set.lang')}</h2>
      <div className="choice" role="radiogroup" aria-label={t('set.lang')}>
        {(['eu', 'es'] as const).map((l) => (
          <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'sel' : ''} onClick={() => setLang(l)}>
            {l === 'eu' ? 'Euskara' : 'Español'}
          </button>
        ))}
      </div>
      <h2 className="sec">{t('set.theme')}</h2>
      <div className="choice" role="radiogroup" aria-label={t('set.theme')}>
        {(['auto', 'light', 'dark'] as const).map((v) => (
          <button key={v} role="radio" aria-checked={s.theme === v} className={s.theme === v ? 'sel' : ''} onClick={() => setSettings({ theme: v })}>
            {t(`set.theme.${v}`)}
          </button>
        ))}
      </div>
      <p className="note">{t('set.tolerance')}</p>
      <p>
        <a href={hrefOf({ name: 'about' })}>{t('about.title')} →</a>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
export function AboutPage() {
  const { t } = useT();
  return (
    <section className="card">
      <h1>{t('about.title')}</h1>
      <p className="lead">{t('about.lead')}</p>
      <table className="stats">
        <tbody>
          <tr>
            <td>{t('about.version')}</td>
            <td>{__APP_VERSION__}</td>
          </tr>
          <tr>
            <td>{t('about.commit')}</td>
            <td>
              <code>{__COMMIT__}</code>
            </td>
          </tr>
          <tr>
            <td>{t('about.built')}</td>
            <td>{__BUILD_DATE__}</td>
          </tr>
          <tr>
            <td>URL</td>
            <td>
              <a href="https://letitbe010.github.io/EkoizpenLab/">letitbe010.github.io/EkoizpenLab</a>
            </td>
          </tr>
        </tbody>
      </table>
      <p>{t('about.license')}</p>
      <p className="note">{t('about.sources')}</p>
      <p>
        <a href="https://github.com/Letitbe010/EkoizpenLab">github.com/Letitbe010/EkoizpenLab</a>
      </p>
    </section>
  );
}
