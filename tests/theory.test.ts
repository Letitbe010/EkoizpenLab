/**
 * Theory (spec §14.3):
 *  - every topic in both languages; the ids list used by worked exercises matches;
 *  - no hand-written numbers in the prose (examples use solver variables);
 *  - every example fills in both languages from its pool exercise;
 *  - every formula marked `check` is compared with the solvers on 1000 random cases.
 */
import fc from 'fast-check';
import { TOPIC_IDS } from '../src/content/theory/ids';
import { TOPICS } from '../src/content/theory/topics';
import type { FormulaId } from '../src/content/theory/types';
import { assignHeuristic, cycleTime, metrics, nMin, priorities, sumTimes } from '../src/core/balancing';
import { cpm } from '../src/core/cpm';
import { successors } from '../src/core/dag';
import * as R from '../src/core/rational';
import { poolById } from '../src/data/pool';
import { translate } from '../src/i18n';
import { fillTemplate } from '../src/ui/theoryTemplate';
import { arbBalancing, arbProject } from './helpers';

const RUNS = { numRuns: 1000 };

const CHECKS: Record<FormulaId, () => void> = {
  'cycle-time': () =>
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.integer({ min: 1, max: 5000 }), (a, d) => {
        expect(R.eq(cycleTime({ available: R.q(a), demand: d }), R.q(a, d))).toBe(true);
      }),
      RUNS,
    ),
  'n-min': () =>
    fc.assert(
      fc.property(arbBalancing(10), (p) => {
        const ratio = R.div(sumTimes(p.tasks), cycleTime(p));
        // smallest integer ≥ Σt / C, found by counting up (independent of R.ceil)
        let n = 0;
        while (R.lt(R.q(n), ratio)) n++;
        expect(nMin(p)).toBe(n);
      }),
      RUNS,
    ),
  rpw: () =>
    fc.assert(
      fc.property(arbBalancing(10), (p) => {
        const succ = successors(p.tasks);
        const pw = priorities(p.tasks, 'RPW').rpw;
        for (const task of p.tasks) {
          const seen = new Set<string>();
          const stack = [...succ.get(task.id)!];
          while (stack.length) {
            const x = stack.pop()!;
            if (!seen.has(x)) {
              seen.add(x);
              stack.push(...succ.get(x)!);
            }
          }
          const expected = R.add(task.t, R.sum(p.tasks.filter((x) => seen.has(x.id)).map((x) => x.t)));
          expect(R.eq(pw.get(task.id)!, expected)).toBe(true);
        }
      }),
      RUNS,
    ),
  efficiency: () =>
    fc.assert(
      fc.property(arbBalancing(10), (p) => {
        const st = assignHeuristic(p, 'LTT').stations;
        const m = metrics(p, st);
        const eta = R.div(sumTimes(p.tasks), R.mul(R.q(st.length), cycleTime(p)));
        expect(R.eq(m.efficiency, eta)).toBe(true);
        expect(R.eq(m.balanceDelay, R.sub(R.ONE, eta))).toBe(true);
      }),
      RUNS,
    ),
  idle: () =>
    fc.assert(
      fc.property(arbBalancing(10), (p) => {
        const st = assignHeuristic(p, 'RPW').stations;
        expect(R.eq(metrics(p, st).idle, R.sub(R.mul(R.q(st.length), cycleTime(p)), sumTimes(p.tasks)))).toBe(true);
      }),
      RUNS,
    ),
  'station-efficiency': () =>
    fc.assert(
      fc.property(arbBalancing(10), (p) => {
        const st = assignHeuristic(p, 'mostFollowers').stations;
        const m = metrics(p, st);
        const time = new Map(p.tasks.map((x) => [x.id, x.t]));
        st.forEach((s, k) => expect(R.eq(m.stationEfficiency[k]!, R.div(R.sum(s.map((id) => time.get(id)!)), cycleTime(p)))).toBe(true));
      }),
      RUNS,
    ),
  'cpm-forward': () =>
    fc.assert(
      fc.property(arbProject(10), (p) => {
        const rows = new Map(cpm(p).rows.map((r) => [r.id, r]));
        for (const a of p.activities) {
          const es = a.preds.reduce((m, x) => R.max(m, rows.get(x)!.ef), R.ZERO);
          expect(R.eq(rows.get(a.id)!.es, es)).toBe(true);
          expect(R.eq(rows.get(a.id)!.ef, R.add(es, a.d!))).toBe(true);
        }
      }),
      RUNS,
    ),
  'cpm-backward': () =>
    fc.assert(
      fc.property(arbProject(10), (p) => {
        const res = cpm(p);
        const rows = new Map(res.rows.map((r) => [r.id, r]));
        const succ = successors(p.activities);
        for (const a of p.activities) {
          const ss = succ.get(a.id)!;
          const lf = ss.length === 0 ? res.duration : ss.map((x) => rows.get(x)!.ls).reduce(R.min);
          expect(R.eq(rows.get(a.id)!.lf, lf)).toBe(true);
          expect(R.eq(rows.get(a.id)!.ls, R.sub(lf, a.d!))).toBe(true);
        }
      }),
      RUNS,
    ),
  floats: () =>
    fc.assert(
      fc.property(arbProject(10), (p) => {
        const res = cpm(p);
        const rows = new Map(res.rows.map((r) => [r.id, r]));
        const succ = successors(p.activities);
        for (const r of res.rows) {
          expect(R.eq(r.tf, R.sub(r.ls, r.es))).toBe(true);
          expect(R.eq(r.tf, R.sub(r.lf, r.ef))).toBe(true);
          const ss = succ.get(r.id)!;
          const minEs = ss.length === 0 ? res.duration : ss.map((x) => rows.get(x)!.es).reduce(R.min);
          expect(R.eq(r.ff, R.sub(minEs, r.ef))).toBe(true);
        }
      }),
      RUNS,
    ),
};

