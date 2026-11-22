/**
 * Exercise templates (spec §10.2). Reverse design: the builder starts from a nice result
 * (an integer cycle time that divides the shift, integer te, a readable z) and builds the
 * data from it; the answer is then recomputed from the data shown (solve.ts).
 * A builder throws Reject when the draw is not usable; generate() retries with a new seed.
 */
import { assignHeuristic, sumTimes } from '../balancing';
import { cpm } from '../cpm';
import { redundantEdges } from '../dag';
import type { Ask, BalancingProblem, Exercise, FlowShopProblem, Heuristic, ProjectProblem, TieBreak, TimeUnit } from '../model';
import { pert } from '../pert';
import * as R from '../rational';
import type { Rng } from './rng';
import { balancingText, flowShopText, projectText } from './text';

export class Reject extends Error {
  override name = 'Reject';
}

export const TEMPLATES = ['balancing', 'balancingExcess', 'cpm', 'pert', 'johnson'] as const;
export type TemplateId = (typeof TEMPLATES)[number];
export const LEVELS: Record<TemplateId, (1 | 2 | 3)[]> = {
  balancing: [1, 2, 3],
  balancingExcess: [3],
  cpm: [1, 2, 3],
  pert: [2],
  johnson: [1, 2],
};

export type Draft = Pick<Exercise, 'difficulty' | 'problem' | 'asks' | 'weights' | 'text'>;

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

/**
 * Layered, connected DAG on n nodes: every node after the first layer has one predecessor in
 * the layer just before (plus sometimes one more from any earlier layer), and every node
 * outside the last layer has a successor. Redundant (transitive) edges are removed.
 */
export function layeredDag(r: Rng, n: number, layers: number): string[][] {
  if (layers < 2 || layers > n) throw new Reject('layers');
  const size = Array<number>(layers).fill(1);
  for (let i = layers; i < n; i++) size[r.int(0, layers - 1)]!++;
  if (size[0]! > 2) throw new Reject('too many start tasks');
  const layerOf: number[] = [];
  size.forEach((s, k) => {
    for (let i = 0; i < s; i++) layerOf.push(k);
  });
  const preds: Set<number>[] = layerOf.map(() => new Set<number>());
  const inLayer = (k: number) => layerOf.map((l, i) => [l, i] as const).filter(([l]) => l === k).map(([, i]) => i);
  for (let i = 0; i < n; i++) {
    const k = layerOf[i]!;
    if (k === 0) continue;
    preds[i]!.add(r.pick(inLayer(k - 1)));
    if (r.next() < 0.35) {
      const earlier = layerOf.map((l, j) => [l, j] as const).filter(([l]) => l < k).map(([, j]) => j);
      preds[i]!.add(r.pick(earlier));
    }
  }
  for (let i = 0; i < n; i++) {
    const k = layerOf[i]!;
    if (k === layers - 1 || preds.some((p) => p.has(i))) continue;
    preds[r.pick(layerOf.map((l, j) => [l, j] as const).filter(([l]) => l > k).map(([, j]) => j))]!.add(i);
  }
  const ids = names(n);
  const nodes = ids.map((id, i) => ({ id, preds: [...preds[i]!].sort((a, b) => a - b).map((j) => ids[j]!) }));
  const red = new Set(redundantEdges(nodes).map(([a, b]) => `${a}>${b}`));
  return nodes.map((x) => x.preds.filter((p) => !red.has(`${p}>${x.id}`)));
}

// ------------------------------------------------------------------ line balancing

const SHIFTS: Record<TimeUnit, number[]> = { min: [420, 450, 480], s: [25200, 27000, 28800], h: [] };

