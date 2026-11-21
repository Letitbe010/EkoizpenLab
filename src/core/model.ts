/**
 * Data model (spec §4). Pure types, no UI.
 *
 * All times are exact Rationals; `unit` is always explicit (spec §3).
 */
import type { Rational } from './rational';

export type TimeUnit = 'min' | 's';

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
  /** Extra parameters of the ask (e.g. which station's efficiency). */
  params?: Record<string, string | number>;
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
}
