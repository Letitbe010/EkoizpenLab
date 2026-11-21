import fc from 'fast-check';
import { BalancingError, assignHeuristic, checkFeasible, cycleTime, metrics, nMin, priorities } from '../src/core/balancing';
import { heuristicByList, optimalStations, validateAssignment } from '../src/core/balancingExact';
import type { BalancingProblem, Heuristic, TieBreak } from '../src/core/model';
import * as R from '../src/core/rational';
import { S, arbBalancing, goldenProblem } from './helpers';

const HEUR: Heuristic[] = ['LTT', 'mostFollowers', 'RPW'];
const TIES: TieBreak[] = ['alpha', 'shortest', 'mostFollowers'];

describe('balancing: conventions', () => {
  const eg1 = goldenProblem<BalancingProblem>('EG1');

  it('C = available / demand, N_min = ceiling', () => {
    expect(S(cycleTime({ available: R.q(480), demand: 40 }))).toBe('12');
    expect(S(cycleTime({ available: R.q(480), demand: 36 }))).toBe('40/3');
    // 27 / 10 = 2.7 -> 3 (floor would give 2: diagnosis 2 of spec §8.3)
    expect(nMin(eg1)).toBe(3);
  });

  it('infeasible problems are rejected', () => {
    expect(() => checkFeasible({ ...eg1, demand: 100 })).toThrow(BalancingError); // C = 4.8 < 6
    expect(() => cycleTime({ available: R.q(480), demand: 0 })).toThrow(BalancingError);
  });

  it('priorities: followers and RPW are transitive', () => {
    const pr = priorities(eg1.tasks, 'RPW');
    expect(pr.followers.get('A')).toBe(6);
    expect(S(pr.rpw.get('A')!)).toBe('27');
    expect(S(pr.rpw.get('C')!)).toBe('16'); // 4 + E 6 + F 2 + G 4
    expect(S(pr.rpw.get('B')!)).toBe('12'); // 3 + D 3 + F 2 + G 4
  });

  it('bottleneck base: η = Σt / (N · max station time)', () => {
    const m = metrics(eg1, [['A', 'C'], ['E', 'B'], ['D', 'F', 'G']], 'bottleneck');
    expect(S(m.base)).toBe('9');
    expect(S(m.efficiency)).toBe('1');
    expect(S(m.idle)).toBe('0');
  });

  it('trace records the closing of each station', () => {
    const { steps } = assignHeuristic(eg1, 'LTT');
    const closes = steps.filter((s) => s.chosen === null);
    expect(closes.map((s) => S(s.free))).toEqual(['1', '1', '1']);
    expect(steps[1]!.candidates).toEqual(['C', 'B']); // LTT: C (4) before B (3)
  });
});

describe('balancing: Euskadi OPE 2020, exercise 6 (pool candidate, user still to verify)', () => {
  const t = (id: string, x: number, preds: string[]) => ({ id, t: R.q(x), preds });
  const p: BalancingProblem = {
    kind: 'balancing',
    unit: 'min',
    available: R.q(480),
    demand: 40,
    tasks: [
      t('A', 10, []), t('B', 11, ['A']), t('C', 5, ['B']), t('D', 4, ['B']), t('E', 12, ['A']),
      t('F', 3, ['C', 'D']), t('G', 7, ['F']), t('H', 11, ['E']), t('I', 3, ['G', 'H']),
    ],
  };
  it('C = 12, N_min = 6, LTT gives 6 stations', () => {
    const { stations } = assignHeuristic(p, 'LTT');
    const m = metrics(p, stations);
    expect(S(m.c)).toBe('12');
    expect(m.nMin).toBe(6);
    expect(stations).toEqual([['A'], ['E'], ['B'], ['H'], ['C', 'D', 'F'], ['G', 'I']]);
    expect(S(m.stationEfficiency[5]!)).toBe('5/6'); // 83.3 %
    expect(S(m.efficiency)).toBe('11/12'); // 91.7 %
    expect(optimalStations(p)).toBe(6);
  });
});

