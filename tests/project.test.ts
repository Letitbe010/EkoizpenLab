import fc from 'fast-check';
import { cpm } from '../src/core/cpm';
import { cpmAlt } from '../src/core/cpmAlt';
import type { ProjectProblem } from '../src/core/model';
import { deadlineForProbability, pert, pertVariance, probabilityByDeadline } from '../src/core/pert';
import * as R from '../src/core/rational';
import { S, arbProject } from './helpers';

const act = (id: string, d: number, preds: string[] = []) => ({ id, d: R.q(d), preds });
const pa = (id: string, a: number, m: number, b: number, preds: string[] = []) => ({
  id,
  preds,
  pert: [R.q(a), R.q(m), R.q(b)] as [R.Rational, R.Rational, R.Rational],
});

describe('cpm: details', () => {
  it('free float: min ES of successors − EF; T − EF at the end', () => {
    // A 3 → C 2 → E 3; B 4 → D 5 → E; A → D (EG2)
    const p: ProjectProblem = { kind: 'project', activities: [act('A', 3), act('B', 4), act('C', 2, ['A']), act('D', 5, ['A', 'B']), act('E', 3, ['C', 'D'])] };
    const r = Object.fromEntries(cpm(p).rows.map((x) => [x.id, x]));
    expect(S(r.A!.ff)).toBe('0'); // min(ES C 3, ES D 4) − EF 3
    expect(S(r.C!.ff)).toBe('4'); // ES E 9 − EF 5
    expect(S(r.E!.ff)).toBe('0');
    expect([S(r.D!.es), S(r.D!.ef), S(r.D!.ls), S(r.D!.lf)]).toEqual(['4', '9', '4', '9']);
    expect([S(r.C!.es), S(r.C!.ef), S(r.C!.ls), S(r.C!.lf)]).toEqual(['3', '5', '7', '9']);
  });

  it('terminal non-critical activity: FF = T − EF', () => {
    const p: ProjectProblem = { kind: 'project', activities: [act('A', 5), act('B', 2)] };
    const b = cpm(p).rows.find((x) => x.id === 'B')!;
    expect(S(b.ff)).toBe('3');
    expect(S(b.tf)).toBe('3');
  });

  it('two critical paths are both reported', () => {
    const p: ProjectProblem = { kind: 'project', activities: [act('A', 2), act('B', 3, ['A']), act('C', 3, ['A']), act('D', 1, ['B', 'C'])] };
    expect(cpm(p).criticalPaths).toEqual([['A', 'B', 'D'], ['A', 'C', 'D']]);
    expect(cpmAlt(p).criticalPaths).toEqual([['A', 'B', 'D'], ['A', 'C', 'D']]);
  });

  it('rejects cycles and non-positive durations', () => {
    expect(() => cpm({ kind: 'project', activities: [act('A', 1, ['B']), act('B', 1, ['A'])] })).toThrow();
    expect(() => cpm({ kind: 'project', activities: [act('A', 0)] })).toThrow();
  });
});

describe('pert: details', () => {
  it('Madrid OPE 2022, exercise 7 (pool candidate, user still to verify)', () => {
    const p: ProjectProblem = {
      kind: 'project',
      activities: [
        pa('A', 4, 6, 8), pa('B', 5, 7, 15, ['A']), pa('C', 4, 8, 12, ['A']), pa('D', 15, 20, 25, ['B']), pa('E', 10, 18, 26, ['B']),
        pa('F', 8, 9, 16, ['C']), pa('G', 4, 8, 12, ['E']), pa('H', 1, 2, 3, ['D', 'F']), pa('I', 6, 7, 8, ['G', 'H']),
      ],
    };
    const r = pert(p);
    expect(Object.fromEntries([...r.te].map(([k, v]) => [k, S(v)]))).toEqual({ A: '6', B: '8', C: '8', D: '20', E: '18', F: '10', G: '8', H: '2', I: '7' });
    expect(S(r.Te)).toBe('47');
    expect(r.criticalPaths).toEqual([['A', 'B', 'E', 'G', 'I']]);
    expect(S(r.projectVariance)).toBe('110/9'); // 12.222
    expect(r.sigma.toFixed(3)).toBe('3.496');
  });

  it('several critical paths: the largest variance is used', () => {
    const p: ProjectProblem = { kind: 'project', activities: [pa('A', 1, 2, 3), pa('B', 0, 2, 4)] };
    const r = pert(p);
    expect(r.criticalPaths.length).toBe(2);
    expect(r.path).toEqual(['B']);
    expect(S(r.projectVariance)).toBe('4/9');
  });

  it('variance of an activity and inverse problem', () => {
    expect(S(pertVariance([R.q(3), R.q(5), R.q(13)]))).toBe('25/9');
    const t = deadlineForProbability(R.q(16), R.q(11, 3), 0.9);
    expect(probabilityByDeadline(R.q(16), R.q(11, 3), R.parse(t.toFixed(12))).p).toBeCloseTo(0.9, 9);
  });
});

describe('cpm: A = B and global checks (property-based)', () => {
  it('A and B agree on duration, critical paths, ES, LS and TF; TF ≥ 0; 0 ≤ FF ≤ TF', () => {
    fc.assert(
      fc.property(arbProject(10), (p) => {
        const a = cpm(p);
        const b = cpmAlt(p);
        expect(R.eq(a.duration, b.duration)).toBe(true);
        expect(a.criticalPaths).toEqual(b.criticalPaths);
        expect(a.criticalPaths.length).toBeGreaterThan(0);
        for (const r of a.rows) {
          expect(S(r.es)).toBe(S(b.es.get(r.id)!));
          expect(S(r.ls)).toBe(S(b.ls.get(r.id)!));
          expect(S(r.tf)).toBe(S(b.tf.get(r.id)!));
          expect(R.sign(r.tf)).toBeGreaterThanOrEqual(0);
          expect(R.sign(r.ff)).toBeGreaterThanOrEqual(0);
          expect(R.cmp(r.ff, r.tf)).toBeLessThanOrEqual(0);
        }
        // critical path length = project duration
        const d = new Map(a.rows.map((r) => [r.id, r.d]));
        for (const path of a.criticalPaths) expect(R.eq(R.sum(path.map((id) => d.get(id)!)), a.duration)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('lengthening a non-critical activity up to its total float keeps the duration; one more unit adds one', () => {
    fc.assert(
      fc.property(arbProject(9), (p) => {
        const a = cpm(p);
        for (const r of a.rows.filter((x) => !x.critical)) {
          const grow = (k: R.Rational): ProjectProblem => ({
            ...p,
            activities: p.activities.map((x) => (x.id === r.id ? { ...x, d: R.add(x.d!, k) } : x)),
          });
          expect(R.eq(cpm(grow(r.tf)).duration, a.duration)).toBe(true);
          expect(R.eq(cpm(grow(R.add(r.tf, R.ONE))).duration, R.add(a.duration, R.ONE))).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('PERT: te-based CPM of A equals B, and project variance = Σ variances of the chosen path', () => {
    fc.assert(
      fc.property(arbProject(9, true), (p) => {
        const r = pert(p);
        const b = cpmAlt(p);
        expect(R.eq(r.Te, b.duration)).toBe(true);
        expect(r.criticalPaths).toEqual(b.criticalPaths);
        const vs = b.criticalPaths.map((path) => R.sum(path.map((id) => pertVariance(p.activities.find((x) => x.id === id)!.pert!))));
        expect(R.eq(r.projectVariance, vs.reduce(R.max))).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
