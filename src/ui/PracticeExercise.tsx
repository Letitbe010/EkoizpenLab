/**
 * Practice exercise screen (spec §13.1): ① statement → ② solve → ③ grading → ④ solution.
 * The data table is always visible. Figures that give the answer away (precedence diagram,
 * stations, CPM network, Gantt) appear only after grading (spec §6), with the user's answer
 * overlaid where it applies (dashed, spec §13.2).
 */
import { useMemo, useState } from 'react';
import { metrics } from '../core/balancing';
import { validateAssignment } from '../core/balancingExact';
import { generate, LEVELS, TEMPLATES, type TemplateId } from '../core/generator';
import { type Answer, type GradeResult, gradeExercise } from '../core/grader';
import { schedule } from '../core/johnson';
import type { Exercise } from '../core/model';
import * as R from '../core/rational';
import { solve } from '../core/solve';
import { poolById } from '../data/pool';
import { useT } from '../i18n';
import { AnswerForm } from './AnswerForm';
import { CpmNetwork, Gantt, PrecedenceGraph, StationBoard, type EdgeMark, type GanttRow } from './charts/Diagrams';
import { DataTable } from './DataTable';
import { askLabel, exerciseTitle, letter, templateOf } from './describe';
import { fmtN, fmtR } from './format';
import { hrefOf, randomSeed } from './router';
import { solutionLines } from './solution';
import { loadAnswers, saveAnswers } from './store';

export type ExerciseSource = { kind: 'generated'; template: string; level: number; seed: number } | { kind: 'pool'; id: string };

type Loaded = { ok: true; ex: Exercise } | { ok: false; reason: 'notFound' | 'error' };

