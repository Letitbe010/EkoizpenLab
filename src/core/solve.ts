/**
 * Verified solution of an exercise (spec §5, §8.1): solvers A and B are both run and must
 * agree; otherwise SolverMismatch is thrown and the exercise must not be shown.
 * Everything is computed from the data shown to the user (the problem itself).
 */
import { assignHeuristic, metrics, nMin, type BalancingMetrics } from './balancing';
import { heuristicByList, optimalAssignment, validateAssignment } from './balancingExact';
import { cpm, type CpmResult } from './cpm';
import { cpmAlt } from './cpmAlt';
import { redundantEdges } from './dag';
import { bruteForce, johnsonSequence, johnsonSequences, schedule, type Schedule } from './johnson';
import type { Assignment, BalancingProblem, FlowShopProblem, Heuristic, ProjectProblem, TieBreak } from './model';
import { pert, type PertResult } from './pert';
import * as R from './rational';
import type { Rational } from './rational';

export class SolverMismatch extends Error {
  override name = 'SolverMismatch';
}

const check = (ok: boolean, what: string): void => {
  if (!ok) throw new SolverMismatch(what);
};

export interface BalancingSolution {
  kind: 'balancing';
  /** Non-redundant precedence edges [from, to]. */
  edges: [string, string][];
  nMin: number;
  nOptimal: number;
  /** Rule of the heuristic assignment (the exercise's, or LTT + alphabetical). */
  heuristic: Heuristic;
  tieBreak: TieBreak;
  /** true if the exercise states the rule (then the assignment must follow it). */
  ruleGiven: boolean;
  /** Assignment the rule gives (A, checked with B). */
  heuristicAssignment: Assignment;
  /**
   * Reference answer: the rule's assignment if the exercise states a rule; otherwise an
   * assignment with the minimum number of stations (solver B, exact).
   */
  reference: Assignment;
  metrics: BalancingMetrics;
}

export interface ProjectSolution {
  kind: 'project';
  cpm: CpmResult;
  pert?: PertResult;
}

export interface FlowShopSolution {
  kind: 'flowshop';
  sequence: string[];
  johnsonSequences: string[][];
  optimalSequences: string[][];
  schedule: Schedule;
  optimal: Rational;
}

export type Solution = BalancingSolution | ProjectSolution | FlowShopSolution;

export function solveBalancing(p: BalancingProblem): BalancingSolution {
  const ruleGiven = p.heuristic !== undefined;
  const heuristic = p.heuristic ?? 'LTT';
  const tieBreak = p.tieBreak ?? 'alpha';
  const heuristicAssignment = assignHeuristic(p, heuristic, tieBreak).stations;
  check(JSON.stringify(heuristicByList(p, heuristic, tieBreak)) === JSON.stringify(heuristicAssignment), 'balancing: A and B assignments differ');
  check(validateAssignment(p, heuristicAssignment).length === 0, 'balancing: heuristic assignment is not valid');
  const optimal = optimalAssignment(p);
  check(validateAssignment(p, optimal).length === 0, 'balancing: optimal assignment is not valid');
  const nOptimal = optimal.length;
  const reference = ruleGiven ? heuristicAssignment : optimal;
  const m = metrics(p, reference);
  check(nOptimal >= m.nMin && heuristicAssignment.length >= nOptimal, 'balancing: N_min ≤ N_opt ≤ N violated');
  check(R.cmp(m.efficiency, R.ONE) <= 0, 'balancing: efficiency > 1');
  const red = new Set(redundantEdges(p.tasks).map(([a, b]) => `${a}>${b}`));
  const edges = p.tasks.flatMap((t) => t.preds.filter((x) => !red.has(`${x}>${t.id}`)).map((x) => [x, t.id] as [string, string]));
  return { kind: 'balancing', edges, nMin: nMin(p), nOptimal, heuristic, tieBreak, ruleGiven, heuristicAssignment, reference, metrics: m };
}

export function solveProject(p: ProjectProblem): ProjectSolution {
  const a = cpm(p);
  const b = cpmAlt(p);
  check(R.eq(a.duration, b.duration), 'cpm: durations differ');
  check(JSON.stringify(a.criticalPaths) === JSON.stringify(b.criticalPaths), 'cpm: critical paths differ');
  for (const r of a.rows) {
    check(R.eq(r.es, b.es.get(r.id)!) && R.eq(r.ls, b.ls.get(r.id)!), `cpm: ES/LS of ${r.id} differ`);
    check(R.sign(r.tf) >= 0, `cpm: negative float for ${r.id}`);
  }
  const usesPert = p.activities.every((x) => x.pert);
  return { kind: 'project', cpm: a, ...(usesPert ? { pert: pert(p) } : {}) };
}

export function solveFlowShop(p: FlowShopProblem): FlowShopSolution {
  const sequence = johnsonSequence(p);
  const js = johnsonSequences(p);
  const b = bruteForce(p);
  for (const s of js) check(R.eq(schedule(p, s).makespan, b.optimal), 'johnson: a Johnson sequence is not optimal');
  const sch = schedule(p, sequence);
  check(R.cmp(sch.makespan, R.max(R.sum(p.jobs.map((j) => j.p1)), R.sum(p.jobs.map((j) => j.p2)))) >= 0, 'johnson: makespan below the bound');
  return { kind: 'flowshop', sequence, johnsonSequences: js, optimalSequences: b.optimalSequences, schedule: sch, optimal: b.optimal };
}

export function solve(p: BalancingProblem): BalancingSolution;
export function solve(p: ProjectProblem): ProjectSolution;
export function solve(p: FlowShopProblem): FlowShopSolution;
export function solve(p: BalancingProblem | ProjectProblem | FlowShopProblem): Solution;
export function solve(p: BalancingProblem | ProjectProblem | FlowShopProblem): Solution {
  switch (p.kind) {
    case 'balancing':
      return solveBalancing(p);
    case 'project':
      return solveProject(p);
    case 'flowshop':
      return solveFlowShop(p);
  }
}
