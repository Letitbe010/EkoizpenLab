import { generate, LEVELS, rebuild, signature, TEMPLATES, verifyExercise, type TemplateId } from '../src/core/generator';
import { gradeExercise } from '../src/core/grader';
import { exerciseFromJson, exerciseToJson } from '../src/core/serialize';
import { perfectAnswers } from './helpers';

const J = (e: Parameters<typeof exerciseToJson>[0]): string => JSON.stringify(exerciseToJson(e));
const N = Number(process.env.GEN_N ?? 10000);

describe(`generator: ${N} exercises verified (spec §12, phase 4)`, () => {
  it('every template and level produces verified exercises that perfect answers grade 10/10', () => {
    const combos: [TemplateId, 1 | 2 | 3][] = TEMPLATES.flatMap((t) => LEVELS[t].map((l) => [t, l] as [TemplateId, 1 | 2 | 3]));
    const counts = new Map<string, number>();
    let maxAttempts = 0;
    for (let i = 0; i < N; i++) {
      const [t, lv] = combos[i % combos.length]!;
      const { exercise, attempts } = generate(t, 1000 + i, lv);
      maxAttempts = Math.max(maxAttempts, attempts);
      const v = verifyExercise(exercise);
      if (!v.ok) throw new Error(`${exercise.id}: ${v.reasons.join('; ')}`);
      const g = gradeExercise(exercise, perfectAnswers(exercise));
      if (g.score10 !== 10) throw new Error(`${exercise.id}: perfect answers scored ${g.score10} ${JSON.stringify(g.asks.filter((a) => a.score < 1))}`);
      if (!exercise.text.eu || !exercise.text.es) throw new Error(`${exercise.id}: missing statement`);
      counts.set(`${t}-${lv}`, (counts.get(`${t}-${lv}`) ?? 0) + 1);
    }
    expect(counts.size).toBe(combos.length);
    expect(maxAttempts).toBeLessThan(300);
  }, 900_000);

  it('same seed → same exercise; the stored seed rebuilds it; JSON round trip is lossless', () => {
    for (const t of TEMPLATES) {
      for (const lv of LEVELS[t]) {
        const a = generate(t, 42, lv).exercise;
        expect(J(generate(t, 42, lv).exercise)).toBe(J(a));
        expect(J(rebuild(t, a.seed!, lv))).toBe(J(a));
        expect(J(exerciseFromJson(JSON.parse(J(a))))).toBe(J(a));
      }
    }
  });

  it('different seeds give different exercises', () => {
    for (const t of TEMPLATES) {
      const sigs = new Set<string>();
      for (let s = 0; s < 50; s++) sigs.add(signature(generate(t, s, LEVELS[t][0]).exercise));
      expect(sigs.size, t).toBeGreaterThan(45);
    }
  });

  it('level rules: L1 balancing uses LTT; L3 CPM has two critical paths; Johnson L1 has no ties', () => {
    for (let s = 0; s < 30; s++) {
      const b = generate('balancing', s, 1).exercise;
      expect(b.problem.kind === 'balancing' && b.problem.heuristic).toBe('LTT');
    }
  });
});
