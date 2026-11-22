/**
 * Grader and error diagnosis (spec §8). Deterministic: every answer is compared with the
 * verified solution (solve.ts). A wrong answer is re-checked against the result of each
 * common mistake (spec §8.3); the first hypothesis that matches is reported.
 *
 * Rules approved by the user (2026-11-22):
 *  - times and durations: an exact fraction ("40/3") or a decimal equal to the exact value
 *    rounded to the user's own decimals, with at least 2 decimals ("13,33"); unit selector
 *    (s, min, h) for line balancing, converted before comparing;
 *  - efficiencies in % (or as a fraction), ±0.1 percentage points;
 *  - PERT: te, σ², σ ±0.0005 (3 decimals); probability ±0.005; deadline ±max(0.01·σ, 0.005);
 *  - no carry-forward, except the station-dependent asks (station times, idle time,
 *    efficiencies), graded on the user's own assignment when it is valid (2026-11-21);
 *  - partial credit 0.5 with a note for: valid assignment not following the stated rule;
 *    valid assignment without rule but with more stations than the optimum; optimal
 *    sequence that is not a Johnson sequence;
 *  - an uninterpretable entry is "invalid", never counted as a wrong answer.
 */
import { metrics, sumTimes } from './balancing';
import { validateAssignment } from './balancingExact';
import { successors, topoOrder } from './dag';
import { johnsonSequence, johnsonSequences, schedule } from './johnson';
import type { Ask, Assignment, BalancingProblem, Exercise, FlowShopProblem, ProjectProblem, TimeUnit } from './model';
import { phi, phiInv } from './normal';
import { pertVariance } from './pert';
import * as R from './rational';
import type { Rational } from './rational';
import { solve, type BalancingSolution, type FlowShopSolution, type ProjectSolution } from './solve';

// ------------------------------------------------------------------ input

export type CpmField = 'es' | 'ef' | 'ls' | 'lf' | 'tf' | 'ff';
export const CPM_FIELDS: CpmField[] = ['es', 'ef', 'ls', 'lf', 'tf', 'ff'];

export interface Answer {
  value?: string;
  /** 's' | 'min' | 'h' for times; '%' | 'fraction' for efficiencies and probabilities */
  unit?: string;
  /** stationTimes: one value per station, in line order */
  values?: string[];
  stations?: string[][];
  edges?: [string, string][];
  table?: Record<string, Partial<Record<CpmField, string>>>;
  paths?: string[][];
  sequence?: string[];
  /** pert te: one value per activity */
  perId?: Record<string, string>;
  m1?: string;
  m2?: string;
}

export interface ParsedValue {
  r: Rational;
  /** decimals written by the user; null for a fraction */
  decimals: number | null;
}

/** "13,33", "13.33", "40/3", "−5", " 12 " → exact value. Garbage → null, empty → undefined. */
export function parseUserValue(raw: string | undefined): ParsedValue | null | undefined {
  if (raw === undefined) return undefined;
  const s = raw.trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (s === '') return undefined;
  if (s.includes(',') && s.includes('.')) return null;
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)(\/\d+([.,]\d*)?)?$/.test(s)) return null;
  try {
    const r = R.parse(s);
    const m = /[.,](\d*)/.exec(s);
    return { r, decimals: s.includes('/') ? null : m ? m[1]!.length : 0 };
  } catch {
    return null;
  }
}

const SECONDS: Record<TimeUnit, number> = { s: 1, min: 60, h: 3600 };

// ------------------------------------------------------------------ output

export type Status = 'correct' | 'wrong' | 'missing' | 'invalid';

/** Diagnosis ids (spec §8.3; ids map to eu/es texts in the UI). */
export type DiagnosisId =
  | 'c-inverted'
  | 'units-mixed'
  | 'nmin-floor'
  | 'eff-nmin'
  | 'eff-bottleneck'
  | 'eff-c-base'
  | 'precedence-violated'
  | 'over-c'
  | 'missing-task'
  | 'duplicate-task'
  | 'unknown-task'
  | 'empty-station'
  | 'ff-tf-swapped'
  | 'backward-max'
  | 'sd-summed'
  | 'other-path'
  | 'phi-wrong-side'
  | 'johnson-reversed'
  | 'not-identified';

