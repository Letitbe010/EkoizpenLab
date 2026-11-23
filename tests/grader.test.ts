/**
 * Grader tests (spec §11.1): correct answers score 100 %; every common mistake of §8.3 gets
 * its diagnosis; in multi-solution asks every valid solution scores 100 % and invalid ones 0.
 * Expected values below are the hand-checked golden values, not solver output.
 */
import { type Answer, gradeExercise, parseUserValue } from '../src/core/grader';
import type { Ask, BalancingProblem, Exercise, FlowShopProblem, Problem, ProjectProblem } from '../src/core/model';
import * as R from '../src/core/rational';
import { goldenProblem } from './helpers';

const ex = (problem: Problem, asks: Ask[]): Exercise => ({
  id: 'test',
  origin: 'generated',
  difficulty: 1,
  problem,
  asks,
  weights: {},
  text: { eu: '', es: '' },
});
const one = (e: Exercise, a: Record<string, Answer>, id: string) => gradeExercise(e, a).asks.find((x) => x.id === id)!;

describe('parseUserValue', () => {
  it('decimal comma/point, fractions, minus sign; garbage', () => {
    expect(R.toString(parseUserValue('13,33')!.r)).toBe('1333/100');
    expect(parseUserValue('13,33')!.decimals).toBe(2);
    expect(R.toString(parseUserValue('40/3')!.r)).toBe('40/3');
    expect(parseUserValue('40/3')!.decimals).toBeNull();
    expect(R.toString(parseUserValue('−5')!.r)).toBe('-5');
    expect(parseUserValue('  ')).toBeUndefined();
    expect(parseUserValue(undefined)).toBeUndefined();
    for (const s of ['1,2.3', 'abc', '1/0', '1/', '12 min']) expect(parseUserValue(s)).toBeNull();
  });
});

// ------------------------------------------------------------------ EG1 (rule given)

const eg1 = goldenProblem<BalancingProblem>('EG1');
const balancingAsks: Ask[] = [
  { id: 'a', kind: 'precedence' },
  { id: 'b', kind: 'cycleTime' },
  { id: 'c', kind: 'nMin' },
  { id: 'd', kind: 'assignment' },
  { id: 'e', kind: 'stationTimes' },
  { id: 'f', kind: 'idle' },
  { id: 'g', kind: 'efficiency' },
  { id: 'h', kind: 'efficiency', scope: 'station', station: 'last' },
];
const E1 = ex(eg1, balancingAsks);
const eg1Correct: Record<string, Answer> = {
  a: { edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'F'], ['E', 'F'], ['F', 'G']] },
  b: { value: '10' },
  c: { value: '3' },
  d: { stations: [['A', 'C'], ['B', 'E'], ['G', 'F', 'D']] }, // order inside a station is free
  e: { values: ['9', '9', '9'] },
  f: { value: '3' },
  g: { value: '90' },
  h: { value: '90,0' },
};

