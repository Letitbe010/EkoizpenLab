import fc from 'fast-check';
import { bruteForce, johnsonSequence, johnsonSequences, schedule } from '../src/core/johnson';
import type { FlowShopProblem } from '../src/core/model';
import * as R from '../src/core/rational';
import { S, arbFlowShop } from './helpers';

const fs = (...jobs: [number, number][]): FlowShopProblem => ({
  kind: 'flowshop',
  jobs: jobs.map(([a, b], i) => ({ id: `J${i + 1}`, p1: R.q(a), p2: R.q(b) })),
});

describe('johnson: details', () => {
  it('schedule: start/end on each machine and idle times', () => {
    const p = fs([3, 6], [5, 2], [1, 2], [6, 6], [7, 5]);
    const s = schedule(p, ['J3', 'J1', 'J4', 'J5', 'J2']);
    expect(s.m2.map((x) => `${S(x.start)}-${S(x.end)}`)).toEqual(['1-3', '4-10', '10-16', '17-22', '22-24']);
    expect(S(s.idleM1)).toBe('2'); // 24 − 22
    expect(S(s.idleM2)).toBe('3'); // 24 − 21
  });

  it('ties give several Johnson sequences', () => {
    const p = fs([2, 5], [2, 4], [3, 3]);
    // min 2 on M1 for J1 and J2 (either first); J3 (3, 3) is alone at the end
    expect(johnsonSequences(p)).toEqual([['J1', 'J2', 'J3'], ['J2', 'J1', 'J3']]);
    expect(johnsonSequence(p)).toEqual(['J1', 'J2', 'J3']);
  });

  it('the reversed rule (diagnosis 7) is not a Johnson sequence and is worse here', () => {
    const p = fs([3, 6], [5, 2], [1, 2], [6, 6], [7, 5]);
    const wrong = ['J2', 'J5', 'J4', 'J1', 'J3'];
    expect(johnsonSequences(p)).not.toContainEqual(wrong);
    expect(R.gt(schedule(p, wrong).makespan, R.q(24))).toBe(true);
  });

  it('rejects incomplete sequences', () => {
    expect(() => schedule(fs([1, 2], [2, 1]), ['J1'])).toThrow();
    expect(() => schedule(fs([1, 2], [2, 1]), ['J1', 'J1'])).toThrow();
  });
});

describe('johnson: optimality (property-based)', () => {
  it('every Johnson sequence is optimal (= brute force); the canonical one is among them', () => {
    fc.assert(
      fc.property(arbFlowShop(7), (p) => {
        const b = bruteForce(p);
        const js = johnsonSequences(p);
        expect(js).toContainEqual(johnsonSequence(p));
        for (const s of js) {
          expect(S(schedule(p, s).makespan)).toBe(S(b.optimal));
          expect(b.optimalSequences).toContainEqual(s);
        }
        const sum1 = R.sum(p.jobs.map((j) => j.p1));
        const sum2 = R.sum(p.jobs.map((j) => j.p2));
        expect(R.cmp(b.optimal, R.max(sum1, sum2))).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 400 },
    );
  });
});