describe('balancing: validity checker (solver B)', () => {
  const p = goldenProblem<BalancingProblem>('EG1');
  it('reports each kind of violation', () => {
    expect(validateAssignment(p, [['A', 'C'], ['E', 'B'], ['D', 'F', 'G']])).toEqual([]);
    // same station is fine: E after C inside station 1 is valid
    expect(validateAssignment(p, [['A', 'B'], ['C', 'E'], ['D', 'F', 'G']])).toEqual([]);
    expect(validateAssignment(p, [['A', 'B'], ['E'], ['C', 'D', 'F']])).toContainEqual({ kind: 'precedence', task: 'E', pred: 'C' });
    expect(validateAssignment(p, [['A', 'C', 'B'], ['E'], ['D', 'F', 'G']])).toContainEqual({ kind: 'overC', station: 0 });
    expect(validateAssignment(p, [['A', 'C'], ['E', 'B'], ['D', 'F']])).toContainEqual({ kind: 'missing', task: 'G' });
    expect(validateAssignment(p, [['A', 'C'], ['E', 'B', 'C'], ['D', 'F', 'G']])).toContainEqual({ kind: 'duplicate', task: 'C' });
    expect(validateAssignment(p, [['A', 'C', 'X'], ['E', 'B'], ['D', 'F', 'G']])).toContainEqual({ kind: 'unknown', task: 'X' });
    expect(validateAssignment(p, [['A', 'C'], [], ['E', 'B'], ['D', 'F', 'G']])).toContainEqual({ kind: 'emptyStation', station: 1 });
  });
});

describe('balancing: A = B and global checks (property-based)', () => {
  it('A and B give the same assignment for every heuristic and tie rule; it is valid', () => {
    fc.assert(
      fc.property(arbBalancing(10), fc.constantFrom(...HEUR), fc.constantFrom(...TIES), (p, h, tie) => {
        const a = assignHeuristic(p, h, tie).stations;
        expect(heuristicByList(p, h, tie)).toEqual(a);
        expect(validateAssignment(p, a)).toEqual([]);
        const m = metrics(p, a);
        const opt = optimalStations(p);
        expect(m.n).toBeGreaterThanOrEqual(opt);
        expect(opt).toBeGreaterThanOrEqual(m.nMin);
        expect(R.cmp(m.efficiency, R.ONE)).toBeLessThanOrEqual(0);
        expect(R.sign(m.idle)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 400 },
    );
  });

  it('multiplying every time by k scales C and keeps the assignment', () => {
    fc.assert(
      fc.property(arbBalancing(9), fc.integer({ min: 2, max: 7 }), fc.integer({ min: 1, max: 5 }), (p, num, den) => {
        const k = R.q(num, den);
        const scaled: BalancingProblem = { ...p, available: R.mul(p.available, k), tasks: p.tasks.map((t) => ({ ...t, t: R.mul(t.t, k) })) };
        expect(R.eq(cycleTime(scaled), R.mul(cycleTime(p), k))).toBe(true);
        for (const h of HEUR) expect(assignHeuristic(scaled, h).stations).toEqual(assignHeuristic(p, h).stations);
        expect(optimalStations(scaled)).toBe(optimalStations(p));
        expect(nMin(scaled)).toBe(nMin(p));
      }),
      { numRuns: 200 },
    );
  });

  it('adding a task never lowers the optimal N', () => {
    fc.assert(
      fc.property(arbBalancing(9), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 0, max: 8 }), (p, t, at) => {
        const c = cycleTime(p);
        const time = R.min(R.q(t), c);
        const pred = p.tasks[at % p.tasks.length]!.id;
        const bigger: BalancingProblem = { ...p, tasks: [...p.tasks, { id: 'Z', t: time, preds: [pred] }] };
        expect(optimalStations(bigger)).toBeGreaterThanOrEqual(optimalStations(p));
      }),
      { numRuns: 200 },
    );
  });

  it('every valid assignment has η ≤ 1 and N ≥ optimal (random reassignments)', () => {
    fc.assert(
      fc.property(arbBalancing(8), fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 8, maxLength: 8 }), (p, where) => {
        const k = Math.max(...where) + 1;
        const st: string[][] = Array.from({ length: k }, () => []);
        p.tasks.forEach((t, i) => st[where[i]!]!.push(t.id));
        const stations = st.filter((s) => s.length > 0);
        if (validateAssignment(p, stations).length > 0) return;
        const m = metrics(p, stations);
        expect(R.cmp(m.efficiency, R.ONE)).toBeLessThanOrEqual(0);
        expect(m.n).toBeGreaterThanOrEqual(optimalStations(p));
      }),
      { numRuns: 400 },
    );
  });
});
