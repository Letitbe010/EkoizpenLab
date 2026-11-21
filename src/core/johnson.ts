/**
 * Two-machine flow shop, same order on both machines (spec §3).
 *
 * Solver A, Johnson's rule: take the smallest remaining time; if it is on M1 the job goes to
 * the first free position, if on M2 to the last free one; remove the job and repeat.
 * Ties give several sequences: johnsonSequences returns ALL of them (every way to break the
 * ties), johnsonSequence the canonical one (M1 before M2, then input order).
 *
 * Solver B: makespan of every permutation (n ≤ 8) → optimal makespan and optimal sequences.
 *
 * Idle time of a machine = makespan − its total processing time (M2 includes its initial
 * wait; M1 its time after finishing).
 */
import type { FlowShopProblem, Job } from './model';
import * as R from './rational';
import type { Rational } from './rational';

export interface Schedule {
  sequence: string[];
  /** Per job, in sequence order: start/end on M1 and M2. */
  m1: { id: string; start: Rational; end: Rational }[];
  m2: { id: string; start: Rational; end: Rational }[];
  makespan: Rational;
  idleM1: Rational;
  idleM2: Rational;
}

function checkJobs(jobs: readonly Job[]): void {
  const ids = new Set<string>();
  for (const j of jobs) {
    if (ids.has(j.id)) throw new Error(`repeated job ${j.id}`);
    ids.add(j.id);
    if (R.sign(j.p1) < 0 || R.sign(j.p2) < 0) throw new Error(`job ${j.id}: negative time`);
  }
}

export function schedule(p: FlowShopProblem, sequence: readonly string[]): Schedule {
  checkJobs(p.jobs);
  const byId = new Map(p.jobs.map((j) => [j.id, j]));
  if (sequence.length !== p.jobs.length || new Set(sequence).size !== sequence.length || sequence.some((s) => !byId.has(s))) {
    throw new Error('the sequence must contain every job exactly once');
  }
  let t1 = R.ZERO;
  let t2 = R.ZERO;
  const m1: Schedule['m1'] = [];
  const m2: Schedule['m2'] = [];
  for (const id of sequence) {
    const j = byId.get(id)!;
    const e1 = R.add(t1, j.p1);
    m1.push({ id, start: t1, end: e1 });
    const s2 = R.max(e1, t2);
    const e2 = R.add(s2, j.p2);
    m2.push({ id, start: s2, end: e2 });
    t1 = e1;
    t2 = e2;
  }
  const makespan = t2;
  return {
    sequence: [...sequence],
    m1,
    m2,
    makespan,
    idleM1: R.sub(makespan, R.sum(p.jobs.map((j) => j.p1))),
    idleM2: R.sub(makespan, R.sum(p.jobs.map((j) => j.p2))),
  };
}

export const makespan = (p: FlowShopProblem, sequence: readonly string[]): Rational => schedule(p, sequence).makespan;

/** Canonical Johnson sequence: ties broken M1 first, then input order. */
export function johnsonSequence(p: FlowShopProblem): string[] {
  checkJobs(p.jobs);
  const left = [...p.jobs];
  const front: string[] = [];
  const back: string[] = [];
  while (left.length > 0) {
    const v = left.map((j) => R.min(j.p1, j.p2)).reduce(R.min);
    // first job (input order) holding the minimum on M1, else the first holding it on M2
    const i1 = left.findIndex((j) => R.eq(j.p1, v));
    const onM1 = i1 >= 0;
    const best = onM1 ? i1 : left.findIndex((j) => R.eq(j.p2, v));
    const [job] = left.splice(best, 1);
    if (onM1) front.push(job!.id);
    else back.unshift(job!.id);
  }
  return [...front, ...back];
}

export const MAX_JOHNSON_ENUM = 10;

/** Every sequence Johnson's rule can produce (all tie-breaks), sorted. */
export function johnsonSequences(p: FlowShopProblem): string[][] {
  checkJobs(p.jobs);
  const n = p.jobs.length;
  if (n > MAX_JOHNSON_ENUM) throw new Error(`johnsonSequences: more than ${MAX_JOHNSON_ENUM} jobs`);
  // middle(mask) = all orders of the jobs in mask that the rule can produce for them
  const memo = new Map<number, string[][]>();
  const middle = (mask: number): string[][] => {
    if (mask === 0) return [[]];
    const hit = memo.get(mask);
    if (hit) return hit;
    let v: Rational | null = null;
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const j = p.jobs[i]!;
      const m = R.min(j.p1, j.p2);
      if (v === null || R.lt(m, v)) v = m;
    }
    const seen = new Set<string>();
    const out: string[][] = [];
    const add = (s: string[]) => {
      const k = s.join('\u0000');
      if (!seen.has(k)) {
        seen.add(k);
        out.push(s);
      }
    };
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const j = p.jobs[i]!;
      const rest = middle(mask & ~(1 << i));
      if (R.eq(j.p1, v!)) for (const r of rest) add([j.id, ...r]);
      if (R.eq(j.p2, v!)) for (const r of rest) add([...r, j.id]);
    }
    memo.set(mask, out);
    return out;
  };
  return middle((1 << n) - 1)
    .map((s) => [...s])
    .sort((a, b) => (a.join('-') < b.join('-') ? -1 : a.join('-') > b.join('-') ? 1 : 0));
}

export const MAX_PERMUTATIONS_JOBS = 8;

/** Solver B: optimal makespan and every optimal sequence by full enumeration (n ≤ 8). */
export function bruteForce(p: FlowShopProblem): { optimal: Rational; optimalSequences: string[][] } {
  checkJobs(p.jobs);
  const n = p.jobs.length;
  if (n > MAX_PERMUTATIONS_JOBS) throw new Error(`bruteForce: more than ${MAX_PERMUTATIONS_JOBS} jobs`);
  // own makespan recurrence on numbers scaled to integers (independent of schedule())
  let l = 1n;
  const g = (a: bigint, b: bigint): bigint => (b === 0n ? a : g(b, a % b));
  for (const j of p.jobs) for (const x of [j.p1, j.p2]) l = (l / g(l, x.d)) * x.d;
  const a = p.jobs.map((j) => (j.p1.n * l) / j.p1.d);
  const b = p.jobs.map((j) => (j.p2.n * l) / j.p2.d);
  let best: bigint | null = null;
  let seqs: number[][] = [];
  const perm: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const rec = (c1: bigint, c2: bigint): void => {
    if (perm.length === n) {
      if (best === null || c2 < best) {
        best = c2;
        seqs = [[...perm]];
      } else if (c2 === best) seqs.push([...perm]);
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      perm.push(i);
      const e1 = c1 + a[i]!;
      rec(e1, (e1 > c2 ? e1 : c2) + b[i]!);
      perm.pop();
      used[i] = false;
    }
  };
  rec(0n, 0n);
  const bestV = best ?? 0n;
  const k = g(bestV, l);
  return {
    optimal: R.q(bestV / k, l / k),
    optimalSequences: seqs.map((s) => s.map((i) => p.jobs[i]!.id)).sort((x, y) => (x.join('-') < y.join('-') ? -1 : x.join('-') > y.join('-') ? 1 : 0)),
  };
}
