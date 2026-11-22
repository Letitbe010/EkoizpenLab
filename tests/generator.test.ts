import { generate, LEVELS, rebuild, signature, TEMPLATES, verifyExercise, type TemplateId } from '../src/core/generator';
import { gradeExercise } from '../src/core/grader';
import { exerciseFromJson, exerciseToJson } from '../src/core/serialize';
import { solve } from '../src/core/solve';
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
      const c = solve(generate('cpm', s, 3).exercise.problem);
      expect(c.kind === 'project' && c.cpm.criticalPaths.length).toBe(2);
      const j = solve(generate('johnson', s, 1).exercise.problem);
      expect(j.kind === 'flowshop' && j.johnsonSequences.length).toBe(1);
    }
  });

  it('tie rules: never "shortest" with LTT; a non-alphabetical rule names the alphabetical fallback', () => {
    let shortest = 0;
    for (let s = 0; s < 300; s++) {
      for (const t of ['balancing', 'balancingExcess'] as const) {
        const e = generate(t, s, 3).exercise;
        if (e.problem.kind !== 'balancing') continue;
        if (e.problem.heuristic === 'LTT') expect(e.problem.tieBreak ?? 'alpha').toBe('alpha');
        if (e.problem.tieBreak === 'shortest') {
          shortest++;
          expect(e.text.eu).toContain('berdinketak jarraitzen badu, ordena alfabetikoa');
          expect(e.text.es).toContain('si persiste el empate, orden alfabético');
        }
      }
    }
    expect(shortest).toBeGreaterThan(0);
  });
});