function balancingProblem(r: Rng, level: 1 | 2 | 3): BalancingProblem {
  const n = level === 1 ? r.int(6, 7) : level === 2 ? r.int(8, 9) : r.int(10, 12);
  const unit: TimeUnit = level === 3 && r.next() < 0.5 ? 's' : 'min';
  const preds = layeredDag(r, n, r.int(3, Math.min(6, n - 2)));
  const times = preds.map(() => (unit === 'min' ? r.int(2, 12) : 5 * r.int(2, 18)));
  const tasks = names(n).map((id, i) => ({ id, t: R.q(times[i]!), preds: preds[i]! }));
  const sum = times.reduce((a, b) => a + b, 0);
  const maxT = Math.max(...times);
  const shift = r.pick(SHIFTS[unit]);
  // C divides the shift (integer demand), C ≥ max t, 3 ≤ N_min ≤ 7 and Σt / C not an integer
  const cands: number[] = [];
  for (let c = maxT; c <= shift; c++) {
    if (shift % c !== 0) continue;
    const nmin = Math.ceil(sum / c);
    if (nmin >= 3 && nmin <= 7 && sum % c !== 0) cands.push(c);
  }
  if (cands.length === 0) throw new Reject('no nice cycle time');
  const c = r.pick(cands);
  const heuristics: (Heuristic | undefined)[] = level === 1 ? ['LTT'] : level === 2 ? ['RPW', 'mostFollowers'] : ['LTT', 'RPW', 'mostFollowers', undefined];
  const heuristic = r.pick(heuristics);
  // with LTT, tied tasks have equal times: "shortest" would never decide, so it is not drawn
  const tieBreak: TieBreak = level === 3 && heuristic && heuristic !== 'LTT' ? r.pick(['alpha', 'shortest'] as const) : 'alpha';
  return {
    kind: 'balancing',
    unit,
    available: R.q(shift),
    demand: shift / c,
    tasks,
    ...(heuristic ? { heuristic, tieBreak } : {}),
  };
}

function balancingAsks(level: 1 | 2 | 3): { asks: Ask[]; weights: Record<string, number> } {
  const asks: Ask[] = [
    { id: 'a', kind: 'precedence' },
    { id: 'b', kind: 'cycleTime' },
    { id: 'c', kind: 'nMin' },
    { id: 'd', kind: 'assignment' },
  ];
  const weights: Record<string, number> = { a: 0.2, b: 0.1, c: 0.1, d: 0.3 };
  if (level >= 2) {
    asks.push({ id: 'e', kind: 'stationTimes' }, { id: 'f', kind: 'idle' });
    Object.assign(weights, { e: 0.1, f: 0.1 });
  }
  asks.push({ id: 'g', kind: 'efficiency', scope: 'station', station: 'last' }, { id: 'h', kind: 'efficiency' });
  Object.assign(weights, { g: 0.15, h: 0.15 });
  return { asks, weights };
}

function buildBalancing(r: Rng, level: 1 | 2 | 3): Draft {
  const problem = balancingProblem(r, level);
  if (level === 3) {
    // spec §10.2: at level 3 different heuristics give different assignments
    const a = JSON.stringify(assignHeuristic(problem, 'LTT').stations);
    const b = JSON.stringify(assignHeuristic(problem, 'RPW').stations);
    if (a === b) throw new Reject('heuristics agree');
  }
  return { difficulty: level, problem, ...balancingAsks(level), text: balancingText(problem) };
}

function buildBalancingExcess(r: Rng): Draft {
  const p = balancingProblem(r, 3);
  const problem: BalancingProblem = { ...p, heuristic: p.heuristic ?? 'LTT', tieBreak: p.tieBreak ?? 'alpha' };
  const n = assignHeuristic(problem, problem.heuristic!, problem.tieBreak).stations.length;
  const nmin = Math.ceil(R.toNumber(R.div(sumTimes(problem.tasks), R.div(problem.available, R.q(problem.demand)))));
  if (n <= nmin) throw new Reject('heuristic reaches N_min');
  return { difficulty: 3, problem, ...balancingAsks(3), text: balancingText(problem) };
}

// ------------------------------------------------------------------ projects

