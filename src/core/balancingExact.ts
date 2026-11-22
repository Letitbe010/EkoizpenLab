/**
 * Line balancing, solver B (spec §5.2), written independently of solver A:
 *
 *  - validateAssignment: independent validity checker (every task exactly once, precedences,
 *    station time ≤ C);
 *  - optimalStations: exact minimum number of stations (SALBP-1) by dynamic programming over
 *    precedence-closed task sets, ≤ 15 tasks;
 *  - heuristicByList: the same assignment rules with another structure (one static priority
 *    list, scanned for the first fitting available task).
 *
 * B works on integers: every time and C are scaled by the lcm of their denominators, so it
 * shares no arithmetic code path with A beyond the Rational type at its boundary.
 */
import type { Assignment, BalancingProblem, Heuristic, TieBreak } from './model';
import type { Rational } from './rational';

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));

interface Scaled {
  ids: string[];
  t: bigint[];
  c: bigint;
  /** preds[i] = indices of predecessors of task i */
  preds: number[][];
}

function scale(p: BalancingProblem): Scaled {
  // C = available / demand, as a fraction built directly from the inputs
  const cNum = p.available.n;
  const cDen = p.available.d * BigInt(p.demand);
  let l = cDen / gcd(cNum, cDen);
  for (const t of p.tasks) l = (l / gcd(l, t.t.d)) * t.t.d;
  const toInt = (x: Rational): bigint => (x.n * l) / x.d;
  const ids = p.tasks.map((t) => t.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  return {
    ids,
    t: p.tasks.map((t) => toInt(t.t)),
    c: (cNum * l) / cDen,
    preds: p.tasks.map((t) => t.preds.map((x) => {
      const i = index.get(x);
      if (i === undefined) throw new Error(`unknown predecessor ${x}`);
      return i;
    })),
  };
}

export type Violation =
  | { kind: 'unknown'; task: string }
  | { kind: 'duplicate'; task: string }
  | { kind: 'missing'; task: string }
  | { kind: 'emptyStation'; station: number }
  | { kind: 'overC'; station: number }
  | { kind: 'precedence'; task: string; pred: string };

/** All violations of an assignment (empty list = valid). Stations are 0-based. */
export function validateAssignment(p: BalancingProblem, stations: Assignment): Violation[] {
  const s = scale(p);
  const index = new Map(s.ids.map((id, i) => [id, i]));
  const where = new Map<number, number>();
  const out: Violation[] = [];
  stations.forEach((st, k) => {
    if (st.length === 0) out.push({ kind: 'emptyStation', station: k });
    let load = 0n;
    for (const id of st) {
      const i = index.get(id);
      if (i === undefined) {
        out.push({ kind: 'unknown', task: id });
        continue;
      }
      if (where.has(i)) {
        out.push({ kind: 'duplicate', task: id });
        continue;
      }
      where.set(i, k);
      load += s.t[i]!;
    }
    if (load > s.c) out.push({ kind: 'overC', station: k });
  });
  s.ids.forEach((id, i) => {
    if (!where.has(i)) out.push({ kind: 'missing', task: id });
  });
  s.ids.forEach((id, i) => {
    const k = where.get(i);
    if (k === undefined) return;
    for (const j of s.preds[i]!) {
      const kp = where.get(j);
      // a predecessor must be in the same or an earlier station
      if (kp === undefined || kp > k) out.push({ kind: 'precedence', task: id, pred: s.ids[j]! });
    }
  });
  return out;
}

export const MAX_EXACT_TASKS = 15;

/** Exact minimum number of stations (spec §5.2). Throws if a task does not fit in C. */
export function optimalStations(p: BalancingProblem): number {
  return optimalAssignment(p).length;
}

/**
 * An assignment with the minimum number of stations: the DP below finds, for every
 * precedence-closed task set, the best (stations, load of the last one); the optimal order is
 * read back from the parent pointers and packed into stations the same way.
 */
export function optimalAssignment(p: BalancingProblem): Assignment {
  const s = scale(p);
  const n = s.ids.length;
  if (n > MAX_EXACT_TASKS) throw new Error(`optimalStations: more than ${MAX_EXACT_TASKS} tasks`);
  if (s.t.some((x) => x > s.c)) throw new Error('a task is longer than C');
  const predMask = s.preds.map((ps) => ps.reduce((m, j) => m | (1 << j), 0));
  const size = 1 << n;
  // best[mask] = (stations used, load of the last one), lexicographic minimum; -1 = unreachable
  const k = new Int32Array(size).fill(-1);
  const load: bigint[] = new Array<bigint>(size).fill(0n);
  const parent = new Int32Array(size).fill(-1);
  k[0] = 1;
  for (let mask = 0; mask < size; mask++) {
    const km = k[mask]!;
    if (km < 0) continue;
    for (let j = 0; j < n; j++) {
      const bit = 1 << j;
      if (mask & bit || (predMask[j]! & mask) !== predMask[j]) continue;
      let nk = km;
      let nl = load[mask]! + s.t[j]!;
      if (nl > s.c) {
        nk = km + 1;
        nl = s.t[j]!;
      }
      const to = mask | bit;
      const kt = k[to]!;
      if (kt < 0 || nk < kt || (nk === kt && nl < load[to]!)) {
        k[to] = nk;
        load[to] = nl;
        parent[to] = j;
      }
    }
  }
  const order: number[] = [];
  for (let mask = size - 1; mask !== 0; ) {
    const j = parent[mask]!;
    order.push(j);
    mask &= ~(1 << j);
  }
  order.reverse();
  const out: Assignment = [[]];
  let free = s.c;
  for (const j of order) {
    if (s.t[j]! > free) {
      out.push([]);
      free = s.c;
    }
    out[out.length - 1]!.push(s.ids[j]!);
    free -= s.t[j]!;
  }
  if (out.length !== k[size - 1]) throw new Error('optimalAssignment: reconstruction mismatch');
  return out;
}

/** Transitive followers by depth-first search (independent of dag.ts). */
function followerSets(s: Scaled): Set<number>[] {
  const succ: number[][] = s.ids.map(() => []);
  s.preds.forEach((ps, i) => ps.forEach((j) => succ[j]!.push(i)));
  return s.ids.map((_, i) => {
    const seen = new Set<number>();
    const stack = [...succ[i]!];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...succ[x]!);
    }
    return seen;
  });
}