export type NoteId =
  | 'valid-not-rule'
  | 'valid-not-optimal'
  | 'redundant-edges'
  | 'graded-on-yours'
  | 'graded-on-reference'
  | 'optimal-not-johnson';

export interface ItemResult {
  /** what the item is: 'value', 'station 2', 'C.ls', 'B-D-E', 'm1'... */
  part: string;
  status: Status;
  expected: string;
  given?: string;
  diagnosis?: DiagnosisId;
  /** extra data for the diagnosis text (e.g. the violated precedence) */
  detail?: string;
}

export interface AskResult {
  id: string;
  kind: Ask['kind'];
  status: Status | 'partial';
  /** fraction of the ask's weight earned, 0…1 */
  score: number;
  items: ItemResult[];
  notes: { id: NoteId; detail?: string }[];
}

export interface GradeResult {
  asks: AskResult[];
  /** 0…10, weighted by exercise.weights (default 1 each) */
  score10: number;
}

// ------------------------------------------------------------------ comparison helpers

const S = R.toString;

/** Exact, or equal to the exact value rounded to the user's decimals (≥ 2). */
function sameValue(u: ParsedValue, e: Rational): boolean {
  if (R.eq(u.r, e)) return true;
  return u.decimals !== null && u.decimals >= 2 && R.eq(u.r, R.round(e, u.decimals));
}

interface Hyp<T> {
  id: DiagnosisId;
  value: T;
}

/** Exact time (or duration) item; `scale` converts expected values into the user's unit. */
function timeItem(part: string, raw: string | undefined, e: Rational, scale: Rational, unitLabel: string, hyps: Hyp<Rational>[] = []): ItemResult {
  const ex = R.mul(e, scale);
  const expected = unitLabel ? `${S(ex)} ${unitLabel}` : S(ex);
  const u = parseUserValue(raw);
  if (u === undefined) return { part, status: 'missing', expected };
  if (u === null) return { part, status: 'invalid', expected, given: raw };
  if (sameValue(u, ex)) return { part, status: 'correct', expected, given: raw };
  const hit = hyps.find((h) => !R.eq(h.value, e) && sameValue(u, R.mul(h.value, scale)));
  return { part, status: 'wrong', expected, given: raw, diagnosis: hit?.id ?? 'not-identified' };
}

/** Number item with an absolute tolerance (efficiencies, probabilities, PERT values). */
function numberItem(part: string, raw: string | undefined, e: number, tol: number, factor: number, label: string, digits: number, hyps: Hyp<number>[] = []): ItemResult {
  const expected = `${(e * factor).toFixed(digits)}${label}`;
  const u = parseUserValue(raw);
  if (u === undefined) return { part, status: 'missing', expected };
  if (u === null) return { part, status: 'invalid', expected, given: raw };
  const v = R.toNumber(u.r) / factor;
  const near = (x: number) => Math.abs(v - x) <= tol * (1 + 1e-9) + 1e-12;
  if (near(e)) return { part, status: 'correct', expected, given: raw };
  const hit = hyps.find((h) => !near(e) && Math.abs(h.value - e) > tol && near(h.value));
  return { part, status: 'wrong', expected, given: raw, diagnosis: hit?.id ?? 'not-identified' };
}

function finish(ask: Ask, items: ItemResult[], notes: AskResult['notes'] = [], override?: { status: AskResult['status']; score: number }): AskResult {
  if (override) return { id: ask.id, kind: ask.kind, items, notes, ...override };
  const correct = items.filter((i) => i.status === 'correct').length;
  const score = items.length > 0 ? correct / items.length : 0;
  const st = new Set(items.map((i) => i.status));
  const status: AskResult['status'] =
    st.size === 1 ? items[0]!.status : correct > 0 ? 'partial' : st.has('wrong') ? 'wrong' : st.has('invalid') ? 'invalid' : 'missing';
  return { id: ask.id, kind: ask.kind, status, score, items, notes };
}

