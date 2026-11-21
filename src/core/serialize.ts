/**
 * JSON <-> model. In JSON every Rational is a string ("12", "5/2", "2,5"), so data files
 * never go through floating point.
 */
import type { BalancingProblem, FlowShopProblem, Problem, ProjectProblem } from './model';
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
