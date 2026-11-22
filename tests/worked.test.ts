/**
 * Worked exercises (spec §15.3, phase 6 acceptance: the full list, number tests green).
 *  - the 10 worked exercises of spec §15.1, each on a verified pool exercise;
 *  - the text templates contain no hard-coded numbers (all numbers come from the solvers);
 *  - the same numbers appear in both languages; every ask step explains why and warns.
 */
import { LEVELS, TEMPLATES, type TemplateId, verifyExercise } from '../src/core/generator';
import { gradeExercise } from '../src/core/grader';
import { poolById } from '../src/data/pool';
import { translate } from '../src/i18n';
import es from '../src/i18n/es.json';
import eu from '../src/i18n/eu.json';
import { buildWorked, WORKED, workedAsks } from '../src/ui/worked';
import { perfectAnswers } from './helpers';

/** Constants that belong to formulas or rules, not to the data. */
const ALLOWED = [/M[12]/g, /\b0\b/g, /\(a \+ 4m \+ b\)\/6/g, /\(a \+ m \+ b\)\/3/g, /\/6\)²/g, /1 − η/g];
function hardNumbers(s: string): string[] {
  let x = s.replace(/\{\w+\}/g, '');
  for (const re of ALLOWED) x = x.replace(re, '');
  return x.match(/\d+/g) ?? [];
}

describe('worked exercises', () => {
  it('there are 10 (spec §15.1), on verified pool exercises that perfect answers grade 10/10', () => {
    expect(WORKED).toHaveLength(10);
    expect(new Set(WORKED.map((w) => `${w.pool}:${(w.asks ?? []).join()}`)).size).toBe(10);
    for (const w of WORKED) {
      const ex = poolById(w.pool);
      expect(ex, w.pool).toBeDefined();
      expect(verifyExercise(ex!).reasons, w.pool).toEqual([]);
      expect(gradeExercise(ex!, perfectAnswers(ex!)).score10, w.pool).toBeCloseTo(10, 12);
      for (const id of w.asks ?? []) expect(ex!.asks.map((a) => a.id), `${w.id} ask ${id}`).toContain(id);
    }
  });

  it('"now you" points to a real template and level', () => {
    for (const w of WORKED) {
      expect(TEMPLATES).toContain(w.nowYou.template);
      expect(LEVELS[w.nowYou.template as TemplateId]).toContain(w.nowYou.level);
    }
  });

  it('text templates of worked exercises and solutions contain no hard-coded numbers', () => {
    for (const dict of [eu, es] as Record<string, string>[])
      for (const [k, v] of Object.entries(dict)) if (k.startsWith('wk.') || k.startsWith('sol.')) expect(hardNumbers(v), `${k}: ${v}`).toEqual([]);
  });

  it.each(WORKED.map((w) => [w.id, w] as const))('%s: steps in both languages with the same numbers', (_id, w) => {
    const ex = poolById(w.pool)!;
    const se = buildWorked(ex, w, (k, v) => translate('eu', k, v));
    const ss = buildWorked(ex, w, (k, v) => translate('es', k, v));
    expect(se.length).toBe(workedAsks(ex, w).length + 2 + (w.extra ? 1 : 0));
    expect(ss.map((s) => s.key)).toEqual(se.map((s) => s.key));
    const nums = (steps: typeof se) => steps.flatMap((s) => s.what.flatMap((l) => l.match(/\d+(,\d+)?/g) ?? []));
    expect(nums(ss)).toEqual(nums(se));
    for (const s of se.slice(1, -1)) {
      expect(s.why, `${w.id} ${s.key} why`).toBeTruthy();
      expect(s.careful, `${w.id} ${s.key} careful`).toBeTruthy();
    }
    for (const s of [...se, ...ss]) for (const l of [s.title, ...s.what, s.why ?? '', s.careful ?? '']) expect(l, `${w.id} ${s.key}`).not.toMatch(/NaN|undefined|\{[a-z]+\}|^wk\./);
    const sum = se[se.length - 1]!.what;
    expect(sum).toHaveLength(workedAsks(ex, w).length);
  });
});