const showAssignment = (a: Assignment): string => a.map((s) => s.join(',')).join(' | ');
const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// ------------------------------------------------------------------ line balancing

function timeScale(p: BalancingProblem, unit: string | undefined): Rational | null {
  const uu = (unit ?? p.unit) as TimeUnit;
  if (!(uu in SECONDS)) return null;
  return R.q(SECONDS[p.unit], SECONDS[uu]);
}

const unitsHyps = (e: Rational): Hyp<Rational>[] => [
  { id: 'units-mixed', value: R.mul(e, R.q(60)) },
  { id: 'units-mixed', value: R.div(e, R.q(60)) },
];

/** The assignment the station-dependent asks are graded on, and the note saying which. */
function baseAssignment(p: BalancingProblem, sol: BalancingSolution, user?: Answer): { a: Assignment; note: NoteId } {
  const st = user?.stations;
  if (st && st.length > 0 && validateAssignment(p, st).length === 0) return { a: st, note: 'graded-on-yours' };
  return { a: sol.reference, note: 'graded-on-reference' };
}

function gradeBalancing(ex: Exercise, p: BalancingProblem, sol: BalancingSolution, ask: Ask, ans: Answer | undefined, all: Record<string, Answer>): AskResult {
  const m = sol.metrics;
  switch (ask.kind) {
    case 'cycleTime': {
      const scale = timeScale(p, ans?.unit);
      if (!scale) return finish(ask, [{ part: 'value', status: 'invalid', expected: S(m.c), given: ans?.unit }]);
      const inverted = R.div(R.q(p.demand), p.available);
      // demand / available is not a time: compared as a bare number in the user's unit
      const items = [timeItem('value', ans?.value, m.c, scale, ans?.unit ?? p.unit, unitsHyps(m.c))];
      const u = parseUserValue(ans?.value);
      if (items[0]!.status === 'wrong' && u && sameValue(u, inverted)) items[0]!.diagnosis = 'c-inverted';
      return finish(ask, items);
    }
    case 'nMin': {
      const floor = Number(R.floor(R.div(sumTimes(p.tasks), m.c)));
      return finish(ask, [timeItem('value', ans?.value, R.q(sol.nMin), R.ONE, '', [{ id: 'nmin-floor', value: R.q(floor) }])]);
    }
    case 'precedence':
      return gradePrecedence(p, sol, ask, ans);
    case 'assignment':
      return gradeAssignment(p, sol, ask, ans);
    case 'stationTimes':
    case 'idle':
    case 'efficiency': {
      const assignAsk = ex.asks.find((a) => a.kind === 'assignment');
      const { a, note } = baseAssignment(p, sol, assignAsk ? all[assignAsk.id] : undefined);
      const mm = metrics(p, a);
      const notes = [{ id: note }];
      if (ask.kind === 'stationTimes') {
        const scale = timeScale(p, ans?.unit);
        if (!scale) return finish(ask, [{ part: 'value', status: 'invalid', expected: '', given: ans?.unit }], notes);
        const items = mm.stationTimes.map((t, i) => timeItem(`station ${i + 1}`, ans?.values?.[i], t, scale, ans?.unit ?? p.unit, unitsHyps(t)));
        return finish(ask, items, notes);
      }
      if (ask.kind === 'idle') {
        const scale = timeScale(p, ans?.unit);
        if (!scale) return finish(ask, [{ part: 'value', status: 'invalid', expected: S(mm.idle), given: ans?.unit }], notes);
        return finish(ask, [timeItem('value', ans?.value, mm.idle, scale, ans?.unit ?? p.unit, unitsHyps(mm.idle))], notes);
      }
      // efficiency
      const factor = ans?.unit === 'fraction' ? 1 : 100;
      const label = factor === 100 ? ' %' : '';
      const otherBase = metrics(p, a, mm.baseKind === 'C' ? 'bottleneck' : 'C');
      const baseHyp: DiagnosisId = mm.baseKind === 'C' ? 'eff-bottleneck' : 'eff-c-base';
      if ((ask.scope ?? 'line') === 'line') {
        const nminEff = R.toNumber(R.div(mm.sumT, R.mul(R.q(mm.nMin), mm.base)));
        return finish(
          ask,
          [
            numberItem('line', ans?.value, R.toNumber(mm.efficiency), 0.001, factor, label, factor === 100 ? 2 : 4, [
              { id: 'eff-nmin', value: nminEff },
              { id: baseHyp, value: R.toNumber(otherBase.efficiency) },
            ]),
          ],
          notes,
        );
      }
      const k = ask.station === 'last' || ask.station === undefined ? a.length - 1 : ask.station - 1;
      if (k < 0 || k >= a.length) {
        // the asked station does not exist in this assignment
        return finish(ask, [{ part: `station ${k + 1}`, status: 'invalid', expected: '-' }], notes);
      }
      return finish(
        ask,
        [
          numberItem(`station ${k + 1}`, ans?.value, R.toNumber(mm.stationEfficiency[k]!), 0.001, factor, label, factor === 100 ? 2 : 4, [
            { id: baseHyp, value: R.toNumber(otherBase.stationEfficiency[k]!) },
          ]),
        ],
        notes,
      );
    }
    default:
      throw new Error(`ask ${ask.kind} does not apply to line balancing`);
  }
}

