/** Grading results → progress attempts, and the labels of ask keys on the progress page. */
import type { GradeResult } from '../core/grader';
import type { Exercise } from '../core/model';
import type { Attempt } from './progress';
import { templateOf } from './describe';
import { variant } from './worked';

type T = (k: string, v?: Record<string, string | number>) => string;

export function attemptsOf(ex: Exercise, res: GradeResult, now = Date.now()): Attempt[] {
  const tpl = templateOf(ex);
  return res.asks.map((r) => {
    const ask = ex.asks.find((a) => a.id === r.id)!;
    return {
      ts: now,
      exercise: ex.id,
      ...(tpl ? { template: tpl } : {}),
      origin: ex.origin,
      level: ex.difficulty,
      ask: variant(ex, ask),
      status: r.status,
      diagnoses: [...new Set(r.items.flatMap((i) => (i.diagnosis ? [i.diagnosis] : [])))],
    };
  });
}

/** Label of an ask key (worked.ts `variant`). */
export function askKeyLabel(key: string, t: T): string {
  if (key === 'efficiency.station') return t('ask.efficiencyLast');
  if (key === 'assignment.rule' || key === 'assignment.free') return `${t('ask.assignment')} (${t(key === 'assignment.rule' ? 'prog.withRule' : 'prog.noRule')})`;
  return t(`ask.${key}`, { t: 't', p: 'P' });
}

/** Theory topic for each kind of mistake (link from the progress page). */
export const DIAG_TOPIC: Record<string, string> = {
  'c-inverted': 'lines',
  'units-mixed': 'lines',
  'nmin-floor': 'balancing',
  'eff-nmin': 'efficiency',
  'eff-bottleneck': 'efficiency',
  'eff-c-base': 'efficiency',
  'precedence-violated': 'balancing',
  'over-c': 'balancing',
  'missing-task': 'balancing',
  'duplicate-task': 'balancing',
  'unknown-task': 'balancing',
  'empty-station': 'balancing',
  'ff-tf-swapped': 'floats',
  'backward-max': 'cpm',
  'sd-summed': 'pert',
  'other-path': 'pert',
  'phi-wrong-side': 'pert',
  'johnson-reversed': 'johnson',
};
