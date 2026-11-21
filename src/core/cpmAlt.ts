/**
 * CPM, solver B (spec §5.2), independent of cpm.ts:
 *  - every start→end path is enumerated with its length; duration = longest; critical paths
 *    = paths of that length;
 *  - ES = longest path up to the start of each activity, by Bellman-Ford relaxation over the
 *    edge list (no topological order); LS = T − longest path from its start to the end.
 * Works on integers: durations scaled by the lcm of their denominators.
 */
import type { ProjectProblem } from './model';
import type { Rational } from './rational';

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));

export interface CpmAltResult {
  duration: Rational;
  criticalPaths: string[][];
  es: Map<string, Rational>;
  ls: Map<string, Rational>;
  /** total float LS − ES */
  tf: Map<string, Rational>;
  pathCount: number;
}

/** te computed on its own here: (a + 4m + b) / 6 as an exact fraction. */
function dur(a: ProjectProblem['activities'][number]): [bigint, bigint] {
  if (a.d) return [a.d.n, a.d.d];
  if (!a.pert) throw new Error(`activity ${a.id} has no duration`);
  const [x, m, y] = a.pert;
  // x.n/x.d + 4 m.n/m.d + y.n/y.d over 6
  const den = x.d * m.d * y.d * 6n;
  const num = x.n * m.d * y.d + 4n * m.n * x.d * y.d + y.n * x.d * m.d;
  const g = gcd(num, den);
  return [num / g, den / g];
}

export const MAX_PATHS = 100_000;

export function cpmAlt(p: ProjectProblem): CpmAltResult {
  const fr = p.activities.map(dur);
  let l = 1n;
  for (const [, den] of fr) l = (l / gcd(l, den)) * den;
  const d = fr.map(([n, den]) => (n * l) / den);
  const ids = p.activities.map((a) => a.id);
  const ix = new Map(ids.map((id, i) => [id, i]));
  const edges: [number, number][] = [];
  p.activities.forEach((a, i) => a.preds.forEach((x) => edges.push([ix.get(x)!, i])));
  const succ: number[][] = ids.map(() => []);
  for (const [u, v] of edges) succ[u]!.push(v);
  const out = (k: bigint): Rational => {
    const g = gcd(k, l);
    return { n: k / g, d: l / g };
  };

  // all paths from start activities (no predecessors) to end activities (no successors)
  const paths: { ids: number[]; len: bigint }[] = [];
  const dfs = (i: number, acc: number[], len: bigint): void => {
    if (paths.length > MAX_PATHS) throw new Error('too many paths');
    const nl = len + d[i]!;
    if (succ[i]!.length === 0) paths.push({ ids: [...acc, i], len: nl });
    for (const j of succ[i]!) dfs(j, [...acc, i], nl);
  };
  p.activities.forEach((a, i) => {
    if (a.preds.length === 0) dfs(i, [], 0n);
  });
  const T = paths.reduce((m, x) => (x.len > m ? x.len : m), 0n);
  const criticalPaths = paths
    .filter((x) => x.len === T)
    .map((x) => x.ids.map((i) => ids[i]!))
    .sort((a, b) => (a.join('-') < b.join('-') ? -1 : a.join('-') > b.join('-') ? 1 : 0));

  // Bellman-Ford for the longest path to each activity start (n − 1 rounds over all edges)
  const n = ids.length;
  const es = new Array<bigint>(n).fill(0n);
  for (let round = 0; round < n; round++) {
    let changed = false;
    for (const [u, v] of edges) {
      if (es[u]! + d[u]! > es[v]!) {
        es[v] = es[u]! + d[u]!;
        changed = true;
      }
    }
    if (!changed) break;
  }
  // tail[i] = longest path from the start of i to the end (includes d[i])
  const tail = d.slice();
  for (let round = 0; round < n; round++) {
    let changed = false;
    for (const [u, v] of edges) {
      if (d[u]! + tail[v]! > tail[u]!) {
        tail[u] = d[u]! + tail[v]!;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const esM = new Map<string, Rational>();
  const lsM = new Map<string, Rational>();
  const tfM = new Map<string, Rational>();
  ids.forEach((id, i) => {
    const ls = T - tail[i]!;
    esM.set(id, out(es[i]!));
    lsM.set(id, out(ls));
    tfM.set(id, out(ls - es[i]!));
  });
  return { duration: out(T), criticalPaths, es: esM, ls: lsM, tf: tfM, pathCount: paths.length };
}