function gradeAssignment(p: BalancingProblem, sol: BalancingSolution, ask: Ask, ans: Answer | undefined): AskResult {
  const expected = showAssignment(sol.reference);
  const st = ans?.stations?.filter((s) => s.length > 0);
  if (!st || st.length === 0) return finish(ask, [{ part: 'assignment', status: 'missing', expected }]);
  const given = showAssignment(st);
  const v = validateAssignment(p, st);
  if (v.length > 0) {
    const items: ItemResult[] = v.map((x) => {
      switch (x.kind) {
        case 'precedence':
          return { part: x.task, status: 'wrong', expected, given, diagnosis: 'precedence-violated', detail: `${x.pred}>${x.task}` };
        case 'overC':
          return { part: `station ${x.station + 1}`, status: 'wrong', expected, given, diagnosis: 'over-c', detail: String(x.station + 1) };
        case 'missing':
          return { part: x.task, status: 'wrong', expected, given, diagnosis: 'missing-task', detail: x.task };
        case 'duplicate':
          return { part: x.task, status: 'wrong', expected, given, diagnosis: 'duplicate-task', detail: x.task };
        case 'unknown':
          return { part: x.task, status: 'invalid', expected, given, diagnosis: 'unknown-task', detail: x.task };
        case 'emptyStation':
          return { part: `station ${x.station + 1}`, status: 'wrong', expected, given, diagnosis: 'empty-station', detail: String(x.station + 1) };
      }
    });
    const invalidOnly = items.every((i) => i.status === 'invalid');
    return finish(ask, items, [], { status: invalidOnly ? 'invalid' : 'wrong', score: 0 });
  }
  if (sol.ruleGiven) {
    const same = st.length === sol.reference.length && st.every((s, i) => sameSet(s, sol.reference[i]!));
    if (same) return finish(ask, [{ part: 'assignment', status: 'correct', expected, given }]);
    const k = st.findIndex((s, i) => !sol.reference[i] || !sameSet(s, sol.reference[i]!));
    const detail = `${k + 1}: ${sol.reference[k]?.join(',') ?? '-'} / ${st[k]!.join(',')}`;
    return finish(ask, [{ part: 'assignment', status: 'wrong', expected, given }], [{ id: 'valid-not-rule', detail }], { status: 'partial', score: 0.5 });
  }
  // no rule: any valid assignment; the number of stations is compared with the optimum
  if (st.length === sol.nOptimal) return finish(ask, [{ part: 'assignment', status: 'correct', expected, given }]);
  return finish(ask, [{ part: 'assignment', status: 'wrong', expected, given }], [{ id: 'valid-not-optimal', detail: String(sol.nOptimal) }], {
    status: 'partial',
    score: 0.5,
  });
}

