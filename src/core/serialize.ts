/**
 * JSON <-> model. In JSON every Rational is a string ("12", "5/2", "2,5"), so data files
 * never go through floating point.
 */
import type { Ask, BalancingProblem, Exercise, FlowShopProblem, Problem, ProjectProblem } from './model';
import * as R from './rational';

export interface TaskJson {
  id: string;
  t: string;
  preds: string[];
}
export interface BalancingJson extends Omit<BalancingProblem, 'tasks' | 'available'> {
  tasks: TaskJson[];
  available: string;
}
export interface ProjectJson {
  kind: 'project';
  activities: { id: string; d?: string; pert?: [string, string, string]; preds: string[] }[];
  deadline?: string;
}
export interface FlowShopJson {
  kind: 'flowshop';
  jobs: { id: string; p1: string; p2: string }[];
}
export type ProblemJson = BalancingJson | ProjectJson | FlowShopJson;

export function problemFromJson(j: ProblemJson): Problem {
  switch (j.kind) {
    case 'balancing': {
      const p: BalancingProblem = {
        ...j,
        available: R.parse(j.available),
        tasks: j.tasks.map((t) => ({ id: t.id, t: R.parse(t.t), preds: [...t.preds] })),
      };
      return p;
    }
    case 'project': {
      const p: ProjectProblem = {
        kind: 'project',
        activities: j.activities.map((a) => ({
          id: a.id,
          preds: [...a.preds],
          ...(a.d !== undefined ? { d: R.parse(a.d) } : {}),
          ...(a.pert ? { pert: [R.parse(a.pert[0]), R.parse(a.pert[1]), R.parse(a.pert[2])] as [R.Rational, R.Rational, R.Rational] } : {}),
        })),
        ...(j.deadline !== undefined ? { deadline: R.parse(j.deadline) } : {}),
      };
      return p;
    }
    case 'flowshop': {
      const p: FlowShopProblem = { kind: 'flowshop', jobs: j.jobs.map((x) => ({ id: x.id, p1: R.parse(x.p1), p2: R.parse(x.p2) })) };
      return p;
    }
  }
}

export function balancingToJson(p: BalancingProblem): BalancingJson {
  return { ...p, available: R.toString(p.available), tasks: p.tasks.map((t) => ({ id: t.id, t: R.toString(t.t), preds: [...t.preds] })) };
}

export function problemToJson(p: Problem): ProblemJson {
  switch (p.kind) {
    case 'balancing':
      return balancingToJson(p);
    case 'project':
      return {
        kind: 'project',
        activities: p.activities.map((a) => ({
          id: a.id,
          preds: [...a.preds],
          ...(a.d ? { d: R.toString(a.d) } : {}),
          ...(a.pert ? { pert: a.pert.map(R.toString) as [string, string, string] } : {}),
        })),
        ...(p.deadline ? { deadline: R.toString(p.deadline) } : {}),
      };
    case 'flowshop':
      return { kind: 'flowshop', jobs: p.jobs.map((j) => ({ id: j.id, p1: R.toString(j.p1), p2: R.toString(j.p2) })) };
  }
}

export type AskJson = Omit<Ask, 't'> & { t?: string };
export type ExerciseJson = Omit<Exercise, 'problem' | 'asks'> & { problem: ProblemJson; asks: AskJson[] };

/** Exercise -> JSON with a fixed key order (pool files and seed checks compare strings). */
export function exerciseToJson(e: Exercise): ExerciseJson {
  return {
    id: e.id,
    origin: e.origin,
    ...(e.sourceNote !== undefined ? { sourceNote: e.sourceNote } : {}),
    ...(e.sourceUrl !== undefined ? { sourceUrl: e.sourceUrl } : {}),
    ...(e.seed !== undefined ? { seed: e.seed } : {}),
    difficulty: e.difficulty,
    problem: problemToJson(e.problem),
    asks: e.asks.map((a): AskJson => {
      const { t, ...rest } = a;
      return t ? { ...rest, t: R.toString(t) } : rest;
    }),
    weights: { ...e.weights },
    text: { eu: e.text.eu, es: e.text.es },
    ...(e.review !== undefined ? { review: e.review } : {}),
  };
}

export function exerciseFromJson(j: ExerciseJson): Exercise {
  return {
    ...j,
    problem: problemFromJson(j.problem),
    asks: j.asks.map((a) => {
      const { t, ...rest } = a;
      return t !== undefined ? { ...rest, t: R.parse(t) } : rest;
    }),
  };
}