function buildCpm(r: Rng, level: 1 | 2 | 3): Draft {
  const n = level === 1 ? r.int(6, 7) : level === 2 ? r.int(8, 9) : r.int(10, 12);
  const preds = layeredDag(r, n, r.int(3, Math.min(5, n - 2)));
  const maxD = level === 3 ? 6 : level === 2 ? 12 : 10;
  const problem: ProjectProblem = {
    kind: 'project',
    activities: names(n).map((id, i) => ({ id, d: R.q(r.int(1, maxD)), preds: preds[i]! })),
  };
  const paths = cpm(problem).criticalPaths.length;
  if (paths !== (level === 3 ? 2 : 1)) throw new Reject('number of critical paths');
  const asks: Ask[] = [
    { id: 'a', kind: 'cpmTable' },
    { id: 'b', kind: 'criticalPath' },
    { id: 'c', kind: 'duration' },
  ];
  return { difficulty: level, problem, asks, weights: { a: 0.5, b: 0.3, c: 0.2 }, text: projectText(problem, false) };
}

function buildPert(r: Rng): Draft {
  const n = r.int(6, 9);
  const preds = layeredDag(r, n, r.int(3, Math.min(5, n - 2)));
  const activities = names(n).map((id, i) => {
    // te = m + (y − x)/6 is an integer when y − x is a multiple of 6
    const m = r.int(2, 12);
    const x = r.int(0, Math.min(4, m - 1));
    const y = x + 6 * r.int(0, 2);
    return { id, preds: preds[i]!, pert: [R.q(m - x), R.q(m), R.q(m + y)] as [R.Rational, R.Rational, R.Rational] };
  });
  const base: ProjectProblem = { kind: 'project', activities };
  const res = pert(base);
  if (res.criticalPaths.length !== 1) throw new Reject('several critical paths');
  if (!(res.sigma > 0.5)) throw new Reject('almost no variance');
  const Te = R.toNumber(res.Te);
  const t = Math.round(Te + r.pick([-1.5, -1, -0.75, -0.5, 0.5, 0.75, 1, 1.5, 2]) * res.sigma);
  const z = (t - Te) / res.sigma;
  const frac = (Math.abs(z) * 100) % 1;
  if (Math.abs(z) < 0.3 || Math.abs(z) > 2.5 || (frac > 0.4 && frac < 0.6)) throw new Reject('z not readable from a table');
  const problem: ProjectProblem = { ...base, deadline: R.q(t) };
  const asks: Ask[] = [
    { id: 'a', kind: 'pert', pertWhat: 'te' },
    { id: 'b', kind: 'criticalPath' },
    { id: 'c', kind: 'duration' },
    { id: 'd', kind: 'pert', pertWhat: 'variance' },
    { id: 'e', kind: 'pert', pertWhat: 'sigma' },
    { id: 'f', kind: 'pert', pertWhat: 'probability', t: R.q(t) },
  ];
  return { difficulty: 2, problem, asks, weights: { a: 0.15, b: 0.15, c: 0.15, d: 0.15, e: 0.15, f: 0.25 }, text: projectText(problem, true) };
}

// ------------------------------------------------------------------ flow shop

function buildJohnson(r: Rng, level: 1 | 2 | 3): Draft {
  const n = level === 1 ? 5 : r.int(6, 7);
  const vals: number[] = [];
  if (level === 1) {
    // no ties at all: a single Johnson sequence
    const pool = r.shuffle(Array.from({ length: 12 }, (_, i) => i + 1));
    vals.push(...pool.slice(0, 2 * n));
  } else {
    for (let i = 0; i < 2 * n; i++) vals.push(r.int(1, 12));
  }
  const problem: FlowShopProblem = {
    kind: 'flowshop',
    jobs: Array.from({ length: n }, (_, i) => ({ id: `J${i + 1}`, p1: R.q(vals[2 * i]!), p2: R.q(vals[2 * i + 1]!) })),
  };
  const asks: Ask[] = [
    { id: 'a', kind: 'johnson', johnsonWhat: 'sequence' },
    { id: 'b', kind: 'johnson', johnsonWhat: 'makespan' },
    { id: 'c', kind: 'johnson', johnsonWhat: 'idle' },
  ];
  return { difficulty: level, problem, asks, weights: { a: 0.5, b: 0.25, c: 0.25 }, text: flowShopText(problem) };
}

export const BUILDERS: Record<TemplateId, (r: Rng, level: 1 | 2 | 3) => Draft> = {
  balancing: buildBalancing,
  balancingExcess: (r) => buildBalancingExcess(r),
  cpm: buildCpm,
  pert: (r) => buildPert(r),
  johnson: buildJohnson,
};