/** Transitive reduction of a small DAG given as edges; null if there is a cycle. */
function reduce(ids: string[], edges: [string, string][]): [string, string][] | null {
  const nodes = ids.map((id) => ({ id, preds: [...new Set(edges.filter(([, b]) => b === id).map(([a]) => a))] }));
  if (topoOrder(nodes).length !== nodes.length) return null;
  const succ = successors(nodes);
  const reach = (from: string, to: string, skip: string): boolean => {
    const stack = (succ.get(from) ?? []).filter((x) => x !== skip);
    const seen = new Set<string>();
    while (stack.length) {
      const x = stack.pop()!;
      if (x === to) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...(succ.get(x) ?? []));
    }
    return false;
  };
  const uniq = [...new Map(edges.map((e) => [`${e[0]}>${e[1]}`, e])).values()];
  // a→b is redundant if b is reachable from a without using the direct edge
  return uniq.filter(([a, b]) => !reach(a, b, b));
}

function gradePrecedence(p: BalancingProblem, sol: BalancingSolution, ask: Ask, ans: Answer | undefined): AskResult {
  const key = (e: [string, string]) => `${e[0]}>${e[1]}`;
  const exp = new Set(sol.edges.map(key));
  const expected = sol.edges.map((e) => `${e[0]}→${e[1]}`).join(', ');
  const edges = ans?.edges;
  if (!edges || edges.length === 0) return finish(ask, [{ part: 'edges', status: 'missing', expected }]);
  const ids = p.tasks.map((t) => t.id);
  if (edges.some(([a, b]) => !ids.includes(a) || !ids.includes(b) || a === b)) {
    return finish(ask, [{ part: 'edges', status: 'invalid', expected }]);
  }
  const red = reduce(ids, edges);
  if (!red) return finish(ask, [{ part: 'edges', status: 'invalid', expected, detail: 'cycle' }]);
  const got = new Set(red.map(key));
  const items: ItemResult[] = [];
  for (const e of sol.edges) items.push({ part: `${e[0]}→${e[1]}`, status: got.has(key(e)) ? 'correct' : 'wrong', expected: 'yes', given: got.has(key(e)) ? 'yes' : 'no' });
  for (const e of red) if (!exp.has(key(e))) items.push({ part: `${e[0]}→${e[1]}`, status: 'wrong', expected: 'no', given: 'yes' });
  const notes: AskResult['notes'] = red.length < new Set(edges.map(key)).size ? [{ id: 'redundant-edges' }] : [];
  return finish(ask, items, notes);
}

// ------------------------------------------------------------------ projects

function allPaths(p: ProjectProblem): string[][] {
  const succ = successors(p.activities);
  const out: string[][] = [];
  const dfs = (id: string, acc: string[]): void => {
    const next = succ.get(id)!;
    if (next.length === 0) out.push([...acc, id]);
    for (const x of next) dfs(x, [...acc, id]);
  };
  for (const a of p.activities) if (a.preds.length === 0) dfs(a.id, []);
  return out;
}