/**
 * Heuristic assignment with a static priority list: the priorities of LTT, most followers
 * and RPW do not change during the assignment, so all tasks are sorted once and each
 * station takes, repeatedly, the first task in the list that is available and fits.
 */
export function heuristicByList(p: BalancingProblem, heuristic: Heuristic, tieBreak: TieBreak = 'alpha'): Assignment {
  const s = scale(p);
  const fol = followerSets(s);
  const key = (i: number): bigint =>
    heuristic === 'LTT' ? s.t[i]! : heuristic === 'mostFollowers' ? BigInt(fol[i]!.size) : [...fol[i]!].reduce((a, j) => a + s.t[j]!, s.t[i]!);
  const list = s.ids.map((_, i) => i).sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka !== kb) return ka > kb ? -1 : 1;
    if (tieBreak === 'shortest' && s.t[a] !== s.t[b]) return s.t[a]! < s.t[b]! ? -1 : 1;
    if (tieBreak === 'mostFollowers' && fol[a]!.size !== fol[b]!.size) return fol[b]!.size - fol[a]!.size;
    return s.ids[a]! < s.ids[b]! ? -1 : 1;
  });
  const done = new Array<boolean>(s.ids.length).fill(false);
  let left = s.ids.length;
  const out: Assignment = [];
  while (left > 0) {
    const st: string[] = [];
    let free = s.c;
    let picked = true;
    while (picked) {
      picked = false;
      for (const i of list) {
        if (done[i] || s.t[i]! > free || !s.preds[i]!.every((j) => done[j])) continue;
        done[i] = true;
        left--;
        free -= s.t[i]!;
        st.push(s.ids[i]!);
        picked = true;
        break;
      }
    }
    if (st.length === 0) throw new Error('no task fits in an empty station');
    out.push(st);
  }
  return out;
}
