/**
 * Compares solvers A and B with the Python oracle (spec §5.4). The oracle output is produced
 * by `npm run oracle:py`; locally the test is skipped if it is missing, in CI
 * (ORACLE_REQUIRED=1) it fails.
 */
import { existsSync, readFileSync } from 'node:fs';
import { assignHeuristic, cycleTime, metrics, nMin, sumTimes } from '../src/core/balancing';
import { heuristicByList, optimalStations } from '../src/core/balancingExact';
import { cpm } from '../src/core/cpm';
import { cpmAlt } from '../src/core/cpmAlt';
import { bruteForce, johnsonSequence, johnsonSequences, schedule } from '../src/core/johnson';
import type { BalancingProblem, FlowShopProblem, Heuristic, ProjectProblem, TieBreak } from '../src/core/model';
import { pert, probabilityByDeadline } from '../src/core/pert';
import { type BalancingJson, type FlowShopJson, type ProjectJson, problemFromJson } from '../src/core/serialize';
import { S } from './helpers';

const OUT = 'tools/oracle/out/oracle.json';
const required = process.env.ORACLE_REQUIRED === '1';

interface OracleCase {
  problem: BalancingJson;
  c: string;
  sumT: string;
  nMin: number;
  nOptimal: number;
  assignments: Record<string, { stations: string[][]; efficiency: string }>;
}
interface ProjectCase {
  problem: ProjectJson;
  duration: string;
  criticalPaths: string[][];
  es: Record<string, string>;
  ls: Record<string, string>;
  tf: Record<string, string>;
  projectVariance?: string;
  probability?: number;
}
interface FlowShopCase {
  problem: FlowShopJson;
  optimal: string;
  optimalSequences: string[][];
  johnsonUV: string[];
}
interface OracleOut {
  balancing: Record<string, OracleCase>;
  project: Record<string, ProjectCase>;
  flowshop: Record<string, FlowShopCase>;
}

describe('oracle (Python, networkx + fractions)', () => {
  if (!existsSync(OUT)) {
    it(required ? 'oracle output must exist in CI' : 'skipped: run npm run oracle:py first', () => {
      expect(required).toBe(false);
    });
    return;
  }
  const all = JSON.parse(readFileSync(OUT, 'utf-8')) as OracleOut;
  const data = all.balancing;

  it('covers the golden case, the OPE case and 200 random cases', () => {
    expect(Object.keys(data)).toContain('EG1');
    expect(Object.keys(data)).toContain('euskadi2020-6');
    expect(Object.keys(data).length).toBeGreaterThanOrEqual(202);
  });

  it('A = B = oracle on C, N_min, N optimal and every heuristic assignment', () => {
    for (const [key, o] of Object.entries(data)) {
      const p = problemFromJson(o.problem) as BalancingProblem;
      expect(S(cycleTime(p)), key).toBe(o.c);
      expect(S(sumTimes(p.tasks)), key).toBe(o.sumT);
      expect(nMin(p), key).toBe(o.nMin);
      expect(optimalStations(p), key).toBe(o.nOptimal);
      for (const [hk, a] of Object.entries(o.assignments)) {
        const [h, tie] = hk.split('/') as [Heuristic, TieBreak];
        const st = assignHeuristic(p, h, tie).stations;
        expect(st, `${key} ${hk}`).toEqual(a.stations);
        expect(heuristicByList(p, h, tie), `${key} ${hk} (B)`).toEqual(a.stations);
        expect(S(metrics(p, st, 'C').efficiency), `${key} ${hk}`).toBe(a.efficiency);
      }
    }
  });

  it('covers the project golden cases and the random projects and flow shops', () => {
    expect(Object.keys(all.project)).toEqual(expect.arrayContaining(['EG2', 'EG4']));
    expect(Object.keys(all.flowshop)).toContain('EG3');
    expect(Object.keys(all.project).length).toBeGreaterThanOrEqual(402);
    expect(Object.keys(all.flowshop).length).toBeGreaterThanOrEqual(201);
  });

  it('CPM / PERT: A = B = oracle (duration, critical paths, ES, LS, TF, variance, probability)', () => {
    for (const [key, o] of Object.entries(all.project)) {
      const p = problemFromJson(o.problem) as ProjectProblem;
      const a = cpm(p);
      const b = cpmAlt(p);
      expect(S(a.duration), key).toBe(o.duration);
      expect(S(b.duration), key).toBe(o.duration);
      expect(a.criticalPaths, key).toEqual(o.criticalPaths);
      expect(b.criticalPaths, key).toEqual(o.criticalPaths);
      for (const r of a.rows) {
        expect([S(r.es), S(r.ls), S(r.tf)], `${key} ${r.id}`).toEqual([o.es[r.id], o.ls[r.id], o.tf[r.id]]);
      }
      if (o.projectVariance !== undefined) {
        const r = pert(p);
        expect(S(r.projectVariance), key).toBe(o.projectVariance);
        if (o.probability !== undefined && p.deadline) {
          const pr = probabilityByDeadline(r.Te, r.projectVariance, p.deadline);
          expect(Math.abs(pr.p - o.probability), key).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('Johnson: every Johnson sequence optimal; brute force = oracle; U/V form is a Johnson sequence', () => {
    for (const [key, o] of Object.entries(all.flowshop)) {
      const p = problemFromJson(o.problem) as FlowShopProblem;
      const b = bruteForce(p);
      expect(S(b.optimal), key).toBe(o.optimal);
      expect(b.optimalSequences, key).toEqual(o.optimalSequences);
      const js = johnsonSequences(p);
      expect(js, key).toContainEqual(o.johnsonUV);
      expect(js, key).toContainEqual(johnsonSequence(p));
      for (const s of js) expect(S(schedule(p, s).makespan), key).toBe(o.optimal);
    }
  });
});