function gradeProject(p: ProjectProblem, sol: ProjectSolution, ask: Ask, ans: Answer | undefined): AskResult {
  const c = sol.cpm;
  switch (ask.kind) {
    case 'duration':
      return finish(ask, [timeItem('value', ans?.value, c.duration, R.ONE, '')]);
    case 'cpmTable': {
      // backward pass done with max instead of min (diagnosis 5)
      const succ = successors(p.activities);
      const row = new Map(c.rows.map((r) => [r.id, r]));
      const lsMax = new Map<string, Rational>();
      const lfMax = new Map<string, Rational>();
      for (const id of topoOrder(p.activities).reverse()) {
        const ss = succ.get(id)!;
        const f = ss.length === 0 ? c.duration : ss.map((x) => lsMax.get(x)!).reduce(R.max);
        lfMax.set(id, f);
        lsMax.set(id, R.sub(f, row.get(id)!.d));
      }
      const items: ItemResult[] = [];
      for (const r of c.rows) {
        for (const f of CPM_FIELDS) {
          const hyps: Hyp<Rational>[] = [];
          if (f === 'tf') hyps.push({ id: 'ff-tf-swapped', value: r.ff });
          if (f === 'ff') hyps.push({ id: 'ff-tf-swapped', value: r.tf });
          if (f === 'lf') hyps.push({ id: 'backward-max', value: lfMax.get(r.id)! });
          if (f === 'ls') hyps.push({ id: 'backward-max', value: lsMax.get(r.id)! });
          if (f === 'tf') hyps.push({ id: 'backward-max', value: R.sub(lsMax.get(r.id)!, r.es) });
          items.push(timeItem(`${r.id}.${f}`, ans?.table?.[r.id]?.[f], r[f], R.ONE, '', hyps));
        }
      }
      return finish(ask, items);
    }
    case 'criticalPath': {
      const exp = c.criticalPaths.map((x) => x.join('-'));
      const given = (ans?.paths ?? []).filter((x) => x.length > 0).map((x) => x.join('-'));
      if (given.length === 0) return finish(ask, [{ part: 'paths', status: 'missing', expected: exp.join('; ') }]);
      if ((ask.criticalMode ?? 'all') === 'any') {
        const ok = given.every((g) => exp.includes(g));
        return finish(ask, [{ part: 'paths', status: ok ? 'correct' : 'wrong', expected: exp.join('; '), given: given.join('; ') }]);
      }
      const items: ItemResult[] = exp.map((e) => ({ part: e, status: given.includes(e) ? 'correct' : 'wrong', expected: e, given: given.includes(e) ? e : '-' }));
      for (const g of new Set(given)) if (!exp.includes(g)) items.push({ part: g, status: 'wrong', expected: '-', given: g });
      return finish(ask, items);
    }
    case 'pert':
      return gradePert(p, sol, ask, ans);
    default:
      throw new Error(`ask ${ask.kind} does not apply to projects`);
  }
}

function gradePert(p: ProjectProblem, sol: ProjectSolution, ask: Ask, ans: Answer | undefined): AskResult {
  const r = sol.pert;
  if (!r) throw new Error('pert ask on a project without PERT estimates');
  const what = ask.pertWhat ?? 'variance';
  const act = new Map(p.activities.map((a) => [a.id, a]));
  const sdSum = r.path.reduce((s, id) => s + Math.sqrt(R.toNumber(pertVariance(act.get(id)!.pert!))), 0);
  const chosen = r.path.join('-');
  const otherVars = allPaths(p)
    .filter((x) => x.join('-') !== chosen)
    .map((x) => R.toNumber(R.sum(x.map((id) => r.variance.get(id)!))));
  const Te = R.toNumber(r.Te);
  const sigma = r.sigma;
  const pctFactor = ans?.unit === 'fraction' ? 1 : 100;
  const pctLabel = pctFactor === 100 ? ' %' : '';
  switch (what) {
    case 'te':
      return finish(
        ask,
        p.activities.map((a) => numberItem(a.id, ans?.perId?.[a.id], R.toNumber(r.te.get(a.id)!), 0.0005, 1, '', 3)),
      );
    case 'variance':
      return finish(ask, [
        numberItem('value', ans?.value, R.toNumber(r.projectVariance), 0.0005, 1, '', 3, [
          { id: 'sd-summed', value: sdSum * sdSum },
          ...otherVars.map((v) => ({ id: 'other-path' as const, value: v })),
        ]),
      ]);
    case 'sigma':
      return finish(ask, [
        numberItem('value', ans?.value, sigma, 0.0005, 1, '', 3, [
          { id: 'sd-summed', value: sdSum },
          ...otherVars.map((v) => ({ id: 'other-path' as const, value: Math.sqrt(v) })),
        ]),
      ]);
    case 'probability': {
      if (!ask.t) throw new Error('pert probability ask needs t');
      const t = R.toNumber(ask.t);
      const pr = phi((t - Te) / sigma);
      return finish(ask, [
        numberItem('value', ans?.value, pr, 0.005, pctFactor, pctLabel, pctFactor === 100 ? 1 : 3, [
          { id: 'phi-wrong-side', value: 1 - pr },
          { id: 'sd-summed', value: phi((t - Te) / sdSum) },
          ...otherVars.map((v) => ({ id: 'other-path' as const, value: phi((t - Te) / Math.sqrt(v)) })),
        ]),
      ]);
    }
    case 'deadline': {
      if (ask.prob === undefined) throw new Error('pert deadline ask needs prob');
      const z = phiInv(ask.prob);
      const tol = Math.max(0.01 * sigma, 0.005);
      return finish(ask, [
        numberItem('value', ans?.value, Te + z * sigma, tol, 1, '', 2, [
          { id: 'phi-wrong-side', value: Te - z * sigma },
          { id: 'sd-summed', value: Te + z * sdSum },
        ]),
      ]);
    }
  }
}

