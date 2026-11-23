/**
 * Worked exercises (spec §15): steps built at run time from a verified pool exercise.
 * Each step has three layers: what (the calculation; every number comes from the solvers via
 * solutionLines), why (the reason) and careful (the usual mistake, matching a grader
 * diagnosis). The text templates contain no numbers (tests/worked.test.ts).
 */
import { assignHeuristic, metrics } from '../core/balancing';
import { gradeExercise } from '../core/grader';
import type { Ask, Exercise } from '../core/model';
import * as R from '../core/rational';
import { solve } from '../core/solve';
import raw from '../data/worked.json';
import { askLabel } from './describe';
import { fmtPct, fmtR, showGraded } from './format';
import { solutionLines } from './solution';

type T = (k: string, v?: Record<string, string | number>) => string;

export interface WorkedEntry {
  id: string;
  pool: string;
  /** subset of the pool exercise's asks (default: all) */
  asks?: string[];
  extra?: 'compareHeuristics' | 'gantt';
  nowYou: { template: string; level: number };
  title: { eu: string; es: string };
  review?: 'draft' | 'reviewed';
}
export const WORKED: WorkedEntry[] = raw.worked as WorkedEntry[];

export interface WStep {
  key: string;
  title: string;
  what: string[];
  why?: string;
  careful?: string;
  /** draw the exercise's figures under this step */
  figures?: boolean;
  /** theory topic for the "why" layer */
  topic?: string;
}

/** Theory topic of each explanation (only topics that exist are linked). */
const TOPIC: Record<string, string> = {
  precedence: 'precedence',
  cycleTime: 'lines',
  nMin: 'balancing',
  'assignment.rule': 'balancing',
  'assignment.free': 'balancing',
  stationTimes: 'efficiency',
  idle: 'efficiency',
  efficiency: 'efficiency',
  'efficiency.station': 'efficiency',
  cpmTable: 'floats',
  criticalPath: 'cpm',
  duration: 'cpm',
};

/** Explanation key of an ask: its kind plus what distinguishes it. */
export function variant(ex: Exercise, ask: Ask): string {
  switch (ask.kind) {
    case 'efficiency':
      return (ask.scope ?? 'line') === 'line' ? 'efficiency' : 'efficiency.station';
    case 'assignment':
      return ex.problem.kind === 'balancing' && ex.problem.heuristic ? 'assignment.rule' : 'assignment.free';
    case 'pert':
      return `pert.${ask.pertWhat ?? 'variance'}`;
    case 'johnson':
      return `johnson.${ask.johnsonWhat ?? 'sequence'}`;
    default:
      return ask.kind;
  }
}

const has = (t: T, key: string): string | undefined => {
  const v = t(key);
  return v === key ? undefined : v;
};

/** The asks a worked exercise explains. */
export const workedAsks = (ex: Exercise, w: WorkedEntry): Ask[] => (w.asks ? ex.asks.filter((a) => w.asks!.includes(a.id)) : ex.asks);

function readStep(ex: Exercise, t: T): WStep {
  const p = ex.problem;
  const what: string[] = [];
  if (p.kind === 'balancing') {
    what.push(t('wk.read.balancing', { n: p.tasks.length, u: p.unit }));
    what.push(`${t('sol.available')} = ${fmtR(p.available)} ${p.unit} · ${t('sol.demand')} = ${p.demand} u`);
  } else if (p.kind === 'project') {
    what.push(t(p.activities[0]?.pert ? 'wk.read.pert' : 'wk.read.cpm', { n: p.activities.length }));
  } else {
    what.push(t('wk.read.flowshop', { n: p.jobs.length }));
  }
  return { key: 'read', title: t('wk.read.title'), what, why: t(`wk.read.why.${p.kind}`) };
}

function compareStep(ex: Exercise, t: T): WStep {
  const p = ex.problem;
  if (p.kind !== 'balancing') throw new Error('compareHeuristics needs line balancing');
  const sol = solve(p);
  const line = (h: 'LTT' | 'mostFollowers' | 'RPW') => {
    const a = assignHeuristic(p, h, p.tieBreak ?? 'alpha').stations;
    const m = metrics(p, a);
    return `${t(`heur.${h}`)}: ${a.map((s) => s.join(',')).join(' | ')} → N = ${a.length}, η = ${fmtPct(m.efficiency)}`;
  };
  return {
    key: 'compare',
    title: t('wk.compare.title'),
    what: [line('LTT'), line('mostFollowers'), line('RPW'), t('wk.compare.optimal', { n: sol.kind === 'balancing' ? sol.nOptimal : 0 })],
    why: t('wk.why.compare'),
    careful: t('wk.careful.compare'),
  };
}

function ganttStep(ex: Exercise, t: T): WStep {
  const sol = solve(ex.problem);
  if (sol.kind !== 'project') throw new Error('gantt needs a project');
  return {
    key: 'gantt',
    title: t('chart.gantt'),
    what: sol.cpm.rows.map((r) => `${r.id}: ${fmtR(r.es)} → ${fmtR(r.ef)}${R.isZero(r.tf) ? ` (${t('legend.critical')})` : ` · ${t('legend.slack')} ${fmtR(r.ef)} → ${fmtR(r.lf)}`}`),
    why: t('wk.why.gantt'),
    careful: t('wk.careful.gantt'),
    figures: true,
  };
}

/** One line per ask with the final answer, taken from the grader's expected values. */
export function summaryLines(ex: Exercise, asks: Ask[], t: T): string[] {
  const res = gradeExercise(ex, {});
  return asks.map((ask) => {
    const r = res.asks.find((x) => x.id === ask.id)!;
    const items = r.items;
    const label = askLabel(ask, t);
    if (items.length === 1) return `${label}: ${showGraded(items[0]!.expected)}`;
    if (ask.kind === 'stationTimes') return `${label}: ${items.map((i) => showGraded(i.expected)).join(' · ')}`;
    return `${label}: ${t('wk.summary.seeStep')}`;
  });
}

export function buildWorked(ex: Exercise, w: WorkedEntry, t: T): WStep[] {
  const asks = workedAsks(ex, w);
  const steps: WStep[] = [readStep(ex, t)];
  for (const ask of asks) {
    const v = variant(ex, ask);
    const why = has(t, `wk.why.${v}`);
    const careful = has(t, `wk.careful.${v}`);
    steps.push({
      key: ask.id,
      title: askLabel(ask, t),
      what: solutionLines(ex, ask, t),
      ...(why ? { why } : {}),
      ...(careful ? { careful } : {}),
      ...(TOPIC[v] ? { topic: TOPIC[v] } : {}),
    });
  }
  if (w.extra === 'compareHeuristics') steps.push(compareStep(ex, t));
  if (w.extra === 'gantt') steps.push(ganttStep(ex, t));
  steps.push({ key: 'summary', title: t('wk.summary.title'), what: summaryLines(ex, asks, t), figures: !w.extra || w.extra !== 'gantt' });
  return steps;
}
