/**
 * Line balancing, solver A (spec §3, §5.1): cycle time, N_min, station-oriented heuristic
 * assignment with explicit tie-break rules, and line / station metrics.
 *
 * Conventions (spec §3, not negotiable):
 *   C = available time / demand
 *   N_min = ceil(Σt / C)
 *   η = Σt / (N · base), base = C (default) or the bottleneck station time
 *   idle = N · base − Σt; balance delay = 1 − η; station efficiency = station time / base
 *
 * Followers are transitive (every task that cannot start before this one ends), both for
 * "most followers" and for the ranked positional weight RPW = t + Σ t(followers).
 */
import { allFollowers, validateDag } from './dag';
import type { Assignment, BalancingProblem, EfficiencyBase, Heuristic, Task, TieBreak } from './model';
import * as R from './rational';
import type { Rational } from './rational';

export class BalancingError extends Error {
  override name = 'BalancingError';
}

export const sumTimes = (tasks: readonly Task[]): Rational => R.sum(tasks.map((t) => t.t));

export function cycleTime(p: Pick<BalancingProblem, 'available' | 'demand'>): Rational {
  if (!Number.isSafeInteger(p.demand) || p.demand <= 0) throw new BalancingError('demand must be a positive integer');
  if (R.sign(p.available) <= 0) throw new BalancingError('available time must be positive');
  return R.div(p.available, R.q(p.demand));
}

export function nMin(p: BalancingProblem): number {
  return Number(R.ceil(R.div(sumTimes(p.tasks), cycleTime(p))));
}

/** Throws if the DAG is invalid, a time is not positive, or a task is longer than C (spec §5.3). */
export function checkFeasible(p: BalancingProblem): void {
  validateDag(p.tasks);
  const c = cycleTime(p);
  for (const t of p.tasks) {
    if (R.sign(t.t) <= 0) throw new BalancingError(`task ${t.id}: time must be positive`);
    if (R.gt(t.t, c)) throw new BalancingError(`task ${t.id} (${R.toString(t.t)}) is longer than C = ${R.toString(c)}`);
  }
}

export interface Priorities {
  /** Heuristic value of every task (larger = chosen first). */
  value: Map<string, Rational>;
  followers: Map<string, number>;
  rpw: Map<string, Rational>;
}

export function priorities(tasks: readonly Task[], heuristic: Heuristic): Priorities {
  const fol = allFollowers(tasks);
  const time = new Map(tasks.map((t) => [t.id, t.t]));
  const followers = new Map<string, number>();
  const rpw = new Map<string, Rational>();
  for (const t of tasks) {
    const f = fol.get(t.id)!;
    followers.set(t.id, f.size);
    rpw.set(t.id, R.add(t.t, R.sum([...f].map((id) => time.get(id)!))));
  }
  const value = new Map<string, Rational>();
  for (const t of tasks) {
    value.set(t.id, heuristic === 'LTT' ? t.t : heuristic === 'RPW' ? rpw.get(t.id)! : R.q(followers.get(t.id)!));
  }
  return { value, followers, rpw };
}

/** Negative if a goes before b. Ties of the heuristic use the tie rule, then the id. */
function compareTasks(a: Task, b: Task, pr: Priorities, tie: TieBreak): number {
  const h = R.cmp(pr.value.get(b.id)!, pr.value.get(a.id)!);
  if (h !== 0) return h;
  if (tie === 'shortest') {
    const s = R.cmp(a.t, b.t);
    if (s !== 0) return s;
  } else if (tie === 'mostFollowers') {
    const f = pr.followers.get(b.id)! - pr.followers.get(a.id)!;
    if (f !== 0) return f;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface AssignStep {
  /** 0-based station index. */
  station: number;
  /** Free time in the station before this choice. */
  free: Rational;
  /** Candidates (available and fitting), best first. Empty = the station is closed. */
  candidates: string[];
  chosen: string | null;
}

export interface AssignResult {
  stations: Assignment;
  steps: AssignStep[];
}

/**
 * Station-oriented assignment (spec §3): open a station; candidates are the unassigned
 * tasks whose predecessors are all assigned and which fit in the free time; pick by the
 * heuristic, ties by the rule; with no candidate, close the station.
 */
export function assignHeuristic(p: BalancingProblem, heuristic: Heuristic, tieBreak: TieBreak = 'alpha'): AssignResult {
  checkFeasible(p);
  const c = cycleTime(p);
  const pr = priorities(p.tasks, heuristic);
  const done = new Set<string>();
  const stations: Assignment = [];
  const steps: AssignStep[] = [];
  while (done.size < p.tasks.length) {
    const st: string[] = [];
    let free = c;
    for (;;) {
      const cands = p.tasks
        .filter((t) => !done.has(t.id) && t.preds.every((x) => done.has(x)) && !R.gt(t.t, free))
        .sort((a, b) => compareTasks(a, b, pr, tieBreak));
      const chosen = cands[0] ?? null;
      steps.push({ station: stations.length, free, candidates: cands.map((t) => t.id), chosen: chosen?.id ?? null });
      if (!chosen) break;
      st.push(chosen.id);
      done.add(chosen.id);
      free = R.sub(free, chosen.t);
    }
    // cannot happen after checkFeasible (every task fits in an empty station), kept as a guard
    if (st.length === 0) throw new BalancingError('no task fits in an empty station');
    stations.push(st);
  }
  return { stations, steps };
}

export interface BalancingMetrics {
  c: Rational;
  sumT: Rational;
  n: number;
  nMin: number;
  stationTimes: Rational[];
  base: Rational;
  baseKind: EfficiencyBase;
  /** base − station time, per station. */
  stationIdle: Rational[];
  /** N · base − Σt. */
  idle: Rational;
  /** Σt / (N · base), exact. */
  efficiency: Rational;
  balanceDelay: Rational;
  /** station time / base, per station. */
  stationEfficiency: Rational[];
}

/** Metrics of any assignment (valid or not: validity is checked by validateAssignment). */
export function metrics(p: BalancingProblem, stations: Assignment, baseKind: EfficiencyBase = p.efficiencyBase ?? 'C'): BalancingMetrics {
  const c = cycleTime(p);
  const time = new Map(p.tasks.map((t) => [t.id, t.t]));
  const stationTimes = stations.map((s) => R.sum(s.map((id) => {
    const v = time.get(id);
    if (!v) throw new BalancingError(`unknown task ${id}`);
    return v;
  })));
  const n = stations.length;
  if (n === 0) throw new BalancingError('empty assignment');
  const sumT = sumTimes(p.tasks);
  const base = baseKind === 'C' ? c : stationTimes.reduce(R.max);
  const efficiency = R.div(sumT, R.mul(R.q(n), base));
  return {
    c,
    sumT,
    n,
    nMin: nMin(p),
    stationTimes,
    base,
    baseKind,
    stationIdle: stationTimes.map((s) => R.sub(base, s)),
    idle: R.sub(R.mul(R.q(n), base), sumT),
    efficiency,
    balanceDelay: R.sub(R.ONE, efficiency),
    stationEfficiency: stationTimes.map((s) => R.div(s, base)),
  };
}
