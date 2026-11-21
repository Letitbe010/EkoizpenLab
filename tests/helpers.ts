import fc from 'fast-check';
import type { BalancingProblem, FlowShopProblem, ProjectProblem, Task } from '../src/core/model';
import * as R from '../src/core/rational';
import type { ProblemJson } from '../src/core/serialize';
import { problemFromJson } from '../src/core/serialize';
import golden from './golden/golden.json';

export const S = R.toString;

export function goldenProblem<T>(key: 'EG1' | 'EG2' | 'EG3' | 'EG4'): T {
  return problemFromJson((golden as unknown as Record<string, { problem: ProblemJson }>)[key]!.problem) as T;
}

export const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

/**
 * Random layered-free DAG: task i may depend on any earlier task (prob. ~ density),
 * integer times 1..maxT. C is chosen ≥ max(t) so the problem is always feasible.
 */
export const arbBalancing = (maxTasks = 10): fc.Arbitrary<BalancingProblem> =>
  fc
    .record({
      n: fc.integer({ min: 2, max: maxTasks }),
      seed: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 200, maxLength: 200 }),
      times: fc.array(fc.integer({ min: 1, max: 12 }), { minLength: maxTasks, maxLength: maxTasks }),
      extra: fc.integer({ min: 0, max: 15 }),
      demand: fc.integer({ min: 1, max: 60 }),
      density: fc.integer({ min: 10, max: 60 }),
    })
    .map(({ n, seed, times, extra, demand, density }) => {
      const names = ids(n);
      let k = 0;
      const tasks: Task[] = names.map((id, i) => {
        const preds = names.slice(0, i).filter(() => seed[k++ % seed.length]! < density);
        return { id, t: R.q(times[i]!), preds };
      });
      const maxT = Math.max(...times.slice(0, n));
      // available = (maxT + extra) · demand, so C = maxT + extra (an integer ≥ max t)
      return { kind: 'balancing', unit: 'min', tasks, available: R.q((maxT + extra) * demand), demand } as BalancingProblem;
    });

/** Random AON project: activity i may depend on earlier ones; integer durations 1..10. */
export const arbProject = (maxActs = 10, withPert = false): fc.Arbitrary<ProjectProblem> =>
  fc
    .record({
      n: fc.integer({ min: 2, max: maxActs }),
      seed: fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 120, maxLength: 120 }),
      d: fc.array(fc.tuple(fc.integer({ min: 1, max: 10 }), fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })), {
        minLength: maxActs,
        maxLength: maxActs,
      }),
      density: fc.integer({ min: 10, max: 60 }),
    })
    .map(({ n, seed, d, density }) => {
      const names = ids(n);
      let k = 0;
      const activities = names.map((id, i) => {
        const preds = names.slice(0, i).filter(() => seed[k++ % seed.length]! < density);
        const [m, lo, hi] = d[i]!;
        return withPert
          ? { id, preds, pert: [R.q(Math.max(1, m - lo)), R.q(m), R.q(m + hi)] as [R.Rational, R.Rational, R.Rational] }
          : { id, preds, d: R.q(m) };
      });
      return { kind: 'project', activities } as ProjectProblem;
    });

/** Random 2-machine flow shop, 2..7 jobs, times 1..9 (ties are frequent on purpose). */
export const arbFlowShop = (maxJobs = 7): fc.Arbitrary<FlowShopProblem> =>
  fc.array(fc.tuple(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 1, max: 9 })), { minLength: 2, maxLength: maxJobs }).map((js) => ({
    kind: 'flowshop',
    jobs: js.map(([a, b], i) => ({ id: `J${i + 1}`, p1: R.q(a), p2: R.q(b) })),
  }));