function load(src: ExerciseSource): Loaded {
  try {
    if (src.kind === 'pool') {
      const ex = poolById(src.id);
      return ex ? { ok: true, ex } : { ok: false, reason: 'notFound' };
    }
    const tpl = src.template as TemplateId;
    if (!TEMPLATES.includes(tpl) || !(LEVELS[tpl] as number[]).includes(src.level)) return { ok: false, reason: 'notFound' };
    return { ok: true, ex: generate(tpl, src.seed, src.level as 1 | 2 | 3).exercise };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

const STEPS = ['steps.statement', 'steps.solve', 'steps.grade', 'steps.solution'] as const;

function Figures({ ex, answers, result }: { ex: Exercise; answers: Record<string, Answer>; result: GradeResult }) {
  const { t } = useT();
  const p = ex.problem;
  const sol = solve(p);
  if (p.kind === 'balancing' && sol.kind === 'balancing') {
    const pr = ex.asks.find((a) => a.kind === 'precedence');
    const prRes = pr ? result.asks.find((r) => r.id === pr.id) : undefined;
    const marks = new Map<string, EdgeMark>();
    for (const it of prRes?.items ?? []) {
      const [a, b] = it.part.split('→');
      if (a && b) marks.set(`${a}>${b}`, it.status === 'correct' ? 'ok' : it.expected === 'yes' ? 'missing' : 'extra');
    }
    const edges = [
      ...sol.edges.map(([a, b]) => ({ from: a, to: b, mark: prRes ? (marks.get(`${a}>${b}`) ?? 'ok') : ('normal' as EdgeMark) })),
      ...[...marks].filter(([, m]) => m === 'extra').map(([k]) => ({ from: k.split('>')[0]!, to: k.split('>')[1]!, mark: 'extra' as EdgeMark })),
    ];
    const time = new Map(p.tasks.map((x) => [x.id, R.toNumber(x.t)]));
    const board = (a: string[][]) => a.map((s) => ({ tasks: s.map((id) => ({ id, t: time.get(id) ?? 0 })) }));
    const asg = ex.asks.find((a) => a.kind === 'assignment');
    const user = asg ? answers[asg.id]?.stations?.filter((s) => s.length > 0) : undefined;
    const userValid = user && user.length > 0 && validateAssignment(p, user).length === 0;
    const sameAsRef = userValid && JSON.stringify(user.map((s) => [...s].sort())) === JSON.stringify(sol.reference.map((s) => [...s].sort()));
    const c = R.toNumber(sol.metrics.c);
    return (
      <div className="figs">
        <h3>{t('chart.precedence')}</h3>
        <PrecedenceGraph nodes={p.tasks.map((x) => ({ id: x.id, preds: x.preds }))} sub={Object.fromEntries(p.tasks.map((x) => [x.id, fmtR(x.t)]))} edges={edges} label={t('chart.precedence')} />
        {prRes && <p className="legend"><span className="lg ok">━ {t('legend.ok')}</span> <span className="lg missing">‒ ‒ {t('legend.missing')}</span> <span className="lg extra">━ {t('legend.extra')}</span></p>}
        <h3>{t('chart.stations')}</h3>
        <StationBoard stations={board(sol.reference)} c={c} unit={p.unit} label={t('chart.stations')} />
        {userValid && !sameAsRef && (
          <>
            <h3>{t('chart.yourStations', { e: fmtN(100 * R.toNumber(metrics(p, user).efficiency), 2) })}</h3>
            <StationBoard stations={board(user)} c={c} unit={p.unit} label={t('chart.yourStations', { e: '' })} dashed />
          </>
        )}
      </div>
    );
  }
  if (p.kind === 'project' && sol.kind === 'project') {
    const c = sol.cpm;
    const rows: GanttRow[] = c.rows.map((r) => ({
      label: r.id,
      bars: [
        { from: R.toNumber(r.es), to: R.toNumber(r.ef), text: fmtR(r.d), kind: r.critical ? 'critical' : 'task' },
        ...(R.isZero(r.tf) ? [] : [{ from: R.toNumber(r.ef), to: R.toNumber(r.lf), kind: 'slack' as const }]),
      ],
    }));
    return (
      <div className="figs">
        <h3>{t('chart.network')}</h3>
        <CpmNetwork
          boxes={c.rows.map((r) => ({ id: r.id, preds: p.activities.find((a) => a.id === r.id)!.preds, d: fmtN(R.toNumber(r.d), 2), es: fmtN(R.toNumber(r.es), 2), ef: fmtN(R.toNumber(r.ef), 2), ls: fmtN(R.toNumber(r.ls), 2), lf: fmtN(R.toNumber(r.lf), 2), critical: r.critical }))}
          label={t('chart.network')}
        />
        <h3>{t('chart.gantt')}</h3>
        <Gantt rows={rows} total={R.toNumber(c.duration)} label={t('chart.gantt')} unit={t('chart.days')} />
        <p className="legend"><span className="lg critical">█ {t('legend.critical')}</span> <span className="lg slack">█ {t('legend.slack')}</span></p>
      </div>
    );
  }
  if (p.kind === 'flowshop' && sol.kind === 'flowshop') {
    const rowsOf = (seq: string[]): GanttRow[] => {
      const s = schedule(p, seq);
      const idleBars = (m: typeof s.m2) => {
        const out: GanttRow['bars'] = [];
        let tt = 0;
        for (const x of m) {
          if (R.toNumber(x.start) > tt) out.push({ from: tt, to: R.toNumber(x.start), kind: 'idle' });
          out.push({ from: R.toNumber(x.start), to: R.toNumber(x.end), text: x.id, kind: 'task' });
          tt = R.toNumber(x.end);
        }
        if (tt < R.toNumber(s.makespan)) out.push({ from: tt, to: R.toNumber(s.makespan), kind: 'idle' });
        return out;
      };
      return [
        { label: 'M1', bars: idleBars(s.m1) },
        { label: 'M2', bars: idleBars(s.m2) },
      ];
    };
    const sq = ex.asks.find((a) => a.kind === 'johnson' && (a.johnsonWhat ?? 'sequence') === 'sequence');
    const user = sq ? answers[sq.id]?.sequence : undefined;
    const userOk = user && user.length === p.jobs.length && new Set(user).size === user.length && user.join() !== sol.sequence.join();
    return (
      <div className="figs">
        <h3>{t('chart.ganttJohnson', { m: fmtR(sol.schedule.makespan) })}</h3>
        <Gantt rows={rowsOf(sol.sequence)} total={R.toNumber(sol.schedule.makespan)} label={t('chart.gantt')} unit="h" />
        {userOk && (
          <>
            <h3>{t('chart.yourGantt', { m: fmtR(schedule(p, user).makespan) })}</h3>
            <Gantt rows={rowsOf(user)} total={Math.max(R.toNumber(schedule(p, user).makespan), 1)} label={t('chart.yourGantt', { m: '' })} unit="h" />
          </>
        )}
        <p className="legend"><span className="lg idle">▨ {t('legend.idle')}</span></p>
      </div>
    );
  }
  return null;
}

export function PracticeExercise({ source }: { source: ExerciseSource }) {
  const { t, lang } = useT();
  const loaded = useMemo(() => load(source), [source]);
  const exId = loaded.ok ? loaded.ex.id : '';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => (exId ? loadAnswers(exId) : {}));
  const [result, setResult] = useState<GradeResult | undefined>();

  if (!loaded.ok)
    return (
      <section className="card">
        <a href={hrefOf({ name: 'practice' })}>{t('ex.back')}</a>
        <p className="note warn">{t(loaded.reason === 'notFound' ? 'ex.notFound' : 'ex.error')}</p>
      </section>
    );
  const ex = loaded.ex;
  const tpl = templateOf(ex);
  const onChange = (askId: string, patch: Partial<Answer>) =>
    setAnswers((prev) => {
      const next = { ...prev, [askId]: { ...(prev[askId] ?? {}), ...patch } };
      saveAnswers(ex.id, next);
      return next;
    });
  const check = () => {
    setResult(gradeExercise(ex, answers));
    setStep(2);
  };
  const graded = step >= 2 && result;

  return (
    <section className="card exercise">
      <div className="ex-top">
        <a href={hrefOf({ name: 'practice' })}>{t('ex.back')}</a>
        <span className="tags">
          <span className={`tag origin-${ex.origin}`}>{t(`origin.${ex.origin}`)}</span>
          <span className="tag">{t('practice.level', { n: ex.difficulty })}</span>
          {ex.seed !== undefined && <span className="tag">{t('ex.seed', { s: ex.seed })}</span>}
          {ex.review !== 'approved' && ex.origin !== 'generated' && <span className="tag warn">{t('practice.review')}</span>}
        </span>
      </div>
      <h1>{exerciseTitle(ex, t)}</h1>

      <ol className="stepper" aria-label={t('steps.label')}>
        {STEPS.map((k, i) => (
          <li key={k} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="num">{i + 1}</span> <span className="lbl">{t(k)}</span>
          </li>
        ))}
      </ol>

      <p className="statement">{ex.text[lang]}</p>
      {ex.origin !== 'generated' && (
        <p className="source">
          {t(`poolNote.${ex.id}`)}
          {ex.sourceUrl && (
            <>
              {' '}
              <a href={ex.sourceUrl} target="_blank" rel="noreferrer">
                {t('ex.source')}
              </a>
            </>
          )}
        </p>
      )}

      <DataTable ex={ex} />

      <h2 className="sec">{t('ex.asks')}</h2>
      <ol className="ask-list">
        {ex.asks.map((a, i) => (
          <li key={a.id}>
            {letter(i)} {askLabel(a, t)} {ex.weights[a.id] !== undefined && <small className="muted">({fmtN(ex.weights[a.id]!, 2)} p)</small>}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="actions">
          <button className="primary" onClick={() => setStep(1)}>
            {t('ex.start')}
          </button>
        </div>
      ) : (
        <>
          <AnswerForm ex={ex} answers={answers} onChange={onChange} {...(result ? { results: result.asks } : {})} disabled={!!graded} />
          <div className="actions">
            {step === 1 && (
              <button className="primary" onClick={check}>
                {t('ex.check')}
              </button>
            )}
            {graded && (
              <>
                <span className="score" role="status">
                  {t('ex.score', { s: fmtN(result.score10, 2) })}
                </span>
                {step === 2 && (
                  <button className="primary" onClick={() => setStep(3)}>
                    {t('ex.showSolution')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setResult(undefined);
                    setStep(1);
                  }}
                >
                  {t('ex.retry')}
                </button>
                {tpl && (
                  <button onClick={() => (window.location.hash = hrefOf({ name: 'generated', template: tpl, level: ex.difficulty, seed: randomSeed() }))}>
                    {t('ex.another')}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {graded && <Figures ex={ex} answers={answers} result={result} />}

      {step === 3 && (
        <section className="steps" aria-label={t('sol.title')}>
          <h2 className="sec">{t('sol.title')}</h2>
          {ex.asks.map((a, i) => (
            <article key={a.id} className="wstep">
              <h3>
                {letter(i)} {askLabel(a, t)}
              </h3>
              {solutionLines(ex, a, t).map((l, k) => (
                <p key={k} className="mono">
                  {l}
                </p>
              ))}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
