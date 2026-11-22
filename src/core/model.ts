/**
 * Data model (spec §4). Pure types, no UI.
 *
 * All times are exact Rationals; `unit` is always explicit (spec §3).
 */
import type { Rational } from './rational';

export type TimeUnit = 'min' | 's' | 'h';

export interface Task {
  id: string;
  t: Rational;
  preds: string[];
}

/** Assignment rules for line balancing (spec §3, "Esleipen-arauak"). */
export type Heuristic = 'LTT' | 'mostFollowers' | 'RPW';
export type TieBreak = 'alpha' | 'shortest' | 'mostFollowers';
/** Efficiency base: the cycle time C (default) or the bottleneck station time. */
export type EfficiencyBase = 'C' | 'bottleneck';

export interface BalancingProblem {
  kind: 'balancing';
  tasks: Task[];
  /** Available time per period (shift × hours − breaks), in `unit`. */
  available: Rational;
  /** Units to produce in that period. */
  demand: number;
  unit: TimeUnit;
  /** If absent, any valid assignment is accepted (spec §8.2). */
  heuristic?: Heuristic;
  /** Default 'alpha'. */
  tieBreak?: TieBreak;
  /** Default 'C'. */
  efficiencyBase?: EfficiencyBase;
}

export interface Activity {
  id: string;
  d?: Rational;
  /** PERT estimates (a, m, b). */
  pert?: [Rational, Rational, Rational];
  preds: string[];
}

export interface ProjectProblem {
  kind: 'project';
  activities: Activity[];
  deadline?: Rational;
}

export interface Job {
  id: string;
  p1: Rational;
  p2: Rational;
}

export interface FlowShopProblem {
  kind: 'flowshop';
  jobs: Job[];
}

export type Problem = BalancingProblem | ProjectProblem | FlowShopProblem;

/** A balancing assignment: stations in line order, each a list of task ids. */
export type Assignment = string[][];

export type AskKind =
  | 'precedence'
  | 'cycleTime'
  | 'nMin'
  | 'assignment'
  | 'stationTimes'
  | 'idle'
  | 'efficiency'
  | 'cpmTable'
  | 'criticalPath'
  | 'duration'
  | 'pert'
  | 'johnson';

export interface Ask {
  id: string;
  kind: AskKind;
  /** efficiency: the whole line (default) or one station. */
  scope?: 'line' | 'station';
  /** efficiency of one station: 1-based index or the last one. */
  station?: number | 'last';
  /** criticalPath with several critical paths: give all of them (default) or any one. */
  criticalMode?: 'all' | 'any';
  /** pert: which result is asked. */
  pertWhat?: 'te' | 'variance' | 'sigma' | 'probability' | 'deadline';
  /** pert probability: P(T ≤ t) for this t. */
  t?: Rational;
  /** pert deadline: the t with P(T ≤ t) = prob (0…1). */
  prob?: number;
  /** johnson: which result is asked. */
  johnsonWhat?: 'sequence' | 'makespan' | 'idle';
}

export interface Exercise {
  id: string;
  origin: 'ope' | 'adapted' | 'generated';
  sourceNote?: string;
  sourceUrl?: string;
  seed?: number;
  difficulty: 1 | 2 | 3;
  problem: Problem;
  asks: Ask[];
  weights: Record<string, number>;
  text: { eu: string; es: string };
  /** pool entries: 'review-needed' until the user approves them (spec §9.1) */
  review?: 'review-needed' | 'approved';
}
