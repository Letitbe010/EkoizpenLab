/**
 * Exam mode (spec §13.1): three exercises (balancing, CPM or PERT, Johnson) from one seed, a
 * countdown (30/45/60/90 min, default 45), grading only at the end (also when time runs
 * out). Start time and answers are kept in localStorage, so a reload does not restart the
 * clock. Every graded exercise is recorded in the progress history. Pattern of HabeLab.
 */
import { useEffect, useMemo, useState } from 'react';
import { EXAM_DEFAULT_MINUTES, EXAM_MINUTES, examExercises, examPlan, examScore, formatClock, remainingSeconds } from '../core/exam';
import { type Answer, gradeExercise } from '../core/grader';
import { useT } from '../i18n';
import { AnswerForm } from './AnswerForm';
import { DataTable } from './DataTable';
import { fmtN } from './format';
import { recordAttempts } from './progress';
import { attemptsOf } from './record';
import { hrefOf } from './router';
import { loadExam, saveExam } from './store';

export function ExamStart() {
  const { t } = useT();
  const [minutes, setMinutes] = useState<number>(EXAM_DEFAULT_MINUTES);
  const start = () => {
    const seed = 1 + Math.floor(Math.random() * 999_999);
    window.location.hash = hrefOf({ name: 'examRun', seed, minutes });
  };
  return (
    <section className="card">
      <h1>{t('exam.title')}</h1>
      <p className="lead">{t('exam.lead')}</p>
      <ul>
        <li>{t('exam.rule1')}</li>
        <li>{t('exam.rule2')}</li>
        <li>{t('exam.rule3')}</li>
      </ul>
      <div className="ask">
        <b>{t('exam.time')}</b>
        <div className="choice" role="radiogroup" aria-label={t('exam.time')} style={{ marginTop: 6 }}>
          {EXAM_MINUTES.map((m) => (
            <button key={m} role="radio" aria-checked={minutes === m} className={minutes === m ? 'sel' : ''} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="primary" onClick={start}>
            {t('exam.start')}
          </button>
        </div>
      </div>
    </section>
  );
}

export function ExamRun({ seed, minutes }: { seed: number; minutes: number }) {
  const { t, lang } = useT();
  const exercises = useMemo(() => examExercises(seed), [seed]);
  const [state, setState] = useState(() => loadExam(seed) ?? { startedAt: Date.now(), answers: {}, graded: false });
  const [now, setNow] = useState(Date.now());
  useEffect(() => saveExam(seed, state), [seed, state]);
  useEffect(() => {
    if (state.graded) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.graded]);
  const left = remainingSeconds(state.startedAt, minutes, now);
  const results = useMemo(() => (state.graded ? exercises.map((ex) => gradeExercise(ex, state.answers[ex.id] ?? {})) : null), [state.graded, state.answers, exercises]);
  const finish = () => {
    if (state.graded) return;
    const res = exercises.map((ex) => gradeExercise(ex, state.answers[ex.id] ?? {}));
    recordAttempts(exercises.flatMap((ex, k) => attemptsOf(ex, res[k]!)));
    setState((s) => ({ ...s, graded: true }));
  };
  useEffect(() => {
    if (left === 0 && !state.graded) finish();
  });
  const onChange = (exId: string) => (askId: string, patch: Partial<Answer>) =>
    setState((s) => ({ ...s, answers: { ...s.answers, [exId]: { ...(s.answers[exId] ?? {}), [askId]: { ...(s.answers[exId]?.[askId] ?? {}), ...patch } } } }));

  return (
    <section className="card exercise">
      <div className="ex-top">
        <a href={hrefOf({ name: 'exam' })}>← {t('exam.title')}</a>
        <span className="tags">
          <span className="tag">{t('ex.seed', { s: seed })}</span>
          <span className={`tag clock${left < 300 && !state.graded ? ' warn' : ''}`} role="timer" aria-live="off">
            {state.graded ? t('exam.done') : `⏱ ${formatClock(left)}`}
          </span>
        </span>
      </div>
      <h1>{t('exam.title')}</h1>
      {results && (
        <p className="score" role="status">
          {t('exam.score', { s: fmtN(examScore(results.map((r) => r.score10)), 1) })} ({results.map((r) => fmtN(r.score10, 1)).join(' · ')})
        </p>
      )}
      {exercises.map((ex, k) => (
        <article key={ex.id} className="exam-ex">
          <h2>
            {k + 1}. {t(`tpl.${examPlan(seed)[k]!.template}`)}
            {results && <span className="tag"> {fmtN(results[k]!.score10, 1)} / 10</span>}
          </h2>
          <p className="statement">{ex.text[lang]}</p>
          <DataTable ex={ex} />
          <AnswerForm ex={ex} answers={state.answers[ex.id] ?? {}} onChange={onChange(ex.id)} {...(results ? { results: results[k]!.asks } : {})} disabled={state.graded} />
          {results && (
            <p>
              <a href={hrefOf({ name: 'generated', template: examPlan(seed)[k]!.template, level: examPlan(seed)[k]!.level, seed: ex.seed! })}>
                {t('exam.review')} →
              </a>
            </p>
          )}
        </article>
      ))}
      {!state.graded && (
        <div className="actions">
          <button
            className="primary"
            onClick={() => {
              if (window.confirm(t('exam.confirm'))) finish();
            }}
          >
            {t('exam.finish')}
          </button>
        </div>
      )}
    </section>
  );
}
