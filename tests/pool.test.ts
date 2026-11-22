/**
 * Pool (spec §9): OPE exercises re-modelled (src/data/pool-ope.json) + one pinned generated
 * exercise per template and level. `WRITE_POOL=1 npx vitest run tests/pool.test.ts` rebuilds
 * pool.json. Every entry waits for the user's review (spec §9.3) until approved.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { generate, LEVELS, rebuild, TEMPLATES, verifyExercise, type TemplateId } from '../src/core/generator';
import { gradeExercise } from '../src/core/grader';
import type { Exercise } from '../src/core/model';
import { type ExerciseJson, exerciseFromJson, exerciseToJson } from '../src/core/serialize';
import { solve } from '../src/core/solve';
import { perfectAnswers } from './helpers';

const OPE_FILE = 'src/data/pool-ope.json';
const POOL_FILE = 'src/data/pool.json';
const PIN_SEED = 1;
/** Extra pinned exercises used by worked exercises (spec §15.3): balancing L2 with RPW. */
const EXTRA_PINS: { t: TemplateId; lv: 1 | 2 | 3; seed: number }[] = [{ t: 'balancing', lv: 2, seed: 5 }];

const ope: Exercise[] = (JSON.parse(readFileSync(OPE_FILE, 'utf8')) as ExerciseJson[]).map(exerciseFromJson);

function buildPool(): ExerciseJson[] {
  const pinned = [...TEMPLATES.flatMap((t) => LEVELS[t].map((lv) => generate(t, PIN_SEED, lv).exercise)), ...EXTRA_PINS.map((p) => generate(p.t, p.seed, p.lv).exercise)].map((ex) =>
    exerciseToJson({ ...ex, review: 'review-needed' }),
  );
  return [...ope.map(exerciseToJson), ...pinned];
}

if (process.env.WRITE_POOL === '1') writeFileSync(POOL_FILE, JSON.stringify(buildPool(), null, 1) + '\n');

describe('pool', () => {
  it('pool.json is up to date with pool-ope.json and the pinned seeds', () => {
    expect(existsSync(POOL_FILE)).toBe(true);
    expect(JSON.parse(readFileSync(POOL_FILE, 'utf8'))).toEqual(JSON.parse(JSON.stringify(buildPool())));
  });

  const pool: Exercise[] = existsSync(POOL_FILE) ? (JSON.parse(readFileSync(POOL_FILE, 'utf8')) as ExerciseJson[]).map(exerciseFromJson) : [];

  it.each(pool.map((e) => [e.id, e] as const))('%s: verified, perfect answers 10/10, waiting for review', (_id, e) => {
    expect(verifyExercise(e).reasons).toEqual([]);
    expect(gradeExercise(e, perfectAnswers(e)).score10).toBeCloseTo(10, 12);
    expect(e.review).toBe('review-needed');
  });

  it('pinned generated exercises rebuild from their stored seed', () => {
    for (const e of pool.filter((x) => x.origin === 'generated')) {
      const [t, lv] = e.id.split('-') as [TemplateId, string];
      expect(JSON.stringify(exerciseToJson({ ...rebuild(t, e.seed!, Number(lv) as 1 | 2 | 3), review: 'review-needed' }))).toBe(JSON.stringify(exerciseToJson(e)));
    }
  });

  it('OPE solutions are written out for the user review', () => {
    const lines = ope.map((e) => `${e.id}: ${JSON.stringify(solve(e.problem), (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
    mkdirSync('tools/oracle/out', { recursive: true }); // gitignored: absent in CI
    writeFileSync('tools/oracle/out/ope-solutions.txt', lines.join('\n') + '\n');
    expect(ope.length).toBe(4);
  });
});