// ------------------------------------------------------------------ flow shop

function gradeFlowShop(p: FlowShopProblem, sol: FlowShopSolution, ask: Ask, ans: Answer | undefined): AskResult {
  if (ask.kind !== 'johnson') throw new Error(`ask ${ask.kind} does not apply to flow shops`);
  const swapped: FlowShopProblem = { kind: 'flowshop', jobs: p.jobs.map((j) => ({ id: j.id, p1: j.p2, p2: j.p1 })) };
  const reversed = schedule(p, johnsonSequence(swapped));
  const what = ask.johnsonWhat ?? 'sequence';
  if (what === 'makespan') {
    return finish(ask, [timeItem('value', ans?.value, sol.schedule.makespan, R.ONE, '', [{ id: 'johnson-reversed', value: reversed.makespan }])]);
  }
  if (what === 'idle') {
    return finish(ask, [
      timeItem('m1', ans?.m1, sol.schedule.idleM1, R.ONE, '', [{ id: 'johnson-reversed', value: reversed.idleM1 }]),
      timeItem('m2', ans?.m2, sol.schedule.idleM2, R.ONE, '', [{ id: 'johnson-reversed', value: reversed.idleM2 }]),
    ]);
  }
  const expected = sol.sequence.join('-');
  const seq = ans?.sequence?.filter((x) => x !== '');
  if (!seq || seq.length === 0) return finish(ask, [{ part: 'sequence', status: 'missing', expected }]);
  const given = seq.join('-');
  const ids = p.jobs.map((j) => j.id);
  if (seq.length !== ids.length || new Set(seq).size !== seq.length || seq.some((x) => !ids.includes(x))) {
    return finish(ask, [{ part: 'sequence', status: 'invalid', expected, given }]);
  }
  const has = (list: string[][]) => list.some((s) => s.join('-') === given);
  if (has(sol.johnsonSequences)) return finish(ask, [{ part: 'sequence', status: 'correct', expected, given }]);
  if (has(sol.optimalSequences)) {
    return finish(ask, [{ part: 'sequence', status: 'wrong', expected, given }], [{ id: 'optimal-not-johnson' }], { status: 'partial', score: 0.5 });
  }
  const diag: DiagnosisId = has(johnsonSequences(swapped)) ? 'johnson-reversed' : 'not-identified';
  return finish(ask, [{ part: 'sequence', status: 'wrong', expected, given, diagnosis: diag }]);
}

// ------------------------------------------------------------------ entry point

/** Grades every ask of an exercise; score on 0–10 weighted by exercise.weights (spec §8.4). */
export function gradeExercise(ex: Exercise, answers: Record<string, Answer>): GradeResult {
  const p = ex.problem;
  const sol = solve(p);
  const asks = ex.asks.map((ask) => {
    const ans = answers[ask.id];
    if (p.kind === 'balancing') return gradeBalancing(ex, p, sol as BalancingSolution, ask, ans, answers);
    if (p.kind === 'project') return gradeProject(p, sol as ProjectSolution, ask, ans);
    return gradeFlowShop(p, sol as FlowShopSolution, ask, ans);
  });
  let acc = 0;
  let wsum = 0;
  for (const r of asks) {
    const w = ex.weights[r.id] ?? 1;
    wsum += w;
    acc += w * r.score;
  }
  return { asks, score10: wsum > 0 ? (10 * acc) / wsum : 0 };
}