describe('grader: EG1 line balancing', () => {
  it('correct answers score 10', () => {
    const g = gradeExercise(E1, eg1Correct);
    expect(g.asks.map((a) => a.status)).toEqual(Array(8).fill('correct'));
    expect(g.score10).toBe(10);
  });

  it('missing answers are "missing", garbage is "invalid"', () => {
    const g = gradeExercise(E1, { b: { value: 'diez' } });
    expect(g.asks.find((a) => a.id === 'b')!.status).toBe('invalid');
    expect(g.asks.find((a) => a.id === 'c')!.status).toBe('missing');
    expect(g.score10).toBe(0);
  });

  it('units: 600 s is right, 600 with min selected is "units-mixed"', () => {
    expect(one(E1, { b: { value: '600', unit: 's' } }, 'b').status).toBe('correct');
    expect(one(E1, { b: { value: '1/6', unit: 'h' } }, 'b').status).toBe('correct');
    expect(one(E1, { b: { value: '600', unit: 'min' } }, 'b').items[0]!.diagnosis).toBe('units-mixed');
  });

  it('diagnosis 1: C = demand / time', () => {
    expect(one(E1, { b: { value: '0,1' } }, 'b').items[0]!.diagnosis).toBe('c-inverted');
  });

  it('diagnosis 2: N_min rounded down', () => {
    expect(one(E1, { c: { value: '2' } }, 'c').items[0]!.diagnosis).toBe('nmin-floor');
  });

  it('precedence: redundant edges accepted with a note; missing / extra edges wrong; cycles invalid', () => {
    const r = one(E1, { a: { edges: [...eg1Correct.a!.edges!, ['A', 'F']] } }, 'a');
    expect(r.status).toBe('correct');
    expect(r.notes.map((n) => n.id)).toContain('redundant-edges');
    const miss = one(E1, { a: { edges: eg1Correct.a!.edges!.filter(([x, y]) => !(x === 'E' && y === 'F')) } }, 'a');
    expect(miss.status).toBe('partial');
    expect(miss.items.find((i) => i.part === 'E→F')!.status).toBe('wrong');
    const extra = one(E1, { a: { edges: [...eg1Correct.a!.edges!, ['B', 'C']] } }, 'a');
    expect(extra.items.find((i) => i.part === 'B→C')!.status).toBe('wrong');
    expect(one(E1, { a: { edges: [['A', 'B'], ['B', 'A']] } }, 'a').status).toBe('invalid');
  });

  it('diagnosis 4: violated precedence and station over C', () => {
    const r = one(E1, { d: { stations: [['A', 'B'], ['E'], ['C', 'D', 'F']] } }, 'd');
    expect(r.score).toBe(0);
    expect(r.items.find((i) => i.diagnosis === 'precedence-violated')!.detail).toBe('C>E');
    const o = one(E1, { d: { stations: [['A', 'C', 'B'], ['E', 'D'], ['F', 'G']] } }, 'd');
    expect(o.items.find((i) => i.diagnosis === 'over-c')!.detail).toBe('1');
  });

  it('valid assignment not following the rule: 0.5 with the first deviation', () => {
    const r = one(E1, { d: { stations: [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G']] } }, 'd');
    expect(r.status).toBe('partial');
    expect(r.score).toBe(0.5);
    expect(r.notes[0]!.id).toBe('valid-not-rule');
    expect(r.notes[0]!.detail).toBe('1: A,C / A,B');
  });

  it("station-dependent asks use the user's valid assignment (N = 4)", () => {
    const d = { stations: [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G']] };
    const g = gradeExercise(E1, { d, e: { values: ['8', '7', '8', '4'] }, f: { value: '13' }, g: { value: '67,5' }, h: { value: '40' } });
    for (const id of ['e', 'f', 'g', 'h']) {
      const a = g.asks.find((x) => x.id === id)!;
      expect(a.status, id).toBe('correct');
      expect(a.notes[0]!.id).toBe('graded-on-yours');
    }
  });

  it('empty station slots are ignored in the assignment and in the station-dependent asks', () => {
    const d = { stations: [['A', 'B'], [], ['C', 'D'], ['E', 'F'], ['G']] };
    const g = gradeExercise(E1, { d, g: { value: '67,5' }, e: { values: ['8', '7', '8', '4'] } });
    expect(g.asks.find((x) => x.id === 'd')!.score).toBe(0.5);
    for (const id of ['e', 'g']) {
      const a = g.asks.find((x) => x.id === id)!;
      expect(a.status, id).toBe('correct');
      expect(a.notes[0]!.id).toBe('graded-on-yours');
    }
  });

  it('diagnosis 3 with a bottleneck base: computed with C instead', () => {
    const Eb = ex({ ...eg1, efficiencyBase: 'bottleneck' }, balancingAsks);
    const d = { stations: [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G']] };
    expect(one(Eb, { d, g: { value: '84,38' } }, 'g').status).toBe('correct'); // 27 / (4·8)
    expect(one(Eb, { d, g: { value: '67,5' } }, 'g').items[0]!.diagnosis).toBe('eff-c-base'); // 27 / (4·10)
    expect(one(Eb, { d, h: { value: '40' } }, 'h').items[0]!.diagnosis).toBe('eff-c-base'); // 4 / 10
  });

  it('station-dependent asks fall back to the reference when the assignment is invalid', () => {
    const g = gradeExercise(E1, { d: { stations: [['A', 'E']] }, g: { value: '90' } });
    const a = g.asks.find((x) => x.id === 'g')!;
    expect(a.status).toBe('correct');
    expect(a.notes[0]!.id).toBe('graded-on-reference');
  });

  it('diagnosis 3: efficiency with N_min, or with the bottleneck instead of C', () => {
    const d = { stations: [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G']] };
    expect(one(E1, { d, g: { value: '90' } }, 'g').items[0]!.diagnosis).toBe('eff-nmin'); // 27 / (3·10)
    expect(one(E1, { d, g: { value: '84,38' } }, 'g').items[0]!.diagnosis).toBe('eff-bottleneck'); // 27 / (4·8)
    expect(one(E1, { d, h: { value: '50' } }, 'h').items[0]!.diagnosis).toBe('eff-bottleneck'); // 4 / 8
  });

  it('efficiency tolerance ±0.1 percentage points; fraction unit', () => {
    const d = { stations: [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G']] };
    expect(one(E1, { d, g: { value: '67,6' } }, 'g').status).toBe('correct');
    expect(one(E1, { d, g: { value: '67,7' } }, 'g').status).toBe('wrong');
    expect(one(E1, { d, g: { value: '0,675', unit: 'fraction' } }, 'g').status).toBe('correct');
  });
});

// ------------------------------------------------------------------ no rule: any valid assignment

describe('grader: assignment without rule (spec §8.2)', () => {
  const p: BalancingProblem = { ...eg1, heuristic: undefined };
  const E = ex(p, [{ id: 'd', kind: 'assignment' }]);
  it('every valid 3-station assignment scores 1; every invalid one 0', () => {
    const ids = p.tasks.map((t) => t.id);
    const time = new Map(p.tasks.map((t) => [t.id, Number(t.t.n)]));
    let valid = 0;
    for (let code = 0; code < 3 ** ids.length; code++) {
      const st: string[][] = [[], [], []];
      let c = code;
      for (const id of ids) {
        st[c % 3]!.push(id);
        c = Math.floor(c / 3);
      }
      if (st.some((s) => s.length === 0)) continue;
      // independent validity check, written here
      const where = new Map(st.flatMap((s, k) => s.map((id) => [id, k] as const)));
      const ok =
        st.every((s) => s.reduce((a, id) => a + time.get(id)!, 0) <= 10) &&
        p.tasks.every((t) => t.preds.every((x) => where.get(x)! <= where.get(t.id)!));
      const r = one(E, { d: { stations: st } }, 'd');
      expect(r.score, JSON.stringify(st)).toBe(ok ? 1 : 0);
      if (ok) valid++;
    }
    expect(valid).toBeGreaterThan(1);
  });
  it('valid but with more stations than the optimum: 0.5', () => {
    const r = one(E, { d: { stations: [['A', 'B'], ['C', 'D'], ['E', 'F'], ['G']] } }, 'd');
    expect(r.score).toBe(0.5);
    expect(r.notes[0]).toEqual({ id: 'valid-not-optimal', detail: '3' });
  });
});

// ------------------------------------------------------------------ EG2 CPM

const eg2 = goldenProblem<ProjectProblem>('EG2');
const E2 = ex(eg2, [
  { id: 'a', kind: 'cpmTable' },
  { id: 'b', kind: 'criticalPath' },
  { id: 'c', kind: 'duration' },
]);
// hand table: ES EF LS LF TF FF
const T2: Record<string, string[]> = {
  A: ['0', '3', '1', '4', '1', '0'],
  B: ['0', '4', '0', '4', '0', '0'],
  C: ['3', '5', '7', '9', '4', '4'],
  D: ['4', '9', '4', '9', '0', '0'],
  E: ['9', '12', '9', '12', '0', '0'],
};
const table = (t: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(t).map(([id, v]) => [id, { es: v[0], ef: v[1], ls: v[2], lf: v[3], tf: v[4], ff: v[5] }]));

describe('grader: EG2 CPM', () => {
  it('correct answers score 10', () => {
    const g = gradeExercise(E2, { a: { table: table(T2) }, b: { paths: [['B', 'D', 'E']] }, c: { value: '12' } });
    expect(g.score10).toBe(10);
  });
  it('diagnosis 5: free and total float swapped; backward pass with max', () => {
    const t = structuredClone(T2);
    t.A![4] = '0'; // TF of A written as its FF
    t.A![3] = '7'; // LF of A = max(LS C 7, LS D 4)
    const r = one(E2, { a: { table: table(t) } }, 'a');
    expect(r.items.find((i) => i.part === 'A.tf')!.diagnosis).toBe('ff-tf-swapped');
    expect(r.items.find((i) => i.part === 'A.lf')!.diagnosis).toBe('backward-max');
    expect(r.score).toBeCloseTo(28 / 30, 10);
  });
  it('critical paths: all required by default, any one if the exercise says so', () => {
    const p: ProjectProblem = {
      kind: 'project',
      activities: [
        { id: 'A', d: R.q(2), preds: [] },
        { id: 'B', d: R.q(3), preds: ['A'] },
        { id: 'C', d: R.q(3), preds: ['A'] },
        { id: 'D', d: R.q(1), preds: ['B', 'C'] },
      ],
    };
    const all = ex(p, [{ id: 'x', kind: 'criticalPath' }]);
    const any = ex(p, [{ id: 'x', kind: 'criticalPath', criticalMode: 'any' }]);
    expect(one(all, { x: { paths: [['A', 'B', 'D'], ['A', 'C', 'D']] } }, 'x').score).toBe(1);
    expect(one(all, { x: { paths: [['A', 'B', 'D']] } }, 'x').score).toBe(0.5);
    expect(one(any, { x: { paths: [['A', 'B', 'D']] } }, 'x').score).toBe(1);
    expect(one(any, { x: { paths: [['A', 'C', 'D']] } }, 'x').score).toBe(1);
    expect(one(any, { x: { paths: [['A', 'B']] } }, 'x').score).toBe(0);
  });
});

// ------------------------------------------------------------------ EG4 PERT

const eg4 = goldenProblem<ProjectProblem>('EG4');
const E4 = ex(eg4, [
  { id: 'te', kind: 'pert', pertWhat: 'te' },
  { id: 'v', kind: 'pert', pertWhat: 'variance' },
  { id: 's', kind: 'pert', pertWhat: 'sigma' },
  { id: 'p', kind: 'pert', pertWhat: 'probability', t: R.q(17) },
  { id: 't', kind: 'pert', pertWhat: 'deadline', prob: 0.9 },
]);

describe('grader: EG4 PERT', () => {
  it('correct answers (3 decimals; P with z from a table) score 10', () => {
    // t for 90 %: 16 + 1,2816 · 1,9149 = 18,454
    const g = gradeExercise(E4, {
      te: { perId: { A: '4', B: '6', C: '6' } },
      v: { value: '3,667' },
      s: { value: '1,915' },
      p: { value: '69,85' }, // Φ(0,52) from the table
      t: { value: '18,45' },
    });
    expect(g.asks.map((a) => [a.id, a.status])).toEqual([['te', 'correct'], ['v', 'correct'], ['s', 'correct'], ['p', 'correct'], ['t', 'correct']]);
  });
  it('diagnosis 6: deviations summed instead of variances; wrong side of Φ', () => {
    // σ_i = 2/3, 5/3, 2/3 → Σσ = 3
    expect(one(E4, { s: { value: '3' } }, 's').items[0]!.diagnosis).toBe('sd-summed');
    expect(one(E4, { v: { value: '9' } }, 'v').items[0]!.diagnosis).toBe('sd-summed');
    expect(one(E4, { p: { value: '63,06' } }, 'p').items[0]!.diagnosis).toBe('sd-summed'); // Φ(1/3)
    expect(one(E4, { p: { value: '30,1' } }, 'p').items[0]!.diagnosis).toBe('phi-wrong-side');
    expect(one(E4, { v: { value: '3,66' } }, 'v').status).toBe('wrong'); // 3 decimals required
  });
  it('diagnosis 6: a non-critical path (Madrid 2022-7)', () => {
    const pa = (id: string, a: number, m: number, b: number, preds: string[] = []) => ({
      id,
      preds,
      pert: [R.q(a), R.q(m), R.q(b)] as [R.Rational, R.Rational, R.Rational],
    });
    const p: ProjectProblem = {
      kind: 'project',
      activities: [
        pa('A', 4, 6, 8), pa('B', 5, 7, 15, ['A']), pa('C', 4, 8, 12, ['A']), pa('D', 15, 20, 25, ['B']), pa('E', 10, 18, 26, ['B']),
        pa('F', 8, 9, 16, ['C']), pa('G', 4, 8, 12, ['E']), pa('H', 1, 2, 3, ['D', 'F']), pa('I', 6, 7, 8, ['G', 'H']),
      ],
    };
    const E = ex(p, [{ id: 'v', kind: 'pert', pertWhat: 'variance' }]);
    expect(one(E, { v: { value: '12,222' } }, 'v').status).toBe('correct');
    // A-B-D-H-I: 4/9 + 25/9 + 25/9 + 1/9 + 1/9 = 56/9 = 6.222
    expect(one(E, { v: { value: '6,222' } }, 'v').items[0]!.diagnosis).toBe('other-path');
  });
});

// ------------------------------------------------------------------ EG3 Johnson

const eg3 = goldenProblem<FlowShopProblem>('EG3');
const E3 = ex(eg3, [
  { id: 's', kind: 'johnson', johnsonWhat: 'sequence' },
  { id: 'm', kind: 'johnson', johnsonWhat: 'makespan' },
  { id: 'i', kind: 'johnson', johnsonWhat: 'idle' },
]);

describe('grader: EG3 Johnson', () => {
  it('correct answers score 10', () => {
    const g = gradeExercise(E3, { s: { sequence: ['J3', 'J1', 'J4', 'J5', 'J2'] }, m: { value: '24' }, i: { m1: '2', m2: '3' } });
    expect(g.score10).toBe(10);
  });
  it('diagnosis 7: rule reversed', () => {
    const r = one(E3, { s: { sequence: ['J2', 'J5', 'J4', 'J1', 'J3'] } }, 's');
    expect(r.score).toBe(0);
    expect(r.items[0]!.diagnosis).toBe('johnson-reversed');
  });
  it('every permutation: Johnson → 1, optimal non-Johnson → 0.5, others → 0', () => {
    const ids = ['J1', 'J2', 'J3', 'J4', 'J5'];
    const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x) => perms(xs.filter((y) => y !== x)).map((r) => [x, ...r])));
    const job = new Map(eg3.jobs.map((j) => [j.id, [Number(j.p1.n), Number(j.p2.n)]]));
    let half = 0;
    for (const s of perms(ids)) {
      let c1 = 0;
      let c2 = 0;
      for (const id of s) {
        c1 += job.get(id)![0]!;
        c2 = Math.max(c1, c2) + job.get(id)![1]!;
      }
      const score = one(E3, { s: { sequence: s } }, 's').score;
      if (s.join() === 'J3,J1,J4,J5,J2') expect(score).toBe(1);
      else if (c2 === 24) {
        expect(score, s.join()).toBe(0.5);
        half++;
      } else expect(score, s.join()).toBe(0);
    }
    expect(half).toBeGreaterThan(0);
  });
  it('diagnosis 7 on makespan and idle times', () => {
    // reversed rule J2-J5-J4-J1-J3: M1 ends at 22; M2: 5-7, 12-17, 18-24, 24-30, 30-32 → 32
    expect(one(E3, { m: { value: '32' } }, 'm').items[0]!.diagnosis).toBe('johnson-reversed');
    const r = one(E3, { i: { m1: '10', m2: '11' } }, 'i');
    expect(r.items.map((x) => x.diagnosis)).toEqual(['johnson-reversed', 'johnson-reversed']);
  });

  it('incomplete sequences are invalid', () => {
    expect(one(E3, { s: { sequence: ['J1', 'J2'] } }, 's').status).toBe('invalid');
  });
});

// ------------------------------------------------------------------ non-integer te: graded exactly (user decision)

describe('grader: CPM times with non-integer te (exact by user decision 2026-11-23)', () => {
  it('te rounded to 3 decimals and added along a path is NOT accepted (exact grading)', () => {
    // te(A) = (5 + 4·7 + 13)/6 = 23/3 = 7.667; te(B) = (6 + 4·8 + 14)/6 = 26/3 = 8.667; T = 49/3
    const p: ProjectProblem = {
      kind: 'project',
      activities: [
        { id: 'A', preds: [], pert: [R.q(5), R.q(7), R.q(13)] },
        { id: 'B', preds: ['A'], pert: [R.q(6), R.q(8), R.q(14)] },
      ],
    };
    const E = ex(p, [{ id: 'c', kind: 'duration' }]);
    expect(one(E, { c: { value: '16,333' } }, 'c').status).toBe('correct');
    expect(one(E, { c: { value: '16,334' } }, 'c').status).toBe('wrong'); // 7,667 + 8,667
  });
});

describe('import rule for non-integer te (user decision 2026-11-23)', () => {
  it('a pool exercise with non-integer te and CPM-time asks is flagged by verifyExercise', async () => {
    const { verifyExercise } = await import('../src/core/generator');
    const p: ProjectProblem = {
      kind: 'project',
      activities: [
        { id: 'A', preds: [], pert: [R.q(5), R.q(7), R.q(13)] },
        { id: 'B', preds: ['A'], pert: [R.q(6), R.q(8), R.q(14)] },
      ],
    };
    const flagged = { ...ex(p, [{ id: 'c', kind: 'duration' }]), origin: 'ope' as const };
    expect(verifyExercise(flagged).reasons.join()).toMatch(/non-integer te with CPM-time asks/);
    const ok = { ...ex(p, [{ id: 's', kind: 'pert', pertWhat: 'sigma' }]), origin: 'ope' as const };
    expect(verifyExercise(ok).reasons.join()).not.toMatch(/non-integer te/);
  });
});