function hardNumbers(s: string): string[] {
  // the constant 0 is a rule (HT = 0, starts at 0), not data
  return s.replace(/\{\{[^}]+\}\}/g, '').replace(/\b0\b/g, '').match(/\d+/g) ?? [];
}

describe('theory topics', () => {
  it('ids list matches the topics', () => expect(TOPIC_IDS).toEqual(TOPICS.map((t) => t.id)));

  it.each(TOPICS.map((tp) => [tp.id, tp] as const))('%s: both languages, no hand-written numbers, examples fill', (_id, tp) => {
    expect(tp.title.eu && tp.title.es).toBeTruthy();
    for (const b of tp.blocks) {
      if (b.t === 'p' || b.t === 'h' || b.t === 'note' || b.t === 'example') {
        expect(b.eu.length > 0 && b.es.length > 0).toBe(true);
        expect(hardNumbers(b.eu), b.eu).toEqual([]);
        expect(hardNumbers(b.es), b.es).toEqual([]);
      }
      if (b.t === 'list') {
        expect(b.eu.length).toBe(b.es.length);
        for (const x of [...b.eu, ...b.es]) expect(hardNumbers(x), x).toEqual([]);
      }
      if (b.t === 'f' && /\\text\{/.test(b.tex)) expect(b.texEs, `Spanish formula for ${b.tex}`).toBeTruthy();
      if (b.t === 'example') {
        const ex = poolById(b.pool);
        expect(ex, b.pool).toBeDefined();
        for (const lang of ['eu', 'es'] as const) {
          const out = fillTemplate(b[lang], ex!, (k, v) => translate(lang, k, v));
          expect(out).not.toMatch(/\{\{|NaN|undefined/);
        }
      }
    }
  });

  const checked = [...new Set(TOPICS.flatMap((tp) => tp.blocks.flatMap((b) => (b.t === 'f' && b.check ? [b.check] : []))))];
  it('every formula id is used', () => expect(checked.sort()).toEqual((Object.keys(CHECKS) as FormulaId[]).sort()));
  it.each(checked)('formula %s = solvers (1000 random cases)', (id) => CHECKS[id]());
});
