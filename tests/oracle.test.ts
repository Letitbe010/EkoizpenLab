/**
 * Compares solvers A and B with the Python oracle (spec §5.4). The oracle output is produced
 * by `npm run oracle:py`; locally the test is skipped if it is missing, in CI
 * (ORACLE_REQUIRED=1) it fails.
 */
import { existsSync, readFileSync } from 'node:fs';
import { assignHeuristic, cycleTime, metrics, nMin, sumTimes } from '../src/core/balancing';
import { heuristicByList, optimalStations } from '../src/core/balancingExact';
import type { BalancingProblem, Heuristic, TieBreak } from '../src/core/model';
import { type BalancingJson, problemFromJson } from '../src/core/serialize';
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

describe('oracle (Python, networkx + fractions)', () => {
  if (!existsSync(OUT)) {
    it(required ? 'oracle output must exist in CI' : 'skipped: run npm run oracle:py first', () => {
      expect(required).toBe(false);
    });
    return;
  }
  const data = JSON.parse(readFileSync(OUT, 'utf-8')) as Record<string, OracleCase>;

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
});
