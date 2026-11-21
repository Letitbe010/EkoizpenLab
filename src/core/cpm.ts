/**
 * CPM, solver A (spec §3, §5.1): activities on nodes (AON), forward and backward passes.
 *
 *   ES = max(EF of predecessors) (0 without predecessors), EF = ES + d
 *   LF = min(LS of successors) (T without successors),     LS = LF − d
 *   total float TF = LS − ES
 *   free float  FF = min(ES of successors) − EF; without successors FF = T − EF
 *                (user decision 2026-11-21)
 *   critical = TF = 0; there can be more than one critical path.
 *
 * Event times of the AOA view (Madrid 2022-7 "Early y Last para cada nudo") will be derived
 * from these values in phase 3 (grader, solution); not implemented yet.
 */
import { successors, topoOrder, validateDag } from './dag';
import type { Activity, ProjectProblem } from './model';
import * as R from './rational';
import type { Rational } from './rational';

export class ProjectError extends Error {
  override name = 'ProjectError';
}

export interface CpmRow {
  id: string;
  d: Rational;
  es: Rational;
  ef: Rational;
  ls: Rational;
  lf: Rational;
  tf: Rational;
  ff: Rational;
  critical: boolean;
}

export interface CpmResult {
  /** Rows in the input order of the activities. */
  rows: CpmRow[];
  duration: Rational;
  /** Every critical path, as activity ids from start to end, sorted. */
  criticalPaths: string[][];
}

/** te of a PERT activity: (a + 4m + b) / 6. */
export function pertMean([a, m, b]: [Rational, Rational, Rational]): Rational {
  return R.div(R.add(R.add(a, R.mul(R.q(4), m)), b), R.q(6));
}

/** Duration used by CPM: d if given, otherwise te from the PERT estimates. */
export function durationOf(a: Activity): Rational {
  if (a.d) return a.d;
  if (a.pert) return pertMean(a.pert);
  throw new ProjectError(`activity ${a.id} has no duration`);
}

export function checkProject(p: ProjectProblem): void {
  validateDag(p.activities);
  if (p.activities.length === 0) throw new ProjectError('empty project');
  for (const a of p.activities) {
    if (a.pert) {
      const [x, m, y] = a.pert;
      if (R.sign(x) < 0 || R.gt(x, m) || R.gt(m, y)) throw new ProjectError(`activity ${a.id}: needs 0 ≤ a ≤ m ≤ b`);
    }
    if (R.sign(durationOf(a)) <= 0) throw new ProjectError(`activity ${a.id}: duration must be positive`);
  }
}

export function cpm(p: ProjectProblem): CpmResult {
  checkProject(p);
  const acts = new Map(p.activities.map((a) => [a.id, a]));
  const d = new Map(p.activities.map((a) => [a.id, durationOf(a)]));
  const succ = successors(p.activities);
  const order = topoOrder(p.activities);
  const es = new Map<string, Rational>();
  const ef = new Map<string, Rational>();
  for (const id of order) {
    const s = acts.get(id)!.preds.reduce((m, x) => R.max(m, ef.get(x)!), R.ZERO);
    es.set(id, s);
    ef.set(id, R.add(s, d.get(id)!));
  }
  const duration = [...ef.values()].reduce(R.max);
  const ls = new Map<string, Rational>();
  const lf = new Map<string, Rational>();
  for (const id of [...order].reverse()) {
    const ss = succ.get(id)!;
    const f = ss.length === 0 ? duration : ss.map((x) => ls.get(x)!).reduce(R.min);
    lf.set(id, f);
    ls.set(id, R.sub(f, d.get(id)!));
  }
  const rows: CpmRow[] = p.activities.map((a) => {
    const ss = succ.get(a.id)!;
    const tf = R.sub(ls.get(a.id)!, es.get(a.id)!);
    const minEsSucc = ss.length === 0 ? duration : ss.map((x) => es.get(x)!).reduce(R.min);
    return {
      id: a.id,
      d: d.get(a.id)!,
      es: es.get(a.id)!,
      ef: ef.get(a.id)!,
      ls: ls.get(a.id)!,
      lf: lf.get(a.id)!,
      tf,
      ff: R.sub(minEsSucc, ef.get(a.id)!),
      critical: R.isZero(tf),
    };
  });
  // critical paths: chains of critical activities, each starting when the previous ends
  const row = new Map(rows.map((r) => [r.id, r]));
  const paths: string[][] = [];
  const walk = (id: string, acc: string[]): void => {
    const r = row.get(id)!;
    const next = succ.get(id)!.filter((x) => row.get(x)!.critical && R.eq(row.get(x)!.es, r.ef));
    // with positive durations, EF = T implies no successors and ES = 0 implies no predecessors
    if (R.eq(r.ef, duration)) paths.push([...acc, id]);
    for (const x of next) walk(x, [...acc, id]);
  };
  for (const r of rows) if (r.critical && R.isZero(r.es)) walk(r.id, []);
  paths.sort((a, b) => (a.join('-') < b.join('-') ? -1 : a.join('-') > b.join('-') ? 1 : 0));
  return { rows, duration, criticalPaths: paths };
}
