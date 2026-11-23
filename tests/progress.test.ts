/** Phase 8: progress store, attempts recorded from grading, exam mode. */
import { examExercises, examPlan, examScore, formatClock, remainingSeconds } from '../src/core/exam';
import { verifyExercise } from '../src/core/generator';
import { gradeExercise } from '../src/core/grader';
import { poolById } from '../src/data/pool';
import { translate } from '../src/i18n';
import { ratesBy, sanitize, topMistakes, type Attempt } from '../src/ui/progress';
import { askKeyLabel, attemptsOf, DIAG_TOPIC } from '../src/ui/record';
import { TOPIC_IDS } from '../src/content/theory/ids';
import { variant } from '../src/ui/worked';
import { exerciseToJson, problemToJson } from '../src/core/serialize';
import { perfectAnswers } from './helpers';
import { LEVELS, TEMPLATES, generate } from '../src/core/generator';

describe('progress store', () => {
  it('sanitize keeps valid data and drops the rest', () => {
    const d = sanitize({
      attempts: [
        { ts: 1, exercise: 'x', origin: 'ope', level: 2, ask: 'nMin', status: 'wrong', diagnoses: ['nmin-floor', 3] },
        { exercise: 'y', ask: 'nMin', status: 'bogus' },
        'junk',
      ],
      theorySeen: ['cpm', 7],
      lastRoute: 'http://evil',
      introSeen: true,
      settings: { theme: 'dark' },
    });
    expect(d.attempts).toHaveLength(1);
    expect(d.attempts[0]!.diagnoses).toEqual(['nmin-floor']);
    expect(d.theorySeen).toEqual(['cpm']);
    expect(d.lastRoute).toBeUndefined();
    expect(d.introSeen).toBe(true);
    expect(d.settings.theme).toBe('dark');
    expect(sanitize(null).attempts).toEqual([]);
  });

  it('rates ignore missing answers; partial is not correct; top mistakes by count', () => {
    const a = (ask: string, status: Attempt['status'], diagnoses: string[] = []): Attempt => ({ ts: 0, exercise: 'e', origin: 'generated', level: 1, ask, status, diagnoses });
    const as = [a('nMin', 'correct'), a('nMin', 'wrong', ['nmin-floor']), a('nMin', 'missing'), a('cycleTime', 'partial'), a('cycleTime', 'wrong', ['nmin-floor', 'not-identified'])];
    expect(ratesBy(as, (x) => x.ask)).toEqual([
      { key: 'nMin', correct: 1, total: 2 },
      { key: 'cycleTime', correct: 0, total: 2 },
    ]);
    expect(topMistakes(as)).toEqual([{ code: 'nmin-floor', count: 2 }]);
  });
});

describe('attempts recorded from grading', () => {
  it('one attempt per ask, with its explanation key and diagnoses', () => {
    const ex = poolById('spec-eg1')!;
    const ans = { ...perfectAnswers(ex), c: { value: '2' } };
    const at = attemptsOf(ex, gradeExercise(ex, ans), 42);
    expect(at).toHaveLength(ex.asks.length);
    const c = at.find((x) => x.ask === 'nMin')!;
    expect(c.status).toBe('wrong');
    expect(c.diagnoses).toEqual(['nmin-floor']);
    expect(at.find((x) => x.ask === 'efficiency.station')!.status).toBe('correct');
    expect(at.every((x) => x.ts === 42 && x.exercise === 'spec-eg1' && x.origin === 'adapted')).toBe(true);
  });

  it('every ask key of every template has a label, and mistake links point to real topics', () => {
    const keys = new Set<string>();
    for (const t of TEMPLATES) for (const lv of LEVELS[t]) for (const ex of [generate(t, 2, lv).exercise]) for (const a of ex.asks) keys.add(variant(ex, a));
    for (const e of ['ope-euskadi-2020-6', 'ope-madrid-2022-7']) for (const a of poolById(e)!.asks) keys.add(variant(poolById(e)!, a));
    for (const lang of ['eu', 'es'] as const)
      for (const k of keys) expect(askKeyLabel(k, (key, v) => translate(lang, key, v)), k).not.toMatch(/^ask\.|^prog\./);
    for (const topic of Object.values(DIAG_TOPIC)) expect(TOPIC_IDS).toContain(topic);
  });
});

describe('exam mode', () => {
  it('three verified exercises (balancing, project, Johnson), same seed → same exam', () => {
    for (const seed of [1, 2, 3, 12345, 999_999]) {
      const a = examExercises(seed);
      expect(a.map((e) => e.problem.kind)).toEqual(['balancing', 'project', 'flowshop']);
      expect(JSON.stringify(examExercises(seed).map(exerciseToJson))).toBe(JSON.stringify(a.map(exerciseToJson)));
      for (const e of a) {
        expect(verifyExercise({ ...e, origin: 'generated' }).reasons).toEqual([]);
        expect(gradeExercise(e, perfectAnswers(e)).score10).toBeCloseTo(10, 12);
      }
      // the "review" link rebuilds the same exercise from its template, level and seed
      examPlan(seed).forEach((p, k) => {
        const again = generate(p.template, a[k]!.seed!, p.level).exercise;
        expect(JSON.stringify(problemToJson(again.problem))).toBe(JSON.stringify(problemToJson(a[k]!.problem)));
      });
    }
  });

  it('score, clock and remaining time', () => {
    expect(examScore([10, 5, 7.5])).toBe(7.5);
    expect(examScore([])).toBe(0);
    expect(formatClock(2700)).toBe('45:00');
    expect(formatClock(65)).toBe('1:05');
    expect(remainingSeconds(0, 45, 60_000)).toBe(2640);
    expect(remainingSeconds(0, 1, 120_000)).toBe(0);
  });
});
